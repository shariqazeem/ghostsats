/**
 * Ghost Sats - Starknet Sepolia Deployment Script
 *
 * Declares and deploys:
 *   1. MockERC20      (USDC mock)  -- no constructor args
 *   2. MockERC20      (WBTC mock)  -- no constructor args  (same class, second instance)
 *   3. MockEkuboRouter             -- constructor(rate_numerator: u256, rate_denominator: u256)
 *   4. ShieldedPool                -- constructor(usdc_token, wbtc_token, owner, ekubo_router)
 *
 * Prerequisites:
 *   1. Enable CASM output in contracts/Scarb.toml:
 *        [[target.starknet-contract]]
 *        sierra = true
 *        casm   = true
 *
 *   2. Build the contracts:
 *        cd contracts && scarb build
 *
 *   3. Copy .env.example to .env and fill in PRIVATE_KEY and ACCOUNT_ADDRESS.
 *
 *   4. Install dependencies:
 *        cd scripts && npm install
 *
 *   5. Run:
 *        npm run deploy
 *
 * Environment variables:
 *   PRIVATE_KEY       - Hex-encoded private key of the deployer account
 *   ACCOUNT_ADDRESS   - Hex-encoded address of the deployer account
 *   STARKNET_RPC_URL  - (optional) RPC endpoint; defaults to Blast public Sepolia
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import {
  Account,
  RpcProvider,
  CallData,
  json,
  type DeclareContractPayload,
} from "starknet";
import "dotenv/config";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Resolve a path relative to the contracts/target/dev/ directory. */
function artifactPath(filename: string): string {
  return path.resolve(__dirname, "..", "contracts", "target", "dev", filename);
}

/** Load and parse a JSON artifact from the build output directory. */
function loadArtifact(filename: string): any {
  const fullPath = artifactPath(filename);
  if (!fs.existsSync(fullPath)) {
    throw new Error(
      `Artifact not found: ${fullPath}\n` +
        `Make sure you have run "scarb build" in the contracts/ directory ` +
        `with casm = true in Scarb.toml.`
    );
  }
  return json.parse(fs.readFileSync(fullPath).toString("ascii"));
}

/**
 * Declare a contract class on Starknet (Sierra + CASM).
 *
 * If the class is already declared the RPC node will return an error;
 * we catch that and return the classHash so the script is idempotent.
 */
async function declareContract(
  account: Account,
  provider: RpcProvider,
  sierraFilename: string,
  casmFilename: string
): Promise<string> {
  const compiledSierra = loadArtifact(sierraFilename);
  const compiledCasm = loadArtifact(casmFilename);

  const payload: DeclareContractPayload = {
    contract: compiledSierra,
    casm: compiledCasm,
  };

  try {
    console.log(`  Declaring ${sierraFilename} ...`);
    const declareResponse = await account.declare(payload);
    console.log(`  tx: ${declareResponse.transaction_hash}`);
    console.log(`  Waiting for transaction ...`);
    await provider.waitForTransaction(declareResponse.transaction_hash);
    console.log(`  Class hash: ${declareResponse.class_hash}`);
    return declareResponse.class_hash;
  } catch (err: any) {
    // If the class is already declared, extract the classHash from the error
    // or compute it from the artifact so we can continue deploying.
    const msg: string = err?.message ?? String(err);
    if (msg.includes("already declared") || msg.includes("class already declared")) {
      // Compute the classHash ourselves from the Sierra artifact
      const { hash } = await import("starknet");
      const classHash = hash.computeContractClassHash(compiledSierra);
      console.log(`  Already declared. Class hash: ${classHash}`);
      return classHash;
    }
    throw err;
  }
}

/**
 * Deploy an instance of an already-declared contract class.
 */
async function deployContract(
  account: Account,
  provider: RpcProvider,
  classHash: string,
  constructorCalldata: any[] = []
): Promise<string> {
  console.log(`  Deploying class ${classHash} ...`);
  const deployResponse = await account.deployContract({
    classHash,
    constructorCalldata,
  });
  console.log(`  tx: ${deployResponse.transaction_hash}`);
  console.log(`  Waiting for transaction ...`);
  await provider.waitForTransaction(deployResponse.transaction_hash);
  console.log(`  Contract address: ${deployResponse.contract_address}`);
  return deployResponse.contract_address;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  // ---- Environment ----
  const privateKey = process.env.PRIVATE_KEY;
  const accountAddress = process.env.ACCOUNT_ADDRESS;
  const rpcUrl =
    process.env.STARKNET_RPC_URL ??
    "https://starknet-sepolia.public.blastapi.io/rpc/v0_7";

  if (!privateKey || !accountAddress) {
    console.error(
      "ERROR: PRIVATE_KEY and ACCOUNT_ADDRESS must be set.\n" +
        "Copy .env.example to .env and fill in the values."
    );
    process.exit(1);
  }

  // ---- Provider & Account ----
  console.log(`\nConnecting to Starknet Sepolia at ${rpcUrl} ...\n`);
  const provider = new RpcProvider({ nodeUrl: rpcUrl });
  const account = new Account(provider, accountAddress, privateKey);

  // Quick sanity check -- ensure the account is reachable
  const chainId = await provider.getChainId();
  console.log(`Chain ID: ${chainId}\n`);

  // =========================================================================
  // 1. Declare contracts
  // =========================================================================

  console.log("========================================");
  console.log("Step 1 - Declare MockERC20");
  console.log("========================================");
  const mockERC20ClassHash = await declareContract(
    account,
    provider,
    "ghost_sats_MockERC20.contract_class.json",
    "ghost_sats_MockERC20.compiled_contract_class.json"
  );

  console.log("\n========================================");
  console.log("Step 2 - Declare MockEkuboRouter");
  console.log("========================================");
  const mockEkuboRouterClassHash = await declareContract(
    account,
    provider,
    "ghost_sats_MockEkuboRouter.contract_class.json",
    "ghost_sats_MockEkuboRouter.compiled_contract_class.json"
  );

  console.log("\n========================================");
  console.log("Step 3 - Declare ShieldedPool");
  console.log("========================================");
  const shieldedPoolClassHash = await declareContract(
    account,
    provider,
    "ghost_sats_ShieldedPool.contract_class.json",
    "ghost_sats_ShieldedPool.compiled_contract_class.json"
  );

  // =========================================================================
  // 2. Deploy contract instances
  // =========================================================================

  // -- MockERC20 (USDC) -- no constructor args
  console.log("\n========================================");
  console.log("Step 4 - Deploy MockERC20 as USDC");
  console.log("========================================");
  const usdcAddress = await deployContract(
    account,
    provider,
    mockERC20ClassHash
  );

  // -- MockERC20 (WBTC) -- same class, new instance, no constructor args
  console.log("\n========================================");
  console.log("Step 5 - Deploy MockERC20 as WBTC");
  console.log("========================================");
  const wbtcAddress = await deployContract(
    account,
    provider,
    mockERC20ClassHash
  );

  // -- MockEkuboRouter -- constructor(rate_numerator: u256, rate_denominator: u256)
  // u256 in Cairo is { low: felt252, high: felt252 }.
  // CallData.compile flattens objects; we pass the u256 values as plain numbers/bigints
  // and let starknet.js serialize them.  For u256 we pass the full value; starknet.js
  // will split it into (low, high) automatically when using CallData.compile with the ABI.
  //
  // Rate: 1 USDC (6 decimals) => 0.000015 WBTC (8 decimals)
  //   rate_numerator   = 1500   (wbtc amount in smallest unit)
  //   rate_denominator = 1000000 (usdc amount in smallest unit)
  // This gives: wbtc_out = usdc_in * 1500 / 1_000_000
  console.log("\n========================================");
  console.log("Step 6 - Deploy MockEkuboRouter");
  console.log("========================================");

  const ekuboSierra = loadArtifact("ghost_sats_MockEkuboRouter.contract_class.json");
  const ekuboCallData = new CallData(ekuboSierra.abi);
  const ekuboConstructor = ekuboCallData.compile("constructor", {
    rate_numerator: { low: 1500n, high: 0n },
    rate_denominator: { low: 1_000_000n, high: 0n },
  });

  const ekuboRouterAddress = await deployContract(
    account,
    provider,
    mockEkuboRouterClassHash,
    ekuboConstructor
  );

  // -- ShieldedPool -- constructor(usdc_token, wbtc_token, owner, ekubo_router)
  console.log("\n========================================");
  console.log("Step 7 - Deploy ShieldedPool");
  console.log("========================================");

  const poolSierra = loadArtifact("ghost_sats_ShieldedPool.contract_class.json");
  const poolCallData = new CallData(poolSierra.abi);
  const poolConstructor = poolCallData.compile("constructor", {
    usdc_token: usdcAddress,
    wbtc_token: wbtcAddress,
    owner: accountAddress,
    ekubo_router: ekuboRouterAddress,
  });

  const shieldedPoolAddress = await deployContract(
    account,
    provider,
    shieldedPoolClassHash,
    poolConstructor
  );

  // =========================================================================
  // 3. Summary
  // =========================================================================

  console.log("\n");
  console.log("=".repeat(60));
  console.log("  DEPLOYMENT COMPLETE");
  console.log("=".repeat(60));
  console.log();
  console.log("  Class Hashes:");
  console.log(`    MockERC20       : ${mockERC20ClassHash}`);
  console.log(`    MockEkuboRouter : ${mockEkuboRouterClassHash}`);
  console.log(`    ShieldedPool    : ${shieldedPoolClassHash}`);
  console.log();
  console.log("  Contract Addresses:");
  console.log(`    USDC (MockERC20)  : ${usdcAddress}`);
  console.log(`    WBTC (MockERC20)  : ${wbtcAddress}`);
  console.log(`    MockEkuboRouter   : ${ekuboRouterAddress}`);
  console.log(`    ShieldedPool      : ${shieldedPoolAddress}`);
  console.log();
  console.log("  View on Voyager:");
  console.log(`    https://sepolia.voyager.online/contract/${usdcAddress}`);
  console.log(`    https://sepolia.voyager.online/contract/${wbtcAddress}`);
  console.log(`    https://sepolia.voyager.online/contract/${ekuboRouterAddress}`);
  console.log(`    https://sepolia.voyager.online/contract/${shieldedPoolAddress}`);
  console.log();

  // Write deployed addresses to a JSON file for use by the frontend/tests
  const deployment = {
    network: "starknet-sepolia",
    chainId,
    deployer: accountAddress,
    classHashes: {
      MockERC20: mockERC20ClassHash,
      MockEkuboRouter: mockEkuboRouterClassHash,
      ShieldedPool: shieldedPoolClassHash,
    },
    contracts: {
      usdc: usdcAddress,
      wbtc: wbtcAddress,
      ekuboRouter: ekuboRouterAddress,
      shieldedPool: shieldedPoolAddress,
    },
    deployedAt: new Date().toISOString(),
  };

  const outPath = path.resolve(__dirname, "deployment.json");
  fs.writeFileSync(outPath, JSON.stringify(deployment, null, 2));
  console.log(`  Deployment manifest written to: ${outPath}`);
  console.log();
}

main().catch((err) => {
  console.error("\nDeployment failed:\n", err);
  process.exit(1);
});
