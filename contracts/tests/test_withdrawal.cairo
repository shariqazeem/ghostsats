use snforge_std::{
    ContractClassTrait, DeclareResultTrait, declare,
    start_cheat_caller_address, stop_cheat_caller_address,
    spy_events, EventSpyAssertionsTrait,
};
use starknet::ContractAddress;
use core::pedersen::PedersenTrait;
use core::hash::HashStateTrait;
use ghost_sats::shielded_pool::{
    IShieldedPoolDispatcher, IShieldedPoolDispatcherTrait,
    ShieldedPool,
};
use ghost_sats::mock_erc20::{IMockERC20Dispatcher, IMockERC20DispatcherTrait};
use openzeppelin_interfaces::token::erc20::{IERC20Dispatcher, IERC20DispatcherTrait};

// ========================================
// Helpers
// ========================================

fn addr(val: felt252) -> ContractAddress {
    val.try_into().unwrap()
}

/// Compute commitment off-chain (mirrors contract's internal logic).
/// commitment = pedersen(pedersen(amount_low, amount_high), pedersen(secret, blinder))
fn compute_commitment(amount: u256, secret: felt252, blinder: felt252) -> felt252 {
    let amount_low: felt252 = amount.low.into();
    let amount_high: felt252 = amount.high.into();
    let amount_hash = PedersenTrait::new(0).update(amount_low).update(amount_high).finalize();
    let secret_hash = PedersenTrait::new(0).update(secret).update(blinder).finalize();
    PedersenTrait::new(0).update(amount_hash).update(secret_hash).finalize()
}

/// Compute nullifier (mirrors contract's withdrawal logic).
/// nullifier = pedersen(secret, 1)
fn compute_nullifier(secret: felt252) -> felt252 {
    PedersenTrait::new(0).update(secret).update(1).finalize()
}

// ========================================
// Deploy Helpers
// ========================================

fn deploy_mock_erc20() -> ContractAddress {
    let contract = declare("MockERC20").unwrap().contract_class();
    let (address, _) = contract.deploy(@array![]).unwrap();
    address
}

fn deploy_mock_router(rate_num: u256, rate_den: u256) -> ContractAddress {
    let contract = declare("MockEkuboRouter").unwrap().contract_class();
    let mut calldata = array![];
    rate_num.serialize(ref calldata);
    rate_den.serialize(ref calldata);
    let (address, _) = contract.deploy(@calldata).unwrap();
    address
}

fn deploy_shielded_pool(
    usdc: ContractAddress,
    wbtc: ContractAddress,
    owner: ContractAddress,
    router: ContractAddress,
) -> ContractAddress {
    let contract = declare("ShieldedPool").unwrap().contract_class();
    let mut calldata = array![];
    usdc.serialize(ref calldata);
    wbtc.serialize(ref calldata);
    owner.serialize(ref calldata);
    router.serialize(ref calldata);
    let (address, _) = contract.deploy(@calldata).unwrap();
    address
}

/// Deploy full test environment. Returns (pool, usdc, wbtc, router, owner).
fn setup() -> (ContractAddress, ContractAddress, ContractAddress, ContractAddress, ContractAddress) {
    let usdc = deploy_mock_erc20();
    let wbtc = deploy_mock_erc20();
    let router = deploy_mock_router(1, 1); // 1:1 rate
    let owner = addr('owner');
    let pool = deploy_shielded_pool(usdc, wbtc, owner, router);
    (pool, usdc, wbtc, router, owner)
}

/// Deposit USDC into the pool with a precomputed commitment.
fn do_deposit(
    pool_addr: ContractAddress,
    usdc_addr: ContractAddress,
    user: ContractAddress,
    commitment: felt252,
    amount: u256,
) {
    let usdc = IERC20Dispatcher { contract_address: usdc_addr };
    let pool = IShieldedPoolDispatcher { contract_address: pool_addr };

    start_cheat_caller_address(usdc_addr, user);
    usdc.approve(pool_addr, amount);
    stop_cheat_caller_address(usdc_addr);

    start_cheat_caller_address(pool_addr, user);
    pool.deposit(commitment, amount);
    stop_cheat_caller_address(pool_addr);
}

/// Execute the current batch as the owner.
fn do_execute_batch(pool_addr: ContractAddress, owner: ContractAddress) {
    let pool = IShieldedPoolDispatcher { contract_address: pool_addr };
    start_cheat_caller_address(pool_addr, owner);
    pool.execute_batch();
    stop_cheat_caller_address(pool_addr);
}

// ========================================
// Tests
// ========================================

#[test]
fn test_full_flow_deposit_execute_withdraw() {
    let (pool_addr, usdc_addr, wbtc_addr, router_addr, owner) = setup();

    let usdc_mock = IMockERC20Dispatcher { contract_address: usdc_addr };
    let wbtc_mock = IMockERC20Dispatcher { contract_address: wbtc_addr };
    let wbtc = IERC20Dispatcher { contract_address: wbtc_addr };
    let pool = IShieldedPoolDispatcher { contract_address: pool_addr };

    let depositor = addr('depositor');
    let recipient = addr('recipient'); // Different address for privacy

    // Note preimage
    let amount: u256 = 3000;
    let secret: felt252 = 0x5EC1;
    let blinder: felt252 = 0xB11D;
    let commitment = compute_commitment(amount, secret, blinder);

    // Mint tokens
    usdc_mock.mint(depositor, amount);
    wbtc_mock.mint(router_addr, 10000);

    // --- Deposit ---
    do_deposit(pool_addr, usdc_addr, depositor, commitment, amount);

    // --- Execute Batch ---
    do_execute_batch(pool_addr, owner);

    // --- Withdraw to a DIFFERENT address (privacy!) ---
    let mut spy = spy_events();

    pool.withdraw(amount, secret, blinder, recipient);

    // Recipient got the WBTC
    assert(wbtc.balance_of(recipient) == 3000, 'Recipient wrong WBTC');

    // Pool WBTC decreased
    assert(wbtc.balance_of(pool_addr) == 0, 'Pool should be empty');

    // Nullifier is spent
    let nullifier = compute_nullifier(secret);
    assert(pool.is_nullifier_spent(nullifier), 'Nullifier not marked');

    // Verify Withdrawal event
    spy.assert_emitted(
        @array![
            (
                pool_addr,
                ShieldedPool::Event::Withdrawal(
                    ShieldedPool::Withdrawal {
                        recipient,
                        wbtc_amount: 3000,
                        batch_id: 0,
                    },
                ),
            ),
        ],
    );
}

#[test]
fn test_proportional_withdrawal_two_users() {
    let (pool_addr, usdc_addr, wbtc_addr, router_addr, owner) = setup();

    let usdc_mock = IMockERC20Dispatcher { contract_address: usdc_addr };
    let wbtc_mock = IMockERC20Dispatcher { contract_address: wbtc_addr };
    let wbtc = IERC20Dispatcher { contract_address: wbtc_addr };
    let pool = IShieldedPoolDispatcher { contract_address: pool_addr };

    let user1 = addr('user1');
    let user2 = addr('user2');
    let recip1 = addr('recip1');
    let recip2 = addr('recip2');

    // User 1 note: 1000 USDC
    let amount1: u256 = 1000;
    let secret1: felt252 = 0xAAA;
    let blinder1: felt252 = 0xBBB;
    let commitment1 = compute_commitment(amount1, secret1, blinder1);

    // User 2 note: 2000 USDC
    let amount2: u256 = 2000;
    let secret2: felt252 = 0xCCC;
    let blinder2: felt252 = 0xDDD;
    let commitment2 = compute_commitment(amount2, secret2, blinder2);

    // Mint
    usdc_mock.mint(user1, amount1);
    usdc_mock.mint(user2, amount2);
    wbtc_mock.mint(router_addr, 10000);

    // Deposit both
    do_deposit(pool_addr, usdc_addr, user1, commitment1, amount1);
    do_deposit(pool_addr, usdc_addr, user2, commitment2, amount2);

    // Execute batch: 3000 USDC -> 3000 WBTC (1:1 rate)
    do_execute_batch(pool_addr, owner);

    // User 1 withdraws: share = (1000 * 3000) / 3000 = 1000 WBTC
    pool.withdraw(amount1, secret1, blinder1, recip1);
    assert(wbtc.balance_of(recip1) == 1000, 'User1 wrong share');

    // User 2 withdraws: share = (2000 * 3000) / 3000 = 2000 WBTC
    pool.withdraw(amount2, secret2, blinder2, recip2);
    assert(wbtc.balance_of(recip2) == 2000, 'User2 wrong share');

    // Pool is fully drained
    assert(wbtc.balance_of(pool_addr) == 0, 'Pool not fully drained');
}

#[test]
fn test_proportional_withdrawal_with_exchange_rate() {
    // Use 2:1 rate: 1 USDC -> 2 WBTC
    let usdc_addr = deploy_mock_erc20();
    let wbtc_addr = deploy_mock_erc20();
    let router_addr = deploy_mock_router(2, 1); // 2:1 rate
    let owner = addr('owner');
    let pool_addr = deploy_shielded_pool(usdc_addr, wbtc_addr, owner, router_addr);

    let usdc_mock = IMockERC20Dispatcher { contract_address: usdc_addr };
    let wbtc_mock = IMockERC20Dispatcher { contract_address: wbtc_addr };
    let wbtc = IERC20Dispatcher { contract_address: wbtc_addr };
    let pool = IShieldedPoolDispatcher { contract_address: pool_addr };

    let user = addr('user');
    let recipient = addr('recipient');

    let amount: u256 = 1500;
    let secret: felt252 = 0xFFF;
    let blinder: felt252 = 0xEEE;
    let commitment = compute_commitment(amount, secret, blinder);

    usdc_mock.mint(user, amount);
    wbtc_mock.mint(router_addr, 100000);

    do_deposit(pool_addr, usdc_addr, user, commitment, amount);
    do_execute_batch(pool_addr, owner);

    // Batch: 1500 USDC -> 3000 WBTC (2:1 rate)
    let result = pool.get_batch_result(0);
    assert(result.total_usdc_in == 1500, 'Wrong batch USDC');
    assert(result.total_wbtc_out == 3000, 'Wrong batch WBTC');

    // Withdraw: share = (1500 * 3000) / 1500 = 3000 WBTC
    pool.withdraw(amount, secret, blinder, recipient);
    assert(wbtc.balance_of(recipient) == 3000, 'Wrong WBTC with 2x rate');
}

#[test]
#[should_panic(expected: 'Note already spent')]
fn test_double_withdrawal_rejected() {
    let (pool_addr, usdc_addr, wbtc_addr, router_addr, owner) = setup();

    let usdc_mock = IMockERC20Dispatcher { contract_address: usdc_addr };
    let wbtc_mock = IMockERC20Dispatcher { contract_address: wbtc_addr };
    let pool = IShieldedPoolDispatcher { contract_address: pool_addr };

    let user = addr('user');
    let recipient = addr('recipient');

    let amount: u256 = 1000;
    let secret: felt252 = 0x123;
    let blinder: felt252 = 0x456;
    let commitment = compute_commitment(amount, secret, blinder);

    usdc_mock.mint(user, amount);
    wbtc_mock.mint(router_addr, 10000);

    do_deposit(pool_addr, usdc_addr, user, commitment, amount);
    do_execute_batch(pool_addr, owner);

    // First withdrawal succeeds
    pool.withdraw(amount, secret, blinder, recipient);

    // Second withdrawal with same secret — nullifier already spent
    pool.withdraw(amount, secret, blinder, recipient);
}

#[test]
#[should_panic(expected: 'Invalid commitment')]
fn test_invalid_preimage_rejected() {
    let (pool_addr, usdc_addr, wbtc_addr, router_addr, owner) = setup();

    let usdc_mock = IMockERC20Dispatcher { contract_address: usdc_addr };
    let wbtc_mock = IMockERC20Dispatcher { contract_address: wbtc_addr };
    let pool = IShieldedPoolDispatcher { contract_address: pool_addr };

    let user = addr('user');
    let recipient = addr('recipient');

    let amount: u256 = 1000;
    let secret: felt252 = 0x214E;
    let blinder: felt252 = 0xB11D;
    let commitment = compute_commitment(amount, secret, blinder);

    usdc_mock.mint(user, amount);
    wbtc_mock.mint(router_addr, 10000);

    do_deposit(pool_addr, usdc_addr, user, commitment, amount);
    do_execute_batch(pool_addr, owner);

    // Wrong secret — computed commitment won't match
    let wrong_secret: felt252 = 0xBAD0;
    pool.withdraw(amount, wrong_secret, blinder, recipient);
}

#[test]
#[should_panic(expected: 'Batch not finalized')]
fn test_cannot_withdraw_before_batch_finalized() {
    let (pool_addr, usdc_addr, _, _, _) = setup();

    let usdc_mock = IMockERC20Dispatcher { contract_address: usdc_addr };
    let pool = IShieldedPoolDispatcher { contract_address: pool_addr };

    let user = addr('user');
    let recipient = addr('recipient');

    let amount: u256 = 1000;
    let secret: felt252 = 0xABC;
    let blinder: felt252 = 0xDEF;
    let commitment = compute_commitment(amount, secret, blinder);

    usdc_mock.mint(user, amount);

    do_deposit(pool_addr, usdc_addr, user, commitment, amount);

    // Attempt withdrawal before execute_batch — batch not finalized
    pool.withdraw(amount, secret, blinder, recipient);
}
