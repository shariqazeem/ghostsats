# Telegram Bot

## Veil Strategist

The Veil Strategist Telegram Bot is an AI-powered interface for planning confidential Bitcoin accumulation strategies. No wallet connection is needed -- plan strategies in Telegram, then execute them in the web app via deep links.

The bot is **read-only**. It never holds private keys, signs transactions, or moves funds. It reads on-chain pool state, generates strategy plans, and hands off execution to the web app.

## Setup

### 1. Create a Bot Token

Open Telegram and message [@BotFather](https://t.me/BotFather):

1. Send `/newbot`
2. Choose a name (e.g., "Veil Strategist")
3. Choose a username (e.g., `veil_strategist_bot`)
4. Copy the token BotFather gives you

### 2. Set Environment Variables

Add the following to your `scripts/.env` file:

```bash
# Required: Bot token from @BotFather
TELEGRAM_BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11

# Optional: Frontend URL for deep links (defaults to http://localhost:3000)
WEB_APP_URL=https://theveilprotocol.vercel.app
```

The bot also reads `POOL_ADDRESS` (or loads it from `scripts/deployment.json`) and `STARKNET_RPC_URL` to connect to the ShieldedPool contract.

### 3. Start the Bot

```bash
cd scripts
npm run bot
```

You should see:

```
[bot] Veil Strategist starting...
[bot] Network: sepolia
[bot] Pool: 0x4606a717...
[bot] Web app: https://theveilprotocol.vercel.app
[bot] Veil Strategist is online. Waiting for messages...
```

For development with hot reload, use `npm run bot:dev` (runs via `tsx` instead of `ts-node`).

## Commands

### `/start`

Displays a welcome message with a feature overview and lists all available commands.

### `/strategy <instruction>`

Plans an accumulation strategy from a natural language instruction. The bot parses the target USD amount, fetches live pool state and BTC price, runs the strategy engine, and streams an agent-thinking log before presenting a final plan.

Examples:

```
/strategy DCA $50 over 5 deposits
/strategy maximize privacy with $100
/strategy invest $30 into the strongest anonymity set
/strategy $200 quick and efficient
```

The bot detects strategy type from keywords in your instruction:

| Keywords | Strategy Type |
|----------|--------------|
| privacy, anonymous, stealth, hidden | Privacy-First |
| efficient, fast, quick, cheap | Efficiency |
| dca, spread, split, diversify | Stealth DCA |
| (auto for amounts $500+) | Whale Distribution |
| (default) | Balanced |

### `/status`

Displays live protocol metrics pulled directly from the ShieldedPool contract:

- BTC price (CoinGecko)
- Pending USDC awaiting batch conversion
- Total commitments and batch count
- Anonymity set sizes for each tier ($1 / $10 / $100) with privacy labels
- Confidentiality Strength Index (CSI)
- Network (Sepolia or Mainnet)

### `/pool`

Shows detailed pool analytics, including per-tier anonymity set analysis, active tier count, participant totals, and CSI breakdown with formula explanation. Includes inline keyboard buttons linking to the block explorer and web app.

### `/price`

Fetches the live BTC price from CoinGecko (with CoinCap and Blockchain.info as fallbacks) and shows conversion rates for each deposit tier:

```
BITCOIN PRICE

$97,432 USD

Conversion rates:
  $1   -> 0.00001026 BTC
  $10  -> 0.000103 BTC
  $100 -> 0.001026 BTC

Source: CoinGecko
```

### `/help`

Lists all commands with usage examples.

## Strategy Deep Links

When the bot generates a strategy plan, it creates a **deep link URL** that opens the web app with the strategy pre-loaded in the Strategist tab. The link encodes the strategy parameters as a base64url JSON payload:

```
https://theveilprotocol.vercel.app/app?strategy=eyJpbnB1dCI6IkRDQ...
```

The encoded payload contains:

```json
{
  "input": "DCA $50 over 5 deposits",
  "target": 50,
  "tier": 1,
  "count": 5
}
```

When the web app loads with a `?strategy=` parameter, the Strategist tab automatically activates and populates the input field with the original instruction. The user can then review and execute the strategy with their connected wallet.

The deep link is presented as an inline keyboard button labeled "Execute on Web" alongside a "View Pool" button linking to the block explorer.

## Plain Text Input

The bot also handles plain text messages (without the `/strategy` prefix). If the message contains a parseable dollar amount, it is automatically interpreted as a strategy request and processed identically to the `/strategy` command. Otherwise, the bot responds with a prompt suggesting example usage.

## Architecture

```
Telegram User
     |
     v
grammy Bot Framework
     |
     +--> /strategy --> parseTargetUsdc() --> getPoolState() via RPC
     |                                         |
     |                    +--------------------+
     |                    v
     |              generateAgentLog()    (streaming thinking phases)
     |              generateStrategy()    (structured plan output)
     |                    |
     |                    v
     |              buildDeepLink()  --> base64url-encoded URL
     |                    |
     |                    v
     |              Telegram reply with inline keyboard
     |
     +--> /status, /pool --> getPoolState() --> formatted reply
     |
     +--> /price --> fetchBtcPrice() --> formatted reply
```

Key implementation details:

- **Framework**: [grammY](https://grammy.dev/) (TypeScript Telegram bot framework)
- **On-chain reads**: `starknet.js` RpcProvider + Contract for calling `get_pending_usdc`, `get_batch_count`, `get_leaf_count`, and `get_anonymity_set` view functions
- **Strategy engine**: Shared logic with the frontend via `scripts/strategyEngine.ts` (standalone copy with inlined constants to avoid cross-package dependency issues between starknet v7 and v8)
- **Price feeds**: Triple fallback -- CoinGecko, CoinCap, Blockchain.info (5-second timeout each)
- **No private key required**: The bot only reads contract state and generates plans. It never submits transactions.
- **Progressive message editing**: Strategy analysis streams to the user by editing the Telegram message in batches of 3 log lines with 700ms delays between edits

## Example Conversations

### Privacy-Focused Strategy

```
User: /strategy $100 maximize privacy

Bot:  VEIL STRATEGIST

      [OBSERVE] Parsing intent: "$100 maximize privacy"
      [OBSERVE] Target: $100 USDC -> BTC accumulation
      [OBSERVE] Live BTC: $97,432 (CoinGecko)
      [OBSERVE] Pool state: 12 commitments, 8 active participants
      [OBSERVE] Detected strategy: Privacy-First
      [THINK  ] Evaluating 3 anonymity tiers for Privacy-First optimization...
      [THINK  ] $1 pool: 3 participants -> MODERATE unlinkability
      [THINK  ] $10 pool: 5 participants -> GOOD unlinkability
      [THINK  ] $100 pool: 0 participants -> LOW unlinkability
      [THINK  ] Privacy-first mode: routing all deposits to highest anonymity set.
      [DECIDE ] Strategy: Privacy-First
      [DECIDE ] Plan: 10 deposits = $100 USDC across 1 tier(s)
      [DECIDE ] Estimated yield: 0.001016 BTC (1% slippage buffer)
      [RESULT ] Strategy ready. Awaiting execution authorization.

      STRATEGY READY

      Total: $100 USDC -> 10x $10 deposits
      Est. BTC: 0.001016 (after 1% slippage)
      Privacy: Good (15 participants in $10 pool)
      CSI Impact: 15 -> 45
      Verification: STARK-based ZK proofs
      Settlement: AVNU DEX on Starknet

      [Execute on Web]  [View Pool]
```

### DCA Strategy

```
User: /strategy DCA $50 over 5 deposits

Bot:  VEIL STRATEGIST

      [OBSERVE] Parsing intent: "DCA $50 over 5 deposits"
      [OBSERVE] Target: $50 USDC -> BTC accumulation
      [OBSERVE] Live BTC: $97,432 (CoinGecko)
      [THINK  ] Stealth DCA: randomizing tier selection for cross-pool obfuscation.
      [THINK  ] Extended delays (45-180s) prevent temporal correlation analysis.
      [DECIDE ] Plan: 5 deposits = $50 USDC across 2 tier(s)
      [DECIDE ] Timing: randomized DCA -- relayer executes with 45-180s delays
      [RESULT ] Strategy ready. Awaiting execution authorization.

      STRATEGY READY

      Total: $50 USDC -> 5x deposits (mixed tiers)
      Est. BTC: 0.000508 (after 1% slippage)
      ...

      [Execute on Web]  [View Pool]
```

### Quick Status Check

```
User: /status

Bot:  VEIL PROTOCOL STATUS

      BTC Price:   $97,432
      Pending:     $210.00 USDC
      Commitments: 12
      Batches:     3

      Anonymity Sets:
        $1   pool: 3 participants  [Moderate]
        $10  pool: 5 participants  [Good]
        $100 pool: 0 participants  [Low]

      CSI: 15  |  Participants: 8
      Network: Starknet Sepolia
```
