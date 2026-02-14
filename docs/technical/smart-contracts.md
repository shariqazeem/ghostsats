# Smart Contracts

All contracts are written in Cairo 2.15 and deployed on Starknet Sepolia.

## ShieldedPool

The core protocol contract. Manages deposits, batch execution, withdrawals, and BTC intent settlement.

### Interface

```cairo
#[starknet::interface]
trait IShieldedPool<TContractState> {
    // ========================================
    // Core Protocol
    // ========================================

    /// Deposit USDC with a Pedersen commitment. Fixed denominations only.
    fn deposit(
        ref self: TContractState,
        commitment: felt252,
        denomination: u8,
        btc_identity_hash: felt252,
    );

    /// Execute the current batch: swap pooled USDC -> WBTC via Avnu.
    fn execute_batch(
        ref self: TContractState,
        min_wbtc_out: u256,
        routes: Array<Route>,
    );

    /// Withdraw WBTC by proving Merkle membership. Caller pays own gas.
    fn withdraw(
        ref self: TContractState,
        denomination: u8,
        secret: felt252,
        blinder: felt252,
        nullifier: felt252,
        merkle_path: Array<felt252>,
        path_indices: Array<u8>,
        recipient: ContractAddress,
        btc_recipient_hash: felt252,
    );

    /// Withdraw via relayer — relayer pays gas, takes a fee.
    fn withdraw_via_relayer(
        ref self: TContractState,
        denomination: u8,
        secret: felt252,
        blinder: felt252,
        nullifier: felt252,
        merkle_path: Array<felt252>,
        path_indices: Array<u8>,
        recipient: ContractAddress,
        relayer: ContractAddress,
        fee_bps: u256,
        btc_recipient_hash: felt252,
    );

    // ========================================
    // ZK-Private Protocol (no secret/blinder in calldata)
    // ========================================

    /// Privacy-preserving deposit with ZK commitment
    fn deposit_private(
        ref self: TContractState,
        commitment: felt252,
        denomination: u8,
        btc_identity_hash: felt252,
        zk_commitment: felt252,
    );

    /// Withdraw with ZK proof — verified on-chain by Garaga
    fn withdraw_private(
        ref self: TContractState,
        denomination: u8,
        zk_nullifier: felt252,
        zk_commitment: felt252,
        proof: Array<felt252>,      // ~2835 elements
        merkle_path: Array<felt252>,
        path_indices: Array<u8>,
        recipient: ContractAddress,
        btc_recipient_hash: felt252,
    );

    /// ZK-private gasless withdrawal via relayer
    fn withdraw_private_via_relayer(
        ref self: TContractState,
        denomination: u8,
        zk_nullifier: felt252,
        zk_commitment: felt252,
        proof: Array<felt252>,
        merkle_path: Array<felt252>,
        path_indices: Array<u8>,
        recipient: ContractAddress,
        relayer: ContractAddress,
        fee_bps: u256,
        btc_recipient_hash: felt252,
    );

    // ========================================
    // Bitcoin Intent Settlement (Optimistic Escrow)
    // ========================================

    /// Withdraw via BTC intent: ZK verify + lock WBTC in escrow.
    /// A solver will send BTC off-chain, oracle confirms, solver gets WBTC.
    fn withdraw_with_btc_intent(
        ref self: TContractState,
        denomination: u8,
        zk_nullifier: felt252,
        zk_commitment: felt252,
        proof: Array<felt252>,
        merkle_path: Array<felt252>,
        path_indices: Array<u8>,
        recipient: ContractAddress,
        btc_address_hash: felt252,
    );

    /// Solver claims an intent — announces they will send BTC.
    fn claim_intent(ref self: TContractState, intent_id: u64);

    /// Oracle confirms BTC payment observed on Bitcoin network.
    /// Auto-releases WBTC to solver when oracle threshold is met.
    fn confirm_btc_payment(ref self: TContractState, intent_id: u64);

    /// Release escrowed WBTC to solver (callable by anyone if threshold met).
    fn release_to_solver(ref self: TContractState, intent_id: u64);

    /// Expire intent and refund WBTC to recipient after timeout.
    fn expire_intent(ref self: TContractState, intent_id: u64);

    /// Configure oracle signers, threshold, and timeout (owner only).
    fn set_oracle_config(
        ref self: TContractState,
        signers: Array<ContractAddress>,
        threshold: u32,
        timeout: u64,
    );

    // ========================================
    // Compliance
    // ========================================

    /// Register a view key for a commitment
    fn register_view_key(
        ref self: TContractState,
        commitment: felt252,
        view_key_hash: felt252,
    );

    // ========================================
    // View Functions
    // ========================================

    fn is_commitment_valid(self: @TContractState, commitment: felt252) -> bool;
    fn is_nullifier_spent(self: @TContractState, nullifier: felt252) -> bool;
    fn get_pending_usdc(self: @TContractState) -> u256;
    fn get_batch_count(self: @TContractState) -> u32;
    fn get_current_batch_id(self: @TContractState) -> u64;
    fn get_batch_result(self: @TContractState, batch_id: u64) -> BatchResult;
    fn get_merkle_root(self: @TContractState) -> felt252;
    fn is_known_root(self: @TContractState, root: felt252) -> bool;
    fn get_leaf_count(self: @TContractState) -> u32;
    fn get_leaf(self: @TContractState, index: u32) -> felt252;
    fn get_denomination_amount(self: @TContractState, tier: u8) -> u256;
    fn get_total_volume(self: @TContractState) -> u256;
    fn get_total_batches_executed(self: @TContractState) -> u64;
    fn get_anonymity_set(self: @TContractState, tier: u8) -> u32;
    fn get_withdrawal_delay(self: @TContractState) -> u64;
    fn get_max_relayer_fee_bps(self: @TContractState) -> u256;
    fn get_btc_identity(self: @TContractState, commitment: felt252) -> felt252;
    fn get_btc_linked_count(self: @TContractState) -> u32;
    fn is_zk_nullifier_spent(self: @TContractState, zk_nullifier: felt252) -> bool;
    fn get_zk_commitment_mapping(self: @TContractState, zk_commitment: felt252) -> felt252;
    fn set_zk_verifier(ref self: TContractState, verifier: ContractAddress);

    // Views: Intent Settlement
    fn get_intent(self: @TContractState, intent_id: u64) -> IntentLock;
    fn get_intent_count(self: @TContractState) -> u64;
    fn get_oracle_threshold(self: @TContractState) -> u32;
    fn get_intent_timeout(self: @TContractState) -> u64;
    fn is_oracle(self: @TContractState, address: ContractAddress) -> bool;
}
```

### Denominations

| ID | Amount | USDC (6 decimals) |
|----|--------|-------------------|
| 0 | $1 USDC | 1,000,000 |
| 1 | $10 USDC | 10,000,000 |
| 2 | $100 USDC | 100,000,000 |

### Merkle Tree

- 20 levels deep -- supports 2^20 (1,048,576) commitments
- Pedersen hash at each node
- Pre-computed zero hashes for empty subtrees
- Merkle path = 20 sibling hashes + index bits

### Nullifier Set

When a withdrawal is processed:
1. Compute nullifier from the ZK proof
2. Check nullifier not in `spent_nullifiers` mapping
3. Store nullifier -- prevents double-spend

### Exchange Rates

After batch execution:
```
exchange_rate = total_wbtc_received / total_usdc_in_batch
wbtc_share = (deposit_usdc * exchange_rate)
```

### Relayer Fees

```
fee = (wbtc_share * fee_bps) / 10000
recipient_gets = wbtc_share - fee
relayer_gets = fee
```

Maximum fee: 500 bps (5%). Default: 200 bps (2%).

### BTC Intent Settlement

The intent settlement system enables trustless BTC-to-WBTC exchange through an optimistic escrow mechanism:

1. **User creates intent** via `withdraw_with_btc_intent()` -- ZK proof is verified, WBTC is locked in escrow (not sent to user)
2. **Solver claims** via `claim_intent()` -- solver announces they will send BTC to the user's Bitcoin address
3. **Oracle confirms** via `confirm_btc_payment()` -- authorized oracle nodes confirm BTC payment observed on Bitcoin network
4. **WBTC released** via `release_to_solver()` -- once oracle threshold is met, escrowed WBTC is released to the solver
5. **Timeout protection** via `expire_intent()` -- if solver fails to deliver BTC within the timeout period, WBTC is refunded to the recipient

The oracle configuration (signers, threshold, timeout) is managed by the contract owner via `set_oracle_config()`.

## GaragaVerifier

Generated by the Garaga CLI from the Noir circuit's verification key.

```cairo
#[starknet::interface]
trait IZKVerifier<TContractState> {
    fn verify_ultra_keccak_zk_honk_proof(
        self: @TContractState,
        full_proof_with_hints: Span<felt252>,
    ) -> Result<Span<u256>, felt252>;
}
```

- **Input**: 2835 felt252 values (proof blob + MSM hints + KZG hints)
- **Output**: `Ok(Span<u256>)` with public inputs on success, `Err(felt252)` on failure
- **Verification key**: Baked into contract constants at generation time
- **No constructor**: Deploy with no arguments

## MockERC20

Standard ERC-20 with a public `mint` function for testing:

```cairo
fn mint(ref self: TContractState, to: ContractAddress, amount: u256);
```

Used for:
- **USDC Mock** -- Depositors mint test USDC
- **WBTC Mock** -- Minted to MockAvnuRouter to simulate swap output
