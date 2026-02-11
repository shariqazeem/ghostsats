# Getting Started

## Prerequisites

| Tool | Purpose |
|------|---------|
| [Scarb](https://docs.swmansion.com/scarb/) | Cairo package manager & compiler |
| [snforge](https://foundry-rs.github.io/starknet-foundry/) | Starknet testing framework |
| [Nargo](https://noir-lang.org/) | Noir ZK circuit compiler |
| [Barretenberg](https://github.com/AztecProtocol/aztec-packages) (`bb`) | ZK prover |
| [Garaga](https://github.com/keep-starknet-strange/garaga) | Starknet calldata generator |
| Node.js 20+ | Frontend & relayer |

## Smart Contracts

```bash
cd contracts
scarb build        # Compile Cairo contracts
snforge test       # Run 40 tests
```

## ZK Circuit

```bash
cd circuits/ghostsats
nargo test         # Run circuit tests
nargo compile      # Compile to ACIR
nargo execute      # Generate witness (with Prover.toml)
```

## Prover & Relayer Service

```bash
cd scripts
cp .env.example .env   # Add PRIVATE_KEY, ACCOUNT_ADDRESS
npm install
npm run relayer        # Starts on http://localhost:3001
```

The relayer exposes:
- `POST /prove` — Generate a ZK proof (nargo → bb → garaga pipeline)
- `POST /relay` — Submit a gasless withdrawal transaction
- `GET /health` — Health check with fee configuration

## Frontend

```bash
cd frontend
npm install
npm run dev            # Starts on http://localhost:3000
```

## Using the App

### 1. Connect Wallets

Connect both:
- **Starknet wallet** (Argent or Braavos) — for deposits and receiving WBTC
- **Bitcoin wallet** (Xverse) — for Bitcoin identity attestation

### 2. Shield (Deposit)

1. Go to the **Shield** tab
2. Select a denomination (100 / 1,000 / 10,000 USDC)
3. Approve USDC spending
4. Confirm the deposit transaction
5. **Save your encrypted note** — you'll need it for withdrawal

### 3. Wait for Batch Execution

The keeper aggregates deposits and executes a batch USDC→WBTC swap. This happens periodically.

### 4. Unveil (Withdraw)

1. Go to the **Unveil** tab
2. Load your encrypted note
3. Enter a recipient address for WBTC
4. Optionally enable **gasless withdrawal** (relayer pays gas)
5. The app generates a ZK proof (~10-30 seconds)
6. Submit the withdrawal transaction
7. WBTC is sent to the recipient address

### 5. Comply (Optional)

Use the **Comply** tab to:
- Register a view key for your deposit
- Export a compliance proof (JSON) for regulators
