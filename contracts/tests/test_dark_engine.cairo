use snforge_std::{
    ContractClassTrait, DeclareResultTrait, declare,
    start_cheat_caller_address, stop_cheat_caller_address,
    spy_events, EventSpyAssertionsTrait,
};
use starknet::ContractAddress;
use ghost_sats::shielded_pool::{
    IShieldedPoolDispatcher, IShieldedPoolDispatcherTrait,
    ShieldedPool,
};
use ghost_sats::mock_erc20::{IMockERC20Dispatcher, IMockERC20DispatcherTrait};
use openzeppelin_interfaces::token::erc20::{IERC20Dispatcher, IERC20DispatcherTrait};

// ========================================
// Address helpers (replacing deprecated contract_address_const)
// ========================================

fn addr(val: felt252) -> ContractAddress {
    val.try_into().unwrap()
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

// ========================================
// Full integration setup
// ========================================

fn setup() -> (ContractAddress, ContractAddress, ContractAddress, ContractAddress, ContractAddress) {
    let usdc = deploy_mock_erc20();
    let wbtc = deploy_mock_erc20();
    let router = deploy_mock_router(1, 1); // 1:1 rate
    let owner: ContractAddress = addr('owner');
    let pool = deploy_shielded_pool(usdc, wbtc, owner, router);
    (pool, usdc, wbtc, router, owner)
}

// ========================================
// Tests
// ========================================

#[test]
fn test_three_users_deposit_and_batch_execute() {
    let (pool_addr, usdc_addr, wbtc_addr, router_addr, owner) = setup();

    // Dispatchers
    let usdc_mock = IMockERC20Dispatcher { contract_address: usdc_addr };
    let wbtc_mock = IMockERC20Dispatcher { contract_address: wbtc_addr };
    let usdc = IERC20Dispatcher { contract_address: usdc_addr };
    let wbtc = IERC20Dispatcher { contract_address: wbtc_addr };
    let pool = IShieldedPoolDispatcher { contract_address: pool_addr };

    // Users
    let user1 = addr('user1');
    let user2 = addr('user2');
    let user3 = addr('user3');

    // --- Mint USDC to users ---
    usdc_mock.mint(user1, 1000);
    usdc_mock.mint(user2, 2000);
    usdc_mock.mint(user3, 3000);

    // --- Mint WBTC to router (so it can fulfill the swap) ---
    wbtc_mock.mint(router_addr, 10000);

    // --- User 1: approve pool, then deposit 1000 with commitment 0x111 ---
    start_cheat_caller_address(usdc_addr, user1);
    usdc.approve(pool_addr, 1000);
    stop_cheat_caller_address(usdc_addr);

    start_cheat_caller_address(pool_addr, user1);
    pool.deposit(0x111, 1000);
    stop_cheat_caller_address(pool_addr);

    // --- User 2: approve pool, then deposit 2000 with commitment 0x222 ---
    start_cheat_caller_address(usdc_addr, user2);
    usdc.approve(pool_addr, 2000);
    stop_cheat_caller_address(usdc_addr);

    start_cheat_caller_address(pool_addr, user2);
    pool.deposit(0x222, 2000);
    stop_cheat_caller_address(pool_addr);

    // --- User 3: approve pool, then deposit 3000 with commitment 0x333 ---
    start_cheat_caller_address(usdc_addr, user3);
    usdc.approve(pool_addr, 3000);
    stop_cheat_caller_address(usdc_addr);

    start_cheat_caller_address(pool_addr, user3);
    pool.deposit(0x333, 3000);
    stop_cheat_caller_address(pool_addr);

    // ========================================
    // Verify pre-execution state
    // ========================================
    assert(pool.get_pending_usdc() == 6000, 'Wrong pending USDC');
    assert(pool.get_batch_count() == 3, 'Wrong batch count');
    assert(pool.get_current_batch_id() == 0, 'Batch ID should be 0');

    // Commitments are valid
    assert(pool.is_commitment_valid(0x111), 'Commitment 1 invalid');
    assert(pool.is_commitment_valid(0x222), 'Commitment 2 invalid');
    assert(pool.is_commitment_valid(0x333), 'Commitment 3 invalid');

    // Pool holds all USDC
    assert(usdc.balance_of(pool_addr) == 6000, 'Pool should hold 6000 USDC');

    // ========================================
    // Execute the Dark Engine
    // ========================================
    let mut spy = spy_events();

    start_cheat_caller_address(pool_addr, owner);
    pool.execute_batch();
    stop_cheat_caller_address(pool_addr);

    // ========================================
    // Verify post-execution state
    // ========================================

    // Batch state is reset
    assert(pool.get_pending_usdc() == 0, 'pending_usdc not reset');
    assert(pool.get_batch_count() == 0, 'batch_count not reset');
    assert(pool.get_current_batch_id() == 1, 'batch_id not incremented');

    // BatchResult is recorded correctly
    let result = pool.get_batch_result(0);
    assert(result.total_usdc_in == 6000, 'Wrong USDC in BatchResult');
    assert(result.total_wbtc_out == 6000, 'Wrong WBTC in BatchResult');
    assert(result.is_finalized, 'Batch not finalized');

    // Token balances: Pool swapped all USDC for WBTC
    assert(usdc.balance_of(pool_addr) == 0, 'Pool should have 0 USDC');
    assert(wbtc.balance_of(pool_addr) == 6000, 'Pool should have 6000 WBTC');

    // Router received the USDC
    assert(usdc.balance_of(router_addr) == 6000, 'Router should have 6000 USDC');

    // Verify BatchExecuted event
    spy.assert_emitted(
        @array![
            (
                pool_addr,
                ShieldedPool::Event::BatchExecuted(
                    ShieldedPool::BatchExecuted {
                        batch_id: 0,
                        total_usdc: 6000,
                        wbtc_received: 6000,
                    },
                ),
            ),
        ],
    );
}

#[test]
fn test_multiple_batches_sequential() {
    let (pool_addr, usdc_addr, wbtc_addr, router_addr, owner) = setup();

    let usdc_mock = IMockERC20Dispatcher { contract_address: usdc_addr };
    let wbtc_mock = IMockERC20Dispatcher { contract_address: wbtc_addr };
    let usdc = IERC20Dispatcher { contract_address: usdc_addr };
    let pool = IShieldedPoolDispatcher { contract_address: pool_addr };

    let user1 = addr('user1');

    // Mint enough USDC for 2 batches + WBTC for router
    usdc_mock.mint(user1, 5000);
    wbtc_mock.mint(router_addr, 50000);

    // --- Batch 0: deposit 2000 ---
    start_cheat_caller_address(usdc_addr, user1);
    usdc.approve(pool_addr, 5000);
    stop_cheat_caller_address(usdc_addr);

    start_cheat_caller_address(pool_addr, user1);
    pool.deposit(0xAAA, 2000);
    stop_cheat_caller_address(pool_addr);

    start_cheat_caller_address(pool_addr, owner);
    pool.execute_batch();
    stop_cheat_caller_address(pool_addr);

    let result0 = pool.get_batch_result(0);
    assert(result0.total_usdc_in == 2000, 'Batch 0: wrong USDC');
    assert(result0.total_wbtc_out == 2000, 'Batch 0: wrong WBTC');
    assert(pool.get_current_batch_id() == 1, 'Should be batch 1 now');

    // --- Batch 1: deposit 3000 ---
    start_cheat_caller_address(pool_addr, user1);
    pool.deposit(0xBBB, 3000);
    stop_cheat_caller_address(pool_addr);

    start_cheat_caller_address(pool_addr, owner);
    pool.execute_batch();
    stop_cheat_caller_address(pool_addr);

    let result1 = pool.get_batch_result(1);
    assert(result1.total_usdc_in == 3000, 'Batch 1: wrong USDC');
    assert(result1.total_wbtc_out == 3000, 'Batch 1: wrong WBTC');
    assert(pool.get_current_batch_id() == 2, 'Should be batch 2 now');

    // Both batch results are independently queryable
    let r0_again = pool.get_batch_result(0);
    assert(r0_again.total_usdc_in == 2000, 'Batch 0 still accessible');
}

#[test]
#[should_panic(expected: 'Only owner can execute')]
fn test_non_owner_cannot_execute_batch() {
    let (pool_addr, _, _, _, _) = setup();
    let pool = IShieldedPoolDispatcher { contract_address: pool_addr };
    let attacker = addr('attacker');

    start_cheat_caller_address(pool_addr, attacker);
    pool.execute_batch();
}

#[test]
#[should_panic(expected: 'Batch is empty')]
fn test_cannot_execute_empty_batch() {
    let (pool_addr, _, _, _, owner) = setup();
    let pool = IShieldedPoolDispatcher { contract_address: pool_addr };

    start_cheat_caller_address(pool_addr, owner);
    pool.execute_batch();
}

#[test]
#[should_panic(expected: 'Commitment already exists')]
fn test_duplicate_commitment_rejected() {
    let (pool_addr, usdc_addr, _, _, _) = setup();

    let usdc_mock = IMockERC20Dispatcher { contract_address: usdc_addr };
    let usdc = IERC20Dispatcher { contract_address: usdc_addr };
    let pool = IShieldedPoolDispatcher { contract_address: pool_addr };

    let user1 = addr('user1');
    usdc_mock.mint(user1, 2000);

    start_cheat_caller_address(usdc_addr, user1);
    usdc.approve(pool_addr, 2000);
    stop_cheat_caller_address(usdc_addr);

    start_cheat_caller_address(pool_addr, user1);
    pool.deposit(0xDEAD, 1000);
    pool.deposit(0xDEAD, 1000); // Same commitment — should panic
}
