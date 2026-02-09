/// Mock Avnu router for tests.
/// Implements IAvnuExchange with a configurable fixed exchange rate.
/// Ignores routes — just does a simple rate-based swap.
#[starknet::contract]
pub mod MockAvnuRouter {
    use starknet::{ContractAddress, get_caller_address, get_contract_address};
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
    use openzeppelin_interfaces::token::erc20::{IERC20Dispatcher, IERC20DispatcherTrait};
    use ghost_sats::avnu_interface::Route;

    #[storage]
    struct Storage {
        rate_numerator: u256,
        rate_denominator: u256,
    }

    #[constructor]
    fn constructor(ref self: ContractState, rate_numerator: u256, rate_denominator: u256) {
        self.rate_numerator.write(rate_numerator);
        self.rate_denominator.write(rate_denominator);
    }

    #[abi(embed_v0)]
    impl RateImpl of ghost_sats::avnu_interface::IAvnuRate<ContractState> {
        fn set_rate(ref self: ContractState, rate_numerator: u256, rate_denominator: u256) {
            assert(rate_denominator > 0, 'denominator cannot be zero');
            self.rate_numerator.write(rate_numerator);
            self.rate_denominator.write(rate_denominator);
        }

        fn get_rate(self: @ContractState) -> (u256, u256) {
            (self.rate_numerator.read(), self.rate_denominator.read())
        }
    }

    #[abi(embed_v0)]
    impl AvnuExchangeImpl of ghost_sats::avnu_interface::IAvnuExchange<ContractState> {
        fn multi_route_swap(
            ref self: ContractState,
            sell_token_address: ContractAddress,
            sell_token_amount: u256,
            buy_token_address: ContractAddress,
            buy_token_amount: u256,
            buy_token_min_amount: u256,
            beneficiary: ContractAddress,
            integrator_fee_amount_bps: u128,
            integrator_fee_recipient: ContractAddress,
            routes: Array<Route>,
        ) -> bool {
            // Suppress unused variable warnings
            let _ = buy_token_amount;
            let _ = buy_token_min_amount;
            let _ = integrator_fee_amount_bps;
            let _ = integrator_fee_recipient;
            let _ = routes;

            let caller = get_caller_address();
            let this = get_contract_address();

            // Calculate output based on configured rate
            let buy_amount = (sell_token_amount * self.rate_numerator.read())
                / self.rate_denominator.read();

            // Pull sell token from caller (ShieldedPool approved us)
            let sell_token = IERC20Dispatcher { contract_address: sell_token_address };
            sell_token.transfer_from(caller, this, sell_token_amount);

            // Send buy token to beneficiary
            let buy_token = IERC20Dispatcher { contract_address: buy_token_address };
            buy_token.transfer(beneficiary, buy_amount);

            true
        }
    }
}
