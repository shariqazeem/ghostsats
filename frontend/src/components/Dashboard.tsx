"use client";

import { useState, useEffect } from "react";
import { useReadContract } from "@starknet-react/core";
import { motion } from "framer-motion";
import { Activity, Shield, Layers, TrendingUp, Users, Bitcoin, Play, Loader, CheckCircle, ExternalLink } from "lucide-react";
import PrivacyScore from "./PrivacyScore";
import { SkeletonLine } from "./Skeleton";
import { useToast } from "@/context/ToastContext";
import addresses from "@/contracts/addresses.json";
import { SHIELDED_POOL_ABI } from "@/contracts/abi";
import { EXPLORER_TX } from "@/utils/network";

const RELAYER_URL = process.env.NEXT_PUBLIC_RELAYER_URL ?? "/api/relayer";

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

  const safe = (v: unknown, div = 1) => { const n = Number(v); return Number.isFinite(n) ? n / div : 0; };
  const pending = safe(pendingUsdc, 1_000_000);
  const deposits = safe(batchCount);
  const dataLoaded = totalVolume !== undefined;

  const volume = safe(totalVolume, 1_000_000);
  const batches = safe(totalBatches);
  const leaves = safe(leafCount);
  const anon0 = safe(anonSet0);
  const anon1 = safe(anonSet1);
  const anon2 = safe(anonSet2);

  // Prover/relayer health check
  const [proverStatus, setProverStatus] = useState<"checking" | "online" | "offline">("checking");
  useEffect(() => {
    async function checkProver() {
      try {
        const res = await fetch(`${RELAYER_URL}/info`, { signal: AbortSignal.timeout(5000) });
        setProverStatus(res.ok ? "online" : "offline");
      } catch {
        setProverStatus("offline");
      }
    }
    checkProver();
    const interval = setInterval(checkProver, 30_000);
    return () => clearInterval(interval);
  }, []);

  // Batch execution state
  const [batchExecuting, setBatchExecuting] = useState(false);
  const [batchTxHash, setBatchTxHash] = useState<string | null>(null);
  const { toast } = useToast();

  async function handleExecuteBatch() {
    setBatchExecuting(true);
    setBatchTxHash(null);
    try {
      const res = await fetch(`${RELAYER_URL}/execute-batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (data.success) {
        setBatchTxHash(data.txHash);
        toast("success", "Batch executed — capital converted to BTC");
      } else {
        toast("error", data.error ?? "Batch execution failed");
      }
    } catch {
      toast("error", "Failed to connect to relayer");
    }
    setBatchExecuting(false);
  }

  const { data: btcLinkedCount } = useReadContract({
    address: poolAddress || undefined,
    abi: SHIELDED_POOL_ABI,
    functionName: "get_btc_linked_count",
    args: [],
    enabled: !!poolAddress,
    refetchInterval: 10_000,
  } as unknown as Parameters<typeof useReadContract>[0]);
  const btcLinked = safe(btcLinkedCount);

  return (
    <div className="space-y-5">
      {/* Stats Card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 sm:p-6">
        {/* Primary Stats */}
        <div className="grid grid-cols-2 gap-6 mb-5">
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <TrendingUp size={12} strokeWidth={1.5} className="text-gray-400" />
              <span className="text-xs font-medium text-gray-500">Total Allocated</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              {dataLoaded ? (
                <motion.span
                  className="text-2xl sm:text-3xl font-[family-name:var(--font-geist-mono)] font-bold text-gray-900 font-tabular tracking-tight"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6 }}
                >
                  {volume.toLocaleString()}
                </motion.span>
              ) : (
                <SkeletonLine width="80px" height="28px" />
              )}
              <span className="text-sm text-gray-400 font-medium">USDC</span>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Activity size={12} strokeWidth={1.5} className="text-[#FF5A00]" />
              <span className="text-xs font-medium text-gray-500">Pending</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              {dataLoaded ? (
                <motion.span
                  className="text-2xl sm:text-3xl font-[family-name:var(--font-geist-mono)] font-bold text-[#FF5A00] font-tabular tracking-tight"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.1 }}
                >
                  {pending.toLocaleString()}
                </motion.span>
              ) : (
                <SkeletonLine width="80px" height="28px" />
              )}
              <span className="text-sm text-gray-400 font-medium">USDC</span>
            </div>
          </div>
        </div>

        {/* Secondary Stats Row */}
        <div className="grid grid-cols-4 gap-3 pt-5 border-t border-gray-100">
          {[
            { icon: Layers, label: "Batches", value: batches, color: "text-gray-900" },
            { icon: Shield, label: "Commitments", value: leaves, color: "text-gray-900" },
            { icon: Activity, label: "Queued", value: deposits, color: "text-gray-900" },
            { icon: Bitcoin, label: "BTC IDs", value: btcLinked, color: "text-[#FF5A00]" },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Icon size={11} strokeWidth={1.5} className="text-gray-400" />
                <span className="text-xs text-gray-500 font-medium">{label}</span>
              </div>
              <span className={`text-lg sm:text-xl font-[family-name:var(--font-geist-mono)] font-bold font-tabular ${color}`}>
                {value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Execute Batch */}
      {pending > 0 && (
        <div className="bg-orange-50 rounded-xl border border-orange-200 p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <Play size={12} strokeWidth={1.5} className="text-[#FF5A00]" />
                <span className="text-xs font-semibold text-gray-600">
                  Execute Batch Conversion
                </span>
              </div>
              <p className="text-xs text-gray-500">
                {pending.toLocaleString()} USDC pending — convert to BTC
              </p>
            </div>
            <motion.button
              onClick={handleExecuteBatch}
              disabled={batchExecuting || proverStatus !== "online"}
              className="px-4 py-2.5 bg-[#FF5A00] text-white rounded-xl text-xs font-semibold
                         disabled:opacity-30 disabled:cursor-not-allowed
                         cursor-pointer flex items-center gap-1.5 flex-shrink-0"
              whileHover={!batchExecuting ? { y: -1 } : {}}
              whileTap={!batchExecuting ? { scale: 0.97 } : {}}
            >
              {batchExecuting ? (
                <Loader size={12} className="animate-spin" strokeWidth={2} />
              ) : (
                <Play size={12} strokeWidth={2} />
              )}
              {batchExecuting ? "Executing..." : "Execute"}
            </motion.button>
          </div>
          {batchTxHash && (
            <a
              href={`${EXPLORER_TX}${batchTxHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 flex items-center gap-1.5 text-xs text-emerald-600 hover:underline font-[family-name:var(--font-geist-mono)]"
            >
              <CheckCircle size={11} strokeWidth={2} />
              Conversion complete — view on Voyager
              <ExternalLink size={10} strokeWidth={1.5} className="opacity-60" />
            </a>
          )}
          {proverStatus !== "online" && (
            <p className="text-xs text-gray-400 mt-2">
              Relayer must be online to convert (owner-only operation)
            </p>
          )}
        </div>
      )}

      {/* Pool Overview — Anonymity Sets + Privacy Score */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Anonymity Sets */}
          <div className="flex-1">
            <div className="flex items-center gap-1.5 mb-4">
              <Users size={12} strokeWidth={1.5} className="text-gray-400" />
              <span className="text-xs font-semibold text-gray-500">Anonymity Sets</span>
            </div>
            <div className="space-y-3.5">
              {[
                { label: "$1", count: anon0 },
                { label: "$10", count: anon1 },
                { label: "$100", count: anon2 },
              ].map(({ label, count }) => {
                const pct = Math.min(count / 20, 1) * 100;
                const color = count >= 10 ? "#10B981" : count >= 3 ? "#F59E0B" : "#EF4444";
                const strength = count >= 20 ? "Maximum" : count >= 10 ? "Strong" : count >= 3 ? "Growing" : "Low";
                return (
                  <div key={label}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-[family-name:var(--font-geist-mono)] font-semibold text-gray-900 font-tabular">
                          {label}
                        </span>
                        <span className="text-xs text-gray-400">USDC</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-[family-name:var(--font-geist-mono)] font-bold font-tabular" style={{ color }}>
                          {count}
                        </span>
                        <span className="text-xs font-medium" style={{ color }}>
                          {strength}
                        </span>
                      </div>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: color }}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 1.2, ease: [0.4, 0, 0.2, 1] }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-gray-400 mt-3">
              More participants = stronger confidentiality
            </p>
          </div>

          {/* Privacy Score (inline) */}
          <div className="lg:w-56 flex-shrink-0">
            <PrivacyScore
              anonSet={Math.max(anon0, anon1, anon2)}
              batches={batches}
              btcLinked={btcLinked}
              commitments={leaves}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
