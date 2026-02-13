/**
 * Proxy: forward browser-generated proof to the VM's garaga calldata server.
 * Avoids HTTPS → HTTP mixed-content blocks.
 *
 * POST /api/relayer/calldata
 * Body: { proof: number[], publicInputs: string[] }
 * Returns: { calldata: string[] }
 */

import { NextRequest, NextResponse } from "next/server";

const VM_URL = process.env.CALLDATA_SERVER_URL?.trim() ?? "http://141.148.215.239";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const resp = await fetch(`${VM_URL}/calldata`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await resp.json();

    if (!resp.ok) {
      return NextResponse.json(
        { error: data.error ?? "Calldata server error" },
        { status: resp.status },
      );
    }

    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
