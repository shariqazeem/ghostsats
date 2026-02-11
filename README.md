# GhostSats

**Bitcoin's Privacy Layer on Starknet** — Gasless private USDC-to-WBTC execution with Pedersen commitments, Merkle proofs, relayer-powered withdrawals, and timing-attack protection.

**[Live Demo](https://ghostsats.vercel.app)** | Built for the [Re{define} Starknet Hackathon](https://dorahacks.io/)

## How It Works

```
  User A deposits 1,000 USDC ──┐
  User B deposits 1,000 USDC ──┼──▶ Shielded Pool ──▶ Batch Swap (Avnu DEX) ──▶ WBTC
  User C deposits 1,000 USDC ──┘       │                                          │
                                        │                                          │
                              Pedersen Commitments                          Pro-rata shares
                              stored in Merkle Tree                        withdrawn privately
                                        │                                    to ANY address
                                        ▼
                               On-chain Merkle Root
```

### The Privacy Model

1. **Deposit**: User picks a fixed denomination (100 / 1,000 / 10,000 USDC). A Pedersen commitment `C = H(H(amount), H(secret, blinder))` is computed client-side and submitted on-chain. The user's Bitcoin wallet signs the commitment hash, and a Pedersen hash of their BTC address is stored on-chain — cryptographically binding the Bitcoin identity to the shielded deposit. Only the commitment and identity hashes are stored — no amounts, no plaintext addresses.

2. **Batch Execution**: A keeper aggregates all pending deposits and executes a single USDC → WBTC swap via the Avnu DEX aggregator. Individual trade intent is hidden within the batch.

3. **Withdrawal** (after 60s delay): User proves knowledge of their deposit by:
   - Reconstructing the commitment from their secret note
   - Providing a Merkle inclusion proof (20-level Pedersen Merkle tree)
   - Submitting a nullifier `N = H(secret, 1)` to prevent double-spending
   - Withdrawing their pro-rata WBTC share to **any address** (unlinkable)
   - Optionally via a **relayer** for gasless withdrawal (no gas = no on-chain footprint)

### Why Fixed Denominations?

All deposits of the same tier are cryptographically indistinguishable. An observer sees "someone deposited 1,000 USDC" but cannot determine which commitment belongs to which user. This is the same approach used by Tornado Cash — the gold standard for on-chain privacy.

## Features

- **Dark-mode glass UI** — Full dark theme with glassmorphism cards, backdrop blur, and orange accent
- **Landing page** — Professional hero, how-it-works flow, privacy guarantees grid, tech stack
- **Anonymity set visualization** — Animated horizontal bars showing privacy strength per denomination tier (color-coded: red → amber → green)
- **Privacy score** — SVG circular progress ring (0-100) computed from anonymity set, batches, BTC binding, and protocol usage
- **Bitcoin attestation** — Sign Merkle root with BTC wallet (via Xverse) to cryptographically prove pool state — no tBTC required
- **Compliance portal** — Register view keys, export cryptographic proofs (JSON), voluntary regulatory compliance without compromising others
- **Mobile responsive** — Tested at 375px (iPhone SE) through desktop
- **Skeleton loading** — Shimmer placeholders while on-chain data loads
- **OG image** — Edge-rendered social preview card via Next.js ImageResponse

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                      FRONTEND                             │
│  Next.js 16 + React 19 + Starknet.js + sats-connect      │
│                                                           │
│  /                         /app                           │
│  ┌────────────────┐       ┌──────────────────────────┐    │
│  │  Landing Page   │       │  WalletBar (dual wallet) │    │
│  │  Hero + CTA     │──────▶│  Dashboard (live stats)  │    │
│  └────────────────┘       │  TabPanel: Shield|Unveil| │    │
│                            │    Comply                 │    │
│                            └──────────┬───────────────┘    │
│  ┌────────────────────────────────────▼──────────────┐    │
│  │           Privacy Utils (client-side)              │    │
│  │  - Pedersen commitment generation                  │    │
│  │  - Merkle proof construction + leaf validation     │    │
│  │  - Nullifier computation                           │    │
│  │  - AES-GCM encrypted note storage                  │    │
│  │  - BTC attestation (signMessage via sats-connect)  │    │
│  └───────────────────────────────────────────────────┘    │
└───────────────────────┬──────────────────────────────────┘
                        │ Starknet transactions
┌───────────────────────▼──────────────────────────────────┐
│                  SMART CONTRACTS (Cairo)                   │
│                                                           │
│  ShieldedPool.cairo                                       │
│  ├── deposit(commitment, denomination, btc_identity_hash) │
│  │   └── Validates denomination, stores commitment,       │
│  │       inserts into Merkle tree, transfers USDC         │
│  ├── execute_batch(min_wbtc_out, routes)                  │
│  │   └── Swaps pooled USDC → WBTC via Avnu aggregator    │
│  ├── withdraw(denom, secret, blinder, nullifier,          │
│  │           merkle_path, path_indices, recipient)        │
│  │   └── Verifies commitment, Merkle proof, nullifier;    │
│  │       transfers pro-rata WBTC to recipient             │
│  └── register_view_key(commitment, view_key_hash)         │
│      └── Optional compliance: prove tx history            │
│                                                           │
│  Merkle Tree: 20-level Pedersen hash tree (1M+ leaves)    │
│  Nullifier Set: pedersen(secret, 1) — prevents re-spend   │
│  Denominations: 100 / 1,000 / 10,000 USDC                │
└───────────────────────┬──────────────────────────────────┘
                        │
┌───────────────────────▼──────────────────────────────────┐
│                    KEEPER (automation)                     │
│  - Monitors pending USDC threshold                        │
│  - Queries Avnu API for optimal routes                    │
│  - Executes batch with slippage protection                │
│  - Runs on 5-minute loop or manual trigger                │
└──────────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contracts | Cairo 2.15.0 + OpenZeppelin Interfaces |
| DEX Integration | Avnu Aggregator v2 (real on-chain swaps) |
| Frontend | Next.js 16, React 19, Tailwind CSS 4, Framer Motion |
| Wallet | Starknet (Argent/Braavos) + Bitcoin (Xverse via sats-connect) |
| Cryptography | Pedersen hashing (native Starknet), AES-GCM |
| Testing | snforge 0.56.0 (29 passing integration tests) |
| Deployment | Vercel (frontend), Starknet Sepolia (contracts) |
| Network | Starknet Sepolia testnet |

## Privacy Guarantees

| Property | Guarantee | Mechanism |
|----------|-----------|-----------|
| **Deposit unlinkability** | Deposits of the same denomination are indistinguishable | Fixed denominations (Tornado Cash model) |
| **Balance hiding** | No on-chain mapping of address → balance | Only commitment hashes stored |
| **Withdrawal unlinkability** | Withdrawer can be a different address than depositor | Recipient is a parameter, not msg.sender |
| **Double-spend prevention** | Each deposit can only be withdrawn once | Nullifier set: `H(secret, 1)` |
| **Merkle membership** | Proof that a commitment exists without revealing which one | 20-level Pedersen Merkle tree |
| **Note encryption** | Client-side secrets encrypted at rest | AES-GCM with wallet-derived key |
| **Batch anonymity** | Individual trade intent hidden in aggregate | Single batch swap for all deposits |
| **Bitcoin identity binding** | Deposit cryptographically signed by BTC wallet | BTC wallet signs commitment; Pedersen hash of BTC address stored on-chain |
| **Cross-chain withdrawal intent** | Bridge-ready Bitcoin withdrawal | `BitcoinWithdrawalIntent` event with hashed BTC address |
| **Bitcoin attestation** | Merkle root signed by BTC wallet — cryptographic proof of pool state | `signMessage` via Xverse/sats-connect |
| **Gasless withdrawals** | Withdrawer never touches their own wallet for gas | Relayer pattern with on-chain fee cap (5%) |
| **Timing-attack resistance** | Deposit-and-immediately-withdraw pattern blocked | 60-second minimum withdrawal delay |
| **Anonymity set visibility** | Users can see privacy strength before depositing | On-chain per-denomination deposit counter |

## Security Model

### In Scope (Protected Against)
- On-chain balance tracking (no public balance mapping)
- Deposit-withdrawal linking (Merkle proofs + different recipient)
- Double-spending (nullifier set)
- Front-running (batch execution, not individual trades)
- Note theft from browser (AES-GCM encryption)
- Timing attacks (minimum 60s withdrawal delay after batch execution)
- Predatory relayer fees (enforced 500 bps cap on-chain)
- Gas-based deanonymization (relayer-powered gasless withdrawals)

### Out of Scope (Acknowledged Limitations)
- **Secret posting**: During withdrawal, the secret/blinder are posted as calldata. A full ZK-SNARK verifier (e.g., Garaga) would eliminate this. The Merkle proof verification is the first step toward this.
- **Keeper centralization**: The batch executor is currently a single owner. Multi-sig or decentralized keeper networks are the next step.
- **Relayer centralization**: Currently any address can relay, but a decentralized relayer registry with staking would improve trust guarantees.

### Compliance Mechanism
GhostSats includes an optional **view key** system. Users can register a view key hash against their commitment, allowing them to voluntarily prove their transaction history to regulators without compromising the privacy of other users.

## Running Locally

### Prerequisites
- [Scarb](https://docs.swmansion.com/scarb/) (Cairo package manager)
- [snforge](https://foundry-rs.github.io/starknet-foundry/) (Starknet test framework)
- Node.js 20+

### Smart Contracts
```bash
cd contracts
scarb build          # Compile
snforge test         # Run 24 integration tests
```

### Frontend
```bash
cd frontend
npm install
npm run dev          # http://localhost:3000
```

### Keeper (batch executor)
```bash
cd scripts
cp .env.example .env # Add your PRIVATE_KEY and ACCOUNT_ADDRESS
npm install
npm run keeper:loop  # Execute batches every 5 minutes
```

## Test Coverage

29 integration tests covering:

**Deposit Tests**
- Three users deposit into same batch
- Multiple sequential batches
- Duplicate commitment rejection
- Invalid denomination rejection
- Denomination amount verification
- Merkle root updates on each deposit
- Leaf retrieval (get_leaf) for client-side proof reconstruction
- View key registration
- Anonymity set tracking across denomination tiers

**Withdrawal Tests**
- Full deposit → execute → withdraw with Merkle proof
- Two users withdraw from same batch (pro-rata shares)
- Withdrawal with non-1:1 exchange rate
- Double-withdrawal prevention (nullifier)
- Invalid preimage rejection
- Withdrawal before batch finalization
- Wrong nullifier rejection

**Relayer Withdrawal Tests**
- Relayer withdrawal with 2% fee (fee split verified)
- Relayer withdrawal with 0% fee (altruistic relayer)
- Excessive relayer fee rejected (>5% cap)

**Timing Protection Tests**
- Withdrawal too early rejected (before 60s delay)
- Withdrawal delay view returns 60
- Max relayer fee view returns 500 bps

**Bitcoin Identity Tests**
- BTC identity stored on deposit with event emission
- Zero BTC identity not stored (no spurious state)
- BTC-linked count increments correctly
- Withdrawal with BTC intent event (cross-chain signal)
- Relayer withdrawal with BTC intent (fee-deducted amount)

**Access Control**
- Non-owner cannot execute batch
- Empty batch execution blocked

## What Makes GhostSats Different

Most privacy tools stop at "deposit and withdraw." GhostSats goes further:

1. **Gasless Private Withdrawals** — Relayer pattern means the withdrawer never interacts with their own wallet for gas. The gas payment itself is a deanonymization vector that GhostSats eliminates.
2. **Timing-Attack Protection** — A minimum 60-second delay between batch execution and withdrawal prevents the trivial "deposit → immediate withdraw" attack that reduces your anonymity set to 1.
3. **On-Chain Anonymity Set Visibility** — Animated visualization of privacy strength per denomination tier with color-coded bars and a protocol-wide privacy score (0-100). This creates a positive feedback loop: more deposits → stronger privacy → more deposits.
4. **Bitcoin-Native DeFi with Cryptographic Identity Binding** — Not just another ERC-20 mixer. GhostSats enables private USDC→WBTC acquisition through batch execution. Bitcoin wallet signatures are cryptographically bound to deposit commitments on-chain — proving a BTC holder authorized each shielded deposit. Cross-chain withdrawal intents signal bridge-ready Bitcoin destination addresses.
5. **Bitcoin Attestation** — Sign the Merkle root with your BTC wallet to create a cryptographic attestation that the privacy pool state existed at a point in time — a deep Bitcoin integration that goes beyond simple token wrapping.
6. **Compliance Escape Hatch** — Full compliance portal with view key registration and exportable cryptographic proofs (JSON). Users can voluntarily prove their transaction history to regulators without compromising other participants' privacy.

## Hackathon Tracks

GhostSats targets both:

- **Privacy Track**: Pedersen commitments, Merkle tree proofs, nullifier-based double-spend prevention, fixed denomination anonymity sets, relayer-powered gasless withdrawals, timing-attack protection, on-chain anonymity set metrics, encrypted note storage, compliance portal with view key registration + proof export
- **Bitcoin Track**: BTC-native DeFi — private USDC→WBTC swaps via Avnu, dual wallet (Starknet + Bitcoin/Xverse), BTC identity binding (wallet signs commitment), Bitcoin attestation (sign Merkle root), keeper-automated batch execution

## Contract Addresses (Sepolia)

| Contract | Address |
|----------|---------|
| ShieldedPool | `0x07ff913ce462cc274472fc845239fcbcfe4b30ef9b6d9b755af50d5c256e88d1` |
| USDC (test) | `0x009ab543859047dd6043e45471d085e61957618366e153b5f83e2ed6967d7e0e` |
| WBTC (test) | `0x0250cafe9030d5da593cc842a9a3db991a2df50c175239d4ab516c8abba68769` |
| MockAvnuRouter | `0x0518f15d0762cd2aba314affad0ac83f0a4971d603c10e81b81fd47ceff38647` |

## License

MIT
