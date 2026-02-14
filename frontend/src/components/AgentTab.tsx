"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useAccount } from "@starknet-react/core";
import { useSendTransaction } from "@starknet-react/core";
import { useWallet } from "@/context/WalletContext";
import { useToast } from "@/context/ToastContext";
import {
  generatePrivateNote,
  saveNote,
  DENOMINATIONS,
} from "@/utils/privacy";
import { computeBtcIdentityHash } from "@/utils/bitcoin";
import {
  generateStrategy,
  generateAgentLog,
  parseTargetUsdc,
  type AgentPlan,
  type AgentStep,
  type AgentLogEntry,
  type PoolState,
} from "@/utils/strategyEngine";
import { EXPLORER_TX, RPC_URL } from "@/utils/network";
import addresses from "@/contracts/addresses.json";
import { CallData, RpcProvider } from "starknet";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  Play,
  CheckCircle,
  Sparkles,
  Shield,
  Users,
  TrendingUp,
  ExternalLink,
  Terminal,
  Radio,
} from "lucide-react";

const RELAYER_URL = process.env.NEXT_PUBLIC_RELAYER_URL ?? "/api/relayer";
const poolAddress = addresses.contracts.shieldedPool;
const usdcAddress = addresses.contracts.usdc;

type StepStatus = "pending" | "waiting" | "executing" | "done" | "error";

interface ExecutionStep extends AgentStep {
  status: StepStatus;
  txHash?: string;
  error?: string;
}

type AgentPhase = "idle" | "thinking" | "planned" | "executing" | "complete";

const EXAMPLE_PROMPTS = [
  "Accumulate $30 in BTC, maximize privacy",
  "DCA $50 over 5 deposits",
  "Invest $10 into the strongest anonymity set",
  "Deposit $100 for confidential BTC exposure",
];

const LOG_COLORS: Record<AgentLogEntry["type"], string> = {
  observe: "text-blue-600",
  think: "text-violet-600",
  decide: "text-emerald-600",
  act: "text-orange-600",
  result: "text-gray-900",
};

const LOG_PREFIXES: Record<AgentLogEntry["type"], string> = {
  observe: "OBSERVE",
  think: "THINK  ",
  decide: "DECIDE ",
  act: "ACT    ",
  result: "RESULT ",
};

export default function AgentTab() {
  const { address, isConnected } = useAccount();
  const { bitcoinAddress } = useWallet();
  const { sendAsync } = useSendTransaction({ calls: [] });
  const { toast } = useToast();
  const searchParams = useSearchParams();

  // State
  const [input, setInput] = useState("");
  const [poolState, setPoolState] = useState<PoolState | null>(null);
  const [plan, setPlan] = useState<AgentPlan | null>(null);
  const [agentPhase, setAgentPhase] = useState<AgentPhase>("idle");
  const [agentLogs, setAgentLogs] = useState<AgentLogEntry[]>([]);
  const [visibleLogCount, setVisibleLogCount] = useState(0);
  const [executionSteps, setExecutionSteps] = useState<ExecutionStep[]>([]);
  const [currentStepIdx, setCurrentStepIdx] = useState(-1);
  const [batchTxHash, setBatchTxHash] = useState<string | null>(null);
  const [btcPrice, setBtcPrice] = useState(0);
  const [autonomousMode, setAutonomousMode] = useState(true);
  const [countdown, setCountdown] = useState(0); // live DCA delay countdown

  const terminalRef = useRef<HTMLDivElement>(null);

  // Fetch pool state on mount
  useEffect(() => {
    async function fetchStatus() {
      try {
        const res = await fetch("/api/agent/status");
        if (!res.ok) return;
        const data = await res.json();
        setPoolState({
          pendingUsdc: data.pendingUsdc,
          batchCount: data.batchCount,
          leafCount: data.leafCount,
          anonSets: data.anonSets,
          btcPrice: data.btcPrice,
        });
        setBtcPrice(data.btcPrice);
      } catch {
        setBtcPrice(0);
      }
    }
    fetchStatus();
    const interval = setInterval(fetchStatus, 30_000);
    return () => clearInterval(interval);
  }, []);

  // Auto-load strategy from URL params (Telegram deep link)
  useEffect(() => {
    const encoded = searchParams.get("strategy");
    if (!encoded || input) return;
    try {
      const json = atob(encoded.replace(/-/g, "+").replace(/_/g, "/"));
      const decoded = JSON.parse(json);
      if (decoded.input && typeof decoded.input === "string") {
        setInput(decoded.input);
        // Clean URL to avoid re-triggering
        window.history.replaceState({}, "", "/app");
      }
    } catch { /* ignore malformed params */ }
  }, [searchParams, input]);

  // Stream agent logs with delay
  useEffect(() => {
    if (agentLogs.length === 0 || visibleLogCount >= agentLogs.length) return;

    const timer = setTimeout(() => {
      setVisibleLogCount((c) => c + 1);
    }, 150 + Math.random() * 200); // Variable delay for realism

    return () => clearTimeout(timer);
  }, [agentLogs, visibleLogCount]);

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [visibleLogCount, executionSteps]);

  // Detect when logs are done streaming → show plan
  useEffect(() => {
    if (agentPhase === "thinking" && visibleLogCount >= agentLogs.length && agentLogs.length > 0) {
      setAgentPhase("planned");
    }
  }, [agentPhase, visibleLogCount, agentLogs.length]);

  // Auto-execute when plan is ready and autonomous mode is on
  useEffect(() => {
    if (agentPhase === "planned" && autonomousMode && plan && isConnected && address) {
      // Small delay so user can see the plan before execution starts
      const timer = setTimeout(() => {
        executeStrategy();
      }, 1500);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentPhase, autonomousMode, plan, isConnected, address]);

  // ---- Emit log during execution ----
  function emitLog(type: AgentLogEntry["type"], message: string) {
    const entry: AgentLogEntry = { timestamp: Date.now(), type, message };
    setAgentLogs((prev) => [...prev, entry]);
    setVisibleLogCount((c) => c + 1); // Immediately visible during execution
  }

  // ---- Plan Generation ----
  async function handlePlanStrategy() {
    const target = parseTargetUsdc(input);
    if (!target || target <= 0) {
      toast("error", "Please describe an amount — e.g. '$50' or '100 dollars'");
      return;
    }
    if (!btcPrice || btcPrice <= 0) {
      toast("error", "Fetching live BTC price... please wait a moment");
      return;
    }

    // Reset
    setPlan(null);
    setExecutionSteps([]);
    setBatchTxHash(null);
    setAgentPhase("thinking");

    const state = poolState ?? {
      pendingUsdc: 0,
      batchCount: 0,
      leafCount: 0,
      anonSets: { 0: 0, 1: 0, 2: 0 },
      btcPrice: btcPrice || 0,
    };

    // Generate agent thinking log
    const logs = generateAgentLog(target, state, btcPrice || 0, input);
    setAgentLogs(logs);
    setVisibleLogCount(0);

    // Generate plan (instant, but displayed after log streaming)
    const result = generateStrategy(target, state, btcPrice || 0, input);
    setPlan(result);
  }

  // ---- Strategy Execution ----
  // DCA mode: sequential deposits with real delays (temporal decorrelation)
  // Non-DCA: single multicall (efficient, one wallet confirmation)
  const executeStrategy = useCallback(async () => {
    if (!plan || !isConnected || !address) return;

    setAgentPhase("executing");
    const steps: ExecutionStep[] = plan.strategy.steps.map((s) => ({
      ...s,
      status: "pending" as StepStatus,
    }));
    setExecutionSteps(steps);

    const isDCA = steps.length > 1 && steps.some((s) => s.delaySeconds > 0);

    emitLog("act", `Initiating autonomous execution: ${steps.length} deposits`);

    try {
      const btcIdHash = bitcoinAddress
        ? computeBtcIdentityHash(bitcoinAddress)
        : "0x0";

      if (isDCA) {
        // --- Autonomous DCA via relayer ---
        // User signs ONE approval, relayer handles all deposits with real delays
        emitLog("think", `Autonomous DCA: relayer executes ${steps.length} deposits with temporal decorrelation`);

        // Calculate total USDC needed
        const totalRaw = steps.reduce((sum, s) => sum + BigInt(DENOMINATIONS[s.tier]), 0n);

        // Step 1: Single wallet confirmation — approve relayer to spend total USDC
        emitLog("act", `Requesting USDC approval for total $${plan.strategy.totalUsdc} (single signature)...`);
        const relayerInfoRes = await fetch(`${RELAYER_URL}/info`);
        const relayerInfo = await relayerInfoRes.json();
        const relayerAddress = relayerInfo.relayerAddress;

        if (!relayerAddress) throw new Error("Relayer not available");

        const approveCalls = [
          {
            contractAddress: usdcAddress,
            entrypoint: "approve",
            calldata: CallData.compile({
              spender: relayerAddress,
              amount: { low: totalRaw, high: 0n },
            }),
          },
        ];

        const approveResult = await sendAsync(approveCalls);
        emitLog("think", `Approval sent — waiting for on-chain confirmation...`);

        // Wait for the approve tx to be included in a block
        const provider = new RpcProvider({ nodeUrl: RPC_URL });
        await provider.waitForTransaction(approveResult.transaction_hash);
        emitLog("result", `USDC approved on-chain — relayer executing autonomously`);

        // Step 2: Relayer handles all deposits with delays (no more wallet popups)
        for (let i = 0; i < steps.length; i++) {
          // Wait for delay (skip first deposit)
          if (i > 0 && steps[i].delaySeconds > 0) {
            const delay = steps[i].delaySeconds;
            emitLog("think", `Waiting ${delay}s before deposit ${i + 1} (temporal decorrelation)...`);

            setExecutionSteps((prev) =>
              prev.map((s, idx) => idx === i ? { ...s, status: "waiting" } : s)
            );
            setCurrentStepIdx(i);

            // Real delay with live countdown
            for (let sec = delay; sec > 0; sec--) {
              setCountdown(sec);
              await new Promise((r) => setTimeout(r, 1000));
            }
            setCountdown(0);
          }

          // Generate note
          const note = generatePrivateNote(
            steps[i].tier,
            0,
            0,
            btcIdHash !== "0x0" ? btcIdHash : undefined,
          );

          const rawAmount = DENOMINATIONS[steps[i].tier].toString();

          // Mark as executing
          setExecutionSteps((prev) =>
            prev.map((s, idx) => idx === i ? { ...s, status: "executing" } : s)
          );
          setCurrentStepIdx(i);
          emitLog("act", `Relayer executing deposit ${i + 1}/${steps.length}: ${steps[i].label} USDC`);

          // Relayer pulls USDC from user and deposits on their behalf
          const res = await fetch(`${RELAYER_URL}/deposit`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              depositor: address,
              commitment: note.commitment,
              denomination: steps[i].tier,
              btc_identity_hash: btcIdHash,
              zk_commitment: note.zkCommitment!,
              usdc_amount: rawAmount,
            }),
          });
          const data = await res.json();
          if (!data.success) throw new Error(data.error ?? "Relayer deposit failed");

          await saveNote(note, address);

          // Mark as done
          setExecutionSteps((prev) =>
            prev.map((s, idx) => idx === i ? { ...s, status: "done", txHash: data.txHash } : s)
          );
          emitLog("result", `Deposit ${i + 1}/${steps.length} confirmed: ${data.txHash.slice(0, 18)}...`);
        }

        emitLog("result", `All ${steps.length} DCA deposits confirmed — fully autonomous`);
      } else {
        // --- Single multicall: all deposits in one tx ---
        emitLog("think", `Batching ${steps.length} deposit(s) in single transaction`);

        const notes = [];
        const allCalls = [];

        for (let i = 0; i < steps.length; i++) {
          const note = generatePrivateNote(
            steps[i].tier,
            0,
            0,
            btcIdHash !== "0x0" ? btcIdHash : undefined,
          );
          notes.push(note);

          const rawAmount = BigInt(DENOMINATIONS[steps[i].tier]);

          allCalls.push({
            contractAddress: usdcAddress,
            entrypoint: "approve",
            calldata: CallData.compile({
              spender: poolAddress,
              amount: { low: rawAmount, high: 0n },
            }),
          });
          allCalls.push({
            contractAddress: poolAddress,
            entrypoint: "deposit_private",
            calldata: CallData.compile({
              commitment: note.commitment,
              denomination: steps[i].tier,
              btc_identity_hash: btcIdHash,
              zk_commitment: note.zkCommitment!,
            }),
          });

          emitLog("act", `Prepared deposit ${i + 1}/${steps.length}: ${steps[i].label} USDC`);
        }

        emitLog("act", `Submitting ${allCalls.length} calls as single multicall...`);

        const updatedSteps = steps.map((s) => ({ ...s, status: "executing" as StepStatus }));
        setExecutionSteps(updatedSteps);

        const result = await sendAsync(allCalls);

        for (const note of notes) {
          await saveNote(note, address);
        }

        const doneSteps = updatedSteps.map((s) => ({
          ...s,
          status: "done" as StepStatus,
          txHash: result.transaction_hash,
        }));
        setExecutionSteps(doneSteps);
        emitLog("result", `All ${steps.length} deposits confirmed in single tx: ${result.transaction_hash.slice(0, 18)}...`);
      }

      // Trigger batch execution
      emitLog("act", "Triggering batch conversion via AVNU...");
      try {
        const res = await fetch(`${RELAYER_URL}/execute-batch`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        const data = await res.json();
        if (data.success) {
          setBatchTxHash(data.txHash);
          emitLog("result", `Batch converted to BTC: ${data.txHash.slice(0, 14)}...`);
          toast("success", "Batch converted — BTC ready for confidential exit");
        } else {
          emitLog("result", "Batch queued — keeper will execute automatically");
        }
      } catch {
        emitLog("result", "Batch queued — keeper will execute automatically");
      }
      emitLog("result", "Strategy execution complete. Proceed to Confidential Exit.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Transaction failed";
      setExecutionSteps((prev) =>
        prev.map((s) =>
          s.status !== "done"
            ? { ...s, status: "error" as StepStatus, error: msg }
            : s
        )
      );

      if (msg.includes("reject") || msg.includes("abort") || msg.includes("cancel") || msg.includes("REFUSED")) {
        emitLog("result", "Transaction rejected by wallet. Strategy paused.");
        toast("error", "Transaction rejected — strategy paused");
      } else {
        emitLog("result", `Execution failed: ${msg.slice(0, 80)}`);
        toast("error", "Strategy execution failed");
      }
    }

    setAgentPhase("complete");
    setCurrentStepIdx(-1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, isConnected, address, bitcoinAddress, sendAsync, toast]);

  // ---- Render ----
  const completedSteps = executionSteps.filter((s) => s.status === "done").length;
  const isRunning = agentPhase === "thinking" || agentPhase === "executing";
  const visibleLogs = agentLogs.slice(0, visibleLogCount);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-orange-50 border border-orange-200 flex items-center justify-center">
            <Brain size={14} strokeWidth={1.5} className="text-[#FF5A00]" />
          </div>
          <div>
            <h3 className="text-[13px] font-semibold text-gray-900">
              Veil Strategist
            </h3>
            <p className="text-xs text-gray-400">
              Autonomous AI accumulation agent
            </p>
          </div>
        </div>
        {/* Autonomous toggle */}
        <button
          onClick={() => setAutonomousMode(!autonomousMode)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
            autonomousMode
              ? "bg-emerald-50 border-emerald-200 text-emerald-600"
              : "bg-gray-50 border-gray-200 text-gray-400"
          }`}
        >
          <Radio size={10} strokeWidth={2} className={autonomousMode ? "animate-pulse" : ""} />
          {autonomousMode ? "Autonomous" : "Manual"}
        </button>
      </div>

      {/* Pool state cards */}
      {poolState && (
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "BTC", value: btcPrice > 0 ? `$${btcPrice.toLocaleString()}` : "Loading...", icon: TrendingUp, color: "text-[#FF5A00]" },
            { label: "$1 Pool", value: `${poolState.anonSets[0]}`, icon: Users, color: "text-gray-900" },
            { label: "$10 Pool", value: `${poolState.anonSets[1]}`, icon: Users, color: "text-gray-900" },
            { label: "$100 Pool", value: `${poolState.anonSets[2]}`, icon: Shield, color: "text-gray-900" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div
              key={label}
              className="rounded-lg p-2 bg-gray-50 border border-gray-200 text-center"
            >
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <Icon size={9} strokeWidth={1.5} className="text-gray-400" />
                <span className="text-[11px] text-gray-400">{label}</span>
              </div>
              <span className={`text-[12px] font-[family-name:var(--font-geist-mono)] font-bold font-tabular ${color}`}>
                {value}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Input area */}
      {agentPhase === "idle" && (
        <div className="space-y-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe your accumulation strategy..."
            rows={2}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handlePlanStrategy();
              }
            }}
            className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-[13px] text-gray-900 placeholder:text-gray-300 resize-none focus:outline-none focus:border-orange-300 transition-colors"
          />
          <div className="flex flex-wrap gap-1.5">
            {EXAMPLE_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                onClick={() => setInput(prompt)}
                className="px-2.5 py-1 rounded-lg bg-gray-100 border border-gray-200 text-xs text-gray-400 hover:text-gray-600 hover:border-orange-300 transition-all cursor-pointer"
              >
                {prompt}
              </button>
            ))}
          </div>
          <motion.button
            onClick={handlePlanStrategy}
            disabled={!input.trim()}
            className="w-full py-3.5 bg-[#FF5A00] hover:bg-[#e65100] text-white rounded-xl text-[13px] font-semibold
                       disabled:opacity-30 disabled:cursor-not-allowed
                       cursor-pointer transition-all flex items-center justify-center gap-2"
            whileHover={input.trim() ? { y: -1 } : {}}
            whileTap={input.trim() ? { scale: 0.985 } : {}}
          >
            <Sparkles size={14} strokeWidth={2} />
            {autonomousMode ? "Deploy Agent" : "Plan Strategy"}
          </motion.button>
        </div>
      )}

      {/* Agent Terminal */}
      {agentPhase !== "idle" && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 overflow-hidden">
          {/* Terminal header */}
          <div className="px-3 py-2 border-b border-gray-200 flex items-center gap-2 bg-gray-100">
            <div className="flex items-center gap-1.5">
              <Terminal size={11} strokeWidth={1.5} className="text-[#FF5A00]" />
              <span className="text-xs font-[family-name:var(--font-geist-mono)] text-[#FF5A00] font-semibold">
                veil-strategist
              </span>
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              {isRunning && (
                <span className="flex items-center gap-1 text-[11px] text-emerald-600 font-[family-name:var(--font-geist-mono)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  RUNNING
                </span>
              )}
              {agentPhase === "complete" && (
                <span className="flex items-center gap-1 text-[11px] text-emerald-600 font-[family-name:var(--font-geist-mono)]">
                  <CheckCircle size={9} strokeWidth={2} />
                  COMPLETE
                </span>
              )}
            </div>
          </div>

          {/* Terminal body */}
          <div
            ref={terminalRef}
            className="px-3 py-2 max-h-72 overflow-y-auto scrollbar-thin font-[family-name:var(--font-geist-mono)]"
          >
            {/* Agent thinking logs */}
            {visibleLogs.map((log, i) => (
              <div key={i} className="flex gap-2 py-0.5 text-xs leading-relaxed">
                <span className={`${LOG_COLORS[log.type]} font-semibold whitespace-nowrap`}>
                  [{LOG_PREFIXES[log.type]}]
                </span>
                <span className="text-gray-600">
                  {log.message}
                </span>
              </div>
            ))}

            {/* Per-step TX results (DCA mode shows each, single multicall shows one) */}
            {executionSteps.map((step, idx) => {
              if (step.status === "done" && step.txHash) {
                // Deduplicate: for single multicall all share same txHash, show only once
                const isDuplicate = idx > 0 && executionSteps[idx - 1]?.txHash === step.txHash;
                if (isDuplicate) return null;
                const count = executionSteps.filter((s) => s.txHash === step.txHash).length;
                return (
                  <div key={`tx-${idx}`} className="flex gap-2 py-0.5 text-xs leading-relaxed">
                    <span className="text-emerald-600 font-semibold whitespace-nowrap">[TX     ]</span>
                    <a
                      href={`${EXPLORER_TX}${step.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-600/80 hover:text-emerald-500 hover:underline flex items-center gap-1"
                    >
                      {count > 1 ? `${count} deposits` : `Deposit ${idx + 1}`} confirmed: {step.txHash.slice(0, 18)}...
                      <ExternalLink size={8} strokeWidth={2} />
                    </a>
                  </div>
                );
              }
              return null;
            })}
            {executionSteps.some((s) => s.status === "error") && (
              <div className="flex gap-2 py-0.5 text-xs leading-relaxed">
                <span className="text-red-500 font-semibold whitespace-nowrap">[ERROR  ]</span>
                <span className="text-red-500/80">{executionSteps.find((s) => s.status === "error")?.error?.slice(0, 80)}</span>
              </div>
            )}

            {/* Batch tx */}
            {batchTxHash && (
              <div className="flex gap-2 py-0.5 text-xs leading-relaxed">
                <span className="text-[#FF5A00] font-semibold whitespace-nowrap">[BATCH  ]</span>
                <a
                  href={`${EXPLORER_TX}${batchTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#FF5A00]/80 hover:underline flex items-center gap-1"
                >
                  Converted to BTC: {batchTxHash.slice(0, 18)}...
                  <ExternalLink size={8} strokeWidth={2} />
                </a>
              </div>
            )}

            {/* Live DCA countdown */}
            {countdown > 0 && (
              <div className="flex gap-2 py-1 text-xs leading-relaxed">
                <span className="text-amber-600 font-semibold whitespace-nowrap">[WAIT   ]</span>
                <span className="text-amber-500 flex items-center gap-2">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  Next deposit in {countdown}s — temporal decorrelation active
                </span>
              </div>
            )}

            {/* Blinking cursor */}
            {isRunning && countdown === 0 && (
              <div className="flex gap-2 py-0.5 text-xs">
                <span className="w-2 h-3.5 bg-[#FF5A00] animate-pulse" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Strategy Summary Card (visible after planning) */}
      <AnimatePresence>
        {plan && agentPhase !== "idle" && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-400">
                {agentPhase === "complete" ? "Execution Summary" : "Strategy"}
              </span>
              <div className="flex items-center gap-2">
                {executionSteps.length > 0 && (
                  <span className="text-xs font-[family-name:var(--font-geist-mono)] text-gray-400 font-tabular">
                    {completedSteps}/{executionSteps.length} deposits
                  </span>
                )}
                <span className="text-xs font-[family-name:var(--font-geist-mono)] font-bold text-gray-900 font-tabular">
                  ${plan.strategy.totalUsdc.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Progress bar */}
            {executionSteps.length > 0 && (
              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-emerald-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${(completedSteps / executionSteps.length) * 100}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center rounded-lg p-2 bg-white border border-gray-200">
                <div className="text-[11px] text-gray-400">Est. BTC</div>
                <div className="text-[13px] font-[family-name:var(--font-geist-mono)] font-bold text-[#FF5A00] font-tabular">
                  {plan.strategy.estimatedBtc}
                </div>
              </div>
              <div className="text-center rounded-lg p-2 bg-white border border-gray-200">
                <div className="text-[11px] text-gray-400">Privacy</div>
                <div className="text-[12px] font-semibold text-emerald-600">
                  {plan.strategy.privacyScore.split("(")[0].trim()}
                </div>
              </div>
              <div className="text-center rounded-lg p-2 bg-white border border-gray-200">
                <div className="text-[11px] text-gray-400">CSI</div>
                <div className="text-[13px] font-[family-name:var(--font-geist-mono)] font-bold text-[#FF5A00] font-tabular">
                  {plan.strategy.csiImpact}
                </div>
              </div>
            </div>

            {/* Manual execute button (only in non-autonomous mode) */}
            {agentPhase === "planned" && !autonomousMode && (
              <motion.button
                onClick={executeStrategy}
                disabled={!isConnected}
                className="w-full py-3.5 bg-[#FF5A00] hover:bg-[#e65100] text-white rounded-xl text-[13px] font-semibold
                           disabled:opacity-30 disabled:cursor-not-allowed
                           cursor-pointer transition-all flex items-center justify-center gap-2"
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.985 }}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Play size={14} strokeWidth={2} />
                Execute Strategy
              </motion.button>
            )}

            {/* Complete state */}
            {agentPhase === "complete" && (
              <div className="space-y-2">
                {batchTxHash && (
                  <div className="rounded-lg p-2.5 bg-emerald-50 border border-emerald-200 flex items-center gap-2">
                    <CheckCircle size={12} strokeWidth={2} className="text-emerald-600 flex-shrink-0" />
                    <span className="text-xs font-semibold text-emerald-600">
                      BTC conversion complete
                    </span>
                    <a
                      href={`${EXPLORER_TX}${batchTxHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto text-xs text-emerald-500 hover:underline font-[family-name:var(--font-geist-mono)] flex items-center gap-1"
                    >
                      tx <ExternalLink size={8} strokeWidth={2} />
                    </a>
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setAgentPhase("idle");
                      setPlan(null);
                      setAgentLogs([]);
                      setVisibleLogCount(0);
                      setExecutionSteps([]);
                      setBatchTxHash(null);
                      setInput("");
                    }}
                    className="flex-1 py-2.5 rounded-xl text-[12px] font-semibold text-gray-400 bg-gray-100 border border-gray-200 hover:text-gray-900 transition-colors cursor-pointer"
                  >
                    New Strategy
                  </button>
                </div>
                <p className="text-xs text-emerald-500 text-center">
                  Proceed to <strong>Confidential Exit</strong> tab to claim BTC
                </p>
              </div>
            )}

            {!isConnected && agentPhase === "planned" && (
              <p className="text-xs text-gray-400 text-center">
                Connect your wallet to execute
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
