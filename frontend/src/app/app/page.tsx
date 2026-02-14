import { Suspense } from "react";
import WalletBar from "@/components/WalletBar";
import Dashboard from "@/components/Dashboard";
import TabPanel from "@/components/TabPanel";
import TransactionHistory from "@/components/TransactionHistory";
import OnboardingBanner from "@/components/OnboardingBanner";

export default function AppPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <WalletBar />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 pt-20 sm:pt-24 pb-16 sm:pb-20 space-y-8 sm:space-y-10">
        <OnboardingBanner />
        <Dashboard />
        <Suspense>
          <TabPanel />
        </Suspense>
        <TransactionHistory />
      </main>
      <footer className="text-center pb-8 sm:pb-10">
        <div className="h-px bg-[var(--border-subtle)] max-w-xs mx-auto mb-6" />
        <div className="flex items-center justify-center gap-4 mb-2">
          {["Built on Starknet", "STARK-Verified ZK Proofs", "Bitcoin-Native Liquidity"].map((item) => (
            <span key={item} className="text-[10px] text-[var(--text-quaternary)] font-medium">
              {item}
            </span>
          ))}
        </div>
        <p className="text-[10px] text-[var(--text-quaternary)]">
          Veil Protocol &middot; Confidential Bitcoin Accumulation Infrastructure
        </p>
      </footer>
    </div>
  );
}
