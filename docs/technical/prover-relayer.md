# Prover & Relayer Service

Veil Protocol uses a two-part proving and relaying architecture:

1. **In-browser ZK proving** -- `noir_js` (WASM) and `bb.js` (WASM) generate the UltraKeccakZKHonk proof entirely in the browser. Secrets never leave the user's device.
2. **Embedded relayer API** -- Next.js API routes at `/api/relayer/*` handle gasless transaction submission, calldata conversion, batch execution, autonomous DCA deposits, and BTC intent settlement.

**Location**: `frontend/src/app/api/relayer/` (API routes) + `frontend/src/utils/browserProver.ts` (in-browser prover)

## In-Browser ZK Proving

The browser prover generates a complete UltraKeccakZKHonk proof without exposing secrets to any server.

**Location**: `frontend/src/utils/browserProver.ts`

### Pipeline

```
1. Load circuit from /circuits/ghostsats.json (compiled Noir ACIR)
2. Import @noir-lang/noir_js (WASM) — witness generation
3. Import @aztec/bb.js (WASM) — Barretenberg proof generation
4. noir.execute(inputs) → witness (secrets stay in WASM memory)
5. backend.generateProof(witness, { keccakZK: true }) → proof binary (~7KB)
6. POST /api/relayer/calldata with proof binary → garaga → 2835 felt252 values
```

The user's `secret` and `blinder` are only ever present in WASM memory during steps 4-5. They are never serialized, persisted, or transmitted.

### WASM Module Management

```typescript
// Pre-load on page mount (saves 5-15s on first withdrawal)
import { preloadZKProver } from "@/utils/zkProver";
await preloadZKProver();

// Modules are lazily initialized and cached in memory
// destroyProver() frees WASM memory when navigating away
```

## Embedded Relayer API Routes

The relayer is embedded as Next.js API routes, eliminating the need for a separate server process. All routes are under `/api/relayer/`.

### Shared Configuration

**Location**: `frontend/src/app/api/relayer/shared.ts`

```typescript
// RPC endpoint (default for Sepolia)
export const RPC_URL = "https://starknet-sepolia-rpc.publicnode.com";

// Pool and token addresses loaded from addresses.json
export const POOL_ADDRESS = addresses.contracts.shieldedPool;
export const USDC_ADDRESS = addresses.contracts.usdc;
export const WBTC_ADDRESS = addresses.contracts.wbtc;

// Relayer fee: 2% (200 basis points)
export const FEE_BPS = 200;

// starknet.js Account from env vars
export function getRelayerAccount(): Account | null { ... }
```

### GET /api/relayer/info

Returns relayer status and configuration.

**Response**:
```json
{
  "pool": "0x4606a71755ae44459a9fc2105945c3fc3d88227169f834bb0d8a4c86b8b0210",
  "fee_bps": 200,
  "relayer": "online",
  "relayerAddress": "0x501262076fe5cf1748147b92761d2ef2d3a804c929718cfe02bdcda7071b1e5",
  "rpc": "https://starknet-sepolia-rpc.publicnode.com"
}
```

### POST /api/relayer/relay

Submits a gasless ZK withdrawal via `withdraw_private_via_relayer`.

**Request**:
```json
{
  "denomination": 1,
  "zk_nullifier": "0xabc...",
  "zk_commitment": "0xdef...",
  "proof": ["0x01", "0x02", "..."],
  "merkle_path": ["0x...", "..."],
  "path_indices": ["0x...", "..."],
  "recipient": "0x...",
  "btc_recipient_hash": "0x0"
}
```

**Execution**:
The relayer constructs a `withdraw_private_via_relayer` call with its own address as the relayer and the configured fee (200 bps), then submits via `account.execute()` and waits for confirmation.

**Response**:
```json
{
  "success": true,
  "txHash": "0x0201cdeba82f..."
}
```

### POST /api/relayer/relay-intent

Submits a BTC intent settlement withdrawal via `withdraw_with_btc_intent`. Instead of sending WBTC directly to the user, WBTC is locked in escrow for a solver to fulfill with real BTC.

**Request**:
```json
{
  "denomination": 1,
  "zk_nullifier": "0xabc...",
  "zk_commitment": "0xdef...",
  "proof": ["0x01", "0x02", "..."],
  "merkle_path": ["0x...", "..."],
  "path_indices": ["0x...", "..."],
  "recipient": "0x...",
  "btc_address_hash": "0x..."
}
```

**Response**:
```json
{
  "success": true,
  "txHash": "0x..."
}
```

### POST /api/relayer/execute-batch

Triggers batch conversion of pooled USDC to WBTC.

**Mainnet behavior**:
1. Read `get_pending_usdc()` from the pool contract
2. Fetch swap quote from AVNU API (up to 3 retries)
3. Build on-chain Route structs from AVNU quote
4. Calculate `min_wbtc_out` with slippage (1% mainnet, 5% testnet)
5. Call `execute_batch(min_wbtc_out, routes)`

**Testnet behavior**:
1. Fetch live BTC price from CoinGecko
2. Update MockAvnuRouter rate to match real BTC price (`set_rate`)
3. Call `execute_batch(0, [])` with empty routes (mock router handles swap)

**Response**:
```json
{
  "success": true,
  "txHash": "0x...",
  "btcPrice": 97500
}
```

### POST /api/relayer/calldata

Proxies a browser-generated proof binary to the garaga calldata server for conversion to on-chain format. This route exists to avoid HTTPS-to-HTTP mixed-content blocks.

**Request**:
```json
{
  "proof": [1, 2, 3, ...],
  "publicInputs": ["0xabc...", "0xdef...", "0x01"]
}
```

**Response**:
```json
{
  "calldata": ["0x01", "0x02", "..."]
}
```

The proof binary is a `number[]` (bytes), and the response calldata is an array of ~2835 hex-encoded felt252 values.

### POST /api/relayer/deposit

Relayer-assisted deposit for autonomous DCA execution. The user pre-approves total USDC to the relayer address with a single wallet signature, then the relayer pulls USDC and calls `deposit_private` on behalf of the user for each scheduled deposit.

**Request**:
```json
{
  "depositor": "0x...",
  "commitment": "0x...",
  "denomination": 1,
  "btc_identity_hash": "0x0",
  "zk_commitment": "0x...",
  "usdc_amount": "10000000"
}
```

**Execution** (3-call multicall):
1. `transfer_from(depositor, relayer, amount)` -- pull USDC from user to relayer
2. `approve(pool, amount)` -- approve pool to spend from relayer
3. `deposit_private(commitment, denomination, btc_identity_hash, zk_commitment)` -- pool pulls from relayer

**Response**:
```json
{
  "success": true,
  "txHash": "0x..."
}
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `RELAYER_PRIVATE_KEY` | Private key for the relayer account |
| `RELAYER_ACCOUNT_ADDRESS` | Starknet address of the relayer account |
| `STARKNET_RPC_URL` | Starknet RPC endpoint (default: `https://starknet-sepolia-rpc.publicnode.com`) |
| `CALLDATA_SERVER_URL` | Garaga calldata server URL (default: `http://141.148.215.239`) |
| `RELAYER_ETH_GAS` | Set to `"true"` for V1 (ETH gas) transactions instead of V3 (STRK gas) |

## Privacy Considerations

In the current architecture, in-browser proving is the primary proof generation path. Secrets (`secret` and `blinder`) never leave the browser:

1. The browser generates the witness and proof using WASM modules
2. Only the proof binary (public data) is sent to the server for garaga calldata conversion
3. The garaga server converts proof format but never sees secrets

The critical guarantee: **secrets never appear in on-chain calldata or server requests**.

For the legacy server-side proving path, the prover sees `secret` and `blinder` temporarily in memory during proof generation. These values are never persisted to disk or logs.

## Gasless Withdrawal Flow

```
User                    Browser WASM            Relayer API             Starknet
  |                        |                        |                        |
  ├─ initiate withdrawal ─▶|                        |                        |
  |                        ├─ noir_js witness ──────|                        |
  |                        ├─ bb.js proof ──────────|                        |
  |                        |                        |                        |
  |                        ├─ POST /calldata ──────▶|                        |
  |                        |  (proof binary only)   ├─ garaga convert ──────|
  |                        |◀─ felt252 calldata ────┤                        |
  |                        |                        |                        |
  ├─ POST /relay ─────────▶|                        |                        |
  |  (calldata, params)    |                        ├─ account.execute() ──▶|
  |                        |                        |                        ├─ Garaga verify
  |                        |                        |                        ├─ Nullifier check
  |                        |                        |                        ├─ Merkle check
  |                        |                        |                        ├─ WBTC → recipient
  |                        |                        |◀─ tx confirmed ────────┤
  |◀─ { txHash } ─────────|                        |                        |
  |                        |                        |                        |
```

The user never signs a Starknet transaction. The relayer pays gas. The ZK proof is the only authorization needed.

## Autonomous DCA Flow

```
User                    Agent Tab               Relayer API             Starknet
  |                        |                        |                        |
  ├─ "DCA $50 over 5" ───▶|                        |                        |
  |                        ├─ plan 5 deposits ─────|                        |
  |                        ├─ show plan ───────────|                        |
  |                        |                        |                        |
  ├─ approve(relayer, $50)▶|                        |                        |
  |  [single wallet sig]  |                        |                        |
  |                        |                        |                        |
  |                        ├─ POST /deposit ───────▶|                        |
  |                        |  (deposit 1)           ├─ transferFrom + deposit|
  |                        |                        |                        |
  |                        ├─ sleep(random delay) ─|                        |
  |                        |                        |                        |
  |                        ├─ POST /deposit ───────▶|                        |
  |                        |  (deposit 2)           ├─ transferFrom + deposit|
  |                        |                        |                        |
  |                        ├─ ... (repeat) ────────|                        |
  |                        |                        |                        |
  |                        ├─ POST /execute-batch ─▶|                        |
  |                        |                        ├─ AVNU swap ───────────▶|
  |◀─ strategy complete ──┤                        |                        |
  |                        |                        |                        |
```

The user signs once. The relayer handles all deposits with real delays for temporal decorrelation.
