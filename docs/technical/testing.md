# Testing

Veil Protocol has 52 passing tests covering the full protocol.

```bash
cd contracts && snforge test
# Tests: 52 passed, 0 failed, 0 ignored, 0 filtered out
```

## Test Suites

### Core Engine (14 tests)

**File**: `tests/test_dark_engine.cairo`

Tests the fundamental protocol mechanics:

- Three-user deposit and batch execution flow
- Multiple sequential batches
- Non-owner batch execution rejection
- Empty batch rejection
- Duplicate commitment rejection
- Invalid denomination rejection
- Denomination amounts ($1 / $10 / $100 USDC)
- Merkle root updates on deposit
- View key registration
- Correct leaf retrieval by index
- Anonymity set tracking per denomination tier
- BTC identity hash stored on deposit
- Zero BTC identity not counted
- BTC-linked deposit counter increments

### Withdrawal (16 tests)

**File**: `tests/test_withdrawal.cairo`

Tests the complete deposit-execute-withdraw cycle:

- Full lifecycle: deposit, batch execute, withdraw with Merkle proof
- Two-user withdrawal with independent Merkle proofs
- Withdrawal with exchange rate computation
- Double-spend prevention (nullifier reuse)
- Invalid preimage rejection
- Cannot withdraw before batch finalized
- Wrong nullifier rejection
- Relayer withdrawal with fee calculation (2% default)
- Relayer withdrawal with zero fee
- Excessive relayer fee rejection (5% cap)
- Withdrawal too early (timing delay enforcement, 60s minimum)
- Withdrawal delay view function
- Max relayer fee view function
- Withdrawal with BTC intent creates escrow
- Merkle proof wrong length rejection
- Relayer withdrawal with BTC intent creates escrow

### ZK Privacy (11 tests)

**File**: `tests/test_zk_privacy.cairo`

Tests the ZK-specific functionality:

- `deposit_private` stores ZK commitment mapping
- `deposit_private` to `withdraw_private` full flow
- ZK double-spend rejection (same nullifier)
- Wrong ZK commitment rejection
- Timing delay with ZK withdrawals
- Relayer fee calculation with ZK
- Backward compatibility with legacy deposits (no ZK)
- Duplicate ZK commitment rejection
- BTC identity with ZK deposits
- Zero ZK commitment rejection
- ZK withdrawal with BTC intent creates escrow

### Intent Escrow (11 tests)

**File**: `tests/test_intent_escrow.cairo`

Tests the BTC intent settlement system:

- `withdraw_with_btc_intent` creates intent lock
- `claim_intent` sets solver address
- Oracle confirmation and release to solver
- Intent expiration refunds recipient
- Double claim rejection
- Non-oracle confirmation rejection
- Cannot expire before timeout
- Oracle configuration update
- Oracle revocation on reconfiguration
- Minimum timeout enforcement
- Full intent lifecycle (create, claim, confirm, release)

## Running Tests

### Full Suite

```bash
cd contracts
snforge test
```

### Specific Test File

```bash
snforge test --filter test_dark_engine       # Core engine tests
snforge test --filter test_withdrawal        # Withdrawal tests
snforge test --filter test_zk_privacy        # ZK privacy tests
snforge test --filter test_intent_escrow     # Intent escrow tests
```

### Garaga Verifier Fork Test

The Garaga verifier has a separate fork test that runs against Starknet Sepolia:

```bash
cd circuits/ghostsats/zk_verifier
snforge test
```

This test:
1. Deploys the verifier contract on a Sepolia fork
2. Submits a real proof (2835 felt252 values)
3. Verifies the proof passes on-chain
4. Checks public inputs match expected values

## Test Architecture

Tests use `snforge_std` utilities:

- `deploy_syscall` for contract deployment
- `start_cheat_caller_address` for caller impersonation
- `start_cheat_block_timestamp_global` for time manipulation
- Mock contracts for USDC, WBTC, and Avnu router

### Mock Contracts

| Contract | Purpose |
|----------|---------|
| MockERC20 | USDC and WBTC with public mint |
| MockAvnuRouter | Simulates Avnu swap at a fixed rate |

### Test Flow Example

```cairo
// 1. Deploy mock tokens + pool
let (pool, usdc, wbtc, router) = deploy_test_suite();

// 2. Mint USDC to depositor ($10 = 10,000,000 raw)
usdc.mint(depositor, 10_000_000);

// 3. Approve + deposit
usdc.approve(pool, 10_000_000);
pool.deposit_private(commitment, 1, btc_hash, zk_commitment);

// 4. Execute batch
pool.execute_batch(0, routes);

// 5. Advance time past cooldown
set_block_timestamp(current_time + 61);

// 6. Withdraw with ZK proof
pool.withdraw_private(1, nullifier, zk_commitment, proof, merkle_path, indices, recipient, 0);
```

### Denomination Reference for Tests

| Tier | Label | Raw Amount (USDC 6 decimals) |
|------|-------|------------------------------|
| 0 | $1 | 1,000,000 |
| 1 | $10 | 10,000,000 |
| 2 | $100 | 100,000,000 |
