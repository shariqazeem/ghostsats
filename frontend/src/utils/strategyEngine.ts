/**
 * Veil Strategist — Deterministic AI Strategy Engine
 *
 * Generates structured accumulation plans from natural language input.
 * No external API dependency — all logic is deterministic with
 * template-based narrative generation for typewriter display.
 *
 * Supports 5 strategy types:
 *   1. privacy_first  — highest anonymity set tier, all deposits there
 *   2. efficiency     — largest affordable tier, single multicall
 *   3. stealth_dca    — randomize across tiers for cross-pool obfuscation
 *   4. whale          — spread across ALL tiers to strengthen protocol-wide anonymity
 *   5. balanced       — (default) optimal tier by amount
 */

import { DENOMINATIONS, DENOMINATION_LABELS } from "./privacy";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type StrategyType =
  | "privacy_first"
  | "efficiency"
  | "stealth_dca"
  | "whale"
  | "balanced";

export interface PoolState {
  pendingUsdc: number;   // in human-readable USD (not raw 6-decimal)
  batchCount: number;
  leafCount: number;
  anonSets: Record<number, number>; // tier -> count
  btcPrice: number;
}

export interface AgentStep {
  tier: number;           // 0, 1, or 2
  label: string;          // "$1", "$10", "$100"
  usdcAmount: number;     // human-readable
  delaySeconds: number;   // randomized delay before this step
  description: string;    // e.g. "Deposit $10 into tier 1 (anonymity set: 5)"
}

export interface AgentPlan {
  analysis: string;
  strategy: {
    totalUsdc: number;
    steps: AgentStep[];
    estimatedBtc: string;
    privacyScore: string;
    csiImpact: string;
  };
  reasoning: string;
}

/** Individual log line emitted during agent "thinking" */
export interface AgentLogEntry {
  timestamp: number;
  type: "think" | "observe" | "decide" | "act" | "result";
  message: string;
}

// ---------------------------------------------------------------------------
// Intent Parsing
// ---------------------------------------------------------------------------

/** Extract a target USD amount from natural language. */
export function parseTargetUsdc(input: string): number | null {
  const patterns = [
    /\$\s?([\d,]+(?:\.\d+)?)/,
    /([\d,]+(?:\.\d+)?)\s*(?:dollars?|usd|usdc)/i,
    /accumulate\s+([\d,]+)/i,
    /invest\s+([\d,]+)/i,
    /deposit\s+([\d,]+)/i,
    /dca\s+([\d,]+)/i,
  ];

  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match) {
      return parseFloat(match[1].replace(/,/g, ""));
    }
  }

  const bareNumber = input.match(/\b(\d+(?:\.\d+)?)\b/);
  if (bareNumber) {
    return parseFloat(bareNumber[1]);
  }

  return null;
}

// ---------------------------------------------------------------------------
// Strategy Detection from Natural Language
// ---------------------------------------------------------------------------

/** Detect strategy type from user input. */
export function detectStrategyType(input: string, targetUsdc: number): StrategyType {
  const lower = input.toLowerCase();

  // privacy_first: privacy / anonymous / stealth / hidden / invisible
  if (/privac|anonym|stealth|hidden|invisible/i.test(lower)) {
    return "privacy_first";
  }

  // efficiency: efficient / fast / quick / cheap / gas
  if (/efficien|fast|quick|cheap|gas/i.test(lower)) {
    return "efficiency";
  }

  // stealth_dca: dca / spread / split / multiple / diversify
  if (/dca|spread|split|multiple|diversif/i.test(lower)) {
    return "stealth_dca";
  }

  // whale: amount $500+ without other keywords
  if (targetUsdc >= 500) {
    return "whale";
  }

  // Default
  return "balanced";
}

/** Detect if user wants a DCA / spread pattern (kept for backward compat). */
function wantsDCA(input: string): { isDCA: boolean; depositCount?: number } {
  const dcaMatch = input.match(/(\d+)\s*(?:deposits?|steps?|tranches?|times?)/i);
  if (dcaMatch) return { isDCA: true, depositCount: parseInt(dcaMatch[1]) };
  if (/dca|spread|split|multiple|gradual/i.test(input)) return { isDCA: true };
  return { isDCA: false };
}

// ---------------------------------------------------------------------------
// Tranche Optimization
// ---------------------------------------------------------------------------

interface TierOption {
  tier: number;
  label: string;
  usdcPerDeposit: number;
  anonSet: number;
}

function getTierOptions(poolState: PoolState): TierOption[] {
  return Object.entries(DENOMINATIONS).map(([tier, rawAmount]) => ({
    tier: Number(tier),
    label: DENOMINATION_LABELS[Number(tier)],
    usdcPerDeposit: rawAmount / 1_000_000,
    anonSet: poolState.anonSets[Number(tier)] ?? 0,
  }));
}

/** Pick the best tier based on strategy type. */
function selectOptimalTier(
  targetUsdc: number,
  poolState: PoolState,
  strategyType: StrategyType,
): TierOption {
  const tiers = getTierOptions(poolState);
  const affordable = tiers.filter((t) => t.usdcPerDeposit <= targetUsdc);

  if (affordable.length === 0) return tiers[0];

  switch (strategyType) {
    case "privacy_first":
      // Highest anonymity set among affordable tiers
      return affordable.reduce((best, t) =>
        t.anonSet > best.anonSet ? t : best
      );

    case "efficiency":
      // Largest affordable tier (fewest deposits, single multicall)
      return affordable[affordable.length - 1];

    case "stealth_dca":
    case "whale":
      // For these, tier selection happens in the step generator.
      // Return the largest affordable as the "primary" for plan summary.
      return affordable[affordable.length - 1];

    case "balanced":
    default:
      // Default: largest affordable tier
      return affordable[affordable.length - 1];
  }
}

// ---------------------------------------------------------------------------
// Step Generation per Strategy Type
// ---------------------------------------------------------------------------

function generateSteps(
  targetUsdc: number,
  poolState: PoolState,
  strategyType: StrategyType,
  requestedCount?: number,
): AgentStep[] {
  const tiers = getTierOptions(poolState);
  const steps: AgentStep[] = [];

  switch (strategyType) {
    case "privacy_first": {
      // All deposits go to the tier with the highest anonymity set
      const affordable = tiers.filter((t) => t.usdcPerDeposit <= targetUsdc);
      if (affordable.length === 0) break;
      const bestAnon = affordable.reduce((best, t) =>
        t.anonSet > best.anonSet ? t : best
      );
      let numDeposits = Math.floor(targetUsdc / bestAnon.usdcPerDeposit);
      if (numDeposits < 1) numDeposits = 1;
      if (requestedCount && requestedCount > 0) numDeposits = requestedCount;
      for (let i = 0; i < numDeposits; i++) {
        steps.push({
          tier: bestAnon.tier,
          label: bestAnon.label,
          usdcAmount: bestAnon.usdcPerDeposit,
          delaySeconds: i === 0 ? 0 : randomDelay(30, 90),
          description: `Deposit ${bestAnon.label} into tier ${bestAnon.tier} — max anonymity set (${bestAnon.anonSet + i + 1} participants)`,
        });
      }
      break;
    }

    case "efficiency": {
      // Largest affordable tier, single multicall (no delays)
      const affordable = tiers.filter((t) => t.usdcPerDeposit <= targetUsdc);
      if (affordable.length === 0) break;
      const largest = affordable[affordable.length - 1];
      let numDeposits = Math.floor(targetUsdc / largest.usdcPerDeposit);
      if (numDeposits < 1) numDeposits = 1;
      if (requestedCount && requestedCount > 0) numDeposits = requestedCount;
      for (let i = 0; i < numDeposits; i++) {
        steps.push({
          tier: largest.tier,
          label: largest.label,
          usdcAmount: largest.usdcPerDeposit,
          delaySeconds: 0, // No delays — efficiency mode
          description: `Deposit ${largest.label} into tier ${largest.tier} — efficient single batch`,
        });
      }
      break;
    }

    case "stealth_dca": {
      // Randomize across tiers for cross-pool obfuscation
      const affordable = tiers.filter((t) => t.usdcPerDeposit <= targetUsdc);
      if (affordable.length === 0) break;
      let remaining = targetUsdc;
      let depositIdx = 0;
      const maxDeposits = requestedCount && requestedCount > 0 ? requestedCount : 5;

      while (remaining > 0 && depositIdx < maxDeposits) {
        const available = affordable.filter((t) => t.usdcPerDeposit <= remaining);
        if (available.length === 0) break;
        // Pick a random tier from affordable options
        const pick = available[Math.floor(Math.random() * available.length)];
        steps.push({
          tier: pick.tier,
          label: pick.label,
          usdcAmount: pick.usdcPerDeposit,
          delaySeconds: depositIdx === 0 ? 0 : randomDelay(45, 180),
          description: `Deposit ${pick.label} into tier ${pick.tier} — cross-pool obfuscation (set: ${pick.anonSet + 1})`,
        });
        remaining -= pick.usdcPerDeposit;
        depositIdx++;
      }
      break;
    }

    case "whale": {
      // Spread across ALL tiers to strengthen protocol-wide anonymity
      const affordable = tiers.filter((t) => t.usdcPerDeposit <= targetUsdc);
      if (affordable.length === 0) break;
      let remaining = targetUsdc;
      let depositIdx = 0;

      // Distribute starting from largest tier down, cycling through all
      const sortedDesc = [...affordable].sort((a, b) => b.usdcPerDeposit - a.usdcPerDeposit);
      let tierIdx = 0;

      while (remaining > 0 && depositIdx < 20) {
        const current = sortedDesc[tierIdx % sortedDesc.length];
        if (current.usdcPerDeposit > remaining) {
          // Try a smaller tier
          const smaller = sortedDesc.find((t) => t.usdcPerDeposit <= remaining);
          if (!smaller) break;
          steps.push({
            tier: smaller.tier,
            label: smaller.label,
            usdcAmount: smaller.usdcPerDeposit,
            delaySeconds: depositIdx === 0 ? 0 : randomDelay(20, 90),
            description: `Deposit ${smaller.label} into tier ${smaller.tier} — protocol-wide liquidity (whale distribution)`,
          });
          remaining -= smaller.usdcPerDeposit;
        } else {
          steps.push({
            tier: current.tier,
            label: current.label,
            usdcAmount: current.usdcPerDeposit,
            delaySeconds: depositIdx === 0 ? 0 : randomDelay(20, 90),
            description: `Deposit ${current.label} into tier ${current.tier} — protocol-wide liquidity (whale distribution)`,
          });
          remaining -= current.usdcPerDeposit;
        }
        tierIdx++;
        depositIdx++;
      }
      break;
    }

    case "balanced":
    default: {
      // Current behavior: optimal tier by amount
      const affordable = tiers.filter((t) => t.usdcPerDeposit <= targetUsdc);
      if (affordable.length === 0) break;
      const tier = affordable[affordable.length - 1];
      let numDeposits = Math.floor(targetUsdc / tier.usdcPerDeposit);
      if (numDeposits < 1) numDeposits = 1;
      if (requestedCount && requestedCount > 0) numDeposits = requestedCount;
      const { isDCA } = wantsDCA("");
      if (isDCA && !requestedCount && numDeposits > 5) numDeposits = 5;
      for (let i = 0; i < numDeposits; i++) {
        const delay = i === 0 ? 0 : randomDelay(30, 120);
        steps.push({
          tier: tier.tier,
          label: tier.label,
          usdcAmount: tier.usdcPerDeposit,
          delaySeconds: delay,
          description: `Deposit ${tier.label} into tier ${tier.tier} (anonymity set: ${tier.anonSet + i + 1})`,
        });
      }
      break;
    }
  }

  return steps;
}

// ---------------------------------------------------------------------------
// Delay Randomization
// ---------------------------------------------------------------------------

function randomDelay(minSeconds: number, maxSeconds: number): number {
  return Math.floor(minSeconds + Math.random() * (maxSeconds - minSeconds));
}

// ---------------------------------------------------------------------------
// CSI Calculation
// ---------------------------------------------------------------------------

function computeCSI(anonSets: Record<number, number>): number {
  const values = Object.values(anonSets);
  const activeTranches = values.filter((a) => a > 0).length;
  const maxParticipants = Math.max(...values, 0);
  return maxParticipants * activeTranches;
}

// ---------------------------------------------------------------------------
// Strategy-specific narrative helpers
// ---------------------------------------------------------------------------

const STRATEGY_LABELS: Record<StrategyType, string> = {
  privacy_first: "Privacy-First",
  efficiency: "Efficiency",
  stealth_dca: "Stealth DCA",
  whale: "Whale Distribution",
  balanced: "Balanced",
};

const STRATEGY_DESCRIPTIONS: Record<StrategyType, string> = {
  privacy_first: "Maximizing anonymity set size — all deposits target the strongest pool.",
  efficiency: "Single atomic multicall — minimum gas, maximum speed.",
  stealth_dca: "Cross-pool obfuscation — randomized tiers with temporal decorrelation.",
  whale: "Protocol-wide liquidity injection — strengthening every anonymity tier.",
  balanced: "Optimal balance of privacy coverage and execution efficiency.",
};

// ---------------------------------------------------------------------------
// Agent Thinking Loop — generates log entries for streaming display
// ---------------------------------------------------------------------------

export function generateAgentLog(
  targetUsdc: number,
  poolState: PoolState,
  btcPrice: number,
  userInput: string,
): AgentLogEntry[] {
  const logs: AgentLogEntry[] = [];
  let t = Date.now();
  const tick = () => { t += 120 + Math.random() * 300; return t; };

  const strategyType = detectStrategyType(userInput, targetUsdc);
  const { isDCA, depositCount: requestedCount } = wantsDCA(userInput);
  const tiers = getTierOptions(poolState);

  // Phase 1: Observation
  logs.push({ timestamp: tick(), type: "observe", message: `Parsing intent: "${userInput}"` });
  logs.push({ timestamp: tick(), type: "observe", message: `Target: $${targetUsdc} USDC -> BTC accumulation` });
  logs.push({ timestamp: tick(), type: "observe", message: `Live BTC: $${btcPrice.toLocaleString()} (CoinGecko)` });
  logs.push({ timestamp: tick(), type: "observe", message: `Pool state: ${poolState.leafCount} commitments, ${Object.values(poolState.anonSets).reduce((s, v) => s + v, 0)} active participants` });
  logs.push({ timestamp: tick(), type: "observe", message: `Detected strategy: ${STRATEGY_LABELS[strategyType]}` });

  // Phase 2: Analysis
  logs.push({ timestamp: tick(), type: "think", message: `Evaluating 3 anonymity tiers for ${STRATEGY_LABELS[strategyType]} optimization...` });

  for (const tier of tiers) {
    const strength = tier.anonSet >= 10 ? "STRONG" : tier.anonSet >= 5 ? "GOOD" : tier.anonSet >= 3 ? "MODERATE" : "LOW";
    logs.push({ timestamp: tick(), type: "think", message: `  ${tier.label} pool: ${tier.anonSet} participants -> ${strength} unlinkability` });
  }

  if (poolState.pendingUsdc > 0) {
    logs.push({ timestamp: tick(), type: "think", message: `Pending pool: $${poolState.pendingUsdc.toFixed(2)} awaiting batch conversion` });
  }

  const csi = computeCSI(poolState.anonSets);
  logs.push({ timestamp: tick(), type: "think", message: `Current Confidentiality Strength Index: ${csi}` });

  // Strategy-specific thinking logs
  switch (strategyType) {
    case "privacy_first":
      logs.push({ timestamp: tick(), type: "think", message: `Privacy-first mode: routing all deposits to highest anonymity set.` });
      logs.push({ timestamp: tick(), type: "think", message: `Sacrificing efficiency for maximum unlinkability guarantee.` });
      break;
    case "efficiency":
      logs.push({ timestamp: tick(), type: "think", message: `Efficiency mode: selecting largest tier for minimum transaction count.` });
      logs.push({ timestamp: tick(), type: "think", message: `All deposits batched atomically — zero delays, single confirmation.` });
      break;
    case "stealth_dca":
      logs.push({ timestamp: tick(), type: "think", message: `Stealth DCA: randomizing tier selection for cross-pool obfuscation.` });
      logs.push({ timestamp: tick(), type: "think", message: `Extended delays (45-180s) prevent temporal correlation analysis.` });
      break;
    case "whale":
      logs.push({ timestamp: tick(), type: "think", message: `Whale distribution: spreading across ALL tiers to strengthen protocol-wide anonymity.` });
      logs.push({ timestamp: tick(), type: "think", message: `Large deposit detected ($${targetUsdc}). Every tier benefits from added liquidity.` });
      break;
    case "balanced":
    default:
      if (isDCA) {
        logs.push({ timestamp: tick(), type: "think", message: `DCA pattern requested. Spreading deposits for temporal decorrelation.` });
      }
      break;
  }

  // Phase 3: Decision
  const steps = generateSteps(targetUsdc, poolState, strategyType, requestedCount);
  const totalUsdc = steps.reduce((sum, s) => sum + s.usdcAmount, 0);
  const estBtc = (totalUsdc / btcPrice) * 0.99;
  const primaryTier = selectOptimalTier(targetUsdc, poolState, strategyType);

  logs.push({ timestamp: tick(), type: "decide", message: `Strategy: ${STRATEGY_LABELS[strategyType]} — ${STRATEGY_DESCRIPTIONS[strategyType]}` });
  logs.push({ timestamp: tick(), type: "decide", message: `Plan: ${steps.length} deposits = $${totalUsdc} USDC across ${new Set(steps.map(s => s.tier)).size} tier(s)` });
  logs.push({ timestamp: tick(), type: "decide", message: `Estimated yield: ${estBtc.toFixed(estBtc < 0.01 ? 6 : 4)} BTC (1% slippage buffer)` });

  if (strategyType === "efficiency") {
    logs.push({ timestamp: tick(), type: "decide", message: `Timing: single atomic multicall (zero delay, maximum efficiency)` });
  } else if (strategyType === "stealth_dca") {
    logs.push({ timestamp: tick(), type: "decide", message: `Timing: randomized DCA — relayer executes with 45-180s delays, random tiers` });
  } else if (strategyType === "whale") {
    logs.push({ timestamp: tick(), type: "decide", message: `Timing: distributed execution across all tiers with 20-90s delays` });
  } else if (strategyType === "privacy_first") {
    logs.push({ timestamp: tick(), type: "decide", message: `Timing: sequential deposits with 30-90s delays into max-privacy tier` });
  } else if (isDCA) {
    logs.push({ timestamp: tick(), type: "decide", message: `Timing: autonomous DCA — relayer executes with 30-120s delays (1 signature)` });
  } else {
    logs.push({ timestamp: tick(), type: "decide", message: `Timing: single atomic multicall (maximum efficiency)` });
  }

  logs.push({ timestamp: tick(), type: "decide", message: `Post-execution: auto-trigger batch conversion via AVNU` });

  const projectedAnonSets = { ...poolState.anonSets };
  for (const step of steps) {
    projectedAnonSets[step.tier] = (projectedAnonSets[step.tier] ?? 0) + 1;
  }
  const projectedCSI = computeCSI(projectedAnonSets);
  logs.push({ timestamp: tick(), type: "decide", message: `CSI impact: ${csi} -> ${projectedCSI} (+${projectedCSI - csi})` });

  logs.push({ timestamp: tick(), type: "result", message: `Strategy ready. Awaiting execution authorization.` });

  return logs;
}

// ---------------------------------------------------------------------------
// Strategy Generation (structured plan)
// ---------------------------------------------------------------------------

export function generateStrategy(
  targetUsdc: number,
  poolState: PoolState,
  btcPrice: number,
  userInput: string = "",
): AgentPlan {
  const strategyType = detectStrategyType(userInput, targetUsdc);
  const { depositCount: requestedCount } = wantsDCA(userInput);

  const steps = generateSteps(targetUsdc, poolState, strategyType, requestedCount);

  const totalUsdc = steps.reduce((sum, s) => sum + s.usdcAmount, 0);
  const estimatedBtc = totalUsdc / btcPrice;
  const slippageAdjustedBtc = estimatedBtc * 0.99;

  const currentCSI = computeCSI(poolState.anonSets);
  const projectedAnonSets = { ...poolState.anonSets };
  for (const step of steps) {
    projectedAnonSets[step.tier] = (projectedAnonSets[step.tier] ?? 0) + 1;
  }
  const projectedCSI = computeCSI(projectedAnonSets);

  // Compute privacy score from all affected tiers
  const maxProjectedAnon = Math.max(...Object.values(projectedAnonSets));
  const privacyLabel =
    maxProjectedAnon >= 20 ? "Maximum" :
    maxProjectedAnon >= 10 ? "Strong" :
    maxProjectedAnon >= 5 ? "Good" :
    maxProjectedAnon >= 3 ? "Moderate" : "Low";

  const tiersUsed = [...new Set(steps.map(s => s.tier))];
  const tierSummary = tiersUsed.length === 1
    ? `${steps[0].label} pool`
    : `${tiersUsed.length} pools`;

  const primaryTier = selectOptimalTier(targetUsdc, poolState, strategyType);

  const analysis = buildAnalysis(poolState, btcPrice, primaryTier, totalUsdc, strategyType);
  const reasoning = buildReasoning(primaryTier, steps.length, strategyType, poolState, projectedCSI, steps);

  return {
    analysis,
    strategy: {
      totalUsdc,
      steps,
      estimatedBtc: slippageAdjustedBtc.toFixed(slippageAdjustedBtc < 0.01 ? 6 : 4),
      privacyScore: `${privacyLabel} (${maxProjectedAnon} participants across ${tierSummary})`,
      csiImpact: `${currentCSI} -> ${projectedCSI}`,
    },
    reasoning,
  };
}

// ---------------------------------------------------------------------------
// Narrative Templates
// ---------------------------------------------------------------------------

function buildAnalysis(
  poolState: PoolState,
  btcPrice: number,
  tier: TierOption,
  totalUsdc: number,
  strategyType: StrategyType,
): string {
  const lines: string[] = [];

  lines.push(`MARKET ASSESSMENT`);
  lines.push(`BTC is trading at $${btcPrice.toLocaleString()}. At current rates, $${totalUsdc} converts to approximately ${(totalUsdc / btcPrice).toFixed(6)} BTC before slippage adjustment.`);
  lines.push(``);

  lines.push(`POOL STATE ANALYSIS`);
  const totalAnon = Object.values(poolState.anonSets).reduce((s, v) => s + v, 0);
  lines.push(`The protocol currently has ${totalAnon} active commitments across ${Object.values(poolState.anonSets).filter(v => v > 0).length} active tiers.`);

  const tierNames = ["$1", "$10", "$100"];
  const tierDetails = tierNames.map(
    (name, i) => `${name}: ${poolState.anonSets[i] ?? 0} participants`
  );
  lines.push(`Anonymity sets: ${tierDetails.join(" | ")}`);

  if (poolState.pendingUsdc > 0) {
    lines.push(`Pending pool: $${poolState.pendingUsdc.toLocaleString()} USDC awaiting batch conversion.`);
  }
  lines.push(``);

  lines.push(`STRATEGY MODE: ${STRATEGY_LABELS[strategyType].toUpperCase()}`);
  lines.push(STRATEGY_DESCRIPTIONS[strategyType]);
  lines.push(``);

  lines.push(`RECOMMENDED APPROACH`);

  switch (strategyType) {
    case "privacy_first":
      lines.push(`All deposits routed to the tier with the highest anonymity set for maximum unlinkability.`);
      break;
    case "efficiency":
      lines.push(`The ${tier.label} USDC tier selected for fewest deposits. Atomic multicall minimizes gas and latency.`);
      break;
    case "stealth_dca":
      lines.push(`Deposits randomized across tiers. Cross-pool distribution makes correlation analysis computationally infeasible.`);
      break;
    case "whale":
      lines.push(`Large position distributed across all available tiers. Each tier's anonymity set benefits from added liquidity, strengthening protocol-wide privacy.`);
      break;
    case "balanced":
    default:
      lines.push(`The ${tier.label} USDC tier offers the best risk-adjusted privacy. Current anonymity set of ${tier.anonSet} participants provides ${tier.anonSet >= 10 ? "strong" : tier.anonSet >= 5 ? "good" : "growing"} cover.`);
      break;
  }

  return lines.join("\n");
}

function buildReasoning(
  tier: TierOption,
  numDeposits: number,
  strategyType: StrategyType,
  poolState: PoolState,
  projectedCSI: number,
  steps: AgentStep[],
): string {
  const lines: string[] = [];

  lines.push(`STRATEGY RATIONALE`);

  switch (strategyType) {
    case "privacy_first":
      lines.push(`Privacy-first execution: all ${numDeposits} deposit(s) target the tier with the highest anonymity set (${tier.anonSet} participants). This maximizes the probability of unlinkability at the cost of capital efficiency.`);
      break;
    case "efficiency":
      lines.push(`Efficiency execution: selected ${tier.label} tier for the fewest possible deposits. Zero-delay atomic multicall ensures minimum gas cost and instant settlement.`);
      break;
    case "stealth_dca": {
      const tierCounts: Record<string, number> = {};
      for (const s of steps) {
        tierCounts[s.label] = (tierCounts[s.label] ?? 0) + 1;
      }
      const dist = Object.entries(tierCounts).map(([k, v]) => `${v}x ${k}`).join(", ");
      lines.push(`Stealth DCA: deposits randomized across tiers (${dist}). Cross-pool distribution with extended delays (45-180s) makes temporal and amount-based correlation analysis infeasible.`);
      break;
    }
    case "whale": {
      const tierCounts: Record<string, number> = {};
      for (const s of steps) {
        tierCounts[s.label] = (tierCounts[s.label] ?? 0) + 1;
      }
      const dist = Object.entries(tierCounts).map(([k, v]) => `${v}x ${k}`).join(", ");
      lines.push(`Whale distribution: ${numDeposits} deposits spread across all tiers (${dist}). Every anonymity set in the protocol benefits from added liquidity. This is the most altruistic strategy — strengthening privacy for all participants.`);
      break;
    }
    case "balanced":
    default:
      lines.push(`Selected ${tier.label} tier for optimal balance between efficiency and privacy coverage.`);
      break;
  }

  lines.push(``);
  lines.push(`EXECUTION PLAN`);

  const hasDCADelays = steps.some((s) => s.delaySeconds > 0);
  if (hasDCADelays) {
    const minDelay = Math.min(...steps.filter(s => s.delaySeconds > 0).map(s => s.delaySeconds));
    const maxDelay = Math.max(...steps.map(s => s.delaySeconds));
    lines.push(`${numDeposits} autonomous deposits via relayer with randomized delays (${minDelay}-${maxDelay}s). You sign once — the relayer handles execution. Each deposit lands in a separate block, preventing temporal correlation analysis.`);
  } else {
    lines.push(`${numDeposits} deposit(s) batched in a single atomic multicall for maximum efficiency.`);
  }

  lines.push(``);
  lines.push(`Each deposit enters the shielded pool as an indistinguishable commitment. After batch conversion via AVNU, the resulting BTC can be withdrawn through a confidential exit with no on-chain link to the deposit address.`);
  lines.push(``);
  lines.push(`PRIVACY IMPACT`);
  lines.push(`Confidentiality Strength Index will increase to ${projectedCSI} after execution.`);

  return lines.join("\n");
}
