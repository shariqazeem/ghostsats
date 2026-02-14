# AI Strategy Agent

The AI Strategy Agent is a natural language interface for planning and executing confidential Bitcoin accumulation. Type a strategy in plain English, and the agent analyzes live pool state, plans optimal deposits across tiers, and can execute the entire strategy autonomously with a single wallet confirmation.

## Strategy Types

The agent supports five strategy types. It detects the intended type from keywords in your instruction, or falls back to sensible defaults based on the amount.

### 1. Privacy-First

Routes all deposits to the tier with the highest anonymity set, maximizing unlinkability at the cost of capital efficiency. Delays between deposits range from 30 to 90 seconds.

**Trigger keywords**: privacy, anonymous, stealth, hidden, invisible

```
/strategy $100 maximize privacy
/strategy stealth accumulation of $50
```

### 2. Efficiency

Selects the largest affordable tier and batches all deposits in a single atomic multicall. Zero delays between deposits -- minimum gas cost and instant settlement.

**Trigger keywords**: efficient, fast, quick, cheap, gas

```
/strategy quick $10 deposit
/strategy $50 cheap and fast
```

### 3. Stealth DCA

Randomizes deposits across multiple tiers for cross-pool obfuscation. Extended delays between deposits (45 to 180 seconds) prevent temporal correlation analysis. Tier selection is randomized among affordable options for each deposit.

**Trigger keywords**: dca, spread, split, multiple, diversify

```
/strategy DCA $50 over 5 deposits
/strategy split $30 across pools
```

### 4. Whale Distribution

Automatically activated for amounts of $500 or more (unless other keywords override). Spreads deposits across ALL available tiers to strengthen protocol-wide anonymity. Delays between deposits range from 20 to 90 seconds. This is the most altruistic strategy -- every anonymity set in the protocol benefits from added liquidity.

**Auto-triggered**: amounts >= $500 without other strategy keywords

```
/strategy $1000 into the protocol
/strategy accumulate $500
```

### 5. Balanced (Default)

The default when no keywords match and the amount is under $500. Selects the largest affordable tier for an optimal balance between efficiency and privacy coverage. Standard execution timing.

```
/strategy $10
/strategy invest $30
```

## How to Use

### 1. Open the Strategist Tab

In the web app, click the **Strategist** tab in the main panel. The tab shows live pool metrics at the top: BTC price, and anonymity set sizes for the $1, $10, and $100 pools.

### 2. Describe Your Strategy

Type a natural language instruction in the text area. You can also click one of the example prompts:

- "Accumulate $30 in BTC, maximize privacy"
- "DCA $50 over 5 deposits"
- "Invest $10 into the strongest anonymity set"
- "Deposit $100 for confidential BTC exposure"

The agent parses dollar amounts from formats like `$50`, `100 dollars`, `50 USDC`, `deposit 30`, or bare numbers.

### 3. Review the Agent's Plan

Click **Deploy Agent** (autonomous mode) or **Plan Strategy** (manual mode). The agent terminal opens and streams its thinking process through four phases:

| Phase | Color | Description |
|-------|-------|-------------|
| OBSERVE | Blue | Parses intent, fetches live BTC price, reads pool state |
| THINK | Violet | Evaluates anonymity tiers, computes CSI, selects strategy type |
| DECIDE | Orange | Generates deposit plan, estimates BTC yield, projects privacy impact |
| RESULT | Gray | Confirms strategy is ready for execution |

Below the terminal, a summary card displays:

- **Total USDC** and number of deposits
- **Estimated BTC** (after 1% slippage buffer)
- **Privacy Score** (Low / Moderate / Good / Strong / Maximum) with participant count
- **CSI Impact** showing current and projected Confidentiality Strength Index

### 4. Execute the Strategy

In **autonomous mode** (the default, indicated by a green "Autonomous" toggle), execution begins automatically after the plan is generated. In **manual mode**, click the "Execute Strategy" button to start.

Execution depends on the strategy type:

- **Single multicall** (efficiency, balanced without DCA): All deposits are bundled into one Starknet multicall. The wallet prompts for a single confirmation covering all approve + deposit calls.

- **Autonomous DCA** (stealth_dca, whale, privacy_first with delays): The user signs ONE approval transaction for the total USDC amount. The relayer then handles all subsequent deposits with real randomized delays between them. No further wallet popups are needed.

## Autonomous DCA

For strategies with multiple deposits and delays, the execution flow is:

1. The agent calculates the total USDC needed across all planned deposits
2. A single `approve` call is sent to the USDC contract, granting the relayer permission to spend the total amount
3. The user confirms this one transaction in their wallet
4. The relayer waits for on-chain confirmation of the approval
5. For each deposit, the relayer:
   - Waits the randomized delay (displayed as a live countdown in the terminal)
   - Calls `deposit_private` on the ShieldedPool contract on the user's behalf
   - Reports the confirmed transaction hash
6. After all deposits complete, the relayer triggers a batch conversion via AVNU

The randomized delays between deposits provide **temporal decorrelation** -- each deposit lands in a separate block, making it computationally infeasible to correlate them as belonging to the same strategy.

## Terminal Output

The agent terminal is a real-time log display styled as a monospaced console. Log lines are color-coded by phase:

| Prefix | Color | Meaning |
|--------|-------|---------|
| `[OBSERVE]` | Blue (`text-blue-600`) | Input parsing and data fetching |
| `[THINK  ]` | Violet (`text-violet-600`) | Analysis and tier evaluation |
| `[DECIDE ]` | Orange (`text-orange-600`) | Strategy selection and planning (note: displayed as emerald in the UI) |
| `[ACT    ]` | Orange (`text-orange-600`) | Active execution steps |
| `[RESULT ]` | Gray (`text-gray-900`) | Completion confirmations |
| `[TX     ]` | Emerald | Confirmed transaction hashes (clickable links to explorer) |
| `[BATCH  ]` | Orange | Batch conversion transaction hash |
| `[WAIT   ]` | Amber | Live DCA delay countdown |
| `[ERROR  ]` | Red | Execution failures |

During agent thinking, log lines stream in with variable delays (150-350ms per line) to simulate real-time analysis. A blinking cursor indicates the agent is actively processing.

## Privacy Score

After strategy generation, the summary card shows the projected **Privacy Score** based on the anonymity set size after your deposits are added:

| Projected Participants | Privacy Level |
|-----------------------|---------------|
| 1-2 | Low |
| 3-4 | Moderate |
| 5-9 | Good |
| 10-19 | Strong |
| 20+ | Maximum |

The **Confidentiality Strength Index (CSI)** is also displayed, computed as:

```
CSI = max_participants_in_any_tier * number_of_active_tiers
```

The summary shows both the current CSI and the projected CSI after execution (e.g., `15 -> 45`), so you can see exactly how your strategy strengthens the protocol's overall privacy.

## Deep Links

Strategies can be shared as URLs. When a URL contains a `strategy` query parameter, the Strategist tab automatically activates and populates the input field with the encoded instruction:

```
https://theveilprotocol.vercel.app/app?strategy=eyJpbnB1dCI6IkRDQSAkNTAgb3ZlciA1IGRlcG9zaXRzIiwidGFyZ2V0Ijo1MCwidGllciI6MSwiY291bnQiOjV9
```

The parameter value is a base64url-encoded JSON object:

```json
{
  "input": "DCA $50 over 5 deposits",
  "target": 50,
  "tier": 1,
  "count": 5
}
```

Deep links are generated by the [Telegram Bot](/guide/telegram-bot) when a user plans a strategy. They can also be constructed manually for sharing strategies via any channel. On load, the web app decodes the parameter, fills the strategy input, and cleans the URL from the browser address bar to avoid re-triggering on refresh.

## Strategy Engine Architecture

The strategy engine is fully deterministic -- no external AI API calls are involved. All logic runs locally:

```
User Input (natural language)
     |
     v
parseTargetUsdc()          Extract dollar amount from text
     |
     v
detectStrategyType()       Match keywords to one of 5 strategy types
     |
     v
getPoolState()             Fetch live anonymity sets, pending USDC, BTC price
     |
     v
generateSteps()            Build deposit sequence (tiers, amounts, delays)
     |
     v
generateAgentLog()         Produce streaming log entries for terminal display
     |
     v
generateStrategy()         Produce structured AgentPlan with analysis + reasoning
```

The engine code lives in two locations:

- **`frontend/src/utils/strategyEngine.ts`** -- Used by the web app's AgentTab component. Imports constants from `privacy.ts`.
- **`scripts/strategyEngine.ts`** -- Standalone copy used by the Telegram bot. Inlines denomination constants to avoid cross-package dependency issues (the scripts package uses starknet v7, while the frontend uses v8).

Both copies implement the same 5 strategy types with identical logic for tier selection, step generation, CSI computation, and narrative template generation.
