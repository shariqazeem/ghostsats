"use client";

import { useReadContract } from "@starknet-react/core";
import { Radio } from "lucide-react";
import addresses from "@/contracts/addresses.json";
import { SHIELDED_POOL_ABI } from "@/contracts/abi";

export default function BatchFeed() {
  const poolAddress = addresses.contracts.shieldedPool as `0x${string}` | "";

  const { data: pendingUsdc } = useReadContract({
    address: poolAddress || undefined,
    abi: SHIELDED_POOL_ABI,
    functionName: "get_pending_usdc",
    args: [],
    enabled: !!poolAddress,
    refetchInterval: 10_000,
  } as Parameters<typeof useReadContract>[0]);

  const { data: batchCount } = useReadContract({
    address: poolAddress || undefined,
    abi: SHIELDED_POOL_ABI,
    functionName: "get_batch_count",
    args: [],
    enabled: !!poolAddress,
    refetchInterval: 10_000,
  } as Parameters<typeof useReadContract>[0]);

  const volume = pendingUsdc ? Number(pendingUsdc) : 0;
  const batches = batchCount ? Number(batchCount) : 0;

  return (
    <div className="flex items-center justify-center gap-6 text-center">
      <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
        <Radio size={12} strokeWidth={1.5} />
        <span>Live</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-[family-name:var(--font-geist-mono)] font-semibold text-[var(--text-primary)] font-tabular">
          {volume.toLocaleString()}
        </span>
        <span className="text-xs text-[var(--text-tertiary)]">USDC pending</span>
      </div>
      <div className="w-px h-4 bg-[var(--border-subtle)]" />
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-[family-name:var(--font-geist-mono)] font-semibold text-[var(--text-primary)] font-tabular">
          {batches}
        </span>
        <span className="text-xs text-[var(--text-tertiary)]">batches</span>
      </div>
    </div>
  );
}
