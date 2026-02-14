# Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  TELEGRAM BOT (grammy, scripts/bot.ts)                          │
│                                                                  │
│  /strategy → AI plan + deep link to web app                      │
│  /status   → Pool state, anonymity sets, BTC price               │
│  /price    → Live BTC conversion rates (CoinGecko)               │
│  /pool     → Detailed protocol analytics                         │
│                                                                  │
│  Strategy Engine: parseTargetUsdc → detectStrategyType →         │
│    generateAgentLog → generateStrategy → buildDeepLink           │
└──────────────────────────┬──────────────────────────────────────┘
                           │ deep link: /app?strategy=<base64url>
┌──────────────────────────▼──────────────────────────────────────┐
│  FRONTEND (Next.js 16 + React 19 + starknet.js)                 │
│                                                                  │
│  Landing → /app (WalletBar + Dashboard + Shield/Unveil/          │
│                  Strategist tabs + Compliance + Tx History)       │
│                                                                  │
│  AI Strategy Agent (AgentTab + strategyEngine.ts):               │
│  - Natural language → deterministic accumulation plan             │
│  - 5 strategies: privacy_first, efficiency, stealth_dca,         │
│                   whale, balanced                                 │
│  - Autonomous DCA: single approval → relayer executes deposits   │
│  - Agent terminal with streaming observe/think/decide/act logs   │
│                                                                  │
│  Privacy Utils:                                                  │
│  - Pedersen commitment (Stark field)                             │
│  - Poseidon BN254 ZK commitment (via poseidon-lite)              │
│  - Merkle proof construction                                     │
│  - AES-GCM encrypted note storage                                │
│  - BTC attestation (signMessage via sats-connect/Xverse)         │
│                                                                  │
│  In-Browser ZK Proving (browserProver.ts):                       │
│  - noir_js (WASM) → witness generation                           │
│  - bb.js (WASM) → UltraKeccakZKHonk proof                       │
│  - Secrets NEVER leave the browser                               │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│  EMBEDDED RELAYER API (Next.js API Routes, /api/relayer/*)       │
│                                                                  │
│  GET  /info          → { pool, fee_bps, relayer status, rpc }    │
│  POST /relay         → gasless withdraw_private_via_relayer      │
│  POST /relay-intent  → withdraw_with_btc_intent (BTC settlement)│
│  POST /execute-batch → USDC→WBTC swap (AVNU + CoinGecko price)  │
│  POST /calldata      → proxy proof binary to garaga server       │
│  POST /deposit       → autonomous DCA (relayer pulls USDC)       │
│                                                                  │
│  Config: starknet.js Account, RELAYER_PRIVATE_KEY env var        │
│  RPC: https://starknet-sepolia-rpc.publicnode.com                │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│  SMART CONTRACTS (Cairo 2.15 on Starknet Sepolia)                │
│                                                                  │
│  ShieldedPool.cairo                                              │
│  ├── deposit_private(commitment, denom, btc_id, zk_commit)       │
│  ├── execute_batch(min_wbtc_out, routes)                         │
│  ├── withdraw_private(denom, nullifier, commit, proof[2835],     │
│  │                    merkle_path, indices, recipient, ...)       │
│  ├── withdraw_private_via_relayer(... + relayer, fee_bps)        │
│  ├── withdraw_with_btc_intent(... + btc_address_hash)            │
│  ├── claim_intent / confirm_btc_payment / release_to_solver      │
│  ├── expire_intent                                               │
│  └── set_oracle_config / register_view_key                       │
│                                                                  │
│  GaragaVerifier (UltraKeccakZKHonkVerifier)                      │
│  └── verify_ultra_keccak_zk_honk_proof(proof) → Result           │
│                                                                  │
│  Noir Circuit (circuits/ghostsats/src/main.nr)                   │
│  ├── zk_commitment = Poseidon_BN254(secret, blinder, denom)      │
│  └── nullifier = Poseidon_BN254(secret, 1)                       │
└─────────────────────────────────────────────────────────────────┘
```

## Frontend Architecture

### Page Structure

```
src/
├── app/
│   ├── page.tsx          # Landing page
│   ├── app/page.tsx      # Main app (wallet-gated)
│   ├── layout.tsx        # Root layout, providers
│   ├── globals.css       # Design system
│   ├── opengraph-image.tsx  # OG image generation
│   └── api/
│       └── relayer/
│           ├── shared.ts         # RPC, account, config
│           ├── info/route.ts     # GET  /api/relayer/info
│           ├── relay/route.ts    # POST /api/relayer/relay
│           ├── relay-intent/route.ts  # POST /api/relayer/relay-intent
│           ├── execute-batch/route.ts # POST /api/relayer/execute-batch
│           ├── calldata/route.ts      # POST /api/relayer/calldata
│           └── deposit/route.ts       # POST /api/relayer/deposit
├── components/
│   ├── WalletBar.tsx         # Starknet + Bitcoin wallet connections
│   ├── Dashboard.tsx         # Protocol stats, anonymity sets, ZK pipeline
│   ├── TabPanel.tsx          # Shield | Unveil | Strategist tabs + Compliance
│   ├── ShieldForm.tsx        # Deposit flow with commitment generation
│   ├── UnveilForm.tsx        # Withdrawal with ZK proof + gasless toggle
│   ├── AgentTab.tsx          # AI Strategist — plan + autonomous execution
│   ├── ComplianceTab.tsx     # View key registration, exportable proofs
│   ├── OnboardingBanner.tsx  # First-time user guidance
│   ├── TransactionHistory.tsx # Deposit/withdrawal history
│   └── Skeleton.tsx          # Loading state components
├── context/
│   ├── WalletContext.tsx  # Starknet + Bitcoin wallet state
│   └── ToastContext.tsx   # Notification system
├── contracts/
│   ├── abi.ts            # ShieldedPool ABI
│   └── addresses.json    # Deployed contract addresses
└── utils/
    ├── privacy.ts        # Pedersen commitments, note encryption, denominations
    ├── zkProver.ts       # ZK commitment/nullifier computation + proof orchestration
    ├── browserProver.ts  # In-browser ZK proving (noir_js + bb.js WASM)
    ├── strategyEngine.ts # AI strategy engine (5 strategies, CSI, DCA planning)
    ├── bitcoin.ts        # BTC attestation, identity hash, Merkle anchoring
    ├── network.ts        # Explorer URLs, RPC endpoint, network detection
    └── toasts.ts         # Notification helpers
```

### Key Design Decisions

- **Client-side cryptography** -- Pedersen commitments and Poseidon BN254 hashing happen in the browser. No secrets sent to the server.
- **In-browser ZK proving** -- noir_js + bb.js WASM generate the UltraKeccakZKHonk proof entirely in the browser. Only the proof binary (public data) is sent to the server for garaga calldata conversion.
- **Encrypted notes** -- AES-GCM with wallet-derived key. Stored in localStorage.
- **Dual wallet** -- Starknet for on-chain transactions, Bitcoin (Xverse) for identity binding.
- **Embedded relayer** -- Next.js API routes eliminate the need for a separate prover/relayer server. The frontend deployment itself serves as the relayer.

## AI Strategy Agent Architecture

The Strategist (AgentTab + strategyEngine.ts) is a deterministic AI strategy engine that generates structured accumulation plans from natural language input.

### Strategy Types

| Strategy | Trigger Keywords | Behavior |
|----------|-----------------|----------|
| **privacy_first** | privacy, anonymous, stealth | All deposits target the tier with the highest anonymity set |
| **efficiency** | efficient, fast, quick, cheap | Largest affordable tier, single atomic multicall, zero delays |
| **stealth_dca** | dca, spread, split, multiple | Randomized tiers with extended delays (45-180s) for cross-pool obfuscation |
| **whale** | Amount >= $500 | Distribute across ALL tiers to strengthen protocol-wide anonymity |
| **balanced** | Default | Optimal tier by amount, standard delays |

### Agent Execution Flow

```
User Input ("Accumulate $50 in BTC, max privacy")
    │
    ├─ parseTargetUsdc() → $50
    ├─ detectStrategyType() → privacy_first
    ├─ generateAgentLog() → streaming observe/think/decide/act log entries
    ├─ generateStrategy() → AgentPlan { steps, estimatedBtc, privacyScore, csiImpact }
    │
    ├─ [Autonomous Mode]
    │   ├─ Single USDC approval (one wallet confirmation)
    │   ├─ Relayer executes deposits with real delays (temporal decorrelation)
    │   └─ Auto-trigger batch conversion via AVNU
    │
    └─ [Manual Mode]
        ├─ User reviews plan
        ├─ Click "Execute Strategy"
        └─ Single multicall or DCA via relayer
```

### Autonomous DCA

When multiple deposits are planned with delays (temporal decorrelation):

1. User signs ONE approval transaction (total USDC to relayer)
2. Relayer pulls USDC and executes each deposit with randomized delays
3. Each deposit lands in a separate block, preventing timing correlation
4. Live countdown displayed in agent terminal
5. Auto-triggers batch conversion after all deposits

## Telegram Bot Architecture

The Telegram bot (`scripts/bot.ts`) provides a conversational AI interface powered by the same strategy engine used in the web app.

### Commands

| Command | Description |
|---------|-------------|
| `/strategy <text>` | Plan accumulation strategy from natural language |
| `/status` | Pool state, anonymity sets, BTC price |
| `/price` | Live BTC price + tier conversion rates |
| `/pool` | Detailed protocol analytics |
| `/help` | Command reference |

### Bot Flow

```
Telegram User
    │
    ├─ /strategy "Accumulate $50 max privacy"
    │   ├─ Fetch pool state from on-chain (starknet.js)
    │   ├─ Fetch BTC price (CoinGecko with fallbacks)
    │   ├─ Generate agent log (streamed via message edits)
    │   ├─ Generate strategy plan
    │   ├─ Build deep link: /app?strategy=<base64url>
    │   └─ Reply with plan + "Execute on Web" button
    │
    ├─ /status → Read pool contract views → format response
    ├─ /price  → CoinGecko → tier conversion rates
    └─ /pool   → Detailed analytics + Voyager link
```

The deep link encodes the strategy parameters in base64url and opens the web app's Strategist tab, pre-loaded with the plan.

## Embedded Relayer Architecture

The relayer is embedded as Next.js API routes at `/api/relayer/*`, eliminating the need for a separate server process.

### Endpoints

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/relayer/info` | GET | Pool address, fee, relayer status, RPC URL |
| `/api/relayer/relay` | POST | Gasless withdrawal via `withdraw_private_via_relayer` |
| `/api/relayer/relay-intent` | POST | BTC intent settlement via `withdraw_with_btc_intent` |
| `/api/relayer/execute-batch` | POST | Swap pooled USDC to WBTC (AVNU + live CoinGecko BTC price) |
| `/api/relayer/calldata` | POST | Proxy browser proof binary to garaga calldata server |
| `/api/relayer/deposit` | POST | Autonomous DCA deposit (relayer pulls USDC from user) |

### Configuration

The relayer uses a starknet.js `Account` instance configured via environment variables:

| Variable | Description |
|----------|-------------|
| `RELAYER_PRIVATE_KEY` | Private key for the relayer account |
| `RELAYER_ACCOUNT_ADDRESS` | Starknet address of the relayer account |
| `STARKNET_RPC_URL` | RPC endpoint (default: publicnode.com Sepolia) |
| `CALLDATA_SERVER_URL` | Garaga calldata server URL |
| `RELAYER_ETH_GAS` | Set to "true" for V1 (ETH gas) transactions |

## Smart Contract Architecture

### ShieldedPool

The main contract managing the privacy pool:

- **Storage**: Merkle tree (20 levels), commitment set, nullifier set, batch data, exchange rates, intent escrow
- **Deposit**: Stores Pedersen + ZK commitments, transfers USDC
- **Batch**: Swaps pooled USDC to WBTC via Avnu (live CoinGecko price for testnet mock router)
- **Withdraw**: Verifies ZK proof (Garaga), checks Merkle membership, transfers WBTC
- **BTC Intent Settlement**: Lock WBTC in escrow, solver sends BTC off-chain, oracle confirms, solver gets WBTC
- **Compliance**: View key registration, exportable proofs

### GaragaVerifier

Generated by the Garaga CLI from the circuit's verification key. Contains:
- Precomputed verification key constants
- MSM and KZG pairing logic
- `verify_ultra_keccak_zk_honk_proof()` function

### Data Flow

```
Deposit:
  Browser → Pedersen(secret) → commitment
  Browser → Poseidon_BN254(secret, blinder, denom) → zk_commitment
  Contract → store(commitment, zk_commitment) → Merkle tree insert

Batch:
  Keeper/Relayer → execute_batch() → Avnu swap → WBTC received
  Contract → exchange_rate = wbtc / usdc

Withdraw (ZK):
  Browser → noir_js + bb.js (WASM) → proof[2835]
  Browser → POST /api/relayer/calldata → garaga → felt252 calldata
  Browser/Relayer → withdraw_private(proof, nullifier, commitment, ...)
  Contract → Garaga.verify(proof) → check nullifier → check Merkle → transfer WBTC

Withdraw (BTC Intent):
  Browser/Relayer → withdraw_with_btc_intent(proof, ..., btc_address_hash)
  Contract → verify ZK proof → lock WBTC in escrow → emit IntentCreated
  Solver → claim_intent(id) → send BTC off-chain
  Oracle → confirm_btc_payment(id) → release WBTC to solver

Autonomous DCA:
  Agent → plan N deposits with delays
  User → approve(relayer, total_usdc) [single signature]
  Relayer → for each deposit:
    transfer_from(user) → approve(pool) → deposit_private()
    sleep(randomized delay)
  Relayer → execute_batch()
```
