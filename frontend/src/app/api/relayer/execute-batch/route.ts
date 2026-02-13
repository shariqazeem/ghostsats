import { NextResponse } from "next/server";
import { CallData, Contract } from "starknet";
import { POOL_ADDRESS, getRelayerAccount, getProvider } from "../shared";
import addresses from "@/contracts/addresses.json";

const ROUTER_ADDRESS = addresses.contracts.avnuRouter;
const isMainnet = addresses.network === "mainnet";

/** Fetch live BTC price from CoinGecko */
async function getBtcPrice(): Promise<number> {
  const resp = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd",
    { next: { revalidate: 60 } },
  );
  if (!resp.ok) throw new Error("Failed to fetch BTC price");
  const data = await resp.json();
  return data.bitcoin.usd;
}

/**
 * Set mock router rate to match live BTC price.
 * Rate formula: wbtc_out = usdc_in * numerator / denominator
 * USDC has 6 decimals, WBTC has 8 decimals.
 * So: numerator = 100, denominator = btc_price (rounded)
 */
async function updateMockRouterRate(account: ReturnType<typeof getRelayerAccount>) {
  if (!account || isMainnet) return; // mainnet uses real AVNU

  const btcPrice = await getBtcPrice();
  const denominator = Math.round(btcPrice);

  console.log(`[execute-batch] Live BTC price: $${btcPrice} → rate 100/${denominator}`);

  const setRateCall = {
    contractAddress: ROUTER_ADDRESS,
    entrypoint: "set_rate",
    calldata: CallData.compile({
      rate_numerator: { low: 100, high: 0 },
      rate_denominator: { low: denominator, high: 0 },
    }),
  };

  const provider = getProvider();
  const result = await account.execute([setRateCall]);
  await provider.waitForTransaction(result.transaction_hash);
  console.log(`[execute-batch] Rate updated: tx ${result.transaction_hash}`);

  return btcPrice;
}

export async function POST() {
  try {
    const account = getRelayerAccount();
    if (!account) {
      return NextResponse.json(
        { success: false, error: "Relayer not configured — batch execution requires owner key" },
        { status: 503 },
      );
    }

    // Step 1: Update mock router rate with live BTC price (testnet only)
    let btcPrice: number | undefined;
    try {
      btcPrice = await updateMockRouterRate(account);
    } catch (err) {
      console.warn("[execute-batch] Rate update failed, using existing rate:", err);
    }

    // Step 2: Execute batch
    const calls = [
      {
        contractAddress: POOL_ADDRESS,
        entrypoint: "execute_batch",
        calldata: CallData.compile({
          min_wbtc_out: { low: 0, high: 0 },
          routes: [],
        }),
      },
    ];

    const result = await account.execute(calls);
    const provider = getProvider();
    await provider.waitForTransaction(result.transaction_hash);

    return NextResponse.json({
      success: true,
      txHash: result.transaction_hash,
      btcPrice,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[relayer/execute-batch] Error:", msg);
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 },
    );
  }
}
