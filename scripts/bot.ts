/**
 * Veil Strategist — Telegram Bot
 *
 * AI control interface for confidential Bitcoin accumulation on Starknet.
 * Provides strategy planning, pool analytics, and deep-link execution
 * from Telegram.
 *
 * Usage:
 *   npx ts-node --esm bot.ts
 *   npx tsx bot.ts
 *
 * Environment:
 *   TELEGRAM_BOT_TOKEN  - Bot token from @BotFather
 *   WEB_APP_URL         - Frontend URL for deep links (default: http://localhost:3000)
 *   PRIVATE_KEY          - (optional) Not needed — bot is read-only
 *   STARKNET_RPC_URL     - (optional) RPC endpoint
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { Bot, InlineKeyboard } from "grammy";
import { RpcProvider, Contract, type Abi } from "starknet";
import "dotenv/config";

import {
  parseTargetUsdc,
  generateAgentLog,
  generateStrategy,
  type PoolState,
  type AgentLogEntry,
  type AgentPlan,
} from "./strategyEngine.js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface DeploymentManifest {
  network?: string;
  contracts?: Record<string, string>;
}

function loadDeploymentManifest(): DeploymentManifest {
  try {
    const manifestPath = path.resolve(__dirname, "deployment.json");
    if (fs.existsSync(manifestPath)) {
      return JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    }
  } catch { /* fall through */ }
  return {};
}

const manifest = loadDeploymentManifest();
const addresses = manifest.contracts ?? {};
const network = manifest.network ?? "sepolia";

const POOL_ADDRESS =
  process.env.POOL_ADDRESS ??
  addresses.shieldedPool ??
  "";

const RPC_URL =
  process.env.STARKNET_RPC_URL ??
  (network === "mainnet"
    ? "https://rpc.starknet.lava.build"
    : "https://starknet-sepolia-rpc.publicnode.com");

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEB_APP_BASE = process.env.WEB_APP_URL ?? "http://localhost:3000";

const EXPLORER_BASE =
  network === "mainnet"
    ? "https://starkscan.co"
    : "https://sepolia.starkscan.co";

if (!BOT_TOKEN) {
  console.error("[bot] TELEGRAM_BOT_TOKEN not set in .env");
  process.exit(1);
}

if (!POOL_ADDRESS) {
  console.error("[bot] No pool address found — run deploy first or set POOL_ADDRESS");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Pool Contract Reader
// ---------------------------------------------------------------------------

const POOL_ABI: Abi = [
  {
    type: "function",
    name: "get_pending_usdc",
    inputs: [],
    outputs: [{ type: "core::integer::u256" }],
    state_mutability: "view",
  },
  {
    type: "function",
    name: "get_batch_count",
    inputs: [],
    outputs: [{ type: "core::integer::u32" }],
    state_mutability: "view",
  },
  {
    type: "function",
    name: "get_leaf_count",
    inputs: [],
    outputs: [{ type: "core::integer::u32" }],
    state_mutability: "view",
  },
  {
    type: "function",
    name: "get_anonymity_set",
    inputs: [{ name: "tier", type: "core::integer::u8" }],
    outputs: [{ type: "core::integer::u32" }],
    state_mutability: "view",
  },
];

async function getPoolState(): Promise<PoolState> {
  const provider = new RpcProvider({ nodeUrl: RPC_URL });
  const pool = new Contract(POOL_ABI, POOL_ADDRESS, provider);

  const [pendingRaw, batchCount, leafCount, a0, a1, a2] = await Promise.all([
    pool.get_pending_usdc(),
    pool.get_batch_count(),
    pool.get_leaf_count(),
    pool.get_anonymity_set(0),
    pool.get_anonymity_set(1),
    pool.get_anonymity_set(2),
  ]);

  const btcPrice = await fetchBtcPrice();

  return {
    pendingUsdc: Number(BigInt(pendingRaw.toString())) / 1_000_000,
    batchCount: Number(batchCount),
    leafCount: Number(leafCount),
    anonSets: { 0: Number(a0), 1: Number(a1), 2: Number(a2) },
    btcPrice,
  };
}

// ---------------------------------------------------------------------------
// BTC Price (triple fallback)
// ---------------------------------------------------------------------------

async function fetchBtcPrice(): Promise<number> {
  // CoinGecko
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd",
      { signal: AbortSignal.timeout(5000) },
    );
    if (res.ok) {
      const data = await res.json();
      if (data?.bitcoin?.usd) return data.bitcoin.usd;
    }
  } catch { /* next */ }

  // CoinCap
  try {
    const res = await fetch(
      "https://api.coincap.io/v2/assets/bitcoin",
      { signal: AbortSignal.timeout(5000) },
    );
    if (res.ok) {
      const data = await res.json();
      if (data?.data?.priceUsd) return parseFloat(data.data.priceUsd);
    }
  } catch { /* next */ }

  // Blockchain.info
  try {
    const res = await fetch(
      "https://blockchain.info/ticker",
      { signal: AbortSignal.timeout(5000) },
    );
    if (res.ok) {
      const data = await res.json();
      if (data?.USD?.last) return data.USD.last;
    }
  } catch { /* all failed */ }

  return 0;
}

// ---------------------------------------------------------------------------
// HTML Helpers
// ---------------------------------------------------------------------------

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function privacyLabel(anonSet: number): string {
  if (anonSet >= 20) return "Maximum";
  if (anonSet >= 10) return "Strong";
  if (anonSet >= 5) return "Good";
  if (anonSet >= 3) return "Moderate";
  return "Low";
}

// ---------------------------------------------------------------------------
// Deep Link
// ---------------------------------------------------------------------------

function buildDeepLink(userInput: string, target: number, plan: AgentPlan): string {
  const params = Buffer.from(JSON.stringify({
    input: userInput,
    target,
    tier: plan.strategy.steps[0]?.tier ?? 0,
    count: plan.strategy.steps.length,
  })).toString("base64url");

  return `${WEB_APP_BASE}/app?strategy=${params}`;
}

// ---------------------------------------------------------------------------
// Bot Setup
// ---------------------------------------------------------------------------

const bot = new Bot(BOT_TOKEN);

// /start
bot.command("start", async (ctx) => {
  await ctx.reply(
    `<b>Veil Strategist</b>\n` +
    `<i>AI control interface for confidential Bitcoin accumulation</i>\n\n` +
    `I plan STARK-verified strategies for private BTC accumulation on Starknet. ` +
    `Tell me how much you want to accumulate and I'll optimize for privacy.\n\n` +
    `<b>Commands:</b>\n` +
    `<code>/strategy</code> &lt;instruction&gt; — Plan a strategy\n` +
    `<code>/status</code> — Pool state &amp; BTC price\n` +
    `<code>/price</code> — Live BTC price\n` +
    `<code>/pool</code> — Detailed analytics\n` +
    `<code>/help</code> — Command reference\n\n` +
    `<b>Example:</b>\n` +
    `<code>/strategy Accumulate $50 in BTC, maximize privacy</code>`,
    { parse_mode: "HTML" },
  );
});

// /help
bot.command("help", async (ctx) => {
  await ctx.reply(
    `<b>Veil Strategist Commands</b>\n\n` +
    `<code>/strategy &lt;text&gt;</code>\n` +
    `  Plan accumulation strategy from natural language.\n` +
    `  Examples:\n` +
    `  • <code>/strategy $50 max privacy</code>\n` +
    `  • <code>/strategy DCA $100 over 5 deposits</code>\n` +
    `  • <code>/strategy invest $30 into strongest pool</code>\n\n` +
    `<code>/status</code> — Pool state, anonymity sets, BTC price\n` +
    `<code>/price</code> — Live BTC + tier conversion rates\n` +
    `<code>/pool</code> — Detailed protocol analytics\n` +
    `<code>/start</code> — Welcome message\n\n` +
    `<i>Veil Protocol — Confidential BTC Accumulation on Starknet</i>`,
    { parse_mode: "HTML" },
  );
});

// /status
bot.command("status", async (ctx) => {
  await ctx.reply("<code>Fetching pool state...</code>", { parse_mode: "HTML" });

  try {
    const state = await getPoolState();
    const csi = computeCSIFromState(state);
    const totalAnon = Object.values(state.anonSets).reduce((s, v) => s + v, 0);

    const priceStr = state.btcPrice > 0 ? `$${state.btcPrice.toLocaleString()}` : "unavailable";

    const lines = [
      `<b>VEIL PROTOCOL STATUS</b>`,
      ``,
      `<b>BTC Price:</b>  ${priceStr}`,
      `<b>Pending:</b>    $${state.pendingUsdc.toFixed(2)} USDC`,
      `<b>Commitments:</b> ${state.leafCount}`,
      `<b>Batches:</b>    ${state.batchCount}`,
      ``,
      `<b>Anonymity Sets:</b>`,
      `  $1   pool: ${state.anonSets[0]} participants  [${privacyLabel(state.anonSets[0])}]`,
      `  $10  pool: ${state.anonSets[1]} participants  [${privacyLabel(state.anonSets[1])}]`,
      `  $100 pool: ${state.anonSets[2]} participants  [${privacyLabel(state.anonSets[2])}]`,
      ``,
      `<b>CSI:</b> ${csi}  |  <b>Participants:</b> ${totalAnon}`,
      `<b>Network:</b> Starknet ${network === "mainnet" ? "Mainnet" : "Sepolia"}`,
    ];

    await ctx.reply(lines.join("\n"), { parse_mode: "HTML" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await ctx.reply(`Error fetching status: ${escapeHtml(msg.slice(0, 200))}`);
  }
});

// /price
bot.command("price", async (ctx) => {
  try {
    const btcPrice = await fetchBtcPrice();
    if (btcPrice <= 0) {
      await ctx.reply("BTC price unavailable — try again in a moment.");
      return;
    }

    const lines = [
      `<b>BITCOIN PRICE</b>`,
      ``,
      `<code>$${btcPrice.toLocaleString()}</code> USD`,
      ``,
      `<b>Conversion rates:</b>`,
      `  $1   → ${(1 / btcPrice).toFixed(8)} BTC`,
      `  $10  → ${(10 / btcPrice).toFixed(6)} BTC`,
      `  $100 → ${(100 / btcPrice).toFixed(6)} BTC`,
      ``,
      `<i>Source: CoinGecko</i>`,
    ];

    await ctx.reply(lines.join("\n"), { parse_mode: "HTML" });
  } catch (err) {
    await ctx.reply("Failed to fetch BTC price.");
  }
});

// /pool
bot.command("pool", async (ctx) => {
  await ctx.reply("<code>Analyzing pool...</code>", { parse_mode: "HTML" });

  try {
    const state = await getPoolState();
    const csi = computeCSIFromState(state);
    const totalAnon = Object.values(state.anonSets).reduce((s, v) => s + v, 0);
    const activeTiers = Object.values(state.anonSets).filter(v => v > 0).length;

    const lines = [
      `<b>POOL ANALYTICS</b>`,
      ``,
      `<b>Protocol Metrics:</b>`,
      `  Total commitments: ${state.leafCount}`,
      `  Active participants: ${totalAnon}`,
      `  Active tiers: ${activeTiers}/3`,
      `  Batches executed: ${state.batchCount}`,
      `  Pending USDC: $${state.pendingUsdc.toFixed(2)}`,
      ``,
      `<b>Anonymity Set Analysis:</b>`,
      `  $1   tier: ${state.anonSets[0]} participants → ${privacyLabel(state.anonSets[0])} privacy`,
      `  $10  tier: ${state.anonSets[1]} participants → ${privacyLabel(state.anonSets[1])} privacy`,
      `  $100 tier: ${state.anonSets[2]} participants → ${privacyLabel(state.anonSets[2])} privacy`,
      ``,
      `<b>Confidentiality Strength Index:</b> ${csi}`,
      `  Formula: max_participants × active_tiers`,
      `  ${csi >= 30 ? "Excellent" : csi >= 15 ? "Strong" : csi >= 5 ? "Growing" : "Early stage"} protocol coverage`,
      ``,
      `<b>Verification:</b> STARK-based ZK proofs`,
      `<b>Settlement:</b> AVNU DEX on Starknet`,
    ];

    const keyboard = new InlineKeyboard()
      .url("View on Starkscan", `${EXPLORER_BASE}/contract/${POOL_ADDRESS}`)
      .url("Open Web App", `${WEB_APP_BASE}/app`);

    await ctx.reply(lines.join("\n"), { parse_mode: "HTML", reply_markup: keyboard });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await ctx.reply(`Error: ${escapeHtml(msg.slice(0, 200))}`);
  }
});

// /strategy <text>
bot.command("strategy", async (ctx) => {
  const userInput = ctx.match?.trim();

  if (!userInput) {
    await ctx.reply(
      `<b>Usage:</b> <code>/strategy &lt;your instruction&gt;</code>\n\n` +
      `<b>Examples:</b>\n` +
      `<code>/strategy Accumulate $50 in BTC, maximize privacy</code>\n` +
      `<code>/strategy DCA $100 over 5 deposits</code>\n` +
      `<code>/strategy Invest $30 into the strongest anonymity set</code>`,
      { parse_mode: "HTML" },
    );
    return;
  }

  const target = parseTargetUsdc(userInput);
  if (!target || target <= 0) {
    await ctx.reply(
      `Could not parse an amount. Try:\n` +
      `<code>/strategy $50</code> or <code>/strategy invest 100 dollars</code>`,
      { parse_mode: "HTML" },
    );
    return;
  }

  // Send initial "thinking" message
  const thinkingMsg = await ctx.reply(
    `<b>VEIL STRATEGIST</b>\n\n<code>[OBSERVE]</code> Initializing analysis...`,
    { parse_mode: "HTML" },
  );

  try {
    const poolState = await getPoolState();
    const btcPrice = poolState.btcPrice;

    if (btcPrice <= 0) {
      await ctx.api.editMessageText(
        ctx.chat.id,
        thinkingMsg.message_id,
        "BTC price unavailable. Please try again in a moment.",
      );
      return;
    }

    // Generate logs and plan
    const logs = generateAgentLog(target, poolState, btcPrice, userInput);
    const plan = generateStrategy(target, poolState, btcPrice, userInput);

    // Stream agent thinking — edit message progressively
    let logText = `<b>VEIL STRATEGIST</b>\n\n`;
    const BATCH_SIZE = 3;

    for (let i = 0; i < logs.length; i += BATCH_SIZE) {
      const batch = logs.slice(i, i + BATCH_SIZE);
      for (const log of batch) {
        const prefix = log.type.toUpperCase().padEnd(7);
        logText += `<code>[${prefix}]</code> ${escapeHtml(log.message)}\n`;
      }

      try {
        await ctx.api.editMessageText(
          ctx.chat.id,
          thinkingMsg.message_id,
          logText,
          { parse_mode: "HTML" },
        );
      } catch {
        // Ignore rate limit / same-content errors
      }

      await sleep(700);
    }

    // Build strategy summary
    const s = plan.strategy;
    const deepLink = buildDeepLink(userInput, target, plan);

    const summaryLines = [
      `<b>STRATEGY READY</b>`,
      ``,
      `<b>Total:</b> $${s.totalUsdc} USDC → ${s.steps.length}x ${s.steps[0]?.label ?? "?"} deposits`,
      `<b>Est. BTC:</b> ${s.estimatedBtc} (after 1% slippage)`,
      `<b>Privacy:</b> ${s.privacyScore}`,
      `<b>CSI Impact:</b> ${s.csiImpact}`,
      `<b>Verification:</b> STARK-based ZK proofs`,
      `<b>Settlement:</b> AVNU DEX on Starknet`,
      ``,
      `<i>Tap "Execute on Web" to deploy this strategy with a single wallet confirmation.</i>`,
    ];

    const keyboard = new InlineKeyboard()
      .url("Execute on Web", deepLink)
      .row()
      .url("View Pool", `${EXPLORER_BASE}/contract/${POOL_ADDRESS}`);

    await ctx.reply(summaryLines.join("\n"), {
      parse_mode: "HTML",
      reply_markup: keyboard,
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    try {
      await ctx.api.editMessageText(
        ctx.chat.id,
        thinkingMsg.message_id,
        `Analysis failed: ${escapeHtml(msg.slice(0, 200))}`,
      );
    } catch {
      await ctx.reply(`Analysis failed: ${escapeHtml(msg.slice(0, 200))}`);
    }
  }
});

// Handle plain text as strategy input
bot.on("message:text", async (ctx) => {
  const text = ctx.message.text;

  // Skip if it starts with / (unrecognized command)
  if (text.startsWith("/")) {
    await ctx.reply(
      `Unknown command. Try <code>/help</code> for available commands.`,
      { parse_mode: "HTML" },
    );
    return;
  }

  // Try to parse as a strategy
  const target = parseTargetUsdc(text);
  if (target && target > 0) {
    // Rewrite as strategy command and process
    ctx.match = text;
    await ctx.reply(
      `<i>Interpreting as strategy request...</i>`,
      { parse_mode: "HTML" },
    );

    // Trigger strategy handler manually
    const thinkingMsg = await ctx.reply(
      `<b>VEIL STRATEGIST</b>\n\n<code>[OBSERVE]</code> Initializing analysis...`,
      { parse_mode: "HTML" },
    );

    try {
      const poolState = await getPoolState();
      const btcPrice = poolState.btcPrice;

      if (btcPrice <= 0) {
        await ctx.api.editMessageText(
          ctx.chat.id,
          thinkingMsg.message_id,
          "BTC price unavailable. Please try again.",
        );
        return;
      }

      const logs = generateAgentLog(target, poolState, btcPrice, text);
      const plan = generateStrategy(target, poolState, btcPrice, text);

      let logText = `<b>VEIL STRATEGIST</b>\n\n`;
      for (let i = 0; i < logs.length; i += 3) {
        const batch = logs.slice(i, i + 3);
        for (const log of batch) {
          logText += `<code>[${log.type.toUpperCase().padEnd(7)}]</code> ${escapeHtml(log.message)}\n`;
        }
        try {
          await ctx.api.editMessageText(ctx.chat.id, thinkingMsg.message_id, logText, { parse_mode: "HTML" });
        } catch { /* ignore */ }
        await sleep(700);
      }

      const s = plan.strategy;
      const deepLink = buildDeepLink(text, target, plan);

      const keyboard = new InlineKeyboard()
        .url("Execute on Web", deepLink)
        .row()
        .url("View Pool", `${EXPLORER_BASE}/contract/${POOL_ADDRESS}`);

      await ctx.reply(
        `<b>STRATEGY READY</b>\n\n` +
        `<b>Total:</b> $${s.totalUsdc} USDC → ${s.steps.length}x ${s.steps[0]?.label ?? "?"} deposits\n` +
        `<b>Est. BTC:</b> ${s.estimatedBtc} (after 1% slippage)\n` +
        `<b>Privacy:</b> ${s.privacyScore}\n` +
        `<b>CSI Impact:</b> ${s.csiImpact}\n` +
        `<b>Verification:</b> STARK-based ZK proofs\n` +
        `<b>Settlement:</b> AVNU DEX on Starknet\n\n` +
        `<i>Tap "Execute on Web" to deploy.</i>`,
        { parse_mode: "HTML", reply_markup: keyboard },
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await ctx.reply(`Analysis failed: ${escapeHtml(msg.slice(0, 200))}`);
    }
  } else {
    await ctx.reply(
      `I can help you plan a confidential BTC accumulation strategy.\n\n` +
      `Try: <code>/strategy $50 max privacy</code>\n` +
      `Or just tell me an amount: <code>accumulate $30 in BTC</code>`,
      { parse_mode: "HTML" },
    );
  }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeCSIFromState(state: PoolState): number {
  const values = Object.values(state.anonSets);
  const activeTranches = values.filter((a) => a > 0).length;
  const maxParticipants = Math.max(...values, 0);
  return maxParticipants * activeTranches;
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

bot.catch((err) => {
  console.error("[bot] Error:", err.message ?? err);
});

console.log(`[bot] Veil Strategist starting...`);
console.log(`[bot] Network: ${network}`);
console.log(`[bot] Pool: ${POOL_ADDRESS}`);
console.log(`[bot] Web app: ${WEB_APP_BASE}`);

bot.start({
  onStart: () => console.log("[bot] Veil Strategist is online. Waiting for messages..."),
});
