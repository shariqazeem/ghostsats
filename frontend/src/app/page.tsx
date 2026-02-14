"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Shield,
  Eye,
  Layers,
  Lock,
  Zap,
  Bitcoin,
  ArrowRight,
  ShieldCheck,
  Fingerprint,
  ExternalLink,
  CheckCircle,
  TrendingUp,
  Building2,
  BarChart3,
  Server,
} from "lucide-react";
import addresses from "@/contracts/addresses.json";
import { EXPLORER_CONTRACT } from "@/utils/network";

const spring = { type: "spring" as const, stiffness: 400, damping: 30 };

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white overflow-hidden">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-4 sm:px-6 py-4 sm:py-5 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <span className="text-lg font-bold tracking-tight text-gray-900">
            Veil<span className="text-[#FF5A00]"> Protocol</span>
          </span>
          <div className="flex items-center gap-4">
            <a
              href="https://theveilprotocol-docs.vercel.app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[13px] font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
              Docs
            </a>
            <Link href="/app">
              <motion.button
                className="px-5 py-2.5 bg-[#FF5A00] text-white rounded-full text-[13px] font-semibold tracking-tight cursor-pointer flex items-center gap-2"
                whileHover={{ y: -1, boxShadow: "0 0 30px -5px rgba(255, 90, 0, 0.3)" }}
                whileTap={{ scale: 0.97 }}
                transition={spring}
              >
                Open Terminal
                <ArrowRight size={14} strokeWidth={2} />
              </motion.button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 sm:pt-44 pb-20 sm:pb-28 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
          >
            <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-gray-50 border border-gray-200 mb-6">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse-dot" />
                <span className="text-xs text-gray-600 font-medium">Live on Starknet</span>
              </span>
              <span className="w-px h-3 bg-gray-200" />
              <span className="inline-flex items-center gap-1.5">
                <Fingerprint size={10} strokeWidth={2} className="text-emerald-600" />
                <span className="text-xs text-emerald-600 font-medium">STARK-Verified</span>
              </span>
              <span className="w-px h-3 bg-gray-200" />
              <span className="inline-flex items-center gap-1.5">
                <Bitcoin size={10} strokeWidth={2} className="text-[#FF5A00]" />
                <span className="text-xs text-[#FF5A00] font-medium">BTC Settlement</span>
              </span>
            </div>
          </motion.div>

          <motion.h1
            className="text-[32px] sm:text-[56px] font-black tracking-tight text-gray-900 leading-[1.08] mb-5"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.4, 0, 0.2, 1] }}
          >
            Confidential Bitcoin
            <br />
            <span className="text-[#FF5A00]">Accumulation Infrastructure</span>
          </motion.h1>

          <motion.p
            className="text-[15px] sm:text-[18px] text-gray-600 max-w-xl mx-auto mb-4 leading-relaxed"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.4, 0, 0.2, 1] }}
          >
            Treasury-grade Bitcoin exposure layer built on Starknet&apos;s quantum-secure STARK proofs. Allocate capital confidentially. Exit without trace.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mb-8"
          >
            <span className="text-[12px] text-gray-400">No public order book exposure</span>
            <span className="w-1 h-1 rounded-full bg-gray-200" />
            <span className="text-[12px] text-gray-400">No on-chain position signaling</span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3"
          >
            <Link href="/app">
              <motion.button
                className="px-8 py-4 bg-[#FF5A00] text-white rounded-2xl text-[15px] font-semibold tracking-tight cursor-pointer flex items-center gap-2"
                whileHover={{ y: -2, boxShadow: "0 0 40px -5px rgba(255, 90, 0, 0.35)" }}
                whileTap={{ scale: 0.97 }}
                transition={spring}
              >
                <Shield size={16} strokeWidth={1.5} />
                Open Terminal
              </motion.button>
            </Link>
            <a
              href="https://github.com/shariqazeem/veil-protocol"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-4 text-gray-600 hover:text-gray-900 text-[15px] font-medium transition-colors"
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
            className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 sm:p-10 relative overflow-hidden"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="flex items-center gap-2 mb-6">
              <BarChart3 size={16} strokeWidth={1.5} className="text-red-400" />
              <h2 className="text-[15px] font-bold text-gray-900">The Problem</h2>
            </div>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-6">
              Public Bitcoin accumulation exposes treasury strategy. Every on-chain purchase signals intent to the market.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {[
                {
                  title: "Strategy Leakage",
                  desc: "On-chain buy orders reveal accumulation intent. Competitors front-run positions. Analysts reconstruct your strategy in real-time.",
                },
                {
                  title: "Position Correlation",
                  desc: "Unique transaction amounts create fingerprints. Even across wallets, accumulation patterns are reconstructable through amount analysis.",
                },
                {
                  title: "MEV Extraction",
                  desc: "Visible orders in the mempool enable sandwich attacks. Market makers extract value before your execution settles.",
                },
              ].map((item, i) => (
                <div key={item.title}>
                  <div className="text-xs font-[family-name:var(--font-geist-mono)] text-red-400/50 mb-1">0{i + 1}</div>
                  <h3 className="text-[13px] font-semibold text-gray-900 mb-1.5">{item.title}</h3>
                  <p className="text-xs text-gray-600 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Solution */}
      <section className="px-4 sm:px-6 pb-20 sm:pb-28">
        <div className="max-w-4xl mx-auto">
          <motion.div
            className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 sm:p-10 relative overflow-hidden"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="flex items-center gap-2 mb-6">
              <Shield size={16} strokeWidth={1.5} className="text-emerald-600" />
              <h2 className="text-[15px] font-bold text-gray-900">The Solution</h2>
            </div>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-4">
              Confidential tranche-based accumulation using STARK proofs. Capital enters standardized privacy pools. Batch execution hides individual intent. Zero-knowledge proofs enable unlinkable exits.
            </p>
            <p className="text-[12px] text-gray-400 leading-relaxed">
              Built natively on Starknet&apos;s Cairo VM with Garaga on-chain ZK verification. No trusted setup. No off-chain dependencies for proof validity. The first treasury-grade Bitcoin accumulation layer built on quantum-secure STARK infrastructure.
            </p>
          </motion.div>
        </div>
      </section>

      {/* How It Works */}
      <section className="px-4 sm:px-6 pb-20 sm:pb-32">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-xs font-semibold text-gray-500">
              Protocol Flow
            </span>
            <h2 className="text-[20px] sm:text-[28px] font-black tracking-tight text-gray-900 mt-3">
              Four Phases of Confidential Accumulation
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            {[
              {
                icon: Shield,
                title: "Allocate",
                desc: "Deposit USDC into standardized tranches ($1/$10/$100). A Pedersen commitment conceals your identity. Optional Bitcoin wallet attestation.",
                color: "#FF5A00",
              },
              {
                icon: Layers,
                title: "Batch Execute",
                desc: "All deposits aggregate into a single USDC-to-BTC conversion via AVNU. Individual intent is hidden within the batch.",
                color: "#10B981",
              },
              {
                icon: Fingerprint,
                title: "Verify",
                desc: "Zero-knowledge proof generated entirely in-browser via Noir circuits. Garaga verifier validates on-chain. Secrets never leave your device.",
                color: "#10B981",
              },
              {
                icon: Eye,
                title: "Exit",
                desc: "Claim BTC on Starknet or settle to native Bitcoin via intent bridge. No cryptographic link to the original allocation.",
                color: "#18181B",
              },
            ].map((step, i) => (
              <motion.div
                key={step.title}
                className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 text-center relative"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.1 }}
              >
                <div className="w-10 h-10 rounded-xl mx-auto mb-3 flex items-center justify-center"
                  style={{ background: `${step.color}15`, border: `1px solid ${step.color}20` }}>
                  <step.icon size={18} strokeWidth={1.5} style={{ color: step.color }} />
                </div>
                <div className="flex items-center justify-center gap-2 mb-2">
                  <span className="text-xs font-[family-name:var(--font-geist-mono)] text-gray-400 font-tabular">
                    0{i + 1}
                  </span>
                  <h3 className="text-[14px] font-bold text-gray-900">
                    {step.title}
                  </h3>
                </div>
                <p className="text-xs text-gray-600 leading-relaxed">
                  {step.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Starknet */}
      <section className="px-4 sm:px-6 pb-20 sm:pb-28">
        <div className="max-w-4xl mx-auto">
          <motion.div
            className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 sm:p-10 relative overflow-hidden"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="flex items-center gap-2 mb-6">
              <Server size={16} strokeWidth={1.5} className="text-[#FF5A00]" />
              <h2 className="text-[15px] font-bold text-gray-900">Why Starknet</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {[
                {
                  title: "Quantum-Secure STARKs",
                  desc: "STARK proofs require no trusted setup and are resistant to quantum computing attacks. Future-proof cryptographic guarantees for institutional capital.",
                },
                {
                  title: "Cairo-Native Implementation",
                  desc: "Entire protocol built in Cairo. Pedersen commitments, Merkle trees, and batch execution run natively on the Starknet VM. No EVM compatibility overhead.",
                },
                {
                  title: "Bitcoin DeFi Layer",
                  desc: "Sub-$0.01 transaction costs enable batch execution economics. Account abstraction enables gasless withdrawals. AVNU aggregation ensures best execution.",
                },
              ].map((item, i) => (
                <div key={item.title}>
                  <div className="text-xs font-[family-name:var(--font-geist-mono)] text-[#FF5A00]/50 mb-1">0{i + 1}</div>
                  <h3 className="text-[13px] font-semibold text-gray-900 mb-1.5">{item.title}</h3>
                  <p className="text-xs text-gray-600 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Technical Architecture */}
      <section className="px-4 sm:px-6 pb-20 sm:pb-28">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <span className="text-xs font-semibold text-gray-500">
              Technical Architecture
            </span>
          </div>
          <motion.div
            className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 sm:p-8"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="rounded-xl bg-gray-50 border border-gray-200 p-4">
                <div className="text-xs font-semibold text-[#FF5A00] mb-3">Client</div>
                <div className="space-y-2">
                  {["noir_js witness generation", "bb.js proof generation", "Poseidon BN254 commitments", "Starknet + BTC wallets"].map((item) => (
                    <div key={item} className="flex items-center gap-2">
                      <span className="w-1 h-1 rounded-full bg-[#FF5A00]" />
                      <span className="text-xs text-gray-600">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl bg-gray-50 border border-emerald-200 p-4">
                <div className="text-xs font-semibold text-emerald-600 mb-3">On-Chain (Cairo)</div>
                <div className="space-y-2">
                  {["Pedersen commitment scheme", "Garaga UltraKeccakZKHonk verifier", "Merkle tree (depth 20)", "Intent escrow + oracle settlement"].map((item) => (
                    <div key={item} className="flex items-center gap-2">
                      <span className="w-1 h-1 rounded-full bg-emerald-600" />
                      <span className="text-xs text-gray-600">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl bg-gray-50 border border-gray-200 p-4">
                <div className="text-xs font-semibold text-gray-600 mb-3">Infrastructure</div>
                <div className="space-y-2">
                  {["AVNU DEX aggregation", "Gasless relayer abstraction", "Compliance view keys", "Bitcoin intent bridge"].map((item) => (
                    <div key={item} className="flex items-center gap-2">
                      <span className="w-1 h-1 rounded-full bg-gray-400" />
                      <span className="text-xs text-gray-600">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ZK Pipeline */}
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4">
              <div className="flex items-center gap-1.5 mb-3">
                <Fingerprint size={12} strokeWidth={1.5} className="text-emerald-600" />
                <span className="text-xs font-semibold text-emerald-600">ZK Proof Pipeline</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {[
                  { label: "Noir Circuit", sub: "Poseidon BN254" },
                  { label: "noir_js", sub: "Witness (browser)" },
                  { label: "bb.js", sub: "Proof (browser)" },
                  { label: "Garaga", sub: "~2835 felt252" },
                  { label: "On-Chain", sub: "STARK verified" },
                ].map((step, i) => (
                  <div key={step.label} className="flex items-center">
                    <div className="flex-1 rounded-lg bg-emerald-50 border border-emerald-200 p-2 text-center">
                      <div className="text-xs font-semibold text-emerald-600">{step.label}</div>
                      <div className="text-[11px] text-emerald-600/50">{step.sub}</div>
                    </div>
                    {i < 4 && (
                      <span className="hidden sm:block text-gray-300 text-xs px-1 flex-shrink-0">&rarr;</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Privacy Guarantees */}
      <section className="px-4 sm:px-6 pb-20 sm:pb-28">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-xs font-semibold text-gray-500">
              Security Properties
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                icon: Building2,
                title: "Standardized Tranches",
                desc: "Fixed denominations create uniform anonymity sets. No amount-based correlation attacks.",
              },
              {
                icon: Lock,
                title: "MEV Protection",
                desc: "Individual orders hidden in batch execution. No front-running or sandwich extraction.",
              },
              {
                icon: ShieldCheck,
                title: "Compliance Ready",
                desc: "Optional view keys prove transaction history to auditors without breaking pool confidentiality.",
              },
              {
                icon: TrendingUp,
                title: "Best Execution",
                desc: "AVNU DEX aggregation across all Starknet liquidity sources. Optimal routing guaranteed.",
              },
              {
                icon: Bitcoin,
                title: "Native BTC Settlement",
                desc: "Intent-based Bitcoin bridge. Lock, solve, confirm. Trustless cross-chain settlement.",
              },
              {
                icon: Fingerprint,
                title: "On-Chain Verification",
                desc: "Noir circuits + Garaga verifier. Browser-generated proofs validated on-chain. No trusted server.",
              },
              {
                icon: Zap,
                title: "Gasless Withdrawal",
                desc: "Relayer-abstracted exits. No gas token required. Maximum operational privacy.",
              },
              {
                icon: Eye,
                title: "Timing Protection",
                desc: "Mandatory delay between batch and withdrawal prevents deposit-exit correlation attacks.",
              },
            ].map((feat, i) => (
              <motion.div
                key={feat.title}
                className="p-5 rounded-2xl bg-gray-50 border border-gray-200 hover:border-gray-300 transition-colors"
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.06 }}
              >
                <feat.icon size={16} strokeWidth={1.5} className="text-[#FF5A00] mb-3" />
                <h4 className="text-[13px] font-semibold text-gray-900 mb-1">
                  {feat.title}
                </h4>
                <p className="text-xs text-gray-600 leading-relaxed">
                  {feat.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Verified On-Chain */}
      <section className="px-4 sm:px-6 pb-20 sm:pb-28">
        <div className="max-w-4xl mx-auto">
          <motion.div
            className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 sm:p-8 relative overflow-hidden"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="flex items-center gap-2 mb-5">
              <Fingerprint size={16} strokeWidth={1.5} className="text-emerald-600" />
              <h3 className="text-[15px] font-bold text-gray-900">
                Verified On-Chain
              </h3>
              <span className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-600">
                <CheckCircle size={10} strokeWidth={2} />
                E2E Verified
              </span>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed mb-5">
              Proofs generated in-browser using noir_js + bb.js WASM. Secrets never leave your device.
              The Garaga verifier validates each UltraKeccakZKHonk proof on-chain. Verify the contracts:
            </p>

            <div className="flex flex-wrap gap-2">
              <a
                href={`${EXPLORER_CONTRACT}${addresses.contracts.shieldedPool}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 border border-gray-200 transition-colors text-xs font-medium text-gray-600 hover:text-gray-900"
              >
                <Shield size={12} strokeWidth={1.5} />
                Pool Contract
                <ExternalLink size={10} strokeWidth={2} className="opacity-50" />
              </a>
              <a
                href={`${EXPLORER_CONTRACT}${(addresses.contracts as Record<string, string>).garagaVerifier ?? ""}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors text-xs font-medium text-emerald-600"
              >
                <Fingerprint size={12} strokeWidth={1.5} />
                Garaga ZK Verifier
                <ExternalLink size={10} strokeWidth={2} className="opacity-50" />
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Tech Stack */}
      <section className="px-4 sm:px-6 pb-20 sm:pb-28">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 sm:p-8">
            <div className="text-center mb-6">
              <span className="text-xs font-semibold text-gray-500">
                Technology Stack
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
                "Next.js",
                "sats-connect",
                "snforge",
              ].map((tech) => (
                <span
                  key={tech}
                  className="text-[12px] font-[family-name:var(--font-geist-mono)] text-gray-700 px-3 py-1.5 rounded-lg bg-gray-100"
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
          <h2 className="text-[24px] sm:text-[32px] font-black tracking-tight text-gray-900 mb-4">
            Privacy is an institutional priority.
          </h2>
          <p className="text-[14px] text-gray-600 mb-8 max-w-lg mx-auto">
            Starknet is the Bitcoin DeFi layer. This is treasury-grade infrastructure.
          </p>
          <Link href="/app">
            <motion.button
              className="px-8 py-4 bg-[#FF5A00] text-white rounded-2xl text-[15px] font-semibold tracking-tight cursor-pointer flex items-center gap-2 mx-auto"
              whileHover={{ y: -2, boxShadow: "0 0 40px -5px rgba(255, 90, 0, 0.35)" }}
              whileTap={{ scale: 0.97 }}
              transition={spring}
            >
              <Shield size={16} strokeWidth={1.5} />
              Open Terminal
              <ArrowRight size={14} strokeWidth={2} />
            </motion.button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center pb-10 px-4">
        <div className="h-px bg-gray-200 max-w-lg mx-auto mb-8" />
        <div className="flex items-center justify-center gap-4 mb-2">
          {["Built on Starknet", "STARK-Verified ZK Proofs", "Bitcoin-Native Liquidity"].map((item) => (
            <span key={item} className="text-xs text-gray-400 font-medium">
              {item}
            </span>
          ))}
        </div>
        <p className="text-xs text-gray-400">
          Veil Protocol &middot; Confidential Bitcoin Accumulation Infrastructure
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Re&#123;define&#125; Hackathon 2026 &middot; Privacy + Bitcoin
        </p>
      </footer>
    </div>
  );
}
