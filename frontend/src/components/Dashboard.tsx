"use client";

import { useState, useEffect } from "react";
import { useReadContract } from "@starknet-react/core";
import { motion } from "framer-motion";
import { Activity, Shield, Layers, TrendingUp, Users, Bitcoin, Fingerprint, Zap, ExternalLink, Play, Loader, CheckCircle, Lock, Eye } from "lucide-react";
import PrivacyScore from "./PrivacyScore";
import { SkeletonLine } from "./Skeleton";
import { useToast } from "@/context/ToastContext";
import addresses from "@/contracts/addresses.json";
import { SHIELDED_POOL_ABI } from "@/contracts/abi";
import { EXPLORER_CONTRACT, EXPLORER_TX, NETWORK_LABEL } from "@/utils/network";

const CONTRACT_EXPLORER = EXPLORER_CONTRACT;

const RELAYER_URL = process.env.NEXT_PUBLIC_RELAYER_URL ?? "/api/relayer";

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

  const safe = (v: unknown, div = 1) => { const n = Number(v); return Number.isFinite(n) ? n / div : 0; };
  const pending = safe(pendingUsdc, 1_000_000);
  const deposits = safe(batchCount);
  // Data still loading if the first query hasn't returned yet
  const dataLoaded = totalVolume !== undefined;

  const volume = safe(totalVolume, 1_000_000);
  const batches = safe(totalBatches);
  const leaves = safe(leafCount);
  const root = merkleRoot ? String(merkleRoot) : "0x0";
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
    } catch (err) {
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
    <div className="space-y-6">
      {/* Hero */}
      <div className="text-center space-y-3">
        <h1 className="text-[24px] sm:text-[32px] font-black tracking-tight text-[var(--text-primary)] leading-tight">
          Confidential BTC Accumulation
        </h1>
        <p className="text-[13px] sm:text-[15px] text-[var(--text-secondary)] font-medium max-w-md mx-auto">
          Treasury-grade Bitcoin exposure on Starknet. No public position signaling. STARK-verified exits.
        </p>
        {/* Protocol Status Badges */}
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-950/30 border border-emerald-800/30 text-[10px] font-medium text-emerald-400">
            <Fingerprint size={10} strokeWidth={2} />
            ZK Verified On-Chain
          </span>
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-medium ${
            proverStatus === "online"
              ? "bg-orange-950/30 border border-orange-800/30 text-[var(--accent-orange)]"
              : "bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-tertiary)]"
          }`}>
            <Zap size={10} strokeWidth={2} />
            {proverStatus === "online" ? "Relayer Online" : proverStatus === "checking" ? "Checking Relayer..." : "Relayer Offline"}
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[10px] font-medium text-[var(--text-secondary)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-green)] animate-pulse-dot" />
            {NETWORK_LABEL} Live
          </span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="glass-card p-4 sm:p-6 relative overflow-hidden">
        {/* Subtle gradient accent */}
        <div className="absolute top-0 right-0 w-40 h-40 rounded-full opacity-[0.03] pointer-events-none"
          style={{ background: "radial-gradient(circle, var(--accent-orange) 0%, transparent 70%)" }}
        />

        <div className="grid grid-cols-2 gap-4 sm:gap-6 relative">
          {/* Total Volume */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <TrendingUp size={12} strokeWidth={1.5} className="text-[var(--text-tertiary)]" />
              <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">
                Total Capital Allocated
              </span>
            </div>
            <div className="flex items-baseline gap-1.5">
              {dataLoaded ? (
                <motion.span
                  className="text-[22px] sm:text-[28px] font-[family-name:var(--font-geist-mono)] font-bold text-[var(--text-primary)] font-tabular tracking-tight"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6 }}
                >
                  {volume.toLocaleString()}
                </motion.span>
              ) : (
                <SkeletonLine width="80px" height="28px" />
              )}
              <span className="text-[11px] sm:text-[13px] text-[var(--text-tertiary)] font-medium">USDC</span>
            </div>
          </div>

          {/* Pending Pool */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Activity size={12} strokeWidth={1.5} className="text-[var(--accent-orange)]" />
              <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">
                Pending Execution
              </span>
            </div>
            <div className="flex items-baseline gap-1.5">
              {dataLoaded ? (
                <motion.span
                  className="text-[22px] sm:text-[28px] font-[family-name:var(--font-geist-mono)] font-bold text-[var(--accent-orange)] font-tabular tracking-tight"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.1 }}
                >
                  {pending.toLocaleString()}
                </motion.span>
              ) : (
                <SkeletonLine width="80px" height="28px" />
              )}
              <span className="text-[11px] sm:text-[13px] text-[var(--text-tertiary)] font-medium">USDC</span>
            </div>
          </div>
        </div>

        <div className="h-px bg-[var(--border-subtle)] my-5" />

        {/* Bottom Stats Row */}
        <div className="grid grid-cols-4 gap-3 relative">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Layers size={10} strokeWidth={1.5} className="text-[var(--text-tertiary)]" />
              <span className="text-[10px] text-[var(--text-tertiary)] font-medium">Batches</span>
            </div>
            <span className="text-[16px] sm:text-[18px] font-[family-name:var(--font-geist-mono)] font-bold text-[var(--text-primary)] font-tabular">
              {batches}
            </span>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Shield size={10} strokeWidth={1.5} className="text-[var(--text-tertiary)]" />
              <span className="text-[10px] text-[var(--text-tertiary)] font-medium">Commitments</span>
            </div>
            <span className="text-[16px] sm:text-[18px] font-[family-name:var(--font-geist-mono)] font-bold text-[var(--text-primary)] font-tabular">
              {leaves}
            </span>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Activity size={10} strokeWidth={1.5} className="text-[var(--text-tertiary)]" />
              <span className="text-[10px] text-[var(--text-tertiary)] font-medium">Queued</span>
            </div>
            <span className="text-[16px] sm:text-[18px] font-[family-name:var(--font-geist-mono)] font-bold text-[var(--text-primary)] font-tabular">
              {deposits}
            </span>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Bitcoin size={10} strokeWidth={1.5} className="text-[var(--accent-orange)]" />
              <span className="text-[10px] text-[var(--text-tertiary)] font-medium">BTC IDs</span>
            </div>
            <span className="text-[16px] sm:text-[18px] font-[family-name:var(--font-geist-mono)] font-bold text-[var(--accent-orange)] font-tabular">
              {btcLinked}
            </span>
          </div>
        </div>

        <div className="h-px bg-[var(--border-subtle)] my-5" />

        {/* Merkle Root & Protocol Info */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0 relative">
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-[var(--text-tertiary)]">Merkle Root</span>
            <span className="text-[10px] sm:text-[11px] font-[family-name:var(--font-geist-mono)] text-[var(--text-secondary)]">
              {truncateHash(root)}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-green)] animate-pulse-dot" />
            <span className="text-[11px] text-[var(--text-tertiary)]">Live on {NETWORK_LABEL}</span>
          </div>
        </div>

        <div className="h-px bg-[var(--border-subtle)] my-4" />

        {/* Verified On-Chain Links */}
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`${CONTRACT_EXPLORER}/${addresses.contracts.shieldedPool}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--bg-tertiary)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] transition-colors text-[10px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <Shield size={10} strokeWidth={1.5} />
            Pool
            <ExternalLink size={8} strokeWidth={2} className="opacity-50" />
          </a>
          {(addresses.contracts as Record<string, string>).garagaVerifier && (
            <a
              href={`${CONTRACT_EXPLORER}/${(addresses.contracts as Record<string, string>).garagaVerifier}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-950/20 hover:bg-emerald-950/30 border border-emerald-800/20 transition-colors text-[10px] font-medium text-emerald-400"
            >
              <Fingerprint size={10} strokeWidth={1.5} />
              ZK Verifier
              <ExternalLink size={8} strokeWidth={2} className="opacity-50" />
            </a>
          )}
          <a
            href={`${CONTRACT_EXPLORER}/${addresses.contracts.usdc}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--bg-tertiary)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] transition-colors text-[10px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            USDC
            <ExternalLink size={8} strokeWidth={2} className="opacity-50" />
          </a>
          <a
            href={`${CONTRACT_EXPLORER}/${addresses.contracts.wbtc}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--bg-tertiary)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] transition-colors text-[10px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <Bitcoin size={10} strokeWidth={1.5} />
            WBTC
            <ExternalLink size={8} strokeWidth={2} className="opacity-50" />
          </a>
        </div>
      </div>

      {/* Execute Batch Button */}
      {pending > 0 && (
        <div className="glass-card p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <Play size={12} strokeWidth={1.5} className="text-[var(--accent-orange)]" />
                <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">
                  Execute Batch Conversion
                </span>
              </div>
              <p className="text-[11px] text-[var(--text-secondary)]">
                {pending.toLocaleString()} USDC pending — execute conversion
              </p>
            </div>
            <motion.button
              onClick={handleExecuteBatch}
              disabled={batchExecuting || proverStatus !== "online"}
              className="px-4 py-2.5 bg-[var(--accent-orange)] text-white rounded-xl text-[12px] font-semibold
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
              className="mt-3 flex items-center gap-1.5 text-[11px] text-emerald-400 hover:underline font-[family-name:var(--font-geist-mono)]"
            >
              <CheckCircle size={10} strokeWidth={2} />
              Conversion complete — view on Voyager
              <ExternalLink size={10} strokeWidth={1.5} className="opacity-60" />
            </a>
          )}
          {proverStatus !== "online" && (
            <p className="text-[10px] text-[var(--text-tertiary)] mt-2">
              Relayer must be online to convert (owner-only operation)
            </p>
          )}
        </div>
      )}

      {/* Anonymity Sets — Animated Bars */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-1.5">
            <Users size={12} strokeWidth={1.5} className="text-[var(--text-tertiary)]" />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">
              Anonymity Sets
            </span>
          </div>
          <span className="text-[10px] text-[var(--text-quaternary)]">
            More participants = stronger confidentiality
          </span>
        </div>
        <div className="space-y-4">
          {[
            { label: "$1", unit: "USDC", count: anon0 },
            { label: "$10", unit: "USDC", count: anon1 },
            { label: "$100", unit: "USDC", count: anon2 },
          ].map(({ label, unit, count }) => {
            const pct = Math.min(count / 20, 1) * 100;
            const color = count >= 10 ? "#10B981" : count >= 3 ? "#F59E0B" : "#EF4444";
            const strength = count >= 20 ? "Maximum" : count >= 10 ? "Strong" : count >= 3 ? "Growing" : "Low";
            return (
              <div key={label}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-[family-name:var(--font-geist-mono)] font-semibold text-[var(--text-primary)] font-tabular">
                      {label}
                    </span>
                    <span className="text-[11px] text-[var(--text-tertiary)]">{unit}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-[family-name:var(--font-geist-mono)] font-bold font-tabular" style={{ color }}>
                      {count}
                    </span>
                    <span className="text-[10px] font-medium" style={{ color }}>
                      {strength}
                    </span>
                  </div>
                </div>
                <div className="h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
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
        <p className="text-[10px] text-[var(--text-quaternary)] text-center mt-4">
          Each allocation is indistinguishable within its tranche. Larger anonymity sets provide stronger confidentiality guarantees.
        </p>
      </div>

      {/* Confidentiality Metrics */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-1.5">
            <Lock size={12} strokeWidth={1.5} className="text-emerald-400" />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">
              Confidentiality Metrics
            </span>
          </div>
          {/* Confidentiality Strength Index */}
          {(() => {
            const activeTranches = [anon0, anon1, anon2].filter(a => a > 0).length;
            const maxParticipants = Math.max(anon0, anon1, anon2);
            const csi = maxParticipants * activeTranches;
            return (
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold font-[family-name:var(--font-geist-mono)] ${
                csi >= 15 ? "bg-emerald-950/30 border border-emerald-800/30 text-emerald-400"
                  : csi >= 5 ? "bg-amber-950/30 border border-amber-800/30 text-amber-400"
                  : "bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-tertiary)]"
              }`}>
                CSI: {csi}
              </div>
            );
          })()}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {
              label: "Active Participants",
              value: `${Math.max(anon0, anon1, anon2)}`,
              active: Math.max(anon0, anon1, anon2) >= 5,
              icon: Users,
            },
            {
              label: "Max Capital Tier",
              value: anon2 > 0 ? "$100" : anon1 > 0 ? "$10" : anon0 > 0 ? "$1" : "None",
              active: anon0 > 0 || anon1 > 0 || anon2 > 0,
              icon: Layers,
            },
            {
              label: "Anonymity Threshold",
              value: Math.max(anon0, anon1, anon2) >= 5 ? "Operational" : "Building",
              active: Math.max(anon0, anon1, anon2) >= 5,
              icon: Eye,
            },
            {
              label: "ZK Verification",
              value: (addresses.contracts as Record<string, string>).garagaVerifier ? "STARK-Verified" : "Pedersen Mode",
              active: !!(addresses.contracts as Record<string, string>).garagaVerifier,
              icon: Fingerprint,
            },
          ].map(({ label, value, active, icon: Icon }) => (
            <div key={label} className={`rounded-xl p-3 border transition-all ${
              active
                ? "bg-emerald-950/15 border-emerald-800/25"
                : "bg-[var(--bg-secondary)] border-[var(--border-subtle)]"
            }`}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Icon size={10} strokeWidth={1.5} className={active ? "text-emerald-400" : "text-[var(--text-tertiary)]"} />
                <span className="text-[10px] text-[var(--text-tertiary)] font-medium">{label}</span>
              </div>
              <div className={`text-[12px] font-semibold ${active ? "text-emerald-400" : "text-[var(--text-secondary)]"}`}>
                {value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* STARK Credibility Panel */}
      <div className="glass-card p-5">
        <div className="flex items-center gap-1.5 mb-3">
          <Shield size={12} strokeWidth={1.5} className="text-[var(--accent-orange)]" />
          <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">
            Powered by STARK Cryptography
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Proof System", value: "STARK-based", sub: "Quantum secure" },
            { label: "Contracts", value: "Cairo-native", sub: "Starknet VM" },
            { label: "Verification", value: "On-chain", sub: "Garaga verifier" },
            { label: "Settlement", value: "Bitcoin L1", sub: "Intent bridge" },
          ].map(({ label, value, sub }) => (
            <div key={label} className="rounded-xl p-3 bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
              <div className="text-[10px] text-[var(--text-tertiary)] font-medium mb-1">{label}</div>
              <div className="text-[12px] font-semibold text-[var(--text-primary)]">{value}</div>
              <div className="text-[9px] text-[var(--text-quaternary)]">{sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Privacy Score */}
      <PrivacyScore
        anonSet={Math.max(anon0, anon1, anon2)}
        batches={batches}
        btcLinked={btcLinked}
        commitments={leaves}
      />

      {/* ZK Proof Pipeline — the differentiator */}
      <div className="glass-card p-6 relative overflow-hidden">
        <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full opacity-[0.02] pointer-events-none"
          style={{ background: "radial-gradient(circle, #10B981 0%, transparent 70%)" }}
        />
        <div className="flex items-center gap-1.5 mb-4">
          <Fingerprint size={12} strokeWidth={1.5} className="text-emerald-400" />
          <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">
            ZK Proof Pipeline
          </span>
        </div>
        <div className="flex items-center gap-1 sm:gap-2 mb-4">
          {[
            { label: "Noir Circuit", sub: "Poseidon BN254" },
            { label: "BB Prover", sub: "UltraHonk" },
            { label: "Garaga", sub: "On-chain verify" },
          ].map((step, i) => (
            <div key={step.label} className="flex items-center gap-1 sm:gap-2 flex-1">
              <div className="flex-1 rounded-lg bg-emerald-950/20 border border-emerald-800/20 p-2 sm:p-2.5 text-center">
                <div className="text-[10px] sm:text-[11px] font-semibold text-emerald-400">{step.label}</div>
                <div className="text-[9px] text-emerald-400/50">{step.sub}</div>
              </div>
              {i < 2 && (
                <span className="text-[var(--text-quaternary)] text-[10px] flex-shrink-0">&rarr;</span>
              )}
            </div>
          ))}
        </div>
        <p className="text-[10px] text-[var(--text-tertiary)] leading-relaxed">
          Secrets never appear in calldata. The ZK proof (~2835 felt252 values) is verified by the Garaga UltraKeccakZKHonk verifier deployed on-chain.
        </p>
      </div>

    </div>
  );
}
