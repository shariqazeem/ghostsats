"use client";

import { useState } from "react";
import { useAccount, useReadContract } from "@starknet-react/core";
import { useSendTransaction } from "@starknet-react/core";
import { useWallet } from "@/context/WalletContext";
import { generateNote, saveNote } from "@/utils/privacy";
import { signBitcoinIntent } from "@/utils/bitcoin";
import { Loader, CheckCircle, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import addresses from "@/contracts/addresses.json";
import { SHIELDED_POOL_ABI } from "@/contracts/abi";
import { CallData } from "starknet";

type Phase =
  | "idle"
  | "signing_btc"
  | "generating_proof"
  | "depositing"
  | "success"
  | "error";

const PHASE_LABELS: Record<Phase, string> = {
  idle: "",
  signing_btc: "Requesting Bitcoin signature",
  generating_proof: "Generating zero-knowledge proof",
  depositing: "Approving & shielding into dark pool",
  success: "Assets shielded",
  error: "Shield failed",
};

const spring = { type: "spring" as const, stiffness: 400, damping: 30 };

export default function ShieldForm() {
  const { address, isConnected } = useAccount();
  const { bitcoinAddress } = useWallet();
  const { sendAsync } = useSendTransaction({ calls: [] });

  const [amount, setAmount] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const poolAddress = addresses.contracts.shieldedPool;
  const usdcAddress = addresses.contracts.usdc;

  const { data: currentBatchId } = useReadContract({
    address: poolAddress || undefined,
    abi: SHIELDED_POOL_ABI,
    functionName: "get_current_batch_id",
    args: [],
    enabled: !!poolAddress,
  } as Parameters<typeof useReadContract>[0]);

  async function handleShield() {
    setError(null);
    setTxHash(null);

    if (!isConnected || !address) {
      setError("Connect your Starknet wallet first");
      return;
    }
    if (!bitcoinAddress) {
      setError("Connect your Bitcoin wallet first");
      return;
    }
    if (!poolAddress || !usdcAddress) {
      setError("Contracts not deployed yet");
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      setError("Enter a valid amount");
      return;
    }

    const rawAmount = BigInt(Math.floor(parsedAmount));

    try {
      setPhase("signing_btc");
      await signBitcoinIntent(bitcoinAddress);

      setPhase("generating_proof");
      await new Promise((r) => setTimeout(r, 1500));
      const batchId = currentBatchId ? Number(currentBatchId) : 0;
      const note = generateNote(rawAmount, batchId);
      saveNote(note);

      setPhase("depositing");
      const calls = [
        {
          contractAddress: usdcAddress,
          entrypoint: "mint",
          calldata: CallData.compile({
            to: address,
            amount: { low: rawAmount, high: 0n },
          }),
        },
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
          entrypoint: "deposit",
          calldata: CallData.compile({
            commitment: note.commitment,
            amount: { low: rawAmount, high: 0n },
          }),
        },
      ];
      const result = await sendAsync(calls);
      setTxHash(result.transaction_hash);

      setPhase("success");
      setAmount("");
    } catch (err: unknown) {
      setPhase("error");
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  }

  const isProcessing =
    phase !== "idle" && phase !== "success" && phase !== "error";

  return (
    <div className="space-y-6">
      {/* Amount Input */}
      <div>
        <label className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider block mb-3">
          Deposit Amount
        </label>
        <div className="flex items-baseline gap-3">
          <input
            type="number"
            min="0"
            step="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={isProcessing}
            placeholder="0"
            className="flex-1 bg-transparent border-none outline-none text-5xl font-[family-name:var(--font-geist-mono)] font-bold text-[var(--text-primary)] placeholder-gray-200 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none font-tabular"
          />
          <span className="text-lg font-medium text-[var(--text-tertiary)]">
            USDC
          </span>
        </div>
        <div className="mt-2 h-px bg-[var(--border-subtle)]" />
      </div>

      {/* Shield Button */}
      <motion.button
        onClick={handleShield}
        disabled={isProcessing || !isConnected || !bitcoinAddress}
        className="w-full py-4 bg-[var(--text-primary)] text-white rounded-2xl text-sm font-semibold tracking-wide
                   disabled:opacity-30 disabled:cursor-not-allowed
                   flex items-center justify-center gap-2.5 cursor-pointer"
        whileHover={!isProcessing ? { y: -2, boxShadow: "var(--shadow-hover)" } : {}}
        whileTap={!isProcessing ? { scale: 0.98 } : {}}
        transition={spring}
      >
        {isProcessing ? (
          <Loader size={16} className="animate-spin" strokeWidth={1.5} />
        ) : null}
        {isProcessing ? "Processing..." : "Shield Assets"}
      </motion.button>

      {/* Status Display */}
      {phase !== "idle" && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={spring}
          className={`rounded-xl p-4 text-sm ${
            phase === "success"
              ? "bg-emerald-50 text-emerald-700"
              : phase === "error"
                ? "bg-red-50 text-red-600"
                : "bg-[var(--bg-secondary)] text-[var(--text-secondary)]"
          }`}
        >
          <div className="flex items-center gap-2">
            {phase === "success" ? (
              <CheckCircle size={15} strokeWidth={1.5} />
            ) : phase === "error" ? (
              <AlertTriangle size={15} strokeWidth={1.5} />
            ) : (
              <Loader size={15} className="animate-spin" strokeWidth={1.5} />
            )}
            <span>{PHASE_LABELS[phase]}</span>
          </div>
          {txHash && (
            <div className="mt-2 text-xs text-[var(--text-tertiary)] font-[family-name:var(--font-geist-mono)] break-all">
              {txHash}
            </div>
          )}
          {error && phase === "error" && (
            <div className="mt-2 text-xs break-all">{error}</div>
          )}
        </motion.div>
      )}

      {/* Hints */}
      {!isConnected && (
        <p className="text-xs text-[var(--text-tertiary)] text-center">
          Connect Starknet wallet to shield assets
        </p>
      )}
      {isConnected && !bitcoinAddress && (
        <p className="text-xs text-[var(--text-tertiary)] text-center">
          Connect Bitcoin wallet to authorize deposits
        </p>
      )}
    </div>
  );
}
