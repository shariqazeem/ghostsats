# Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│  FRONTEND (Next.js 16 + React 19 + starknet.js)            │
│                                                              │
│  Landing → /app (WalletBar + Dashboard + Shield/Unveil/     │
│                   Comply tabs + Transaction History)          │
│                                                              │
│  Privacy Utils:                                              │
│  - Pedersen commitment (Stark field)                         │
│  - Poseidon BN254 ZK commitment (via poseidon-lite)          │
│  - Merkle proof construction                                 │
│  - AES-GCM encrypted note storage                            │
│  - BTC attestation (signMessage via sats-connect/Xverse)     │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│  PROVER + RELAYER SERVICE (Node.js, port 3001)              │
│                                                              │
│  POST /prove  → nargo execute → bb prove → garaga calldata  │
│                  (witness)     (UltraHonk)  (2835 felt252s)  │
│  POST /relay  → sncast invoke withdraw_private_via_relayer   │
│  GET  /health → { status: ok, fee_bps: 200 }                │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│  SMART CONTRACTS (Cairo 2.15 on Starknet Sepolia)           │
│                                                              │
│  ShieldedPool.cairo                                          │
│  ├── deposit_private(commitment, denom, btc_id, zk_commit)  │
│  ├── execute_batch(min_wbtc_out, routes)                     │
│  ├── withdraw_private(denom, nullifier, commit, proof[2835], │
│  │                    merkle_path, indices, recipient, ...)   │
│  ├── withdraw_private_via_relayer(... + relayer, fee_bps)    │
│  └── register_view_key(commitment, view_key_hash)            │
│                                                              │
│  GaragaVerifier (UltraKeccakZKHonkVerifier)                  │
│  └── verify_ultra_keccak_zk_honk_proof(proof) → Result       │
│                                                              │
│  Noir Circuit (circuits/ghostsats/src/main.nr)               │
│  ├── zk_commitment = Poseidon_BN254(secret, blinder, denom)  │
│  └── nullifier = Poseidon_BN254(secret, 1)                   │
└─────────────────────────────────────────────────────────────┘
```

## Frontend Architecture

### Page Structure

```
src/
├── app/
│   ├── page.tsx          # Landing page
│   ├── app/page.tsx      # Main app (wallet-gated)
│   └── globals.css       # Design system
├── components/
│   ├── WalletBar.tsx     # Starknet + Bitcoin wallet connections
│   ├── Dashboard.tsx     # Protocol stats, anonymity sets, ZK pipeline
│   ├── TabPanel.tsx      # Shield / Unveil / Comply tabs
│   ├── ShieldForm.tsx    # Deposit flow with commitment generation
│   ├── UnveilForm.tsx    # Withdrawal with ZK proof + gasless toggle
│   ├── PrivacyScore.tsx  # Circular privacy score visualization
│   └── Skeleton.tsx      # Loading state components
├── context/
│   └── WalletContext.tsx  # Starknet + Bitcoin wallet state
├── contracts/
│   ├── abi.ts            # ShieldedPool ABI
│   └── addresses.json    # Deployed contract addresses
└── utils/
    ├── privacy.ts        # Pedersen commitments, note encryption
    ├── zkProver.ts       # ZK commitment/nullifier computation
    ├── bitcoin.ts        # BTC attestation utilities
    └── toasts.ts         # Notification system
```

### Key Design Decisions

- **Client-side cryptography** — Pedersen commitments and Poseidon BN254 hashing happen in the browser. No secrets sent to the server.
- **Encrypted notes** — AES-GCM with wallet-derived key. Stored in localStorage.
- **Dual wallet** — Starknet for on-chain transactions, Bitcoin (Xverse) for identity binding.

## Prover & Relayer Architecture

The prover/relayer is a Node.js service running on port 3001 with three endpoints:

### POST /prove

Generates a ZK proof from private inputs:

1. Write `Prover.toml` with secret, blinder, denomination, and derived commitment/nullifier
2. `nargo execute` — Generate witness from circuit + inputs
3. `bb prove` — Generate UltraKeccakZKHonk proof (~7KB)
4. `bb write_vk` — Generate verification key
5. `garaga calldata` — Convert to 2835 felt252 values
6. Return hex-encoded calldata array

### POST /relay

Submits a gasless withdrawal:

1. Receive calldata from the frontend
2. Invoke `withdraw_private_via_relayer` via `sncast`
3. Wait for transaction confirmation
4. Return transaction hash

### GET /health

Returns service status and fee configuration.

## Smart Contract Architecture

### ShieldedPool

The main contract managing the privacy pool:

- **Storage**: Merkle tree (20 levels), commitment set, nullifier set, batch data, exchange rates
- **Deposit**: Stores Pedersen + ZK commitments, transfers USDC
- **Batch**: Swaps pooled USDC → WBTC via Avnu
- **Withdraw**: Verifies ZK proof (Garaga), checks Merkle membership, transfers WBTC
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
  Keeper → execute_batch() → Avnu swap → WBTC received
  Contract → exchange_rate = wbtc / usdc

Withdraw:
  Browser → POST /prove(secret, blinder, denom) → proof[2835]
  Browser/Relayer → withdraw_private(proof, nullifier, commitment, ...)
  Contract → Garaga.verify(proof) → check nullifier → check Merkle → transfer WBTC
```
