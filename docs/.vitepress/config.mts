import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Veil Protocol",
  description: "Confidential Bitcoin Accumulation on Starknet — ZK proofs, AI strategy agent, Telegram bot, gasless withdrawals",
  head: [
    ["link", { rel: "icon", type: "image/svg+xml", href: "/logo.svg" }],
    ["meta", { name: "theme-color", content: "#FF5A00" }],
  ],
  themeConfig: {
    logo: "/logo.svg",
    nav: [
      { text: "Guide", link: "/guide/what-is-veil-protocol" },
      { text: "Technical", link: "/technical/zk-integration" },
      { text: "Telegram Bot", link: "/guide/telegram-bot" },
      { text: "App", link: "https://theveilprotocol.vercel.app/app" },
      {
        text: "Links",
        items: [
          { text: "GitHub", link: "https://github.com/shariqazeem/ghost-sats" },
          { text: "Explorer", link: "https://sepolia.voyager.online/contract/0x4606a71755ae44459a9fc2105945c3fc3d88227169f834bb0d8a4c86b8b0210" },
        ],
      },
    ],
    sidebar: [
      {
        text: "Guide",
        items: [
          { text: "What is Veil Protocol?", link: "/guide/what-is-veil-protocol" },
          { text: "How It Works", link: "/guide/how-it-works" },
          { text: "Privacy Model", link: "/guide/privacy-model" },
          { text: "Getting Started", link: "/guide/getting-started" },
          { text: "Telegram Bot", link: "/guide/telegram-bot" },
          { text: "AI Strategist", link: "/guide/ai-strategist" },
        ],
      },
      {
        text: "Technical",
        items: [
          { text: "ZK Integration", link: "/technical/zk-integration" },
          { text: "Architecture", link: "/technical/architecture" },
          { text: "Smart Contracts", link: "/technical/smart-contracts" },
          { text: "Prover & Relayer", link: "/technical/prover-relayer" },
          { text: "Testing", link: "/technical/testing" },
        ],
      },
      {
        text: "Reference",
        items: [
          { text: "Deployed Contracts", link: "/technical/deployed-contracts" },
        ],
      },
    ],
    socialLinks: [
      { icon: "github", link: "https://github.com/shariqazeem/ghost-sats" },
    ],
    footer: {
      message: "Built for Re{define} Starknet Hackathon 2026",
      copyright: "MIT License",
    },
    search: {
      provider: "local",
    },
  },
});
