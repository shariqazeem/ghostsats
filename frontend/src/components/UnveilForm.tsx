"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount, useSendTransaction } from "@starknet-react/core";
import { Loader, CheckCircle, AlertTriangle, Lock, Unlock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { markNoteClaimed } from "@/utils/privacy";
import {
  type NoteWithStatus,
  checkAllNoteStatuses,
} from "@/utils/notesManager";
import addresses from "@/contracts/addresses.json";
import { CallData } from "starknet";

type ClaimPhase = "idle" | "decrypting" | "withdrawing" | "success" | "error";

const spring = { type: "spring" as const, stiffness: 400, damping: 30 };

function truncateHash(h: string, chars = 4): string {
  if (h.length <= chars * 2 + 2) return h;
  return `${h.slice(0, chars + 2)}...${h.slice(-chars)}`;
}

function StatusBadge({ status }: { status: NoteWithStatus["status"] }) {
  const styles = {
    PENDING: "bg-amber-50 text-amber-600",
    READY: "bg-emerald-50 text-emerald-600",
    CLAIMED: "bg-gray-100 text-[var(--text-tertiary)]",
  };
  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${styles[status]}`}>
      {status === "PENDING" ? "Pending" : status === "READY" ? "Ready" : "Claimed"}
    </span>
  );
}

function NoteCard({
  note,
  onClaim,
  claimingCommitment,
}: {
  note: NoteWithStatus;
  onClaim: (note: NoteWithStatus) => void;
  claimingCommitment: string | null;
}) {
  const isClaiming = claimingCommitment === note.commitment;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring}
      className="bg-[var(--bg-secondary)] rounded-xl p-4 space-y-3"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {note.status === "CLAIMED" ? (
            <Unlock size={14} strokeWidth={1.5} className="text-[var(--text-tertiary)]" />
          ) : (
            <Lock size={14} strokeWidth={1.5} className="text-[var(--text-primary)]" />
          )}
          <span className="text-xs font-[family-name:var(--font-geist-mono)] text-[var(--text-secondary)]">
            {truncateHash(note.commitment)}
          </span>
        </div>
        <StatusBadge status={note.status} />
      </div>

      <div className="flex items-center gap-6 text-sm">
        <div>
          <span className="text-xs text-[var(--text-tertiary)]">Amount</span>
          <div className="font-[family-name:var(--font-geist-mono)] font-semibold text-[var(--text-primary)] font-tabular">
            {Number(note.amount).toLocaleString()} USDC
          </div>
        </div>
        <div>
          <span className="text-xs text-[var(--text-tertiary)]">Batch</span>
          <div className="font-[family-name:var(--font-geist-mono)] font-semibold text-[var(--text-primary)] font-tabular">
            #{note.batchId}
          </div>
        </div>
        {note.wbtcShare && (
          <div>
            <span className="text-xs text-[var(--text-tertiary)]">BTC Share</span>
            <div className="font-[family-name:var(--font-geist-mono)] font-semibold text-[var(--accent-orange)] font-tabular">
              {note.wbtcShare} sats
            </div>
          </div>
        )}
      </div>

      {note.status === "READY" && (
        <motion.button
          onClick={() => onClaim(note)}
          disabled={isClaiming}
          className="w-full py-3 bg-[var(--text-primary)] text-white rounded-xl text-sm font-semibold
                     disabled:opacity-50 disabled:cursor-not-allowed
                     flex items-center justify-center gap-2 cursor-pointer"
          whileHover={{ y: -1, boxShadow: "var(--shadow-elevated)" }}
          whileTap={{ scale: 0.98 }}
          transition={spring}
        >
          {isClaiming ? (
            <Loader size={14} className="animate-spin" strokeWidth={1.5} />
          ) : (
            <Unlock size={14} strokeWidth={1.5} />
          )}
          {isClaiming ? "Processing..." : "Claim BTC"}
        </motion.button>
      )}
    </motion.div>
  );
}

export default function UnveilForm() {
  const { address, isConnected } = useAccount();
  const { sendAsync } = useSendTransaction({ calls: [] });

  const [notes, setNotes] = useState<NoteWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimPhase, setClaimPhase] = useState<ClaimPhase>("idle");
  const [claimingCommitment, setClaimingCommitment] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimTxHash, setClaimTxHash] = useState<string | null>(null);

  const poolAddress = addresses.contracts.shieldedPool;

  const refreshNotes = useCallback(async () => {
    setLoading(true);
    try {
      const statuses = await checkAllNoteStatuses();
      setNotes(statuses);
    } catch {
      // Silently fail
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refreshNotes();
  }, [refreshNotes]);

  async function handleClaim(note: NoteWithStatus) {
    if (!isConnected || !address) return;
    if (!poolAddress) return;

    setClaimingCommitment(note.commitment);
    setClaimError(null);
    setClaimTxHash(null);

    try {
      setClaimPhase("decrypting");
      await new Promise((r) => setTimeout(r, 2000));

      setClaimPhase("withdrawing");
      const rawAmount = BigInt(note.amount);
      const withdrawCalls = [
        {
          contractAddress: poolAddress,
          entrypoint: "withdraw",
          calldata: CallData.compile({
            amount: { low: rawAmount, high: 0n },
            secret: note.secret,
            blinder: note.blinder,
            recipient: address,
          }),
        },
      ];
      const result = await sendAsync(withdrawCalls);
      setClaimTxHash(result.transaction_hash);

      markNoteClaimed(note.commitment);
      setClaimPhase("success");

      await refreshNotes();
    } catch (err: unknown) {
      setClaimPhase("error");
      setClaimError(err instanceof Error ? err.message : "Withdrawal failed");
    } finally {
      setClaimingCommitment(null);
    }
  }

  const activeNotes = notes.filter((n) => !n.claimed);
  const claimedNotes = notes.filter((n) => n.claimed);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
          Shielded Notes
        </span>
        <button
          onClick={refreshNotes}
          disabled={loading}
          className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
        >
          {loading ? "Scanning..." : "Refresh"}
        </button>
      </div>

      {/* Status Banner */}
      <AnimatePresence>
        {claimPhase !== "idle" && claimPhase !== "success" && claimPhase !== "error" && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-xl p-4 bg-[var(--bg-secondary)] text-sm text-[var(--text-secondary)]"
          >
            <div className="flex items-center gap-2">
              <Loader size={14} className="animate-spin" strokeWidth={1.5} />
              <span>
                {claimPhase === "decrypting"
                  ? "Decrypting proof..."
                  : "Executing withdrawal..."}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {claimPhase === "success" && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={spring}
          className="rounded-xl p-4 bg-emerald-50 text-sm text-emerald-700"
        >
          <div className="flex items-center gap-2">
            <CheckCircle size={14} strokeWidth={1.5} />
            <span>Assets unveiled</span>
          </div>
          {claimTxHash && (
            <div className="mt-2 text-xs text-emerald-500 font-[family-name:var(--font-geist-mono)] break-all">
              {claimTxHash}
            </div>
          )}
        </motion.div>
      )}

      {claimPhase === "error" && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={spring}
          className="rounded-xl p-4 bg-red-50 text-sm text-red-600"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} strokeWidth={1.5} />
            <span>Unveil failed</span>
          </div>
          {claimError && (
            <div className="mt-2 text-xs break-all">{claimError}</div>
          )}
        </motion.div>
      )}

      {/* Notes */}
      {loading ? (
        <div className="text-center py-10">
          <Loader size={20} className="animate-spin mx-auto text-[var(--text-tertiary)]" strokeWidth={1.5} />
          <p className="text-xs text-[var(--text-tertiary)] mt-3">
            Scanning notes...
          </p>
        </div>
      ) : activeNotes.length === 0 && claimedNotes.length === 0 ? (
        <div className="text-center py-10">
          <Lock size={24} className="mx-auto mb-3 text-gray-300" strokeWidth={1.5} />
          <p className="text-sm text-[var(--text-secondary)]">No shielded notes</p>
          <p className="text-xs text-[var(--text-tertiary)] mt-1">
            Shield assets to create your first note
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {activeNotes.map((note) => (
            <NoteCard
              key={note.commitment}
              note={note}
              onClaim={handleClaim}
              claimingCommitment={claimingCommitment}
            />
          ))}

          {claimedNotes.length > 0 && (
            <div className="mt-4 pt-4 border-t border-[var(--border-subtle)]">
              <p className="text-xs text-[var(--text-tertiary)] mb-2">
                Previously unveiled ({claimedNotes.length})
              </p>
              {claimedNotes.map((note) => (
                <NoteCard
                  key={note.commitment}
                  note={note}
                  onClaim={handleClaim}
                  claimingCommitment={claimingCommitment}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {!isConnected && (
        <p className="text-xs text-[var(--text-tertiary)] text-center">
          Connect Starknet wallet to unveil assets
        </p>
      )}
    </div>
  );
}
