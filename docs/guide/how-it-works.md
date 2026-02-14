# How It Works

Veil Protocol operates in four phases: **Shield**, **Batch**, **Unveil**, and **AI Strategist**.

## Phase 1: Shield (Deposit)

When you deposit USDC into the shielded pool:

1. **Choose a denomination** -- $1, $10, or $100 USDC. Fixed amounts make deposits indistinguishable.

2. **Client-side commitment generation**:
   - Generate random `secret` and `blinder` values
   - Compute **Pedersen commitment** = `H(H(0, amount_hash), secret_hash)` (Stark field)
   - Compute **ZK commitment** = `Poseidon_BN254(secret, blinder, denomination)` (BN254 field)

3. **Bitcoin attestation** -- Your Bitcoin wallet (Xverse) signs the commitment hash, binding your BTC identity to the deposit.

4. **On-chain storage** -- `deposit_private(commitment, denomination, btc_identity, zk_commitment)` stores:
   - Pedersen commitment inserted into 20-level Merkle tree
   - ZK commitment mapped for later verification
   - USDC transferred to pool

::: info Key Privacy Property
The `secret` and `blinder` **never leave your browser**. Only cryptographic commitments are stored on-chain.
:::

## Phase 2: Batch (Keeper Execution)

A keeper (currently owner-only) aggregates all pending deposits:

1. Fetches **live BTC price from CoinGecko** (with CoinCap and Blockchain.info as fallbacks)
2. Calls `execute_batch(min_wbtc_out, routes)` on the ShieldedPool contract
3. Pool approves USDC spending to the Avnu router
4. Avnu executes a single USDC-to-WBTC swap across configured routes
5. Exchange rate locked: `wbtc_received / total_usdc`
6. Batch marked as executed, Merkle tree updated

The embedded relayer API in Next.js (`/api/relayer/execute-batch`) can also trigger batch execution, fetching live BTC pricing from CoinGecko to calculate accurate `min_wbtc_out` slippage protection.

**Why batch?** Individual swaps reveal the depositor's intent timing. A batch hides your trade among all concurrent deposits.

## Phase 3: Unveil (Withdrawal)

After a 60-second cooldown, you can withdraw your share.

### ZK Proof Generation

Veil Protocol supports two proving modes:

**Option A: In-browser proving (bb.js WASM)** -- secrets never leave the browser:
```
Browser (WASM)
  |- @noir-lang/noir_js  -> witness generation (secret + blinder stay in WASM memory)
  |- @aztec/bb.js        -> UltraKeccakZKHonk proof generation
  |- POST /api/relayer/calldata -> garaga calldata conversion (proof bytes only, no secrets)
```

**Option B: Server-side proving** -- the prover service runs the full pipeline:
```
Browser -> POST /prove (to prover service)
  |- nargo execute    -> witness generation
  |- bb prove         -> UltraKeccakZKHonk proof (7KB binary)
  |- garaga calldata  -> 2835 felt252 values (proof + MSM/KZG hints)
```

In both modes, the proof demonstrates:
- You **know** the `secret` and `blinder` that produce the committed `zk_commitment`
- The derived `nullifier = Poseidon_BN254(secret, 1)` has not been used before

### On-Chain Verification

```
withdraw_private(denomination, zk_nullifier, zk_commitment, proof[2835], merkle_path, indices, recipient)
  |- Garaga verifier validates proof on-chain
  |- Nullifier marked spent (no double-spend)
  |- Merkle proof verified for Pedersen commitment
  |- Assets transferred to recipient
```

### Withdrawal Modes

After verification, you choose how to receive your BTC:

| Mode | Description |
|------|-------------|
| **WBTC on Starknet** | WBTC sent directly to any Starknet address |
| **Native BTC (intent settlement)** | A BTC intent is created; a solver fills it by sending native Bitcoin to your Bitcoin wallet address on the Bitcoin network |

BTC intent settlement uses an escrow mechanism: the contract locks WBTC, and a solver sends the equivalent BTC to your specified Bitcoin address. Once confirmed, the solver claims the locked WBTC.

### Gasless Option

With the embedded relayer enabled:
- The relayer's address appears as tx sender, **not yours**
- You never sign anything -- the ZK proof is your authorization
- No gas payment from your wallet = no on-chain footprint
- Relayer takes a small fee (2%, capped at 5%)

The relayer runs as Next.js API routes embedded in the frontend application (`/api/relayer/*`), eliminating the need for a separate relayer service in most deployments.

::: tip Why Gasless Matters
Without the relayer, your wallet signs the withdrawal tx, creating an on-chain link between depositor and withdrawer. With the relayer, the link is completely broken.
:::

## Phase 4: AI Strategist

The Strategist tab provides an AI-powered strategy agent that plans and executes confidential BTC accumulation.

### Natural Language Input

Describe your goal in plain English:
- "Accumulate $50 in BTC with maximum privacy"
- "DCA $100 over 5 deposits"
- "Invest $200, spread across all pools"
- "Quick $10 deposit, minimize gas"

The agent parses your intent, detects the target amount, and selects the optimal strategy type.

### 5 Strategy Types

| Strategy | Detection Keywords | Behavior |
|----------|-------------------|----------|
| **privacy_first** | privacy, anonymous, stealth, hidden | All deposits target the tier with the highest anonymity set. Sacrifices efficiency for maximum unlinkability. |
| **efficiency** | efficient, fast, quick, cheap, gas | Largest affordable tier, single atomic multicall, zero delays between deposits. |
| **stealth_dca** | dca, spread, split, multiple, diversify | Randomizes across tiers for cross-pool obfuscation. Extended delays (45-180s) prevent temporal correlation analysis. |
| **whale** | Auto-detected for amounts >= $500 | Spreads deposits across ALL tiers to strengthen protocol-wide anonymity for every participant. |
| **balanced** | Default when no keywords match | Optimal tier by amount with moderate timing protection (30-120s delays). |

### Autonomous DCA Execution

When the agent generates a multi-step plan with delays, execution is autonomous:

1. You approve the plan and sign **once**
2. The relayer executes each deposit at the scheduled time with randomized delays
3. Each deposit lands in a separate block, preventing temporal correlation
4. After all deposits complete, the keeper triggers batch conversion via Avnu

### Agent Observability

The agent streams a real-time thinking log showing:
- **OBSERVE** -- Parsing intent, reading pool state, fetching live BTC price
- **THINK** -- Evaluating anonymity tiers, computing Confidentiality Strength Index
- **DECIDE** -- Selecting strategy, generating execution plan
- **ACT** -- Executing deposits (when authorized)
- **RESULT** -- Final strategy summary with privacy impact

### Telegram Bot

The same strategy engine powers the Telegram bot (`/strategy` command), providing mobile access to strategy planning with deep links to execute on the web app.

## Timing Protection

A 60-second minimum delay between deposit and withdrawal prevents:
- Deposit-and-immediately-withdraw attacks
- Timing correlation between deposits and withdrawals
- Front-running withdrawal transactions

The AI Strategist adds additional temporal decorrelation through randomized delays (20-180 seconds depending on strategy type) between autonomous DCA deposits.
