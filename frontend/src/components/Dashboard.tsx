"use client";

import { useReadContract } from "@starknet-react/core";
import { motion } from "framer-motion";
import { Activity, Shield, Layers, TrendingUp, Users, Clock, Bitcoin } from "lucide-react";
import addresses from "@/contracts/addresses.json";
import { SHIELDED_POOL_ABI } from "@/contracts/abi";

function truncateHash(h: string, chars = 6): string {
  if (h.length <= chars * 2 + 2) return h;
  return `${h.slice(0, chars + 2)}...${h.slice(-chars)}`;
}

export default function Dashboard() {
  const poolAddress = addresses.contracts.shieldedPool as `0x${string}` | "";

  const { data: pendingUsdc } = useReadContract({
    address: poolAddress || undefined,
    abi: SHIELDED_POOL_ABI,
    functionName: "get_pending_usdc",
    args: [],
    enabled: !!poolAddress,
    refetchInterval: 10_000,
  } as unknown as Parameters<typeof useReadContract>[0]);

  const { data: batchCount } = useReadContract({
    address: poolAddress || undefined,
    abi: SHIELDED_POOL_ABI,
    functionName: "get_batch_count",
    args: [],
    enabled: !!poolAddress,
    refetchInterval: 10_000,
  } as unknown as Parameters<typeof useReadContract>[0]);

  const { data: totalVolume } = useReadContract({
    address: poolAddress || undefined,
    abi: SHIELDED_POOL_ABI,
    functionName: "get_total_volume",
    args: [],
    enabled: !!poolAddress,
    refetchInterval: 10_000,
  } as unknown as Parameters<typeof useReadContract>[0]);

  const { data: totalBatches } = useReadContract({
    address: poolAddress || undefined,
    abi: SHIELDED_POOL_ABI,
    functionName: "get_total_batches_executed",
    args: [],
    enabled: !!poolAddress,
    refetchInterval: 10_000,
  } as unknown as Parameters<typeof useReadContract>[0]);

  const { data: leafCount } = useReadContract({
    address: poolAddress || undefined,
    abi: SHIELDED_POOL_ABI,
    functionName: "get_leaf_count",
    args: [],
    enabled: !!poolAddress,
    refetchInterval: 10_000,
  } as unknown as Parameters<typeof useReadContract>[0]);

  const { data: merkleRoot } = useReadContract({
    address: poolAddress || undefined,
    abi: SHIELDED_POOL_ABI,
    functionName: "get_merkle_root",
    args: [],
    enabled: !!poolAddress,
    refetchInterval: 30_000,
  } as unknown as Parameters<typeof useReadContract>[0]);

  const { data: anonSet0 } = useReadContract({
    address: poolAddress || undefined,
    abi: SHIELDED_POOL_ABI,
    functionName: "get_anonymity_set",
    args: [0],
    enabled: !!poolAddress,
    refetchInterval: 10_000,
  } as unknown as Parameters<typeof useReadContract>[0]);

  const { data: anonSet1 } = useReadContract({
    address: poolAddress || undefined,
    abi: SHIELDED_POOL_ABI,
    functionName: "get_anonymity_set",
    args: [1],
    enabled: !!poolAddress,
    refetchInterval: 10_000,
  } as unknown as Parameters<typeof useReadContract>[0]);

  const { data: anonSet2 } = useReadContract({
    address: poolAddress || undefined,
    abi: SHIELDED_POOL_ABI,
    functionName: "get_anonymity_set",
    args: [2],
    enabled: !!poolAddress,
    refetchInterval: 10_000,
  } as unknown as Parameters<typeof useReadContract>[0]);

  const pending = pendingUsdc ? Number(pendingUsdc) / 1_000_000 : 0;
  const deposits = batchCount ? Number(batchCount) : 0;
  const volume = totalVolume ? Number(totalVolume) / 1_000_000 : 0;
  const batches = totalBatches ? Number(totalBatches) : 0;
  const leaves = leafCount ? Number(leafCount) : 0;
  const root = merkleRoot ? String(merkleRoot) : "0x0";
  const anon0 = anonSet0 ? Number(anonSet0) : 0;
  const anon1 = anonSet1 ? Number(anonSet1) : 0;
  const anon2 = anonSet2 ? Number(anonSet2) : 0;

  const { data: btcLinkedCount } = useReadContract({
    address: poolAddress || undefined,
    abi: SHIELDED_POOL_ABI,
    functionName: "get_btc_linked_count",
    args: [],
    enabled: !!poolAddress,
    refetchInterval: 10_000,
  } as unknown as Parameters<typeof useReadContract>[0]);
  const btcLinked = btcLinkedCount ? Number(btcLinkedCount) : 0;

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="text-center space-y-2">
        <h1 className="text-[32px] font-black tracking-tight text-[var(--text-primary)] leading-tight">
          Bitcoin&apos;s Privacy Layer
        </h1>
        <p className="text-[15px] text-[var(--text-secondary)] font-medium">
          Gasless private execution on Starknet
        </p>
      </div>

      {/* Stats Grid */}
      <div className="glass-card p-6">
        <div className="grid grid-cols-2 gap-6">
          {/* Total Volume */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <TrendingUp size={12} strokeWidth={1.5} className="text-[var(--text-tertiary)]" />
              <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">
                Total Shielded
              </span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-[28px] font-[family-name:var(--font-geist-mono)] font-bold text-[var(--text-primary)] font-tabular tracking-tight">
                {volume.toLocaleString()}
              </span>
              <span className="text-[13px] text-[var(--text-tertiary)] font-medium">USDC</span>
            </div>
          </div>

          {/* Pending Pool */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Activity size={12} strokeWidth={1.5} className="text-[var(--accent-orange)]" />
              <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">
                Pending Pool
              </span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-[28px] font-[family-name:var(--font-geist-mono)] font-bold text-[var(--accent-orange)] font-tabular tracking-tight">
                {pending.toLocaleString()}
              </span>
              <span className="text-[13px] text-[var(--text-tertiary)] font-medium">USDC</span>
            </div>
          </div>
        </div>

        <div className="h-px bg-[var(--border-subtle)] my-5" />

        {/* Bottom Stats Row */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <Layers size={11} strokeWidth={1.5} className="text-[var(--text-tertiary)]" />
              <span className="text-[11px] text-[var(--text-tertiary)] font-medium">Batches</span>
            </div>
            <span className="text-[18px] font-[family-name:var(--font-geist-mono)] font-bold text-[var(--text-primary)] font-tabular">
              {batches}
            </span>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <Shield size={11} strokeWidth={1.5} className="text-[var(--text-tertiary)]" />
              <span className="text-[11px] text-[var(--text-tertiary)] font-medium">Commitments</span>
            </div>
            <span className="text-[18px] font-[family-name:var(--font-geist-mono)] font-bold text-[var(--text-primary)] font-tabular">
              {leaves}
            </span>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <Activity size={11} strokeWidth={1.5} className="text-[var(--text-tertiary)]" />
              <span className="text-[11px] text-[var(--text-tertiary)] font-medium">In Batch</span>
            </div>
            <span className="text-[18px] font-[family-name:var(--font-geist-mono)] font-bold text-[var(--text-primary)] font-tabular">
              {deposits}
            </span>
          </div>
        </div>

        <div className="h-px bg-[var(--border-subtle)] my-5" />

        {/* Merkle Root & Protocol Info */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-[var(--text-tertiary)]">Merkle Root</span>
            <span className="text-[11px] font-[family-name:var(--font-geist-mono)] text-[var(--text-secondary)]">
              {truncateHash(root)}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-green)] animate-pulse-dot" />
            <span className="text-[11px] text-[var(--text-tertiary)]">Live on Sepolia</span>
          </div>
        </div>
      </div>

      {/* Anonymity Sets */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-1.5 mb-4">
          <Users size={12} strokeWidth={1.5} className="text-[var(--text-tertiary)]" />
          <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">
            Anonymity Sets
          </span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "100 USDC", count: anon0, tier: 0 },
            { label: "1,000 USDC", count: anon1, tier: 1 },
            { label: "10,000 USDC", count: anon2, tier: 2 },
          ].map(({ label, count }) => (
            <div key={label} className="bg-[var(--bg-secondary)] rounded-xl p-3 text-center">
              <div className="text-[20px] font-[family-name:var(--font-geist-mono)] font-bold text-[var(--text-primary)] font-tabular">
                {count}
              </div>
              <div className="text-[11px] text-[var(--text-tertiary)] mt-0.5">{label}</div>
              <div className={`text-[10px] mt-1 font-medium ${
                count >= 10 ? "text-emerald-500" : count >= 3 ? "text-amber-500" : "text-red-400"
              }`}>
                {count >= 10 ? "Strong" : count >= 3 ? "Growing" : "Low"}
              </div>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-[var(--text-tertiary)] text-center mt-3">
          Higher anonymity sets = stronger privacy. Your deposit is indistinguishable from others in the same tier.
        </p>
      </div>

      {/* Privacy Features */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-1.5 mb-4">
          <Shield size={12} strokeWidth={1.5} className="text-[var(--text-tertiary)]" />
          <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">
            Privacy Features
          </span>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock size={12} strokeWidth={1.5} className="text-[var(--text-secondary)]" />
              <span className="text-[12px] text-[var(--text-secondary)]">Withdrawal Delay</span>
            </div>
            <span className="text-[12px] font-[family-name:var(--font-geist-mono)] text-[var(--text-primary)] font-tabular">
              60 seconds
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users size={12} strokeWidth={1.5} className="text-[var(--text-secondary)]" />
              <span className="text-[12px] text-[var(--text-secondary)]">Gasless Withdrawals</span>
            </div>
            <span className="text-[12px] font-medium text-emerald-500">Relayer Supported</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield size={12} strokeWidth={1.5} className="text-[var(--text-secondary)]" />
              <span className="text-[12px] text-[var(--text-secondary)]">Max Relayer Fee</span>
            </div>
            <span className="text-[12px] font-[family-name:var(--font-geist-mono)] text-[var(--text-primary)] font-tabular">
              5% cap
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers size={12} strokeWidth={1.5} className="text-[var(--text-secondary)]" />
              <span className="text-[12px] text-[var(--text-secondary)]">Merkle Tree</span>
            </div>
            <span className="text-[12px] font-[family-name:var(--font-geist-mono)] text-[var(--text-primary)] font-tabular">
              20-level (1M+ deposits)
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bitcoin size={12} strokeWidth={1.5} className="text-[var(--accent-orange)]" />
              <span className="text-[12px] text-[var(--text-secondary)]">BTC-Linked Deposits</span>
            </div>
            <span className="text-[12px] font-[family-name:var(--font-geist-mono)] text-[var(--accent-orange)] font-tabular">
              {btcLinked}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
