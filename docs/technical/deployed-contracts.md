# Deployed Contracts

All contracts are deployed on **Starknet Sepolia** testnet.

## Contract Addresses

| Contract | Address | Explorer |
|----------|---------|----------|
| **ShieldedPool** | `0x4606a71755ae44459a9fc2105945c3fc3d88227169f834bb0d8a4c86b8b0210` | [Voyager](https://sepolia.voyager.online/contract/0x4606a71755ae44459a9fc2105945c3fc3d88227169f834bb0d8a4c86b8b0210) |
| **GaragaVerifier** | `0x00e8f49d3077663a517c203afb857e6d7a95c9d9b620aa2054f1400f62a32f07` | [Voyager](https://sepolia.voyager.online/contract/0x00e8f49d3077663a517c203afb857e6d7a95c9d9b620aa2054f1400f62a32f07) |
| **USDC (Mock)** | `0x4cf76a48cda7d5e99d987e1506a0090caee3350a0d4fcedb5f39dea9c7d192b` | [Voyager](https://sepolia.voyager.online/contract/0x4cf76a48cda7d5e99d987e1506a0090caee3350a0d4fcedb5f39dea9c7d192b) |
| **WBTC (Mock)** | `0x73bcbf56714ac25619f59335ecaf967d657e67050b1b26f46087893aa21a2a2` | [Voyager](https://sepolia.voyager.online/contract/0x73bcbf56714ac25619f59335ecaf967d657e67050b1b26f46087893aa21a2a2) |
| **AvnuRouter (Mock)** | `0x4502b6fe4463a18062a32c788e64b622cf9f08d77d5135f4c10dc2c95caeed1` | [Voyager](https://sepolia.voyager.online/contract/0x4502b6fe4463a18062a32c788e64b622cf9f08d77d5135f4c10dc2c95caeed1) |

## Deployer Account

| Field | Value |
|-------|-------|
| Address | `0x501262076fe5cf1748147b92761d2ef2d3a804c929718cfe02bdcda7071b1e5` |
| Account Name | `veil-deployer` |
| Type | OpenZeppelin |
| Network | Starknet Sepolia |

## Constructor Parameters

The ShieldedPool was deployed with:

```
constructor(
    usdc_address:   0x4cf76a48cda7d5e99d987e1506a0090caee3350a0d4fcedb5f39dea9c7d192b
    wbtc_address:   0x73bcbf56714ac25619f59335ecaf967d657e67050b1b26f46087893aa21a2a2
    owner:          0x501262076fe5cf1748147b92761d2ef2d3a804c929718cfe02bdcda7071b1e5
    avnu_router:    0x4502b6fe4463a18062a32c788e64b622cf9f08d77d5135f4c10dc2c95caeed1
    zk_verifier:    0x00e8f49d3077663a517c203afb857e6d7a95c9d9b620aa2054f1400f62a32f07
)
```

## Interacting with Contracts

### Using sncast

```bash
# Read pending USDC
sncast --account veil-deployer \
  call --url https://starknet-sepolia-rpc.publicnode.com \
  --contract-address 0x4606a71755ae44459a9fc2105945c3fc3d88227169f834bb0d8a4c86b8b0210 \
  --function get_pending_usdc

# Read Merkle root
sncast --account veil-deployer \
  call --url https://starknet-sepolia-rpc.publicnode.com \
  --contract-address 0x4606a71755ae44459a9fc2105945c3fc3d88227169f834bb0d8a4c86b8b0210 \
  --function get_merkle_root

# Read anonymity set for $10 tier
sncast --account veil-deployer \
  call --url https://starknet-sepolia-rpc.publicnode.com \
  --contract-address 0x4606a71755ae44459a9fc2105945c3fc3d88227169f834bb0d8a4c86b8b0210 \
  --function get_anonymity_set \
  --calldata 1
```

### Using starknet.js

```typescript
import { Contract, RpcProvider } from "starknet";
import { SHIELDED_POOL_ABI } from "./contracts/abi";

const provider = new RpcProvider({
  nodeUrl: "https://starknet-sepolia-rpc.publicnode.com",
});

const pool = new Contract(
  SHIELDED_POOL_ABI,
  "0x4606a71755ae44459a9fc2105945c3fc3d88227169f834bb0d8a4c86b8b0210",
  provider,
);

const pendingUsdc = await pool.get_pending_usdc();
const merkleRoot = await pool.get_merkle_root();
const anonSet = await pool.get_anonymity_set(1); // $10 tier
```

## Frontend Configuration

Contract addresses are stored in `frontend/src/contracts/addresses.json`:

```json
{
  "network": "sepolia",
  "contracts": {
    "usdc": "0x4cf76a48cda7d5e99d987e1506a0090caee3350a0d4fcedb5f39dea9c7d192b",
    "wbtc": "0x73bcbf56714ac25619f59335ecaf967d657e67050b1b26f46087893aa21a2a2",
    "avnuRouter": "0x4502b6fe4463a18062a32c788e64b622cf9f08d77d5135f4c10dc2c95caeed1",
    "shieldedPool": "0x4606a71755ae44459a9fc2105945c3fc3d88227169f834bb0d8a4c86b8b0210",
    "garagaVerifier": "0x00e8f49d3077663a517c203afb857e6d7a95c9d9b620aa2054f1400f62a32f07"
  },
  "deployer": "0x501262076fe5cf1748147b92761d2ef2d3a804c929718cfe02bdcda7071b1e5",
  "classHashes": {
    "ShieldedPool": "0x35d7b2485d281bbb24a9901908dcc6bdf81fbbbcb7013b25ac63fca98cf7487",
    "MockERC20": "0x6f3e7e7a6293ea1d027c730d8487335420b2f519f65375338990d4503f36f35",
    "MockAvnuRouter": "0x18f0070c5840824330f7cb436f01abc8144540e94e550eb50cff09d99b15bd4"
  }
}
```

## Class Hashes

| Contract | Class Hash |
|----------|-----------|
| ShieldedPool | `0x35d7b2485d281bbb24a9901908dcc6bdf81fbbbcb7013b25ac63fca98cf7487` |
| MockERC20 | `0x6f3e7e7a6293ea1d027c730d8487335420b2f519f65375338990d4503f36f35` |
| MockAvnuRouter | `0x18f0070c5840824330f7cb436f01abc8144540e94e550eb50cff09d99b15bd4` |
