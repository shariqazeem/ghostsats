use starknet::ContractAddress;

/// Parameters for an Ekubo DEX swap.
/// Phase 2: Extend with pool_key, fee_tier, sqrt_price_limit for real Ekubo integration.
#[derive(Drop, Copy, Serde)]
pub struct SwapParams {
    pub token_in: ContractAddress,
    pub token_out: ContractAddress,
    pub amount_in: u256,
    pub min_amount_out: u256,
}

/// Simplified Ekubo DEX Router interface.
/// In production, this wraps Ekubo's multi-hop router with pool keys and tick math.
/// For the hackathon MVP, we use a flat swap(params) -> amount_out signature.
#[starknet::interface]
pub trait IEkuboRouter<TContractState> {
    fn swap(ref self: TContractState, params: SwapParams) -> u256;
}
