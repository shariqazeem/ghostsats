"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Shield,
  Eye,
  Layers,
  Lock,
  Users,
  Zap,
  Bitcoin,
  ArrowRight,
  Clock,
  ShieldCheck,
  Fingerprint,
  ExternalLink,
  CheckCircle,
  TrendingUp,
  Building2,
  BarChart3,
  Globe,
} from "lucide-react";
import addresses from "@/contracts/addresses.json";
import { EXPLORER_CONTRACT } from "@/utils/network";

const spring = { type: "spring" as const, stiffness: 400, damping: 30 };

const steps = [
  {
    icon: Shield,
    title: "Deposit",
    desc: "Deposit a fixed USDC denomination into the shielded pool. A Pedersen commitment hides your identity. Your Bitcoin wallet signs the commitment hash on-chain.",
    color: "var(--accent-orange)",
  },
  {
    icon: Layers,
    title: "Batch Swap",
    desc: "All deposits are aggregated into a single USDC-to-WBTC swap via AVNU. Individual accumulation intent is hidden within the batch — no front-running possible.",
    color: "var(--accent-green)",
  },
  {
    icon: Eye,
    title: "Private Claim",
    desc: "Generate a zero-knowledge proof entirely in your browser. Claim WBTC to any address or create a BTC intent for native Bitcoin settlement. No link to the depositor.",
    color: "var(--text-primary)",
  },
];

const features = [
  {
    icon: Building2,
    title: "Institutional Grade",
    desc: "Fixed denominations ($1/$10/$100) create uniform anonymity sets. No amount-based correlation attacks.",
  },
  {
    icon: Lock,
    title: "Front-Run Protection",
    desc: "Individual buy orders are hidden in batch swaps. Market makers cannot extract MEV from your accumulation.",
  },
  {
    icon: Users,
    title: "Anonymity Sets",
    desc: "Your deposit hides among others in the same tier. More participants = exponentially stronger privacy guarantees.",
  },
  {
    icon: TrendingUp,
    title: "Best Execution",
    desc: "Batch swaps via AVNU DEX aggregator ensure optimal routing across all Starknet liquidity sources.",
  },
  {
    icon: Bitcoin,
    title: "Native BTC Settlement",
    desc: "Intent-based Bitcoin bridge: lock WBTC in escrow, a solver sends real BTC, oracle confirms. Trustless.",
  },
  {
    icon: Fingerprint,
    title: "On-Chain ZK Verification",
    desc: "Noir circuits + Garaga verifier. Proofs generated in-browser, verified on-chain. Secrets never leave your device.",
  },
  {
    icon: ShieldCheck,
    title: "Compliance Ready",
    desc: "Optional view keys let treasury teams prove transaction history to auditors without breaking pool privacy.",
  },
  {
    icon: Clock,
    title: "Timing Protection",
    desc: "60-second minimum delay between batch execution and withdrawal blocks deposit-and-immediately-withdraw attacks.",
  },
];

const metrics = [
  { label: "On-Chain ZK Proofs", value: "Garaga", sub: "UltraKeccakZKHonk" },
  { label: "Proof Generation", value: "Browser", sub: "noir_js + bb.js WASM" },
  { label: "Calldata Size", value: "~2,835", sub: "felt252 elements" },
  { label: "Settlement", value: "<1s", sub: "Starknet L2" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] overflow-hidden">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-4 sm:px-6 py-4 sm:py-5 backdrop-blur-md bg-[var(--bg-primary)]/80">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <span className="text-lg font-bold tracking-tight text-[var(--text-primary)]">
            Ghost<span className="text-[var(--accent-orange)]">Sats</span>
          </span>
          <div className="flex items-center gap-4">
            <a
              href="https://ghostsats-docs.vercel.app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[13px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              Docs
            </a>
            <Link href="/app">
              <motion.button
                className="px-5 py-2.5 bg-[var(--accent-orange)] text-white rounded-full text-[13px] font-semibold tracking-tight cursor-pointer flex items-center gap-2"
                whileHover={{ y: -1, boxShadow: "0 0 30px -5px rgba(255, 90, 0, 0.3)" }}
                whileTap={{ scale: 0.97 }}
                transition={spring}
              >
                Launch App
                <ArrowRight size={14} strokeWidth={2} />
              </motion.button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 sm:pt-44 pb-20 sm:pb-32 px-4 sm:px-6">
        {/* Gradient orbs */}
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full opacity-15 pointer-events-none"
          style={{
            background: "radial-gradient(circle, rgba(255,90,0,0.4) 0%, rgba(255,90,0,0) 70%)",
          }}
        />
        <div className="absolute top-40 left-1/4 w-[300px] h-[300px] rounded-full opacity-10 pointer-events-none"
          style={{
            background: "radial-gradient(circle, rgba(16,185,129,0.3) 0%, transparent 70%)",
          }}
        />

        <div className="max-w-3xl mx-auto text-center relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
          >
            <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-subtle)] mb-6">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-green)] animate-pulse-dot" />
                <span className="text-[11px] text-[var(--text-secondary)] font-medium">Live on Starknet</span>
              </span>
              <span className="w-px h-3 bg-[var(--border-subtle)]" />
              <span className="inline-flex items-center gap-1.5">
                <Fingerprint size={10} strokeWidth={2} className="text-emerald-400" />
                <span className="text-[11px] text-emerald-400 font-medium">ZK Verified On-Chain</span>
              </span>
              <span className="w-px h-3 bg-[var(--border-subtle)]" />
              <span className="inline-flex items-center gap-1.5">
                <Bitcoin size={10} strokeWidth={2} className="text-[var(--accent-orange)]" />
                <span className="text-[11px] text-[var(--accent-orange)] font-medium">BTC Settlement</span>
              </span>
            </div>
          </motion.div>

          <motion.h1
            className="text-[32px] sm:text-[56px] font-black tracking-tight text-[var(--text-primary)] leading-[1.08] mb-5"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.4, 0, 0.2, 1] }}
          >
            Private Bitcoin
            <br />
            <span className="text-[var(--accent-orange)]">Accumulation Protocol</span>
          </motion.h1>

          <motion.p
            className="text-[15px] sm:text-[18px] text-[var(--text-secondary)] max-w-xl mx-auto mb-8 leading-relaxed"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.4, 0, 0.2, 1] }}
          >
            Accumulate BTC without revealing your position. Deposit stablecoins into a shielded pool, batch-swap to WBTC at market rates, and withdraw privately with zero-knowledge proofs verified on-chain.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3"
          >
            <Link href="/app">
              <motion.button
                className="px-8 py-4 bg-[var(--accent-orange)] text-white rounded-2xl text-[15px] font-semibold tracking-tight cursor-pointer flex items-center gap-2"
                whileHover={{ y: -2, boxShadow: "0 0 40px -5px rgba(255, 90, 0, 0.35)" }}
                whileTap={{ scale: 0.97 }}
                transition={spring}
              >
                <Shield size={16} strokeWidth={1.5} />
                Start Accumulating
              </motion.button>
            </Link>
            <a
              href="https://github.com/shariqazeem/ghostsats"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-4 text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-[15px] font-medium transition-colors"
            >
              View Source
            </a>
          </motion.div>
        </div>
      </section>

      {/* The Problem */}
      <section className="px-4 sm:px-6 pb-20 sm:pb-28">
        <div className="max-w-4xl mx-auto">
          <motion.div
            className="glass-card p-6 sm:p-10 relative overflow-hidden"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="absolute top-0 right-0 w-80 h-80 rounded-full opacity-[0.04] pointer-events-none"
              style={{ background: "radial-gradient(circle, #EF4444 0%, transparent 70%)" }}
            />
            <div className="flex items-center gap-2 mb-6">
              <BarChart3 size={16} strokeWidth={1.5} className="text-red-400" />
              <h2 className="text-[15px] font-bold text-[var(--text-primary)]">The Problem</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {[
                {
                  title: "Front-Running",
                  desc: "On-chain buy orders are visible in the mempool. Bots sandwich your trades, extracting value before execution.",
                },
                {
                  title: "Position Leakage",
                  desc: "Every deposit and swap is public. Competitors, analysts, and adversaries can track your accumulation strategy in real-time.",
                },
                {
                  title: "Amount Correlation",
                  desc: "Unique transaction amounts create fingerprints. Even across wallets, your accumulation pattern can be reconstructed.",
                },
              ].map((item, i) => (
                <div key={item.title}>
                  <div className="text-[11px] font-[family-name:var(--font-geist-mono)] text-red-400/50 mb-1">0{i + 1}</div>
                  <h3 className="text-[13px] font-semibold text-[var(--text-primary)] mb-1.5">{item.title}</h3>
                  <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* How It Works */}
      <section className="px-4 sm:px-6 pb-20 sm:pb-32">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">
              How It Works
            </span>
            <h2 className="text-[20px] sm:text-[28px] font-black tracking-tight text-[var(--text-primary)] mt-3">
              Three Steps to Private Accumulation
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {steps.map((step, i) => (
              <motion.div
                key={step.title}
                className="glass-card p-6 text-center relative"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.15 }}
              >
                {/* Step connector line */}
                {i < 2 && (
                  <div className="hidden sm:block absolute top-1/2 -right-3 w-6 h-px bg-[var(--border-subtle)]" />
                )}
                <div className="w-12 h-12 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                  style={{ background: `${step.color}15`, border: `1px solid ${step.color}20` }}>
                  <step.icon size={20} strokeWidth={1.5} style={{ color: step.color }} />
                </div>
                <div className="flex items-center justify-center gap-2 mb-2">
                  <span className="text-[11px] font-[family-name:var(--font-geist-mono)] text-[var(--text-tertiary)] font-tabular">
                    0{i + 1}
                  </span>
                  <h3 className="text-[15px] font-bold text-[var(--text-primary)]">
                    {step.title}
                  </h3>
                </div>
                <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed">
                  {step.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Key Metrics Bar */}
      <section className="px-4 sm:px-6 pb-20 sm:pb-28">
        <div className="max-w-4xl mx-auto">
          <div className="glass-card p-6 sm:p-8">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
              {metrics.map((m, i) => (
                <motion.div
                  key={m.label}
                  className="text-center"
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                >
                  <div className="text-[22px] sm:text-[28px] font-[family-name:var(--font-geist-mono)] font-bold text-[var(--text-primary)] font-tabular tracking-tight">
                    {m.value}
                  </div>
                  <div className="text-[11px] font-semibold text-[var(--text-secondary)] mt-0.5">{m.label}</div>
                  <div className="text-[10px] text-[var(--text-tertiary)]">{m.sub}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Privacy Guarantees */}
      <section className="px-4 sm:px-6 pb-20 sm:pb-32">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">
              Privacy Architecture
            </span>
            <h2 className="text-[20px] sm:text-[28px] font-black tracking-tight text-[var(--text-primary)] mt-3">
              Why Institutions Choose GhostSats
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map((feat, i) => (
              <motion.div
                key={feat.title}
                className="p-5 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] hover:border-[var(--border-medium)] transition-colors"
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.06 }}
              >
                <feat.icon size={16} strokeWidth={1.5} className="text-[var(--accent-orange)] mb-3" />
                <h4 className="text-[13px] font-semibold text-[var(--text-primary)] mb-1">
                  {feat.title}
                </h4>
                <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                  {feat.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Verified On-Chain */}
      <section className="px-4 sm:px-6 pb-20 sm:pb-32">
        <div className="max-w-4xl mx-auto">
          <motion.div
            className="glass-card p-6 sm:p-8 relative overflow-hidden"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="absolute top-0 left-0 w-64 h-64 rounded-full opacity-[0.04] pointer-events-none"
              style={{ background: "radial-gradient(circle, #10B981 0%, transparent 70%)" }}
            />

            <div className="flex items-center gap-2 mb-5">
              <Fingerprint size={16} strokeWidth={1.5} className="text-emerald-400" />
              <h3 className="text-[15px] font-bold text-[var(--text-primary)]">
                Real ZK Proof Verification
              </h3>
              <span className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-950/30 border border-emerald-800/30 text-[10px] font-medium text-emerald-400">
                <CheckCircle size={10} strokeWidth={2} />
                E2E Verified
              </span>
            </div>

            {/* ZK Pipeline */}
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 sm:gap-0 mb-6">
              {[
                { label: "Noir Circuit", sub: "Poseidon BN254", icon: "01" },
                { label: "noir_js WASM", sub: "Witness (browser)", icon: "02" },
                { label: "bb.js WASM", sub: "Proof (browser)", icon: "03" },
                { label: "garaga calldata", sub: "2835 felt252 values", icon: "04" },
                { label: "On-Chain Verify", sub: "Garaga Verifier", icon: "05" },
              ].map((step, i) => (
                <div key={step.label} className="flex items-center">
                  <div className="flex-1 rounded-lg bg-emerald-950/20 border border-emerald-800/20 p-2.5 text-center">
                    <div className="text-[9px] font-[family-name:var(--font-geist-mono)] text-emerald-400/40 mb-0.5">{step.icon}</div>
                    <div className="text-[10px] sm:text-[11px] font-semibold text-emerald-400">{step.label}</div>
                    <div className="text-[9px] text-emerald-400/50">{step.sub}</div>
                  </div>
                  {i < 4 && (
                    <span className="hidden sm:block text-[var(--text-quaternary)] text-[10px] px-1 flex-shrink-0">&rarr;</span>
                  )}
                </div>
              ))}
            </div>

            <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed mb-5">
              Not a mock. Not off-chain. Proofs are generated <strong>entirely in your browser</strong> using noir_js + bb.js WASM.
              Secrets never leave the browser — not in calldata, not to any server. The Garaga verifier validates
              each proof on-chain (~2835 felt252 calldata elements). Verify it yourself:
            </p>

            {/* Contract Links */}
            <div className="flex flex-wrap gap-2">
              <a
                href={`${EXPLORER_CONTRACT}${addresses.contracts.shieldedPool}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] transition-colors text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                <Shield size={12} strokeWidth={1.5} />
                ShieldedPool on Starkscan
                <ExternalLink size={10} strokeWidth={2} className="opacity-50" />
              </a>
              <a
                href={`${EXPLORER_CONTRACT}${(addresses.contracts as Record<string, string>).garagaVerifier ?? ""}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-950/20 hover:bg-emerald-950/30 border border-emerald-800/20 transition-colors text-[11px] font-medium text-emerald-400"
              >
                <Fingerprint size={12} strokeWidth={1.5} />
                Garaga ZK Verifier on Starkscan
                <ExternalLink size={10} strokeWidth={2} className="opacity-50" />
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Architecture Diagram */}
      <section className="px-4 sm:px-6 pb-20 sm:pb-32">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">
              Architecture
            </span>
          </div>
          <motion.div
            className="glass-card p-6 sm:p-8"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Layer 1: User */}
              <div className="rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-4">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--accent-orange)] mb-3">Client Layer</div>
                <div className="space-y-2">
                  {["Next.js Frontend", "noir_js Witness Gen", "bb.js Proof Gen", "Starknet + BTC Wallets"].map((item) => (
                    <div key={item} className="flex items-center gap-2">
                      <span className="w-1 h-1 rounded-full bg-[var(--accent-orange)]" />
                      <span className="text-[11px] text-[var(--text-secondary)]">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
              {/* Layer 2: Protocol */}
              <div className="rounded-xl bg-[var(--bg-secondary)] border border-emerald-800/20 p-4">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400 mb-3">Protocol Layer</div>
                <div className="space-y-2">
                  {["ShieldedPool (Cairo)", "Garaga ZK Verifier", "Merkle Tree (depth 20)", "Intent Escrow System"].map((item) => (
                    <div key={item} className="flex items-center gap-2">
                      <span className="w-1 h-1 rounded-full bg-emerald-400" />
                      <span className="text-[11px] text-[var(--text-secondary)]">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
              {/* Layer 3: Settlement */}
              <div className="rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-4">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-3">Settlement Layer</div>
                <div className="space-y-2">
                  {["AVNU DEX Aggregator", "Starknet L2 (sub-$0.01)", "Bitcoin L1 (intent bridge)", "Oracle Confirmation"].map((item) => (
                    <div key={item} className="flex items-center gap-2">
                      <span className="w-1 h-1 rounded-full bg-[var(--text-tertiary)]" />
                      <span className="text-[11px] text-[var(--text-secondary)]">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Tech Stack Bar */}
      <section className="px-4 sm:px-6 pb-20 sm:pb-32">
        <div className="max-w-4xl mx-auto">
          <div className="glass-card p-6 sm:p-8">
            <div className="text-center mb-6">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">
                Built With
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
              {[
                "Cairo 2.15",
                "Starknet",
                "Noir ZK",
                "Garaga",
                "Barretenberg",
                "Pedersen Hash",
                "Poseidon BN254",
                "Merkle Trees",
                "AVNU DEX",
                "Next.js 16",
                "sats-connect",
                "snforge",
              ].map((tech) => (
                <span
                  key={tech}
                  className="text-[12px] font-[family-name:var(--font-geist-mono)] text-[var(--text-secondary)] px-3 py-1.5 rounded-lg bg-[var(--bg-tertiary)]"
                >
                  {tech}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 sm:px-6 pb-20 sm:pb-32">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-[24px] sm:text-[32px] font-black tracking-tight text-[var(--text-primary)] mb-4">
            Start Accumulating Privately.
          </h2>
          <p className="text-[14px] text-[var(--text-secondary)] mb-8 max-w-lg mx-auto">
            Every deposit strengthens the anonymity set for all participants. The protocol is non-custodial, verifiable, and live on Starknet.
          </p>
          <Link href="/app">
            <motion.button
              className="px-8 py-4 bg-[var(--accent-orange)] text-white rounded-2xl text-[15px] font-semibold tracking-tight cursor-pointer flex items-center gap-2 mx-auto"
              whileHover={{ y: -2, boxShadow: "0 0 40px -5px rgba(255, 90, 0, 0.35)" }}
              whileTap={{ scale: 0.97 }}
              transition={spring}
            >
              <Shield size={16} strokeWidth={1.5} />
              Launch App
              <ArrowRight size={14} strokeWidth={2} />
            </motion.button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center pb-10 px-4">
        <div className="h-px bg-[var(--border-subtle)] max-w-lg mx-auto mb-8" />
        <p className="text-[11px] text-[var(--text-tertiary)] tracking-widest uppercase">
          GhostSats &middot; Private Bitcoin Accumulation Protocol
        </p>
        <p className="text-[10px] text-[var(--text-quaternary)] mt-1">
          Re&#123;define&#125; Hackathon 2026 &middot; ZK Proofs &middot; Starknet &middot; Bitcoin
        </p>
      </footer>
    </div>
  );
}
