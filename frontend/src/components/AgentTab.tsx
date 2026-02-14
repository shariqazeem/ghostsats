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
import { EXPLORER_TX } from "@/utils/network";
import addresses from "@/contracts/addresses.json";
import { CallData } from "starknet";
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
  observe: "text-blue-400",
  think: "text-purple-400",
  decide: "text-emerald-400",
  act: "text-[var(--accent-orange)]",
  result: "text-white",
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

  // ---- Strategy Execution (single multicall — one wallet confirmation) ----
  const executeStrategy = useCallback(async () => {
    if (!plan || !isConnected || !address) return;

    setAgentPhase("executing");
    const steps: ExecutionStep[] = plan.strategy.steps.map((s) => ({
      ...s,
      status: "pending" as StepStatus,
    }));
    setExecutionSteps(steps);

    emitLog("act", `Initiating autonomous execution: ${steps.length} deposits`);
    emitLog("think", `Building multicall: ${steps.length} deposits in a single transaction`);

    try {
      const btcIdHash = bitcoinAddress
        ? computeBtcIdentityHash(bitcoinAddress)
        : "0x0";

      // Generate all notes and build all calls upfront
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

        // Approve + deposit for this step
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

      // Mark all as executing
      const updatedSteps = steps.map((s) => ({ ...s, status: "executing" as StepStatus }));
      setExecutionSteps(updatedSteps);

      // Single wallet confirmation for ALL deposits
      const result = await sendAsync(allCalls);

      // Save all notes
      for (const note of notes) {
        await saveNote(note, address);
      }

      // Mark all as done
      const doneSteps = updatedSteps.map((s) => ({
        ...s,
        status: "done" as StepStatus,
        txHash: result.transaction_hash,
      }));
      setExecutionSteps(doneSteps);
      emitLog("result", `All ${steps.length} deposits confirmed in single tx: ${result.transaction_hash.slice(0, 18)}...`);

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
      const errorSteps = steps.map((s) => ({
        ...s,
        status: "error" as StepStatus,
        error: msg,
      }));
      setExecutionSteps(errorSteps);

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
          <div className="w-7 h-7 rounded-lg bg-purple-950/40 border border-purple-800/30 flex items-center justify-center">
            <Brain size={14} strokeWidth={1.5} className="text-purple-400" />
          </div>
          <div>
            <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">
              Veil Strategist
            </h3>
            <p className="text-[10px] text-[var(--text-tertiary)]">
              Autonomous AI accumulation agent
            </p>
          </div>
        </div>
        {/* Autonomous toggle */}
        <button
          onClick={() => setAutonomousMode(!autonomousMode)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition-all cursor-pointer border ${
            autonomousMode
              ? "bg-emerald-950/30 border-emerald-800/30 text-emerald-400"
              : "bg-[var(--bg-secondary)] border-[var(--border-subtle)] text-[var(--text-tertiary)]"
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
            { label: "BTC", value: btcPrice > 0 ? `$${btcPrice.toLocaleString()}` : "Loading...", icon: TrendingUp, color: "text-[var(--accent-orange)]" },
            { label: "$1 Pool", value: `${poolState.anonSets[0]}`, icon: Users, color: "text-[var(--text-primary)]" },
            { label: "$10 Pool", value: `${poolState.anonSets[1]}`, icon: Users, color: "text-[var(--text-primary)]" },
            { label: "$100 Pool", value: `${poolState.anonSets[2]}`, icon: Shield, color: "text-[var(--text-primary)]" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div
              key={label}
              className="rounded-lg p-2 bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-center"
            >
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <Icon size={9} strokeWidth={1.5} className="text-[var(--text-tertiary)]" />
                <span className="text-[9px] text-[var(--text-tertiary)]">{label}</span>
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
            className="w-full px-4 py-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)] resize-none focus:outline-none focus:border-purple-500/50 transition-colors"
          />
          <div className="flex flex-wrap gap-1.5">
            {EXAMPLE_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                onClick={() => setInput(prompt)}
                className="px-2.5 py-1 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[10px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:border-purple-500/30 transition-all cursor-pointer"
              >
                {prompt}
              </button>
            ))}
          </div>
          <motion.button
            onClick={handlePlanStrategy}
            disabled={!input.trim()}
            className="w-full py-3.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-[13px] font-semibold
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
        <div className="rounded-xl border border-purple-800/20 bg-[#0d0d12] overflow-hidden">
          {/* Terminal header */}
          <div className="px-3 py-2 border-b border-purple-800/20 flex items-center gap-2 bg-[#12121a]">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
            </div>
            <div className="flex items-center gap-1.5 ml-2">
              <Terminal size={11} strokeWidth={1.5} className="text-purple-400" />
              <span className="text-[10px] font-[family-name:var(--font-geist-mono)] text-purple-400 font-semibold">
                veil-strategist
              </span>
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              {isRunning && (
                <span className="flex items-center gap-1 text-[9px] text-emerald-400 font-[family-name:var(--font-geist-mono)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  RUNNING
                </span>
              )}
              {agentPhase === "complete" && (
                <span className="flex items-center gap-1 text-[9px] text-emerald-400 font-[family-name:var(--font-geist-mono)]">
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
              <div key={i} className="flex gap-2 py-0.5 text-[11px] leading-relaxed">
                <span className={`${LOG_COLORS[log.type]} font-semibold whitespace-nowrap`}>
                  [{LOG_PREFIXES[log.type]}]
                </span>
                <span className="text-[var(--text-secondary)]">
                  {log.message}
                </span>
              </div>
            ))}

            {/* Multicall result */}
            {executionSteps.length > 0 && executionSteps[0].status === "done" && executionSteps[0].txHash && (
              <div className="flex gap-2 py-0.5 text-[11px] leading-relaxed">
                <span className="text-emerald-400 font-semibold whitespace-nowrap">[TX     ]</span>
                <a
                  href={`${EXPLORER_TX}${executionSteps[0].txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-400/80 hover:text-emerald-300 hover:underline flex items-center gap-1"
                >
                  {executionSteps.length} deposits confirmed: {executionSteps[0].txHash.slice(0, 18)}...
                  <ExternalLink size={8} strokeWidth={2} />
                </a>
              </div>
            )}
            {executionSteps.length > 0 && executionSteps[0].status === "error" && (
              <div className="flex gap-2 py-0.5 text-[11px] leading-relaxed">
                <span className="text-red-400 font-semibold whitespace-nowrap">[ERROR  ]</span>
                <span className="text-red-400/80">{executionSteps[0].error?.slice(0, 80)}</span>
              </div>
            )}

            {/* Batch tx */}
            {batchTxHash && (
              <div className="flex gap-2 py-0.5 text-[11px] leading-relaxed">
                <span className="text-[var(--accent-orange)] font-semibold whitespace-nowrap">[BATCH  ]</span>
                <a
                  href={`${EXPLORER_TX}${batchTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--accent-orange)]/80 hover:underline flex items-center gap-1"
                >
                  Converted to BTC: {batchTxHash.slice(0, 18)}...
                  <ExternalLink size={8} strokeWidth={2} />
                </a>
              </div>
            )}

            {/* Blinking cursor */}
            {isRunning && (
              <div className="flex gap-2 py-0.5 text-[11px]">
                <span className="w-2 h-3.5 bg-purple-400 animate-pulse" />
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
            className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">
                {agentPhase === "complete" ? "Execution Summary" : "Strategy"}
              </span>
              <div className="flex items-center gap-2">
                {executionSteps.length > 0 && (
                  <span className="text-[10px] font-[family-name:var(--font-geist-mono)] text-[var(--text-tertiary)] font-tabular">
                    {completedSteps}/{executionSteps.length} deposits
                  </span>
                )}
                <span className="text-[11px] font-[family-name:var(--font-geist-mono)] font-bold text-[var(--text-primary)] font-tabular">
                  ${plan.strategy.totalUsdc.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Progress bar */}
            {executionSteps.length > 0 && (
              <div className="h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
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
              <div className="text-center rounded-lg p-2 bg-[var(--bg-tertiary)]">
                <div className="text-[9px] text-[var(--text-tertiary)] uppercase">Est. BTC</div>
                <div className="text-[13px] font-[family-name:var(--font-geist-mono)] font-bold text-[var(--accent-orange)] font-tabular">
                  {plan.strategy.estimatedBtc}
                </div>
              </div>
              <div className="text-center rounded-lg p-2 bg-[var(--bg-tertiary)]">
                <div className="text-[9px] text-[var(--text-tertiary)] uppercase">Privacy</div>
                <div className="text-[12px] font-semibold text-emerald-400">
                  {plan.strategy.privacyScore.split("(")[0].trim()}
                </div>
              </div>
              <div className="text-center rounded-lg p-2 bg-[var(--bg-tertiary)]">
                <div className="text-[9px] text-[var(--text-tertiary)] uppercase">CSI</div>
                <div className="text-[13px] font-[family-name:var(--font-geist-mono)] font-bold text-purple-400 font-tabular">
                  {plan.strategy.csiImpact}
                </div>
              </div>
            </div>

            {/* Manual execute button (only in non-autonomous mode) */}
            {agentPhase === "planned" && !autonomousMode && (
              <motion.button
                onClick={executeStrategy}
                disabled={!isConnected}
                className="w-full py-3.5 bg-[var(--accent-orange)] text-white rounded-xl text-[13px] font-semibold
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
                  <div className="rounded-lg p-2.5 bg-emerald-950/20 border border-emerald-800/25 flex items-center gap-2">
                    <CheckCircle size={12} strokeWidth={2} className="text-emerald-400 flex-shrink-0" />
                    <span className="text-[11px] font-semibold text-emerald-400">
                      BTC conversion complete
                    </span>
                    <a
                      href={`${EXPLORER_TX}${batchTxHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto text-[10px] text-emerald-400/70 hover:underline font-[family-name:var(--font-geist-mono)] flex items-center gap-1"
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
                    className="flex-1 py-2.5 rounded-xl text-[12px] font-semibold text-[var(--text-tertiary)] bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                  >
                    New Strategy
                  </button>
                </div>
                <p className="text-[10px] text-emerald-400/70 text-center">
                  Proceed to <strong>Confidential Exit</strong> tab to claim BTC
                </p>
              </div>
            )}

            {!isConnected && agentPhase === "planned" && (
              <p className="text-[11px] text-[var(--text-tertiary)] text-center">
                Connect your wallet to execute
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
