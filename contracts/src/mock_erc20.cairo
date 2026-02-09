use starknet::ContractAddress;

#[starknet::interface]
pub trait IMockERC20<TContractState> {
    fn mint(ref self: TContractState, to: ContractAddress, amount: u256);
}

#[starknet::contract]
pub mod MockERC20 {
    use starknet::ContractAddress;
    use starknet::get_caller_address;
    use starknet::storage::{
        StoragePointerReadAccess, StoragePointerWriteAccess, Map, StoragePathEntry,
    };

    #[storage]
    struct Storage {
        token_name: ByteArray,
        token_symbol: ByteArray,
        token_decimals: u8,
        balances: Map<ContractAddress, u256>,
        allowances: Map<ContractAddress, Map<ContractAddress, u256>>,
        total_supply: u256,
    }

    #[constructor]
    fn constructor(ref self: ContractState, name: ByteArray, symbol: ByteArray, decimals: u8) {
        self.token_name.write(name);
        self.token_symbol.write(symbol);
        self.token_decimals.write(decimals);
    }

    #[abi(embed_v0)]
    impl MockERC20Impl of super::IMockERC20<ContractState> {
        fn mint(ref self: ContractState, to: ContractAddress, amount: u256) {
            let current = self.balances.entry(to).read();
            self.balances.entry(to).write(current + amount);
            self.total_supply.write(self.total_supply.read() + amount);
        }
    }

    #[abi(embed_v0)]
    impl ERC20MetadataImpl of openzeppelin_interfaces::token::erc20::IERC20Metadata<ContractState> {
        fn name(self: @ContractState) -> ByteArray {
            self.token_name.read()
        }

        fn symbol(self: @ContractState) -> ByteArray {
            self.token_symbol.read()
        }

        fn decimals(self: @ContractState) -> u8 {
            self.token_decimals.read()
        }
    }

    #[abi(embed_v0)]
    impl ERC20Impl of openzeppelin_interfaces::token::erc20::IERC20<ContractState> {
        fn total_supply(self: @ContractState) -> u256 {
            self.total_supply.read()
        }

        fn balance_of(self: @ContractState, account: ContractAddress) -> u256 {
            self.balances.entry(account).read()
        }

        fn allowance(
            self: @ContractState, owner: ContractAddress, spender: ContractAddress,
        ) -> u256 {
            self.allowances.entry(owner).entry(spender).read()
        }

        fn transfer(ref self: ContractState, recipient: ContractAddress, amount: u256) -> bool {
            let sender = get_caller_address();
            let sender_bal = self.balances.entry(sender).read();
            assert(sender_bal >= amount, 'Insufficient balance');
            self.balances.entry(sender).write(sender_bal - amount);
            let recip_bal = self.balances.entry(recipient).read();
            self.balances.entry(recipient).write(recip_bal + amount);
            true
        }

        fn transfer_from(
            ref self: ContractState,
            sender: ContractAddress,
            recipient: ContractAddress,
            amount: u256,
        ) -> bool {
            let caller = get_caller_address();
            let current_allowance = self.allowances.entry(sender).entry(caller).read();
            assert(current_allowance >= amount, 'Insufficient allowance');
            self.allowances.entry(sender).entry(caller).write(current_allowance - amount);

            let sender_bal = self.balances.entry(sender).read();
            assert(sender_bal >= amount, 'Insufficient balance');
            self.balances.entry(sender).write(sender_bal - amount);
            let recip_bal = self.balances.entry(recipient).read();
            self.balances.entry(recipient).write(recip_bal + amount);
            true
        }

        fn approve(ref self: ContractState, spender: ContractAddress, amount: u256) -> bool {
            let caller = get_caller_address();
            self.allowances.entry(caller).entry(spender).write(amount);
            true
        }
    }

    #[abi(embed_v0)]
    impl ERC20CamelImpl of openzeppelin_interfaces::token::erc20::IERC20CamelOnly<ContractState> {
        fn totalSupply(self: @ContractState) -> u256 {
            self.total_supply.read()
        }

        fn balanceOf(self: @ContractState, account: ContractAddress) -> u256 {
            self.balances.entry(account).read()
        }

        fn transferFrom(
            ref self: ContractState,
            sender: ContractAddress,
            recipient: ContractAddress,
            amount: u256,
        ) -> bool {
            ERC20Impl::transfer_from(ref self, sender, recipient, amount)
        }
    }
}
