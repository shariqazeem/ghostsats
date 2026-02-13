import { NextRequest, NextResponse } from "next/server";
import { CallData } from "starknet";
import { POOL_ADDRESS, getRelayerAccount, getProvider } from "../shared";

export async function POST(req: NextRequest) {
  try {
    const account = getRelayerAccount();
    if (!account) {
      return NextResponse.json(
        { success: false, error: "Relayer not configured — batch execution requires owner key" },
        { status: 503 },
      );
    }

    // Execute batch with min_wbtc_out=0 and empty routes (for mock router on testnet)
    // On mainnet, this would fetch AVNU quotes first
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
