use starknet::ContractAddress;

/// A single route leg for the Avnu aggregator.
/// Matches the on-chain Route struct in avnu-contracts-v2.
#[derive(Drop, Clone, Serde)]
pub struct Route {
    pub token_from: ContractAddress,
    pub token_to: ContractAddress,
    pub exchange_address: ContractAddress,
    pub percent: u128,
    pub additional_swap_params: Array<felt252>,
}

/// Interface for updating the mock router exchange rate.
#[starknet::interface]
pub trait IAvnuRate<TContractState> {
    fn set_rate(ref self: TContractState, rate_numerator: u256, rate_denominator: u256);
    fn get_rate(self: @TContractState) -> (u256, u256);
}

/// Interface for the Avnu Exchange aggregator contract.
/// See: https://github.com/avnu-labs/avnu-contracts-v2
#[starknet::interface]
pub trait IAvnuExchange<TContractState> {
    fn multi_route_swap(
        ref self: TContractState,
        sell_token_address: ContractAddress,
        sell_token_amount: u256,
        buy_token_address: ContractAddress,
        buy_token_amount: u256,
        buy_token_min_amount: u256,
        beneficiary: ContractAddress,
        integrator_fee_amount_bps: u128,
        integrator_fee_recipient: ContractAddress,
        routes: Array<Route>,
    ) -> bool;
}
