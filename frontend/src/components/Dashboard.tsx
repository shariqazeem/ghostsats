"use client";

import { useReadContract } from "@starknet-react/core";
import { motion } from "framer-motion";
import addresses from "@/contracts/addresses.json";
import { SHIELDED_POOL_ABI } from "@/contracts/abi";

const spring = { type: "spring" as const, stiffness: 400, damping: 30 };

export default function Dashboard() {
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
  const orbScale = Math.min(1 + volume / 50000, 1.3);

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Ghost Orb */}
      <motion.div
        className="relative flex items-center justify-center"
        animate={{ scale: orbScale }}
        transition={spring}
      >
        <div className="w-48 h-48 rounded-full animate-breathe"
          style={{
            background: "radial-gradient(circle at 40% 35%, #ffffff 0%, #f0f0f0 25%, #e0e0e0 50%, #d4d4d4 75%, #c0c0c0 100%)",
            boxShadow: "0 0 60px rgba(0,0,0,0.06), 0 0 120px rgba(0,0,0,0.03), inset 0 -20px 40px rgba(0,0,0,0.04)",
          }}
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-widest mb-1">
            Volume
          </span>
          <span className="text-3xl font-[family-name:var(--font-geist-mono)] font-bold text-[var(--text-primary)] font-tabular">
            {volume.toLocaleString()}
          </span>
          <span className="text-xs text-[var(--text-tertiary)] mt-0.5">USDC</span>
        </div>
      </motion.div>

      {/* Subtitle */}
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-[family-name:var(--font-geist-sans)] font-extrabold tracking-tight text-[var(--text-primary)]">
          Bitcoin Dark Pool
        </h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Private batch execution on Starknet
        </p>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-8 text-center">
        <div>
          <div className="text-2xl font-[family-name:var(--font-geist-mono)] font-bold text-[var(--text-primary)] font-tabular">
            {batches}
          </div>
          <div className="text-xs text-[var(--text-tertiary)] mt-0.5">Batches</div>
        </div>
        <div className="w-px h-8 bg-[var(--border-subtle)]" />
        <div>
          <div className="text-2xl font-[family-name:var(--font-geist-mono)] font-bold text-[var(--text-primary)] font-tabular">
            Pedersen
          </div>
          <div className="text-xs text-[var(--text-tertiary)] mt-0.5">Commitment</div>
        </div>
      </div>
    </div>
  );
}
