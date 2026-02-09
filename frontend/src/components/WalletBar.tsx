"use client";

import { useAccount, useConnect, useDisconnect } from "@starknet-react/core";
import { useWallet } from "@/context/WalletContext";
import { useEffect, useState, useRef } from "react";
import { Shield, Bitcoin, ChevronDown, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

function truncateAddress(addr: string, chars = 4): string {
  if (addr.length <= chars * 2 + 2) return addr;
  return `${addr.slice(0, chars + 2)}...${addr.slice(-chars)}`;
}

const spring = { type: "spring" as const, stiffness: 400, damping: 30 };

export default function WalletBar() {
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { address, isConnected } = useAccount();
  const { starknetAddress, bitcoinAddress, setStarknetAddress, setBitcoinAddress } = useWallet();
  const [open, setOpen] = useState(false);
  const [btcLoading, setBtcLoading] = useState(false);
  const [btcError, setBtcError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setStarknetAddress(isConnected && address ? address : null);
  }, [address, isConnected, setStarknetAddress]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function connectBitcoin() {
    setBtcLoading(true);
    setBtcError(null);
    try {
      const satsConnect = await import("sats-connect");
      const getAddress = satsConnect.getAddress;
      const AddressPurpose = satsConnect.AddressPurpose;
      const BitcoinNetworkType = satsConnect.BitcoinNetworkType;

      await getAddress({
        payload: {
          purposes: [AddressPurpose.Payment],
          message: "GhostSats: Verify your Bitcoin identity",
          network: { type: BitcoinNetworkType.Testnet4 },
        },
        onFinish: (response: { addresses: Array<{ purpose: string; address: string }> }) => {
          const paymentAddr = response.addresses.find(
            (a: { purpose: string }) => a.purpose === AddressPurpose.Payment
          );
          if (paymentAddr) {
            setBitcoinAddress(paymentAddr.address);
          }
        },
        onCancel: () => {
          setBtcLoading(false);
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes("no bitcoin wallet")) {
        setBtcError("Install Xverse or another Bitcoin wallet extension");
      } else {
        setBtcError(msg);
      }
    }
    setBtcLoading(false);
  }

  const hasAny = !!starknetAddress || !!bitcoinAddress;
  const bothConnected = !!starknetAddress && !!bitcoinAddress;

  return (
    <header className="w-full px-6 py-4">
      <div className="max-w-2xl mx-auto flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <span className="text-xl font-[family-name:var(--font-geist-sans)] font-extrabold tracking-tight text-[var(--text-primary)]">
            Ghost<span className="text-[var(--accent-orange)]">Sats</span>
          </span>
        </div>

        {/* Identity Pill */}
        <div ref={ref} className="relative">
          <motion.button
            onClick={() => setOpen(!open)}
            className="flex items-center gap-2.5 px-4 py-2 bg-white rounded-full shadow-[var(--shadow-ambient)] hover:shadow-[var(--shadow-elevated)] transition-shadow cursor-pointer"
            whileTap={{ scale: 0.97 }}
            transition={spring}
          >
            <span className={`w-2 h-2 rounded-full ${
              bothConnected
                ? "bg-emerald-500 animate-pulse-dot"
                : hasAny
                  ? "bg-[var(--accent-orange)] animate-pulse-dot"
                  : "bg-gray-300"
            }`} />

            {hasAny ? (
              <span className="text-sm font-medium text-[var(--text-primary)]">
                {starknetAddress ? truncateAddress(starknetAddress) : truncateAddress(bitcoinAddress!)}
              </span>
            ) : (
              <span className="text-sm font-medium text-[var(--text-secondary)]">
                Connect
              </span>
            )}
            <ChevronDown size={14} className="text-[var(--text-tertiary)]" />
          </motion.button>

          {/* Dropdown Modal */}
          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                transition={spring}
                className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-[var(--shadow-elevated)] p-5 z-50"
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                    Wallets
                  </span>
                  <button onClick={() => setOpen(false)} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer">
                    <X size={14} />
                  </button>
                </div>

                {/* Starknet */}
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield size={14} className="text-[var(--accent-vault)]" />
                    <span className="text-xs font-medium text-[var(--text-secondary)]">Starknet Vault</span>
                    {starknetAddress && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse-dot" />
                    )}
                  </div>
                  {starknetAddress ? (
                    <div className="flex items-center justify-between bg-[var(--bg-secondary)] rounded-xl px-3 py-2.5">
                      <span className="text-sm font-[family-name:var(--font-geist-mono)] text-[var(--text-primary)]">
                        {truncateAddress(starknetAddress, 6)}
                      </span>
                      <button
                        onClick={() => disconnect()}
                        className="text-xs text-[var(--text-tertiary)] hover:text-red-500 transition-colors cursor-pointer"
                      >
                        Disconnect
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {connectors.map((connector) => (
                        <button
                          key={connector.id}
                          onClick={() => connect({ connector })}
                          className="w-full text-left px-3 py-2.5 bg-[var(--bg-secondary)] rounded-xl text-sm font-medium text-[var(--text-primary)] hover:bg-gray-100 transition-colors cursor-pointer"
                        >
                          {connector.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Bitcoin */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Bitcoin size={14} className="text-[var(--accent-orange)]" />
                    <span className="text-xs font-medium text-[var(--text-secondary)]">Bitcoin</span>
                    {bitcoinAddress && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse-dot" />
                    )}
                  </div>
                  {bitcoinAddress ? (
                    <div className="flex items-center justify-between bg-[var(--bg-secondary)] rounded-xl px-3 py-2.5">
                      <span className="text-sm font-[family-name:var(--font-geist-mono)] text-[var(--text-primary)]">
                        {truncateAddress(bitcoinAddress, 6)}
                      </span>
                      <button
                        onClick={() => setBitcoinAddress(null)}
                        className="text-xs text-[var(--text-tertiary)] hover:text-red-500 transition-colors cursor-pointer"
                      >
                        Disconnect
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <button
                        onClick={connectBitcoin}
                        disabled={btcLoading}
                        className="w-full text-left px-3 py-2.5 bg-[var(--bg-secondary)] rounded-xl text-sm font-medium text-[var(--text-primary)] hover:bg-gray-100 transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        {btcLoading ? "Connecting..." : "Connect Xverse"}
                      </button>
                      {btcError && (
                        <p className="text-xs text-red-500 px-1">{btcError}</p>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
