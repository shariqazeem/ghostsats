/// A Note represents a user's private deposit.
/// This struct lives OFF-CHAIN. Only the commitment hash is stored on-chain.
///
/// commitment = pedersen(pedersen(amount.low, amount.high), pedersen(secret, blinder))
///
/// - amount: The USDC deposit amount (u256 for ERC20 compatibility)
/// - secret: Random secret known only to the depositor
/// - blinder: Random blinding factor for the commitment
#[derive(Drop, Copy, Serde)]
pub struct Note {
    pub amount: u256,
    pub secret: felt252,
    pub blinder: felt252,
}

use starknet::ContractAddress;
use ghost_sats::BatchResult;

#[starknet::interface]
pub trait IShieldedPool<TContractState> {
    /// Deposit USDC into the Ghost Batch with a Pedersen commitment.
    fn deposit(ref self: TContractState, commitment: felt252, amount: u256);

    /// Execute the current batch: approve Ekubo, swap USDC -> WBTC, record result.
    fn execute_batch(ref self: TContractState);

    /// Withdraw WBTC by proving ownership of a note in a finalized batch.
    /// Pre-ZK: secret is passed directly. Will be replaced with a ZK proof.
    fn withdraw(
        ref self: TContractState,
        amount: u256,
        secret: felt252,
        blinder: felt252,
        recipient: ContractAddress,
    );

    /// Check if a commitment exists in the pool.
    fn is_commitment_valid(self: @TContractState, commitment: felt252) -> bool;

    /// Check if a nullifier has been spent.
    fn is_nullifier_spent(self: @TContractState, nullifier: felt252) -> bool;

    /// View: total USDC waiting in the current batch.
    fn get_pending_usdc(self: @TContractState) -> u256;

    /// View: number of deposits in the current batch.
    fn get_batch_count(self: @TContractState) -> u32;

    /// View: current batch ID.
    fn get_current_batch_id(self: @TContractState) -> u64;

    /// View: result of a finalized batch.
    fn get_batch_result(self: @TContractState, batch_id: u64) -> BatchResult;
}

#[starknet::contract]
pub mod ShieldedPool {
    use core::pedersen::PedersenTrait;
    use core::hash::HashStateTrait;
    use starknet::{ContractAddress, get_caller_address, get_contract_address, get_block_timestamp};
    use starknet::storage::{
        StoragePointerReadAccess, StoragePointerWriteAccess, Map, StoragePathEntry,
    };
    use openzeppelin_interfaces::token::erc20::{IERC20Dispatcher, IERC20DispatcherTrait};
    use ghost_sats::BatchResult;
    use ghost_sats::ekubo_interface::{IEkuboRouterDispatcher, IEkuboRouterDispatcherTrait, SwapParams};

    // ========================================
    // Storage
    // ========================================

    #[storage]
    struct Storage {
        // ---- Privacy Layer ----
        // Commitment set: hash -> true. NO public balance mapping.
        commitments: Map<felt252, bool>,
        // Nullifier set: prevents double-withdrawal
        nullifiers: Map<felt252, bool>,
        // Maps each commitment to the batch it belongs to
        commitment_to_batch: Map<felt252, u64>,

        // ---- Batch Accumulator ----
        // Total USDC pooled in the current open batch
        pending_usdc: u256,
        // Number of deposits in the current batch
        batch_count: u32,
        // Monotonically increasing batch identifier
        current_batch_id: u64,

        // ---- Batch Results (the exchange-rate ledger) ----
        batch_results: Map<u64, BatchResult>,

        // ---- Protocol Config ----
        usdc_token: ContractAddress,
        wbtc_token: ContractAddress,
        ekubo_router: ContractAddress,
        owner: ContractAddress,
    }

    // ========================================
    // Events
    // ========================================

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        DepositCommitted: DepositCommitted,
        BatchExecuted: BatchExecuted,
        Withdrawal: Withdrawal,
    }

    #[derive(Drop, starknet::Event)]
    pub struct DepositCommitted {
        #[key]
        pub commitment: felt252,
        pub batch_id: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct BatchExecuted {
        #[key]
        pub batch_id: u64,
        pub total_usdc: u256,
        pub wbtc_received: u256,
    }

    /// Emitted when a user withdraws their WBTC share from a finalized batch.
    #[derive(Drop, starknet::Event)]
    pub struct Withdrawal {
        #[key]
        pub recipient: ContractAddress,
        pub wbtc_amount: u256,
        pub batch_id: u64,
    }

    // ========================================
    // Constructor
    // ========================================

    #[constructor]
    fn constructor(
        ref self: ContractState,
        usdc_token: ContractAddress,
        wbtc_token: ContractAddress,
        owner: ContractAddress,
        ekubo_router: ContractAddress,
    ) {
        self.usdc_token.write(usdc_token);
        self.wbtc_token.write(wbtc_token);
        self.owner.write(owner);
        self.ekubo_router.write(ekubo_router);
    }

    // ========================================
    // External: The Dark Engine
    // ========================================

    #[abi(embed_v0)]
    impl ShieldedPoolImpl of super::IShieldedPool<ContractState> {
        fn deposit(ref self: ContractState, commitment: felt252, amount: u256) {
            // --- Validation ---
            assert(amount > 0, 'Amount must be > 0');
            assert(!self.commitments.entry(commitment).read(), 'Commitment already exists');

            // --- Transfer USDC into the shielded pool ---
            let usdc = IERC20Dispatcher { contract_address: self.usdc_token.read() };
            let caller = get_caller_address();
            let pool = get_contract_address();
            let success = usdc.transfer_from(caller, pool, amount);
            assert(success, 'USDC transfer failed');

            // --- Store commitment hash (NOT the balance) ---
            self.commitments.entry(commitment).write(true);
            // --- Link commitment to its batch ---
            self.commitment_to_batch.entry(commitment).write(self.current_batch_id.read());

            // --- Accumulate into Ghost Batch ---
            self.pending_usdc.write(self.pending_usdc.read() + amount);
            self.batch_count.write(self.batch_count.read() + 1);

            // --- Emit ---
            self.emit(DepositCommitted {
                commitment,
                batch_id: self.current_batch_id.read(),
            });
        }

        fn execute_batch(ref self: ContractState) {
            // --- Gate: only owner ---
            let caller = get_caller_address();
            assert(caller == self.owner.read(), 'Only owner can execute');

            // --- Gate: batch must have funds ---
            let pending = self.pending_usdc.read();
            assert(pending > 0, 'Batch is empty');

            // ==============================================
            // THE DARK ENGINE
            // ==============================================

            // 1. Approve Ekubo router to spend accumulated USDC
            let usdc = IERC20Dispatcher { contract_address: self.usdc_token.read() };
            let router_address = self.ekubo_router.read();
            usdc.approve(router_address, pending);

            // 2. Execute swap: USDC -> WBTC via Ekubo
            let router = IEkuboRouterDispatcher { contract_address: router_address };
            let wbtc_received = router.swap(
                SwapParams {
                    token_in: self.usdc_token.read(),
                    token_out: self.wbtc_token.read(),
                    amount_in: pending,
                    min_amount_out: 0, // Hardcoded limit price for MVP
                },
            );

            // 3. Record BatchResult (the exchange-rate ledger)
            let current_batch = self.current_batch_id.read();
            let result = BatchResult {
                total_usdc_in: pending,
                total_wbtc_out: wbtc_received,
                timestamp: get_block_timestamp(),
                is_finalized: true,
            };
            self.batch_results.entry(current_batch).write(result);

            // 4. Reset batch state
            self.pending_usdc.write(0);
            self.batch_count.write(0);
            self.current_batch_id.write(current_batch + 1);

            // 5. Emit
            self.emit(BatchExecuted {
                batch_id: current_batch,
                total_usdc: pending,
                wbtc_received,
            });
        }

        fn withdraw(
            ref self: ContractState,
            amount: u256,
            secret: felt252,
            blinder: felt252,
            recipient: ContractAddress,
        ) {
            // ==============================================
            // 1. Recompute commitment from preimage
            // ==============================================
            let amount_low: felt252 = amount.low.into();
            let amount_high: felt252 = amount.high.into();
            let commitment = InternalImpl::compute_commitment(
                amount_low, amount_high, secret, blinder,
            );

            // ==============================================
            // 2. Verify commitment exists
            // ==============================================
            assert(self.commitments.entry(commitment).read(), 'Invalid commitment');

            // ==============================================
            // 3. Get batch and verify it's finalized
            // ==============================================
            let batch_id = self.commitment_to_batch.entry(commitment).read();
            let batch = self.batch_results.entry(batch_id).read();
            assert(batch.is_finalized, 'Batch not finalized');

            // ==============================================
            // 4. Nullifier check — prevent double-spend
            // ==============================================
            let nullifier_hash = PedersenTrait::new(0)
                .update(secret)
                .update(1)
                .finalize();
            assert(!self.nullifiers.entry(nullifier_hash).read(), 'Note already spent');
            self.nullifiers.entry(nullifier_hash).write(true);

            // ==============================================
            // 5. Calculate pro-rata WBTC share
            //    user_share = (amount * total_wbtc_out) / total_usdc_in
            // ==============================================
            let user_share = (amount * batch.total_wbtc_out) / batch.total_usdc_in;

            // ==============================================
            // 6. Transfer WBTC to recipient
            // ==============================================
            let wbtc = IERC20Dispatcher { contract_address: self.wbtc_token.read() };
            let success = wbtc.transfer(recipient, user_share);
            assert(success, 'WBTC transfer failed');

            // ==============================================
            // 7. Emit
            // ==============================================
            self.emit(Withdrawal { recipient, wbtc_amount: user_share, batch_id });
        }

        fn is_commitment_valid(self: @ContractState, commitment: felt252) -> bool {
            self.commitments.entry(commitment).read()
        }

        fn is_nullifier_spent(self: @ContractState, nullifier: felt252) -> bool {
            self.nullifiers.entry(nullifier).read()
        }

        fn get_pending_usdc(self: @ContractState) -> u256 {
            self.pending_usdc.read()
        }

        fn get_batch_count(self: @ContractState) -> u32 {
            self.batch_count.read()
        }

        fn get_current_batch_id(self: @ContractState) -> u64 {
            self.current_batch_id.read()
        }

        fn get_batch_result(self: @ContractState, batch_id: u64) -> BatchResult {
            self.batch_results.entry(batch_id).read()
        }
    }

    // ========================================
    // Internal: Commitment Verification
    // ========================================

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        /// Compute a Pedersen commitment from Note fields.
        /// commitment = pedersen(pedersen(amount_low, amount_high), pedersen(secret, blinder))
        /// This mirrors the frontend's off-chain computation.
        fn compute_commitment(
            amount_low: felt252, amount_high: felt252, secret: felt252, blinder: felt252,
        ) -> felt252 {
            let amount_hash = PedersenTrait::new(0)
                .update(amount_low)
                .update(amount_high)
                .finalize();
            let secret_hash = PedersenTrait::new(0)
                .update(secret)
                .update(blinder)
                .finalize();
            PedersenTrait::new(0).update(amount_hash).update(secret_hash).finalize()
        }

        /// Mock ZK verifier — always returns true.
        /// TODO: Replace with Garaga STARK/SNARK verifier for production.
        /// In production, the caller submits a ZK proof instead of the raw secret,
        /// proving knowledge of the commitment preimage without revealing it.
        fn verify_proof(
            _proof: Span<felt252>, _root: felt252, _nullifier: felt252,
        ) -> bool {
            true
        }
    }
}
