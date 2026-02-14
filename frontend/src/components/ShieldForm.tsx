"use client";

import { useState, useEffect } from "react";
import { useAccount, useReadContract } from "@starknet-react/core";
import { useSendTransaction } from "@starknet-react/core";
import { useWallet } from "@/context/WalletContext";
import { generatePrivateNote, saveNote, DENOMINATIONS, DENOMINATION_LABELS } from "@/utils/privacy";
import { signCommitment, computeBtcIdentityHash } from "@/utils/bitcoin";
import { AlertTriangle, ArrowRight, Droplets, CheckCircle, Loader } from "lucide-react";
import { useToast } from "@/context/ToastContext";
import { motion, AnimatePresence } from "framer-motion";
import addresses from "@/contracts/addresses.json";
import { SHIELDED_POOL_ABI, ERC20_ABI } from "@/contracts/abi";
import { EXPLORER_TX, isMainnet, NETWORK_LABEL } from "@/utils/network";
import { CallData } from "starknet";

type Phase =
  | "idle"
  | "signing_btc"
  | "generating_proof"
  | "generating_zk"
  | "depositing"
  | "executing_batch"
  | "batch_done"
  | "success"
  | "error";

const PHASE_LABELS: Record<Phase, string> = {
  idle: "",
  signing_btc: "Attestating Bitcoin identity...",
  generating_proof: "Computing Pedersen commitment...",
  generating_zk: "Generating confidential credentials...",
  depositing: "Submitting capital allocation...",
  executing_batch: "Executing batch conversion at market rate...",
  batch_done: "Execution complete — BTC ready for confidential exit",
  success: "Capital allocation confirmed",
  error: "Transaction failed",
};

const spring = { type: "spring" as const, stiffness: 400, damping: 30 };

const RELAYER_URL = process.env.NEXT_PUBLIC_RELAYER_URL ?? "/api/relayer";

interface ShieldFormProps {
  onComplete?: () => void;
}

export default function ShieldForm({ onComplete }: ShieldFormProps) {
  const { address, isConnected } = useAccount();
  const { bitcoinAddress } = useWallet();
  const { sendAsync } = useSendTransaction({ calls: [] });
  const { toast } = useToast();

  const [selectedTier, setSelectedTier] = useState<number>(1);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [batchTxHash, setBatchTxHash] = useState<string | null>(null);
  const [btcPrice, setBtcPrice] = useState<number | null>(null);

  const [minting, setMinting] = useState(false);

  const poolAddress = addresses.contracts.shieldedPool;
  const usdcAddress = addresses.contracts.usdc;

  const REAL_USDC = "0x053b40a647cedfca6ca84f542a0fe36736031905a9639a7f19a3c1e66bfd5080";
  const isLiveMode = usdcAddress.toLowerCase() === REAL_USDC.toLowerCase();

  const { data: usdcBalance, refetch: refetchBalance } = useReadContract({
    address: usdcAddress || undefined,
    abi: ERC20_ABI,
    functionName: "balance_of",
    args: address ? [address] : [],
    enabled: !!usdcAddress && !!address,
    refetchInterval: 10_000,
  } as unknown as Parameters<typeof useReadContract>[0]);

  const balance = usdcBalance ? Number(usdcBalance) / 1_000_000 : 0;

  async function handleMintUsdc() {
    if (!address || !usdcAddress) return;
    setMinting(true);
    try {
      const calls = [{
        contractAddress: usdcAddress,
        entrypoint: "mint",
        calldata: CallData.compile({
          to: address,
          amount: { low: 100_000_000_000n, high: 0n },
        }),
      }];
      await sendAsync(calls);
      toast("success", "100,000 Test USDC minted");
      refetchBalance();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Mint failed";
      if (msg.includes("reject") || msg.includes("abort")) {
        toast("error", "Transaction rejected");
      } else {
        toast("error", "Failed to mint test USDC");
      }
    }
    setMinting(false);
  }

  // Fetch live BTC price
  useEffect(() => {
    async function fetchPrice() {
      try {
        const res = await fetch(
          "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd"
        );
        const data = await res.json();
        if (data?.bitcoin?.usd) setBtcPrice(Math.round(data.bitcoin.usd));
      } catch {
        setBtcPrice(97000);
      }
    }
    fetchPrice();
    const interval = setInterval(fetchPrice, 60_000);
    return () => clearInterval(interval);
  }, []);

  const { data: currentBatchId } = useReadContract({
    address: poolAddress || undefined,
    abi: SHIELDED_POOL_ABI,
    functionName: "get_current_batch_id",
    args: [],
    enabled: !!poolAddress,
  } as unknown as Parameters<typeof useReadContract>[0]);

  const { data: leafCount } = useReadContract({
    address: poolAddress || undefined,
    abi: SHIELDED_POOL_ABI,
    functionName: "get_leaf_count",
    args: [],
    enabled: !!poolAddress,
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

  const anonSets: Record<number, number> = {
    0: anonSet0 ? Number(anonSet0) : 0,
    1: anonSet1 ? Number(anonSet1) : 0,
    2: anonSet2 ? Number(anonSet2) : 0,
  };

  async function executeBatchAutomatically(): Promise<boolean> {
    try {
      const res = await fetch(`${RELAYER_URL}/execute-batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (data.success) {
        setBatchTxHash(data.txHash);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  async function handleAccumulate() {
    setError(null);
    setTxHash(null);
    setBatchTxHash(null);

    if (!isConnected || !address) {
      setError("Connect your Starknet wallet first");
      return;
    }
    if (!poolAddress || !usdcAddress) {
      setError("Contracts not deployed yet");
      return;
    }

    const rawAmount = BigInt(DENOMINATIONS[selectedTier]);

    try {
      setPhase("generating_proof");
      const batchId = currentBatchId ? Number(currentBatchId) : 0;
      const leafIdx = leafCount ? Number(leafCount) : 0;
      const btcIdHash = bitcoinAddress ? computeBtcIdentityHash(bitcoinAddress) : "0x0";

      setPhase("generating_zk");
      const note = generatePrivateNote(selectedTier, batchId, leafIdx, btcIdHash !== "0x0" ? btcIdHash : undefined);

      if (bitcoinAddress) {
        setPhase("signing_btc");
        await signCommitment(bitcoinAddress, note.commitment);
      }

      setPhase("depositing");
      const calls = [
        {
          contractAddress: usdcAddress,
          entrypoint: "approve",
          calldata: CallData.compile({
            spender: poolAddress,
            amount: { low: rawAmount, high: 0n },
          }),
        },
        {
          contractAddress: poolAddress,
          entrypoint: "deposit_private",
          calldata: CallData.compile({
            commitment: note.commitment,
            denomination: selectedTier,
            btc_identity_hash: btcIdHash,
            zk_commitment: note.zkCommitment!,
          }),
        },
      ];
      const result = await sendAsync(calls);
      setTxHash(result.transaction_hash);

      await saveNote(note, address);

      // Auto-execute batch — the key UX improvement
      setPhase("executing_batch");
      const batchSuccess = await executeBatchAutomatically();

      if (batchSuccess) {
        setPhase("batch_done");
        toast("success", "Capital converted — ready for confidential exit");
        await new Promise(r => setTimeout(r, 1500));
        setPhase("success");
        if (onComplete) onComplete();
      } else {
        // Batch didn't execute — deposit is safe, conversion pending
        toast("info", "Allocation confirmed — batch conversion will execute automatically");
        setPhase("success");
      }
    } catch (err: unknown) {
      setPhase("error");
      const msg = err instanceof Error ? err.message : "Unknown error";
      if (msg.includes("User abort") || msg.includes("cancelled") || msg.includes("rejected")) {
        setError("Transaction rejected in wallet");
        toast("error", "Transaction rejected");
      } else if (msg.includes("insufficient") || msg.includes("balance")) {
        setError("Insufficient USDC balance");
        toast("error", "Insufficient USDC balance");
      } else {
        setError(msg);
        toast("error", "Transaction failed");
      }
    }
  }

  const isProcessing =
    phase !== "idle" && phase !== "success" && phase !== "error";
  const canAccumulate = isConnected && !isProcessing;

  return (
    <div className="relative">
      <AnimatePresence mode="wait">
        {isProcessing ? (
          <motion.div
            key="processing"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
            className="flex flex-col items-center justify-center py-16 gap-6"
          >
            {phase === "batch_done" ? (
              <div className="w-24 h-24 rounded-full bg-emerald-950/30 border border-emerald-800/30 flex items-center justify-center">
                <CheckCircle size={32} strokeWidth={1.5} className="text-emerald-400" />
              </div>
            ) : (
              <div
                className="w-24 h-24 rounded-full animate-processing-orb"
                style={{
                  background: "radial-gradient(circle at 40% 35%, #2A2A30 0%, #1A1A1F 50%, #131316 100%)",
                  boxShadow: phase === "executing_batch"
                    ? "0 0 60px rgba(16, 185, 129, 0.15)"
                    : "0 0 60px rgba(255, 90, 0, 0.1)",
                  border: "1px solid rgba(255, 255, 255, 0.06)",
                }}
              />
            )}
            <div className="text-center space-y-1.5">
              <p className="text-[13px] font-medium text-[var(--text-primary)]">
                {PHASE_LABELS[phase]}
              </p>
              {phase === "executing_batch" && (
                <p className="text-[11px] text-emerald-400/60">
                  Swapping via AVNU at live market rate
                </p>
              )}
              {phase !== "batch_done" && (
                <p className="text-[11px] text-[var(--text-tertiary)]">
                  Do not close this window
                </p>
              )}
            </div>
            {/* Step progress indicator */}
            <div className="flex items-center gap-2 mt-2">
              {["Allocate", "Convert", "Ready"].map((step, i) => {
                const stepPhases: Phase[][] = [
                  ["generating_proof", "generating_zk", "signing_btc", "depositing"],
                  ["executing_batch"],
                  ["batch_done"],
                ];
                const isActive = stepPhases[i].includes(phase);
                const isDone = i === 0
                  ? ["executing_batch", "batch_done"].includes(phase)
                  : i === 1
                    ? phase === "batch_done"
                    : false;
                return (
                  <div key={step} className="flex items-center gap-2">
                    {i > 0 && <div className={`w-6 h-px ${isDone || isActive ? "bg-emerald-500" : "bg-[var(--border-subtle)]"}`} />}
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium ${
                      isDone ? "bg-emerald-950/30 text-emerald-400 border border-emerald-800/30"
                        : isActive ? "bg-[var(--accent-orange)]/10 text-[var(--accent-orange)] border border-[var(--accent-orange)]/30"
                        : "bg-[var(--bg-secondary)] text-[var(--text-tertiary)] border border-[var(--border-subtle)]"
                    }`}>
                      {isDone && <CheckCircle size={10} strokeWidth={2} />}
                      {isActive && <Loader size={10} strokeWidth={2} className="animate-spin" />}
                      {step}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="form"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
            className="space-y-6"
          >
            {/* Faucet — shown when balance is low */}
            {isConnected && balance < 100 && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl p-4 bg-orange-950/20 border border-orange-800/20"
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-orange-950/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Droplets size={14} strokeWidth={1.5} className="text-[var(--accent-orange)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    {isLiveMode ? (
                      <>
                        <p className="text-[12px] font-semibold text-[var(--text-primary)] mb-0.5">
                          Get Sepolia USDC
                        </p>
                        <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed mb-2">
                          This demo uses real Sepolia testnet USDC:
                        </p>
                        <ol className="text-[11px] text-[var(--text-secondary)] leading-relaxed mb-3 list-decimal list-inside space-y-1">
                          <li>Get Sepolia ETH from a{" "}
                            <a href="https://cloud.google.com/application/web3/faucet/ethereum/sepolia" target="_blank" rel="noopener noreferrer" className="text-[var(--accent-orange)] hover:underline">faucet</a>
                          </li>
                          <li>Get Sepolia USDC from{" "}
                            <a href="https://faucet.circle.com/" target="_blank" rel="noopener noreferrer" className="text-[var(--accent-orange)] hover:underline">Circle Faucet</a>
                          </li>
                          <li>Bridge to Starknet via{" "}
                            <a href="https://sepolia.starkgate.starknet.io/" target="_blank" rel="noopener noreferrer" className="text-[var(--accent-orange)] hover:underline">StarkGate</a>
                          </li>
                        </ol>
                        <span className="text-[10px] text-[var(--text-quaternary)] font-[family-name:var(--font-geist-mono)]">
                          Balance: {balance.toLocaleString()} USDC
                        </span>
                      </>
                    ) : (
                      <>
                        <p className="text-[12px] font-semibold text-[var(--text-primary)] mb-0.5">
                          Get Test USDC
                        </p>
                        <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed mb-3">
                          Mint free test USDC to try the full accumulation flow.
                        </p>
                        <div className="flex items-center gap-3">
                          <motion.button
                            onClick={handleMintUsdc}
                            disabled={minting || !address}
                            className="px-4 py-2 bg-[var(--accent-orange)] text-white rounded-xl text-[12px] font-semibold cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                            whileTap={{ scale: 0.97 }}
                            transition={spring}
                          >
                            <Droplets size={12} strokeWidth={2} />
                            {minting ? "Minting..." : "Mint 100K USDC"}
                          </motion.button>
                          <span className="text-[10px] text-[var(--text-quaternary)] font-[family-name:var(--font-geist-mono)]">
                            Balance: {balance.toLocaleString()} USDC
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* USDC Balance */}
            {isConnected && balance >= 100 && (
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] text-[var(--text-tertiary)]">
                  {isLiveMode ? `${NETWORK_LABEL} USDC Balance` : "Test USDC Balance"}
                </span>
                <span className="text-[12px] font-[family-name:var(--font-geist-mono)] font-semibold text-[var(--text-primary)] font-tabular">
                  {balance.toLocaleString()} USDC
                </span>
              </div>
            )}

            {/* Tranche Selector */}
            <div className="space-y-3">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)] block">
                Select Capital Tier
              </span>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(DENOMINATIONS).map(([tier, amount]) => {
                  const tierNum = Number(tier);
                  const isSelected = selectedTier === tierNum;
                  const usdcAmount = amount / 1_000_000;
                  const btcEstimate = btcPrice ? (usdcAmount / btcPrice) : null;
                  return (
                    <motion.button
                      key={tier}
                      onClick={() => setSelectedTier(tierNum)}
                      className={`relative py-4 rounded-xl text-center transition-all cursor-pointer border ${
                        isSelected
                          ? "bg-[var(--accent-orange)] text-white border-[var(--accent-orange)]"
                          : "bg-[var(--bg-secondary)] text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-[var(--text-tertiary)]"
                      }`}
                      whileTap={{ scale: 0.97 }}
                      transition={spring}
                    >
                      <div className="text-[22px] font-[family-name:var(--font-geist-mono)] font-bold tracking-tight font-tabular">
                        {usdcAmount.toLocaleString()}
                      </div>
                      <div className={`text-[11px] mt-0.5 font-medium ${
                        isSelected ? "text-white/60" : "text-[var(--text-tertiary)]"
                      }`}>
                        USDC
                      </div>
                      {btcEstimate !== null && (
                        <div className={`text-[10px] mt-0.5 font-[family-name:var(--font-geist-mono)] ${
                          isSelected ? "text-white/40" : "text-[var(--text-quaternary)]"
                        }`}>
                          ~{btcEstimate.toFixed(btcEstimate < 0.01 ? 5 : 3)} BTC
                        </div>
                      )}
                      <div className={`text-[10px] mt-1 font-medium ${
                        isSelected
                          ? "text-white/50"
                          : anonSets[tierNum] >= 10
                            ? "text-emerald-500"
                            : anonSets[tierNum] >= 3
                              ? "text-amber-500"
                              : "text-[var(--text-tertiary)]"
                      }`}>
                        {anonSets[tierNum]} in pool
                      </div>
                    </motion.button>
                  );
                })}
              </div>
              <div className="flex items-center justify-center gap-2 text-[11px] text-[var(--text-tertiary)]">
                <span>Standardized capital tiers — all allocations are indistinguishable</span>
              </div>
              {btcPrice && (
                <div className="flex items-center justify-center gap-1.5 text-[10px] text-[var(--text-quaternary)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  BTC ${btcPrice.toLocaleString()} — live rate applied at conversion
                </div>
              )}
            </div>

            {/* Accumulate Button */}
            <motion.button
              onClick={handleAccumulate}
              disabled={!canAccumulate}
              className="w-full py-4.5 bg-[var(--accent-orange)] text-white rounded-2xl text-[15px] font-semibold tracking-tight
                         disabled:opacity-20 disabled:cursor-not-allowed
                         cursor-pointer transition-all flex items-center justify-center gap-2"
              whileHover={canAccumulate ? { y: -1, boxShadow: "var(--shadow-xl)" } : {}}
              whileTap={canAccumulate ? { scale: 0.985 } : {}}
              transition={spring}
            >
              Allocate Capital
              <ArrowRight size={16} strokeWidth={1.5} />
            </motion.button>

            {/* Wallet Hints */}
            {!isConnected && (
              <p className="text-[12px] text-[var(--text-tertiary)] text-center">
                Connect your Starknet wallet to begin
              </p>
            )}

            {error && phase === "idle" && (
              <p className="text-[12px] text-red-500 text-center">{error}</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success / Error States */}
      <AnimatePresence>
        {(phase === "success" || phase === "error") && !isProcessing && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
            className="mt-6"
          >
            <div className={`rounded-2xl p-5 ${
              phase === "success"
                ? "bg-emerald-950/20 border border-emerald-800/20"
                : "bg-red-950/30 border border-red-900/30"
            }`}>
              <div className="flex items-center gap-2.5">
                {phase === "success" ? (
                  <CheckCircle size={16} strokeWidth={1.5} className="text-emerald-400" />
                ) : (
                  <AlertTriangle size={14} strokeWidth={1.5} className="text-red-500" />
                )}
                <span className={`text-[13px] font-medium ${
                  phase === "success" ? "text-emerald-400" : "text-red-400"
                }`}>
                  {PHASE_LABELS[phase]}
                </span>
              </div>
              {txHash && (
                <a
                  href={`${EXPLORER_TX}${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 flex items-center gap-1.5 text-[11px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] font-[family-name:var(--font-geist-mono)]"
                >
                  Deposit tx &rarr;
                </a>
              )}
              {batchTxHash && (
                <a
                  href={`${EXPLORER_TX}${batchTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 flex items-center gap-1.5 text-[11px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] font-[family-name:var(--font-geist-mono)]"
                >
                  Conversion tx &rarr;
                </a>
              )}
              {error && phase === "error" && (
                <p className="mt-2 text-[11px] text-red-500 break-all">{error}</p>
              )}
              {phase === "success" && (
                <div className="mt-3 space-y-3">
                  {batchTxHash ? (
                    <p className="text-[11px] text-emerald-400/70">
                      Capital converted. Proceed to <strong>Confidential Exit</strong> to claim BTC.
                    </p>
                  ) : (
                    <p className="text-[11px] text-[var(--text-tertiary)]">
                      Capital allocated to privacy pool. Batch conversion will execute automatically.
                      Once converted, use <strong>Confidential Exit</strong> to claim BTC.
                    </p>
                  )}
                  <div className="flex gap-3">
                    <button
                      onClick={() => { setPhase("idle"); setTxHash(null); setBatchTxHash(null); }}
                      className="text-[12px] font-medium text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                    >
                      Allocate more
                    </button>
                    {batchTxHash && onComplete && (
                      <button
                        onClick={onComplete}
                        className="text-[12px] font-semibold text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer flex items-center gap-1"
                      >
                        Confidential Exit <ArrowRight size={12} strokeWidth={2} />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
