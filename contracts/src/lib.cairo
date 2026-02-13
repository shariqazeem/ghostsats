use starknet::ContractAddress;

#[derive(Drop, Copy, Serde, starknet::Store)]
pub struct BatchResult {
    pub total_usdc_in: u256,
    pub total_wbtc_out: u256,
    pub timestamp: u64,
    pub is_finalized: bool,
}

/// Bitcoin Intent Settlement — Optimistic Escrow Lock
///
/// When a user withdraws to Bitcoin, their WBTC is locked in escrow.
/// A solver sends BTC off-chain, an oracle confirms, and the solver
/// receives the escrowed WBTC. If nobody fulfills, the user gets refunded.
///
/// Status lifecycle: CREATED(0) → CLAIMED(1) → SETTLED(2)
///                   CREATED(0) or CLAIMED(1) → EXPIRED(3) after timeout
#[derive(Drop, Copy, Serde, starknet::Store)]
pub struct IntentLock {
    pub amount: u256,
    pub btc_address_hash: felt252,
    pub recipient: ContractAddress,
    pub solver: ContractAddress,
    pub timestamp: u64,
    pub status: u8,
}

pub mod shielded_pool;
pub mod avnu_interface;
pub mod mock_erc20;
pub mod mock_avnu_router;
