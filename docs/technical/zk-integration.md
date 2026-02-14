# ZK Integration

This is the core differentiator of Veil Protocol -- a complete end-to-end ZK proof pipeline with **real on-chain verification** via the Garaga UltraKeccakZKHonk verifier, and **in-browser proof generation** using noir_js + bb.js WASM.

## Overview

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Noir Circuit │ ──▶ │ BB Prover    │ ──▶ │ Garaga CLI   │ ──▶ │ On-Chain     │
│  (Poseidon)  │     │ (UltraHonk)  │     │ (Calldata)   │     │ Verifier     │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
     ACIR              7KB proof          2835 felt252s        Result<Span<u256>>

Proving options:
  A. In-browser: noir_js WASM → bb.js WASM → POST /api/relayer/calldata → garaga server
  B. Server-side: nargo execute → bb prove → garaga calldata (legacy)
```

## The Noir Circuit

**Location**: `circuits/ghostsats/src/main.nr`

The circuit proves two things:
1. The prover **knows** a `secret` and `blinder` that produce a given `zk_commitment`
2. A `nullifier_hash` is correctly derived from the `secret`

```noir
fn main(
    secret: Field,
    blinder: Field,
    zk_commitment: pub Field,
    nullifier_hash: pub Field,
    denomination: pub Field,
) {
    // Verify commitment
    let computed = std::hash::poseidon::bn254::hash_3([secret, blinder, denomination]);
    assert(computed == zk_commitment);

    // Verify nullifier
    let computed_nullifier = std::hash::poseidon::bn254::hash_2([secret, 1]);
    assert(computed_nullifier == nullifier_hash);
}
```

### Private Inputs (never on-chain)
- `secret` -- Random 254-bit value, generated during deposit
- `blinder` -- Random 254-bit value, prevents brute-force

### Public Inputs (embedded in proof, verified on-chain)
- `zk_commitment` -- Poseidon_BN254(secret, blinder, denomination)
- `nullifier_hash` -- Poseidon_BN254(secret, 1)
- `denomination` -- The USDC tier (0, 1, or 2)

## Proof Generation Pipeline

### Option A: In-Browser Proving (Primary)

Secrets never leave the browser. The proof is generated entirely in WASM.

**Location**: `frontend/src/utils/browserProver.ts` + `frontend/src/utils/zkProver.ts`

#### Step 1: Witness Generation (browser)

```typescript
// noir_js WASM — dynamic import, client-side only
const { Noir } = await import("@noir-lang/noir_js");
const noir = new Noir(circuit); // circuit loaded from /circuits/ghostsats.json

const { witness } = await noir.execute({
  secret: "0x...",
  blinder: "0x...",
  zk_commitment: "0x...",
  nullifier_hash: "0x...",
  denomination: "0x...",
});
```

#### Step 2: Proof Generation (browser)

```typescript
// bb.js WASM — Barretenberg in the browser
const { UltraHonkBackend } = await import("@aztec/bb.js");
const backend = new UltraHonkBackend(circuit.bytecode);

const proof = await backend.generateProof(witness, { keccakZK: true });
// proof.proof = Uint8Array (raw proof binary, ~7KB)
// proof.publicInputs = string[] (hex BN254 public inputs)
```

#### Step 3: Calldata Conversion (server)

```typescript
// Send ONLY the proof binary to the server — secrets never leave the browser
const resp = await fetch("/api/relayer/calldata", {
  method: "POST",
  body: JSON.stringify({
    proof: Array.from(proofBytes),  // Uint8Array → number[]
    publicInputs,                    // string[] (hex)
  }),
});
const { calldata } = await resp.json(); // ~2835 felt252 hex strings
```

The `/api/relayer/calldata` endpoint proxies the proof binary to a garaga calldata server that converts it to 2835 felt252 values for on-chain verification.

#### WASM Module Lifecycle

```typescript
// Pre-load on page mount to shave 5-15 seconds off first withdrawal
import { preloadProver } from "./browserProver";
await preloadProver();

// Destroy when navigating away to free WASM memory
import { destroyProver } from "./browserProver";
await destroyProver();
```

### Option B: Server-Side Proving (Legacy)

For environments where WASM is unavailable, the full pipeline can run server-side:

#### Step 1: Witness Generation

```bash
nargo execute --program-dir circuits/ghostsats/
```

Reads `Prover.toml` with private + public inputs, executes the ACIR circuit, outputs a witness file.

#### Step 2: Proof Generation

```bash
bb prove -s ultra_honk --oracle_hash keccak \
  -b circuits/ghostsats/target/ghostsats.json \
  -w circuits/ghostsats/target/witness.gz \
  -o proof
```

Barretenberg generates an **UltraKeccakZKHonk** proof (~7KB binary). This proving system is chosen because Garaga has an efficient on-chain verifier for it.

#### Step 3: Verification Key

```bash
bb write_vk -s ultra_honk --oracle_hash keccak \
  -b circuits/ghostsats/target/ghostsats.json \
  -o vk
```

The verification key is baked into the Garaga verifier contract at deploy time.

#### Step 4: Calldata Generation

```bash
garaga calldata --system ultra_keccak_zk_honk \
  --proof proof --vk vk \
  --public-inputs target/public_inputs \
  --format array
```

Garaga converts the binary proof into **2835 felt252 values** -- the proof itself plus MSM and KZG hints that make on-chain verification gas-efficient.

## On-Chain Verification

### Garaga Verifier Contract

The `UltraKeccakZKHonkVerifier` contract (generated by Garaga) exposes:

```cairo
fn verify_ultra_keccak_zk_honk_proof(
    self: @TContractState,
    full_proof_with_hints: Span<felt252>,
) -> Result<Span<u256>, felt252>;
```

- **Input**: 2835 felt252 values (proof + MSM/KZG hints)
- **Output**: `Ok(public_inputs)` or `Err(error_code)`
- **Public inputs**: `Span<u256>` containing `[commitment, nullifier, denomination]`
- **Deployed at**: `0x00e8f49d3077663a517c203afb857e6d7a95c9d9b620aa2054f1400f62a32f07` ([Voyager](https://sepolia.voyager.online/contract/0x00e8f49d3077663a517c203afb857e6d7a95c9d9b620aa2054f1400f62a32f07))

### ShieldedPool Verification

```cairo
// In withdraw_private:
let verifier = IZKVerifierDispatcher { contract_address: verifier_addr };
let result = verifier.verify_ultra_keccak_zk_honk_proof(proof.span());
assert(result.is_ok(), 'ZK proof verification failed');
```

The contract:
1. Calls the Garaga verifier with the proof
2. Checks the proof is valid
3. Verifies the nullifier hasn't been used (double-spend protection)
4. Verifies the commitment exists in the Merkle tree
5. Transfers WBTC to the recipient (or locks in escrow for BTC intent settlement)

## BN254 to Stark Field Handling

Poseidon BN254 outputs values in the BN254 field (~2^254). Starknet uses felt252 (~2^251.5). To handle this:

```typescript
const STARK_PRIME = 0x800000000000011000000000000000000000000000000000000000000000001n;

function computeZKCommitment(secret, blinder, denomination) {
    const commitment = poseidon3([secret, blinder, denomination]);
    // Reduce to felt252 range
    return commitment % STARK_PRIME;
}
```

There's a ~16% chance a raw BN254 output exceeds the Stark prime. During deposit, if this happens, a new blinder is generated and the commitment is recomputed (up to 10 retries).

The browser prover computes both **raw** BN254 values (for the circuit) and **reduced** felt252 values (for on-chain storage):

```typescript
// Raw BN254 — fed to the Noir circuit
const zkCommitmentRaw = poseidon3([secret, blinder, denomination]);
const zkNullifierRaw = poseidon2([secret, 1n]);

// Reduced felt252 — stored on-chain
const zkCommitment = zkCommitmentRaw % STARK_PRIME;
const zkNullifier = zkNullifierRaw % STARK_PRIME;
```

## Prover.toml Format

Used by the server-side proving pipeline:

```toml
secret = "0x1234..."
blinder = "0x5678..."
zk_commitment = "0xabcd..."
nullifier_hash = "0xef01..."
denomination = "0x01"
```

All values are hex-encoded BN254 field elements.

## Security Properties

| Property | Guarantee |
|----------|-----------|
| **Soundness** | Cannot generate a valid proof without knowing secret + blinder |
| **Zero-knowledge** | Proof reveals nothing about secret or blinder |
| **Non-malleability** | Proof cannot be modified to verify with different public inputs |
| **Nullifier binding** | Each secret produces exactly one nullifier -- no aliasing |
| **On-chain verification** | Garaga verifier is a deployed contract, not a mock |
| **Client-side privacy** | In-browser proving ensures secrets never leave the user's device |
