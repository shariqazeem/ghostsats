import { defineConfig } from "vitepress";

export default defineConfig({
  title: "GhostSats",
  description: "Bitcoin's Privacy Layer on Starknet — ZK proofs, Pedersen commitments, gasless withdrawals",
  head: [
    ["link", { rel: "icon", type: "image/svg+xml", href: "/logo.svg" }],
    ["meta", { name: "theme-color", content: "#FF5A00" }],
  ],
  themeConfig: {
    logo: "/logo.svg",
    nav: [
      { text: "Guide", link: "/guide/what-is-ghostsats" },
      { text: "Technical", link: "/technical/zk-integration" },
      { text: "App", link: "https://ghostsats.vercel.app/app" },
      {
        text: "Links",
        items: [
          { text: "GitHub", link: "https://github.com/shariqazeem/ghostsats" },
          { text: "Explorer", link: "https://sepolia.voyager.online/contract/0x041f449d25b2dfa8fb052ac3ab7ddaf6d92e86beb85e6a535dec7a28b31354ea" },
        ],
      },
    ],
    sidebar: [
      {
        text: "Guide",
        items: [
          { text: "What is GhostSats?", link: "/guide/what-is-ghostsats" },
          { text: "How It Works", link: "/guide/how-it-works" },
          { text: "Privacy Model", link: "/guide/privacy-model" },
          { text: "Getting Started", link: "/guide/getting-started" },
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
      { icon: "github", link: "https://github.com/shariqazeem/ghostsats" },
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
