#[starknet::contract]
pub mod MockEkuboRouter {
    use starknet::{get_caller_address, get_contract_address};
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
    use openzeppelin_interfaces::token::erc20::{IERC20Dispatcher, IERC20DispatcherTrait};
    use ghost_sats::ekubo_interface::SwapParams;

    #[storage]
    struct Storage {
        // Exchange rate: wbtc_out = usdc_in * rate_numerator / rate_denominator
        rate_numerator: u256,
        rate_denominator: u256,
    }

    #[constructor]
    fn constructor(ref self: ContractState, rate_numerator: u256, rate_denominator: u256) {
        self.rate_numerator.write(rate_numerator);
        self.rate_denominator.write(rate_denominator);
    }

    #[abi(embed_v0)]
    impl EkuboRouterImpl of ghost_sats::ekubo_interface::IEkuboRouter<ContractState> {
        fn swap(ref self: ContractState, params: SwapParams) -> u256 {
            let caller = get_caller_address();
            let this = get_contract_address();

            // Calculate output based on configured rate
            let wbtc_out = (params.amount_in * self.rate_numerator.read())
                / self.rate_denominator.read();

            // Pull USDC from caller (ShieldedPool approved us)
            let usdc = IERC20Dispatcher { contract_address: params.token_in };
            usdc.transfer_from(caller, this, params.amount_in);

            // Send WBTC to caller
            let wbtc = IERC20Dispatcher { contract_address: params.token_out };
            wbtc.transfer(caller, wbtc_out);

            wbtc_out
        }
    }
}
