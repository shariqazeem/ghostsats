import { NextResponse } from "next/server";
import { POOL_ADDRESS, FEE_BPS, getRelayerAccount, RPC_URL } from "../shared";

export async function GET() {
  const account = getRelayerAccount();

  return NextResponse.json({
    pool: POOL_ADDRESS,
    fee_bps: FEE_BPS,
    relayer: account ? "online" : "offline",
    relayerAddress: account?.address ?? null,
    rpc: RPC_URL,
  });
}
