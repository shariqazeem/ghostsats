import WalletBar from "@/components/WalletBar";
import Dashboard from "@/components/Dashboard";
import TabPanel from "@/components/TabPanel";
import BatchFeed from "@/components/BatchFeed";

export default function Home() {
  return (
    <div className="min-h-screen bg-[var(--bg-secondary)]">
      <WalletBar />
      <main className="max-w-2xl mx-auto px-6 pt-12 pb-20 space-y-12">
        <Dashboard />
        <TabPanel />
        <BatchFeed />
      </main>
      <footer className="text-center pb-8 text-xs text-[var(--text-tertiary)] tracking-wide">
        GhostSats v0.1.0 &middot; Starknet Sepolia
      </footer>
    </div>
  );
}
