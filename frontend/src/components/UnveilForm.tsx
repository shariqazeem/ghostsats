"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount, useSendTransaction } from "@starknet-react/core";
import { Loader, CheckCircle, AlertTriangle, Lock, Unlock, ExternalLink, Bitcoin, Clock, Zap, ShieldCheck, Fingerprint } from "lucide-react";
import { useToast } from "@/context/ToastContext";
import { computeBtcIdentityHash } from "@/utils/bitcoin";
import { motion, AnimatePresence } from "framer-motion";
import { markNoteClaimed, computeNullifier, buildMerkleProof } from "@/utils/privacy";
import { generateWithdrawalProof, preloadZKProver } from "@/utils/zkProver";
import {
  type NoteWithStatus,
  checkAllNoteStatuses,
} from "@/utils/notesManager";
import addresses from "@/contracts/addresses.json";
import { SHIELDED_POOL_ABI } from "@/contracts/abi";
import { EXPLORER_TX, RPC_URL } from "@/utils/network";
import { CallData, RpcProvider, Contract, type Abi, num } from "starknet";

type WithdrawMode = "wbtc" | "btc_intent";
type ClaimPhase = "idle" | "building_proof" | "generating_zk" | "withdrawing" | "success" | "error";

interface ProofDetails {
  calldataElements: number;
  zkCommitment: string;
  zkNullifier: string;
  gasless: boolean;
}

const spring = { type: "spring" as const, stiffness: 400, damping: 30 };
const TX_EXPLORER = EXPLORER_TX;
const RELAYER_URL = process.env.NEXT_PUBLIC_RELAYER_URL ?? "/api/relayer";
const GARAGA_VERIFIER = "0x00e8f49d3077663a517c203afb857e6d7a95c9d9b620aa2054f1400f62a32f07";

function truncateHash(h: string, chars = 4): string {
  if (h.length <= chars * 2 + 2) return h;
  return `${h.slice(0, chars + 2)}...${h.slice(-chars)}`;
}

function StatusBadge({ status }: { status: NoteWithStatus["status"] }) {
  const styles: Record<string, string> = {
    PENDING: "bg-amber-50 text-amber-700",
    READY: "bg-emerald-50 text-emerald-700",
    CLAIMED: "bg-gray-100 text-gray-400",
    STALE: "bg-red-50 text-red-700",
  };
  const labels: Record<string, string> = {
    PENDING: "Pending",
    READY: "Ready",
    CLAIMED: "Claimed",
    STALE: "Stale",
  };
  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${styles[status] ?? styles.PENDING}`}>
      {labels[status] ?? status}
    </span>
  );
}

function CountdownTimer({ withdrawableAt, onReady }: { withdrawableAt: number; onReady: () => void }) {
  const [remaining, setRemaining] = useState<number>(0);

  useEffect(() => {
    function tick() {
      const now = Math.floor(Date.now() / 1000);
      const left = withdrawableAt - now;
      if (left <= 0) {
        setRemaining(0);
        onReady();
      } else {
        setRemaining(left);
      }
    }
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [withdrawableAt, onReady]);

  if (remaining <= 0) return null;

  return (
    <div className="w-full py-3 rounded-xl text-sm font-medium text-center bg-amber-50 text-amber-600 flex items-center justify-center gap-2">
      <Clock size={14} strokeWidth={1.5} />
      <span>Privacy cooldown: {remaining}s remaining</span>
    </div>
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
  const [cooldownDone, setCooldownDone] = useState(false);

  // Check if cooldown already passed on mount
  const now = Math.floor(Date.now() / 1000);
  const isCooldownActive = note.status === "READY" && note.withdrawableAt && note.withdrawableAt > now && !cooldownDone;
  const canClaim = note.status === "READY" && !isCooldownActive;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring}
      className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {note.status === "CLAIMED" ? (
            <Unlock size={14} strokeWidth={1.5} className="text-gray-400" />
          ) : (
            <Lock size={14} strokeWidth={1.5} className="text-gray-900" />
          )}
          <span className="text-xs font-[family-name:var(--font-geist-mono)] text-gray-600">
            {truncateHash(note.commitment)}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {note.hasBtcIdentity && (
            <span className="flex items-center gap-1 text-xs bg-orange-50 text-[#FF5A00] px-2 py-0.5 rounded-full font-medium">
              <Bitcoin size={10} strokeWidth={1.5} />
              BTC
            </span>
          )}
          <StatusBadge status={note.status} />
        </div>
      </div>

      <div className="flex items-center gap-6 text-sm">
        <div>
          <span className="text-xs text-gray-400">Amount</span>
          <div className="font-[family-name:var(--font-geist-mono)] font-semibold text-gray-900 font-tabular">
            {(Number(note.amount) / 1_000_000).toLocaleString()} USDC
          </div>
        </div>
        <div>
          <span className="text-xs text-gray-400">Batch</span>
          <div className="font-[family-name:var(--font-geist-mono)] font-semibold text-gray-900 font-tabular">
            #{note.batchId}
          </div>
        </div>
        {note.wbtcShare && (
          <div>
            <span className="text-xs text-gray-400">BTC Share</span>
            <div className="font-[family-name:var(--font-geist-mono)] font-semibold text-[#FF5A00] font-tabular">
              {(Number(note.wbtcShare) / 1e8).toFixed(8)} BTC
            </div>
          </div>
        )}
      </div>

      {isCooldownActive && note.withdrawableAt && (
        <CountdownTimer
          withdrawableAt={note.withdrawableAt}
          onReady={() => setCooldownDone(true)}
        />
      )}

      {canClaim && (
        <motion.button
          onClick={() => onClaim(note)}
          disabled={isClaiming}
          className="w-full py-3 bg-[#FF5A00] text-white rounded-xl text-sm font-semibold
                     disabled:opacity-50 disabled:cursor-not-allowed
                     flex items-center justify-center gap-2 cursor-pointer"
          whileHover={{ y: -1, boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
          whileTap={{ scale: 0.98 }}
          transition={spring}
        >
          {isClaiming ? (
            <Loader size={14} className="animate-spin" strokeWidth={1.5} />
          ) : (
            <Unlock size={14} strokeWidth={1.5} />
          )}
          {isClaiming ? "Building proof..." : "Execute Exit"}
        </motion.button>
      )}
    </motion.div>
  );
}

export default function UnveilForm() {
  const { address, account, isConnected } = useAccount();
  const { sendAsync } = useSendTransaction({ calls: [] });
  const { toast } = useToast();

  const [notes, setNotes] = useState<NoteWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimPhase, setClaimPhase] = useState<ClaimPhase>("idle");
  const [claimingCommitment, setClaimingCommitment] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimTxHash, setClaimTxHash] = useState<string | null>(null);
  const [claimedWbtcAmount, setClaimedWbtcAmount] = useState<string | null>(null);
  const [btcWithdrawAddress, setBtcWithdrawAddress] = useState<string>("");
  const [tokenAdded, setTokenAdded] = useState(false);
  const [useRelayer, setUseRelayer] = useState(true);
  const [relayerFee, setRelayerFee] = useState<number | null>(null);
  const [proofDetails, setProofDetails] = useState<ProofDetails | null>(null);
  const [zkTimer, setZkTimer] = useState<number>(0);
  const [withdrawMode, setWithdrawMode] = useState<WithdrawMode>("wbtc");
  const [intentStatus, setIntentStatus] = useState<string | null>(null);
  const [intentId, setIntentId] = useState<number | null>(null);

  const poolAddress = addresses.contracts.shieldedPool;

  const refreshNotes = useCallback(async () => {
    setLoading(true);
    try {
      const statuses = await checkAllNoteStatuses(address ?? undefined);
      setNotes(statuses);
    } catch {
      // Silently fail
    }
    setLoading(false);
  }, [address]);

  useEffect(() => {
    refreshNotes();
  }, [refreshNotes]);

  // Pre-load ZK WASM modules so proof generation starts faster
  useEffect(() => {
    preloadZKProver();
  }, []);

  // Fetch relayer fee info
  useEffect(() => {
    if (!useRelayer) return;
    async function fetchRelayerInfo() {
      try {
        const res = await fetch(`${RELAYER_URL}/info`);
        const data = await res.json();
        setRelayerFee(data.fee_bps ?? 200);
      } catch {
        setRelayerFee(200); // Default 2%
      }
    }
    fetchRelayerInfo();
  }, [useRelayer]);

  // Poll for intent settlement status
  useEffect(() => {
    if (intentId === null || !poolAddress) return;
    let cancelled = false;

    async function pollIntent() {
      const rpc = new RpcProvider({ nodeUrl: RPC_URL });
      const pool = new Contract({ abi: SHIELDED_POOL_ABI as unknown as Abi, address: poolAddress, providerOrAccount: rpc });

      while (!cancelled) {
        try {
          const intent = await pool.call("get_intent", [intentId!]);
          const status = Number((intent as any).status ?? 0);
          const labels: Record<number, string> = { 0: "CREATED", 1: "CLAIMED", 2: "SETTLED", 3: "EXPIRED" };
          setIntentStatus(labels[status] ?? "UNKNOWN");
          if (status >= 2) break; // Terminal state
        } catch { /* ignore */ }
        await new Promise((r) => setTimeout(r, 10_000));
      }
    }

    pollIntent();
    return () => { cancelled = true; };
  }, [intentId, poolAddress]);

  async function handleClaim(note: NoteWithStatus) {
    if (!isConnected || !address) return;
    if (!poolAddress) return;

    const isBtcIntent = withdrawMode === "btc_intent" && btcWithdrawAddress.trim().length > 0;

    setClaimingCommitment(note.commitment);
    setClaimError(null);
    setClaimTxHash(null);
    setClaimedWbtcAmount(null);
    setProofDetails(null);
    setZkTimer(0);
    setIntentStatus(null);
    setIntentId(null);

    try {
      setClaimPhase("building_proof");

      const rpc = new RpcProvider({
        nodeUrl: RPC_URL,
      });
      const pool = new Contract({ abi: SHIELDED_POOL_ABI as unknown as Abi, address: poolAddress, providerOrAccount: rpc });
      const onChainLeafCount = Number(await pool.call("get_leaf_count", []));

      const leafPromises = Array.from({ length: onChainLeafCount }, (_, i) =>
        pool.call("get_leaf", [i]).then((leaf) => num.toHex(leaf as bigint))
      );
      const allCommitments = await Promise.all(leafPromises);

      const leafIndex = note.leafIndex ?? 0;

      // Validate leaf index matches on-chain commitment
      if (leafIndex >= allCommitments.length || allCommitments[leafIndex] !== note.commitment) {
        const found = allCommitments.indexOf(note.commitment);
        if (found === -1) {
          throw new Error("Commitment not found on-chain. It may not have been included in a batch yet.");
        }
        note.leafIndex = found;
      }
      const validIndex = note.leafIndex ?? leafIndex;

      const { path: merklePath, indices: pathIndices } = buildMerkleProof(
        validIndex,
        allCommitments,
      );

      const denomination = note.denomination ?? 1;
      const btcRecipientHash = btcWithdrawAddress
        ? computeBtcIdentityHash(btcWithdrawAddress)
        : "0x0";

      // Try ZK-private withdrawal first; fall back to legacy if prover unavailable
      const hasZK = !!note.zkCommitment;
      let usedZK = false;

      if (hasZK) {
        try {
          const zkStart = Date.now();
          const timer = setInterval(() => setZkTimer(Math.floor((Date.now() - zkStart) / 1000)), 500);
          setClaimPhase("generating_zk");
          const { proof, zkNullifier } = await generateWithdrawalProof({
            secret: BigInt(note.secret),
            blinder: BigInt(note.blinder),
            denomination: BigInt(denomination),
          });
          clearInterval(timer);
          usedZK = true;

          if (isBtcIntent) {
            // BTC Intent path — lock WBTC in escrow for solver settlement
            setProofDetails({
              calldataElements: proof.length,
              zkCommitment: note.zkCommitment!,
              zkNullifier,
              gasless: useRelayer,
            });
            setClaimPhase("withdrawing");

            if (useRelayer) {
              // Gasless BTC intent via relayer
              const relayRes = await fetch(`${RELAYER_URL}/relay-intent`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  denomination,
                  zk_nullifier: zkNullifier,
                  zk_commitment: note.zkCommitment!,
                  proof,
                  merkle_path: merklePath,
                  path_indices: pathIndices.map(Number),
                  recipient: address,
                  btc_address_hash: btcRecipientHash,
                }),
              });
              const relayData = await relayRes.json();
              if (!relayData.success) throw new Error(relayData.error ?? "Relayer failed");
              setClaimTxHash(relayData.txHash);
            } else {
              // BTC intent, user pays gas
              const intentCalls = [
                {
                  contractAddress: poolAddress,
                  entrypoint: "withdraw_with_btc_intent",
                  calldata: CallData.compile({
                    denomination,
                    zk_nullifier: zkNullifier,
                    zk_commitment: note.zkCommitment!,
                    proof,
                    merkle_path: merklePath,
                    path_indices: pathIndices,
                    recipient: address,
                    btc_address_hash: btcRecipientHash,
                  }),
                },
              ];
              const result = await sendAsync(intentCalls);
              setClaimTxHash(result.transaction_hash);
            }

            // Get intent ID (current count before our tx = our intent ID)
            try {
              const countAfter = Number(await pool.call("get_intent_count", []));
              setIntentId(countAfter - 1);
              setIntentStatus("CREATED");
            } catch { /* ignore */ }

            setClaimedWbtcAmount(note.wbtcShare ?? null);
          } else if (useRelayer) {
            // Gasless WBTC withdrawal via relayer
            setProofDetails({
              calldataElements: proof.length,
              zkCommitment: note.zkCommitment!,
              zkNullifier,
              gasless: true,
            });
            setClaimPhase("withdrawing");
            const relayRes = await fetch(`${RELAYER_URL}/relay`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                denomination,
                zk_nullifier: zkNullifier,
                zk_commitment: note.zkCommitment!,
                proof,
                merkle_path: merklePath,
                path_indices: pathIndices.map(Number),
                recipient: address,
                btc_recipient_hash: btcRecipientHash,
              }),
            });
            const relayData = await relayRes.json();
            if (!relayData.success) throw new Error(relayData.error ?? "Relayer failed");
            setClaimTxHash(relayData.txHash);
            setClaimedWbtcAmount(note.wbtcShare ?? null);
          } else {
            // ZK-private, user pays gas
            setProofDetails({
              calldataElements: proof.length,
              zkCommitment: note.zkCommitment!,
              zkNullifier,
              gasless: false,
            });
            setClaimPhase("withdrawing");
            const withdrawCalls = [
              {
                contractAddress: poolAddress,
                entrypoint: "withdraw_private",
                calldata: CallData.compile({
                  denomination,
                  zk_nullifier: zkNullifier,
                  zk_commitment: note.zkCommitment!,
                  proof,
                  merkle_path: merklePath,
                  path_indices: pathIndices,
                  recipient: address,
                  btc_recipient_hash: btcRecipientHash,
                }),
              },
            ];
            const result = await sendAsync(withdrawCalls);
            setClaimTxHash(result.transaction_hash);
            setClaimedWbtcAmount(note.wbtcShare ?? null);
          }
        } catch (zkErr) {
          console.error("[unveil] ZK proof error:", zkErr);
          const errMsg = zkErr instanceof Error ? zkErr.message : String(zkErr);

          const isInfraError = zkErr instanceof TypeError ||
            (zkErr instanceof Error && (
              zkErr.message.includes("fetch") ||
              zkErr.message.includes("network") ||
              zkErr.message.includes("ECONNREFUSED") ||
              zkErr.message.includes("Calldata generation failed") ||
              zkErr.message.includes("Failed to load ZK circuit")
            ));
          if (!isInfraError) throw zkErr;

          console.warn("[unveil] ZK proving unavailable, falling back to Pedersen withdrawal:", zkErr);
          toast("info", `ZK prover unavailable — ${errMsg.slice(0, 80)}`);
        }
      }

      if (!usedZK) {
        // Legacy Pedersen withdrawal (prover unavailable or non-ZK note)
        const nullifier = computeNullifier(note.secret);
        setClaimPhase("withdrawing");
        const withdrawCalls = [
          {
            contractAddress: poolAddress,
            entrypoint: "withdraw",
            calldata: CallData.compile({
              denomination,
              secret: note.secret,
              blinder: note.blinder,
              nullifier,
              merkle_path: merklePath,
              path_indices: pathIndices,
              recipient: address,
              btc_recipient_hash: btcRecipientHash,
            }),
          },
        ];
        const result = await sendAsync(withdrawCalls);
        setClaimTxHash(result.transaction_hash);
        setClaimedWbtcAmount(note.wbtcShare ?? null);
      }

      await markNoteClaimed(note.commitment, address);
      setClaimPhase("success");
      toast("success", isBtcIntent ? "Settlement initiated — solver will fulfill" : "Confidential exit executed");

      await refreshNotes();
    } catch (err: unknown) {
      setClaimPhase("error");
      const msg = err instanceof Error ? err.message : "Withdrawal failed";
      if (msg.includes("too early") || msg.includes("Withdrawal too early")) {
        setClaimError("Privacy cooldown not finished. Wait 60 seconds after batch execution before withdrawing. This prevents timing attacks.");
        toast("error", "Privacy cooldown not finished");
      } else if (msg.includes("nullifier") || msg.includes("already spent")) {
        setClaimError("This note has already been claimed (nullifier spent).");
        toast("error", "Note already claimed");
      } else if (msg.includes("User abort") || msg.includes("cancelled") || msg.includes("rejected")) {
        setClaimError("Transaction rejected in wallet.");
        toast("error", "Transaction rejected");
      } else {
        setClaimError(msg);
        toast("error", "Withdrawal failed");
      }
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
        <span className="text-xs font-medium text-gray-400">
          Active Allocations
        </span>
        <button
          onClick={refreshNotes}
          disabled={loading}
          className="text-xs text-gray-400 hover:text-gray-900 transition-colors cursor-pointer"
        >
          {loading ? "Scanning..." : "Refresh"}
        </button>
      </div>

      {/* Status Banner — ZK Pipeline Visualization */}
      <AnimatePresence>
        {claimPhase !== "idle" && claimPhase !== "success" && claimPhase !== "error" && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-xl p-4 bg-gray-50 border border-gray-200 space-y-3"
          >
            {claimPhase === "building_proof" && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Loader size={14} className="animate-spin" strokeWidth={1.5} />
                <span>Reconstructing Merkle tree & building proof...</span>
              </div>
            )}
            {claimPhase === "generating_zk" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-gray-900">
                    <Fingerprint size={14} strokeWidth={1.5} className="text-emerald-600" />
                    <span className="font-medium">Generating Zero-Knowledge Proof</span>
                  </div>
                  <span className="text-xs font-[family-name:var(--font-geist-mono)] text-gray-400 font-tabular">
                    {zkTimer}s
                  </span>
                </div>
                {/* 3-step pipeline: witness + proof in browser, calldata on server */}
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { label: "Witness", sub: "browser WASM" },
                    { label: "Proof", sub: "browser WASM" },
                    { label: "Calldata", sub: "garaga server" },
                  ].map((step) => (
                    <div
                      key={step.label}
                      className="rounded-lg p-2 text-center border bg-orange-50 border-orange-200"
                    >
                      <div className="flex items-center justify-center gap-1 mb-0.5">
                        <Loader size={10} className="animate-spin text-[#FF5A00]" strokeWidth={2} />
                        <span className="text-xs font-semibold text-[#FF5A00]">
                          {step.label}
                        </span>
                      </div>
                      <div className="text-xs font-[family-name:var(--font-geist-mono)] text-gray-400">
                        {step.sub}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-400 text-center">
                  Secrets never leave your browser — only the proof is sent
                </p>
              </div>
            )}
            {claimPhase === "withdrawing" && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Loader size={14} className="animate-spin" strokeWidth={1.5} />
                <span>Executing confidential exit ({proofDetails?.calldataElements ?? "~2835"} calldata elements)...</span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {claimPhase === "success" && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={spring}
          className="rounded-xl p-5 bg-emerald-50 text-sm text-emerald-600 space-y-4 border border-emerald-200"
        >
          {/* Privacy Guarantees — emotional closure */}
          <div className="text-center space-y-3 py-2">
            <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto">
              <CheckCircle size={24} strokeWidth={1.5} className="text-emerald-600" />
            </div>
            <div className="text-[15px] font-bold text-emerald-600">
              Confidential Exit Complete
            </div>
            <div className="flex items-center justify-center gap-4">
              {[
                { label: "Withdrawal Unlinkable", icon: Lock },
                { label: "Position Size Obfuscated", icon: ShieldCheck },
              ].map(({ label, icon: Icon }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <Icon size={10} strokeWidth={2} className="text-emerald-600" />
                  <span className="text-xs font-medium text-emerald-600/80">{label}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-emerald-600/60 font-medium">
              No on-chain observer can link this exit to your deposit.
            </p>
          </div>

          {claimedWbtcAmount && (
            <div className="text-center text-xs text-emerald-600">
              Amount: <span className="font-[family-name:var(--font-geist-mono)] font-semibold text-[14px]">{(Number(claimedWbtcAmount) / 1e8).toFixed(8)}</span> BTC
            </div>
          )}

          {claimTxHash && (
            <a
              href={`${TX_EXPLORER}${claimTxHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 text-xs text-emerald-600 hover:underline font-[family-name:var(--font-geist-mono)]"
            >
              View on Voyager
              <ExternalLink size={10} strokeWidth={1.5} />
            </a>
          )}

          {/* ZK Proof Details */}
          {proofDetails && (
            <div className="rounded-lg bg-emerald-50 p-3 space-y-2 border border-emerald-200">
              <div className="flex items-center gap-1.5">
                <Fingerprint size={11} strokeWidth={2} className="text-emerald-600" />
                <span className="text-xs font-semibold text-emerald-600">ZK Proof Verified On-Chain</span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                <div className="text-xs text-emerald-600/60">Proof size</div>
                <div className="text-xs font-[family-name:var(--font-geist-mono)] text-emerald-600">{proofDetails.calldataElements} felt252 values</div>
                <div className="text-xs text-emerald-600/60">Verifier</div>
                <div className="text-xs font-[family-name:var(--font-geist-mono)] text-emerald-600">Garaga UltraKeccakZKHonk</div>
                <div className="text-xs text-emerald-600/60">Method</div>
                <div className="text-xs font-[family-name:var(--font-geist-mono)] text-emerald-600">{proofDetails.gasless ? "Gasless relayer" : "Direct"}</div>
              </div>
              <div className="pt-1.5 border-t border-emerald-200">
                <div className="text-xs text-emerald-600/70 font-medium">
                  Your secret and blinder did NOT appear in this transaction. Only the ZK proof was submitted.
                </div>
              </div>
            </div>
          )}

          <div className="rounded-lg bg-emerald-50 p-2.5 space-y-1.5 border border-emerald-200">
            <div className="text-xs text-emerald-600 font-medium">Add BTC token to your wallet:</div>
            <div className="flex items-center gap-2">
              <code className="text-xs font-[family-name:var(--font-geist-mono)] text-emerald-700 bg-emerald-100 px-2 py-1 rounded flex-1 truncate">
                {addresses.contracts.wbtc}
              </code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(addresses.contracts.wbtc);
                  setTokenAdded(true);
                }}
                className="text-xs font-medium text-emerald-600 hover:text-emerald-700 px-2 py-1 bg-emerald-100 rounded cursor-pointer whitespace-nowrap"
              >
                {tokenAdded ? "Copied" : "Copy"}
              </button>
            </div>
            <div className="text-xs text-emerald-600">
              In Argent/Braavos: Settings &rarr; Manage tokens &rarr; Add token &rarr; paste address
            </div>
          </div>
        </motion.div>
      )}

      {claimPhase === "error" && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={spring}
          className="rounded-xl p-4 bg-red-50 text-sm text-red-600 border border-red-200"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} strokeWidth={1.5} />
            <span>Claim failed</span>
          </div>
          {claimError && (
            <div className="mt-2 text-xs">{claimError}</div>
          )}
        </motion.div>
      )}

      {/* Relayer Toggle */}
      {activeNotes.some((n) => n.status === "READY" && !!n.zkCommitment) && (
        <div className={`rounded-xl p-4 border transition-all ${
          useRelayer
            ? "bg-orange-50 border-orange-200"
            : "bg-gray-50 border-gray-200"
        }`}>
          <button
            onClick={() => setUseRelayer(!useRelayer)}
            className="w-full flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                useRelayer ? "bg-[#FF5A00]" : "bg-gray-100"
              }`}>
                <Zap size={13} strokeWidth={1.5} className={useRelayer ? "text-white" : "text-gray-400"} />
              </div>
              <div className="text-left">
                <span className="text-[12px] font-semibold text-gray-900 block leading-tight">
                  Gasless withdrawal
                </span>
                <span className="text-xs text-gray-400">
                  Relayer pays gas, no wallet signature
                </span>
              </div>
            </div>
            <div className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
              useRelayer ? "bg-[#FF5A00]" : "bg-gray-100"
            }`}>
              <span
                className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                  useRelayer ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </div>
          </button>
          {useRelayer && (
            <div className="mt-3 pt-3 border-t border-orange-200 flex items-center justify-between">
              <span className="text-xs text-[#FF5A00]">
                Fee: <strong>{relayerFee ? `${relayerFee / 100}%` : "2%"}</strong> of WBTC
              </span>
              <span className="text-xs text-gray-400">
                Max privacy — no on-chain link to you
              </span>
            </div>
          )}
        </div>
      )}

      {/* Withdrawal Mode Selector */}
      {activeNotes.some((n) => n.status === "READY") && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setWithdrawMode("wbtc")}
              className={`rounded-xl p-3 text-left transition-all cursor-pointer border ${
                withdrawMode === "wbtc"
                  ? "bg-emerald-50 border-emerald-200"
                  : "bg-gray-50 border-gray-200 hover:border-gray-400"
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <Unlock size={12} strokeWidth={1.5} className={withdrawMode === "wbtc" ? "text-emerald-600" : "text-gray-400"} />
                <span className={`text-xs font-semibold ${
                  withdrawMode === "wbtc" ? "text-emerald-600" : "text-gray-400"
                }`}>
                  Starknet Settlement
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Receive BTC on Starknet
              </p>
            </button>
            <button
              onClick={() => setWithdrawMode("btc_intent")}
              className={`rounded-xl p-3 text-left transition-all cursor-pointer border ${
                withdrawMode === "btc_intent"
                  ? "bg-orange-50 border-orange-200"
                  : "bg-gray-50 border-gray-200 hover:border-gray-400"
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <Bitcoin size={12} strokeWidth={1.5} className={withdrawMode === "btc_intent" ? "text-[#FF5A00]" : "text-gray-400"} />
                <span className={`text-xs font-semibold ${
                  withdrawMode === "btc_intent" ? "text-[#FF5A00]" : "text-gray-400"
                }`}>
                  Bitcoin Settlement
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Settle to native Bitcoin
              </p>
            </button>
          </div>

          {/* BTC Intent Address Input */}
          {withdrawMode === "btc_intent" && (
            <div className="rounded-xl p-3.5 bg-orange-50 border border-orange-200 space-y-2">
              <div className="flex items-center gap-1.5">
                <Bitcoin size={12} strokeWidth={1.5} className="text-[#FF5A00]" />
                <span className="text-xs font-semibold text-[#FF5A00]">
                  Bitcoin Address
                </span>
              </div>
              <input
                type="text"
                placeholder="tb1q... or bc1q... (your Bitcoin address)"
                value={btcWithdrawAddress}
                onChange={(e) => setBtcWithdrawAddress(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg bg-gray-100 border border-gray-200 text-gray-900 placeholder:text-gray-400 font-[family-name:var(--font-geist-mono)] focus:outline-none focus:ring-1 focus:ring-[#FF5A00]"
              />
              <p className="text-xs text-gray-400">
                Your BTC is locked in escrow. A solver sends native Bitcoin to this address, an oracle confirms settlement, and the solver receives the escrowed BTC. If no one fills, you get refunded after timeout.
              </p>
            </div>
          )}

          {/* Intent Settlement Tracker */}
          {intentStatus && (
            <div className="rounded-xl p-3.5 bg-orange-50 border border-orange-200 space-y-2">
              <div className="flex items-center gap-1.5">
                <Zap size={12} strokeWidth={1.5} className="text-[#FF5A00]" />
                <span className="text-xs font-semibold text-[#FF5A00]">
                  Intent #{intentId} Settlement
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1">
                {["CREATED", "CLAIMED", "SETTLED"].map((step) => {
                  const steps = ["CREATED", "CLAIMED", "SETTLED"];
                  const currentIdx = steps.indexOf(intentStatus ?? "");
                  const stepIdx = steps.indexOf(step);
                  const isActive = stepIdx <= currentIdx;
                  const isCurrent = step === intentStatus;
                  return (
                    <div
                      key={step}
                      className={`rounded-lg p-2 text-center border transition-all ${
                        isCurrent
                          ? "bg-orange-50 border-orange-300"
                          : isActive
                          ? "bg-emerald-50 border-emerald-200"
                          : "bg-gray-100 border-gray-200"
                      }`}
                    >
                      <div className="flex items-center justify-center gap-1 mb-0.5">
                        {isCurrent && intentStatus !== "SETTLED" ? (
                          <Loader size={9} className="animate-spin text-[#FF5A00]" strokeWidth={2} />
                        ) : isActive ? (
                          <CheckCircle size={9} className="text-emerald-600" strokeWidth={2} />
                        ) : null}
                        <span className={`text-xs font-semibold ${
                          isCurrent ? "text-[#FF5A00]" : isActive ? "text-emerald-600" : "text-gray-400"
                        }`}>
                          {step}
                        </span>
                      </div>
                    </div>
                  );
                })}
                <div className={`rounded-lg p-2 text-center border transition-all ${
                  intentStatus === "EXPIRED"
                    ? "bg-red-50 border-red-200"
                    : "bg-gray-100 border-gray-200"
                }`}>
                  <span className={`text-xs font-semibold ${
                    intentStatus === "EXPIRED" ? "text-red-600" : "text-gray-400"
                  }`}>
                    {intentStatus === "EXPIRED" ? "EXPIRED" : "TIMEOUT"}
                  </span>
                </div>
              </div>
              {intentStatus === "SETTLED" && (
                <p className="text-xs text-emerald-600 font-medium">
                  Bitcoin sent! Settlement complete.
                </p>
              )}
              {intentStatus === "EXPIRED" && (
                <p className="text-xs text-red-600 font-medium">
                  No solver filled the intent. BTC refunded to your address.
                </p>
              )}
              {(intentStatus === "CREATED" || intentStatus === "CLAIMED") && (
                <p className="text-xs text-gray-400">
                  {intentStatus === "CREATED"
                    ? "Waiting for a solver to claim and send BTC..."
                    : "Solver claimed — waiting for BTC confirmation..."}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Notes */}
      {loading ? (
        <div className="text-center py-10">
          <Loader size={20} className="animate-spin mx-auto text-gray-400" strokeWidth={1.5} />
          <p className="text-xs text-gray-400 mt-3">
            Loading allocations...
          </p>
        </div>
      ) : activeNotes.length === 0 && claimedNotes.length === 0 ? (
        <div className="text-center py-10">
          <Lock size={24} className="mx-auto mb-3 text-gray-400" strokeWidth={1.5} />
          <p className="text-sm text-gray-600">No allocations found</p>
          <p className="text-xs text-gray-400 mt-1">
            Allocate capital first to create positions
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
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-xs text-gray-400 mb-2">
                Previously claimed ({claimedNotes.length})
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
        <p className="text-xs text-gray-400 text-center">
          Connect wallet to execute confidential exit
        </p>
      )}
    </div>
  );
}
