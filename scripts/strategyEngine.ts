/**
 * Veil Strategist — Deterministic AI Strategy Engine (Standalone)
 *
 * Generates structured accumulation plans from natural language input.
 * No external API dependency — all logic is deterministic with
 * template-based narrative generation for typewriter display.
 *
 * This is a standalone copy of frontend/src/utils/strategyEngine.ts
 * with inlined constants to avoid cross-package dependencies
 * (scripts/ uses starknet v7, frontend uses v8).
 */

// Inlined from frontend/src/utils/privacy.ts
const DENOMINATIONS: Record<number, number> = {
  0: 1_000_000,    // $1 USDC
  1: 10_000_000,   // $10 USDC
  2: 100_000_000,  // $100 USDC
};

const DENOMINATION_LABELS: Record<number, string> = {
  0: "$1",
  1: "$10",
  2: "$100",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PoolState {
  pendingUsdc: number;   // in human-readable USD (not raw 6-decimal)
  batchCount: number;
  leafCount: number;
  anonSets: Record<number, number>; // tier → count
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

/** Detect if user wants to maximize privacy. */
function wantsMaxPrivacy(input: string): boolean {
  return /privac|anonym|stealth|confiden|hidden|untrace/i.test(input);
}

/** Detect if user wants a DCA / spread pattern. */
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

/** Pick the best tier based on target amount and privacy preference. */
function selectOptimalTier(
  targetUsdc: number,
  poolState: PoolState,
  maxPrivacy: boolean,
): TierOption {
  const tiers = getTierOptions(poolState);
  const affordable = tiers.filter((t) => t.usdcPerDeposit <= targetUsdc);

  if (affordable.length === 0) return tiers[0];

  if (maxPrivacy) {
    return affordable.reduce((best, t) =>
      t.anonSet > best.anonSet ? t : best
    );
  }

  return affordable[affordable.length - 1];
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

  const maxPrivacy = wantsMaxPrivacy(userInput);
  const { isDCA } = wantsDCA(userInput);
  const tiers = getTierOptions(poolState);

  // Phase 1: Observation
  logs.push({ timestamp: tick(), type: "observe", message: `Parsing intent: "${userInput}"` });
  logs.push({ timestamp: tick(), type: "observe", message: `Target: $${targetUsdc} USDC → BTC accumulation` });
  logs.push({ timestamp: tick(), type: "observe", message: `Live BTC: $${btcPrice.toLocaleString()}` });

  // Phase 2: Analysis (condensed for Telegram — ~12-15 lines total)
  logs.push({ timestamp: tick(), type: "think", message: `Evaluating anonymity tiers on Starknet shielded pool...` });

  const bestTier = tiers.reduce((best, t) => t.anonSet > best.anonSet ? t : best, tiers[0]);
  const strength = bestTier.anonSet >= 10 ? "STRONG" : bestTier.anonSet >= 5 ? "GOOD" : bestTier.anonSet >= 3 ? "MODERATE" : "LOW";
  logs.push({ timestamp: tick(), type: "think", message: `Best pool: ${bestTier.label} (${bestTier.anonSet} participants → ${strength})` });

  const csi = computeCSI(poolState.anonSets);
  logs.push({ timestamp: tick(), type: "think", message: `Confidentiality Strength Index: ${csi}` });

  if (maxPrivacy) {
    logs.push({ timestamp: tick(), type: "think", message: `Privacy-maximizing mode: prioritizing highest anonymity set` });
  }
  if (isDCA) {
    logs.push({ timestamp: tick(), type: "think", message: `DCA pattern: spreading for temporal decorrelation` });
  }

  // Phase 3: Decision
  const tier = selectOptimalTier(targetUsdc, poolState, maxPrivacy);
  let numDeposits = Math.floor(targetUsdc / tier.usdcPerDeposit);
  if (numDeposits < 1) numDeposits = 1;
  const { depositCount: requestedCount } = wantsDCA(userInput);
  if (requestedCount && requestedCount > 0) numDeposits = requestedCount;

  const totalUsdc = numDeposits * tier.usdcPerDeposit;
  const estBtc = (totalUsdc / btcPrice) * 0.99;

  logs.push({ timestamp: tick(), type: "decide", message: `Selected: ${tier.label} tier (anonymity set: ${tier.anonSet})` });
  logs.push({ timestamp: tick(), type: "decide", message: `Plan: ${numDeposits}x ${tier.label} = $${totalUsdc} USDC → ${estBtc.toFixed(estBtc < 0.01 ? 6 : 4)} BTC` });

  const projectedAnonSets = { ...poolState.anonSets };
  projectedAnonSets[tier.tier] = (projectedAnonSets[tier.tier] ?? 0) + numDeposits;
  const projectedCSI = computeCSI(projectedAnonSets);
  logs.push({ timestamp: tick(), type: "decide", message: `CSI impact: ${csi} → ${projectedCSI} (+${projectedCSI - csi})` });
  logs.push({ timestamp: tick(), type: "decide", message: `Settlement: AVNU DEX → STARK-verified withdrawal` });

  logs.push({ timestamp: tick(), type: "result", message: `Strategy ready. Tap Execute to deploy on Starknet.` });

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
  const maxPrivacy = wantsMaxPrivacy(userInput);
  const { isDCA, depositCount: requestedCount } = wantsDCA(userInput);

  const tier = selectOptimalTier(targetUsdc, poolState, maxPrivacy);

  let numDeposits = Math.floor(targetUsdc / tier.usdcPerDeposit);
  if (numDeposits < 1) numDeposits = 1;
  if (requestedCount && requestedCount > 0) numDeposits = requestedCount;
  if (isDCA && !requestedCount && numDeposits > 5) numDeposits = Math.min(numDeposits, 5);

  const totalUsdc = numDeposits * tier.usdcPerDeposit;
  const estimatedBtc = totalUsdc / btcPrice;
  const slippageAdjustedBtc = estimatedBtc * 0.99;

  const steps: AgentStep[] = [];
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

  const currentCSI = computeCSI(poolState.anonSets);
  const projectedAnonSets = { ...poolState.anonSets };
  projectedAnonSets[tier.tier] = (projectedAnonSets[tier.tier] ?? 0) + numDeposits;
  const projectedCSI = computeCSI(projectedAnonSets);

  const projectedAnonSet = projectedAnonSets[tier.tier];
  const privacyLabel =
    projectedAnonSet >= 20 ? "Maximum" :
    projectedAnonSet >= 10 ? "Strong" :
    projectedAnonSet >= 5 ? "Good" :
    projectedAnonSet >= 3 ? "Moderate" : "Low";

  const analysis = buildAnalysis(poolState, btcPrice, tier, totalUsdc);
  const reasoning = buildReasoning(tier, numDeposits, maxPrivacy, projectedCSI);

  return {
    analysis,
    strategy: {
      totalUsdc,
      steps,
      estimatedBtc: slippageAdjustedBtc.toFixed(slippageAdjustedBtc < 0.01 ? 6 : 4),
      privacyScore: `${privacyLabel} (${projectedAnonSet} participants in ${tier.label} pool)`,
      csiImpact: `${currentCSI} → ${projectedCSI}`,
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

  lines.push(`RECOMMENDED APPROACH`);
  lines.push(`The ${tier.label} USDC tier offers the best risk-adjusted privacy. Current anonymity set of ${tier.anonSet} participants provides ${tier.anonSet >= 10 ? "strong" : tier.anonSet >= 5 ? "good" : "growing"} cover.`);

  return lines.join("\n");
}

function buildReasoning(
  tier: TierOption,
  numDeposits: number,
  maxPrivacy: boolean,
  projectedCSI: number,
): string {
  const lines: string[] = [];

  lines.push(`STRATEGY RATIONALE`);

  if (maxPrivacy) {
    lines.push(`Privacy-optimized execution: selected ${tier.label} tier because it has the highest anonymity set (${tier.anonSet}) among affordable options.`);
  } else {
    lines.push(`Selected ${tier.label} tier for optimal balance between efficiency and privacy coverage.`);
  }

  lines.push(``);
  lines.push(`EXECUTION PLAN`);
  lines.push(`${numDeposits} deposits via Starknet multicall. All deposits execute atomically in a single STARK-verified transaction.`);
  lines.push(``);
  lines.push(`Each deposit enters the shielded pool as an indistinguishable commitment. After batch conversion via AVNU, the resulting BTC can be withdrawn through a confidential exit with no on-chain link to the deposit address.`);
  lines.push(``);
  lines.push(`PRIVACY IMPACT`);
  lines.push(`Confidentiality Strength Index will increase to ${projectedCSI} after execution.`);

  return lines.join("\n");
}
