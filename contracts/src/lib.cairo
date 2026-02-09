#[derive(Drop, Copy, Serde, starknet::Store)]
pub struct BatchResult {
    pub total_usdc_in: u256,
    pub total_wbtc_out: u256,
    pub timestamp: u64,
    pub is_finalized: bool,
}

pub mod shielded_pool;
pub mod avnu_interface;
pub mod mock_erc20;
pub mod mock_avnu_router;
