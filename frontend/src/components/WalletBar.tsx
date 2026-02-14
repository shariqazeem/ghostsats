"use client";

import { useAccount, useConnect, useDisconnect } from "@starknet-react/core";
import { useWallet } from "@/context/WalletContext";
import { useEffect, useState, useRef } from "react";
import { Shield, Bitcoin, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { isMainnet } from "@/utils/network";

function truncateAddress(addr: string, chars = 4): string {
  if (addr.length <= chars * 2 + 2) return addr;
  return `${addr.slice(0, chars + 2)}...${addr.slice(-chars)}`;
}

const spring = { type: "spring" as const, stiffness: 400, damping: 30 };

export default function WalletBar() {
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { address, isConnected } = useAccount();
  const { starknetAddress, bitcoinAddress, setStarknetAddress, setBitcoinAddress, setBitcoinPublicKey } = useWallet();
  const [open, setOpen] = useState(false);
  const [btcLoading, setBtcLoading] = useState(false);
  const [btcError, setBtcError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setStarknetAddress(isConnected && address ? address : null);
  }, [address, isConnected, setStarknetAddress]);

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
          message: "Veil Protocol: Verify your Bitcoin identity",
          network: { type: isMainnet ? BitcoinNetworkType.Mainnet : BitcoinNetworkType.Testnet4 },
        },
        onFinish: (response: { addresses: Array<{ purpose: string; address: string; publicKey?: string }> }) => {
          const paymentAddr = response.addresses.find(
            (a: { purpose: string }) => a.purpose === AddressPurpose.Payment
          );
          if (paymentAddr) {
            setBitcoinAddress(paymentAddr.address);
            if (paymentAddr.publicKey) {
              setBitcoinPublicKey(paymentAddr.publicKey);
            }
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

  const bothConnected = !!starknetAddress && !!bitcoinAddress;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 px-4 sm:px-6 py-4 sm:py-5 bg-white/80 backdrop-blur-md border-b border-gray-200">
      <div className="max-w-3xl mx-auto flex items-center justify-between">
        {/* Wordmark */}
        <span className="text-lg font-bold tracking-tight text-gray-900">
          Veil<span className="text-[var(--accent-orange)]"> Protocol</span>
        </span>

        {/* Identity Pill */}
        <div ref={ref} className="relative">
          <motion.button
            onClick={() => setOpen(!open)}
            className="flex items-center gap-0 rounded-full bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer overflow-hidden"
            whileTap={{ scale: 0.97 }}
            transition={spring}
          >
            {/* Starknet side */}
            <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 sm:py-2.5 border-r border-gray-200">
              <Shield size={13} strokeWidth={1.5} className="text-gray-500" />
              {starknetAddress ? (
                <>
                  <span className="hidden sm:inline text-[13px] font-medium text-gray-900 font-[family-name:var(--font-geist-mono)]">
                    {truncateAddress(starknetAddress)}
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-green)] animate-pulse-dot" />
                </>
              ) : (
                <span className="hidden sm:inline text-[13px] font-medium text-gray-400">Starknet</span>
              )}
            </div>

            {/* Bitcoin side */}
            <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 sm:py-2.5">
              <Bitcoin size={13} strokeWidth={1.5} className="text-[var(--accent-orange)]" />
              {bitcoinAddress ? (
                <>
                  <span className="hidden sm:inline text-[13px] font-medium text-gray-900 font-[family-name:var(--font-geist-mono)]">
                    {truncateAddress(bitcoinAddress)}
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-green)] animate-pulse-dot" />
                </>
              ) : (
                <span className="hidden sm:inline text-[13px] font-medium text-gray-400">Bitcoin</span>
              )}
            </div>
          </motion.button>

          {/* If neither connected, show subtle label */}
          {!starknetAddress && !bitcoinAddress && (
            <div className="absolute -bottom-6 right-0 text-[12px] text-gray-400 whitespace-nowrap">
              Connect Identity
            </div>
          )}

          {/* Dropdown */}
          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.97 }}
                transition={spring}
                className="absolute right-0 mt-3 w-[calc(100vw-2rem)] sm:w-80 max-w-80 bg-white rounded-xl border border-gray-200 shadow-lg p-5 z-50"
              >
                <div className="flex items-center justify-between mb-5">
                  <span className="text-[12px] font-semibold text-gray-400">
                    Identity
                  </span>
                  <button
                    onClick={() => setOpen(false)}
                    className="text-gray-400 hover:text-gray-900 transition-colors cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                </div>

                {/* Starknet Section */}
                <div className="mb-5">
                  <div className="flex items-center gap-2 mb-2.5">
                    <Shield size={13} strokeWidth={1.5} className="text-gray-500" />
                    <span className="text-[12px] font-semibold text-gray-500">
                      Starknet
                    </span>
                    {starknetAddress && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-green)] animate-pulse-dot" />
                    )}
                  </div>
                  {starknetAddress ? (
                    <div className="flex items-center justify-between bg-gray-50 rounded-xl px-3.5 py-3">
                      <span className="text-[13px] font-[family-name:var(--font-geist-mono)] text-gray-900">
                        {truncateAddress(starknetAddress, 6)}
                      </span>
                      <button
                        onClick={() => disconnect()}
                        className="text-[12px] font-medium text-gray-400 hover:text-gray-900 transition-colors cursor-pointer"
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
                          className="w-full text-left px-3.5 py-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl text-[13px] font-medium text-gray-900 transition-colors cursor-pointer"
                        >
                          {connector.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Separator */}
                <div className="h-px bg-gray-200 mb-5" />

                {/* Bitcoin Section */}
                <div>
                  <div className="flex items-center gap-2 mb-2.5">
                    <Bitcoin size={13} strokeWidth={1.5} className="text-[var(--accent-orange)]" />
                    <span className="text-[12px] font-semibold text-gray-500">
                      Bitcoin <span className="text-gray-400">(optional)</span>
                    </span>
                    {bitcoinAddress && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-green)] animate-pulse-dot" />
                    )}
                  </div>
                  {bitcoinAddress ? (
                    <div className="flex items-center justify-between bg-gray-50 rounded-xl px-3.5 py-3">
                      <span className="text-[13px] font-[family-name:var(--font-geist-mono)] text-gray-900">
                        {truncateAddress(bitcoinAddress, 6)}
                      </span>
                      <button
                        onClick={() => setBitcoinAddress(null)}
                        className="text-[12px] font-medium text-gray-400 hover:text-gray-900 transition-colors cursor-pointer"
                      >
                        Disconnect
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <button
                        onClick={connectBitcoin}
                        disabled={btcLoading}
                        className="w-full text-left px-3.5 py-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl text-[13px] font-medium text-gray-900 transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        {btcLoading ? "Connecting..." : "Connect Xverse"}
                      </button>
                      {btcError && (
                        <p className="text-[12px] text-red-500 px-1 mt-1">{btcError}</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Status footer */}
                {bothConnected && (
                  <div className="mt-5 pt-4 border-t border-gray-200 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-green)] animate-pulse-dot" />
                    <span className="text-[12px] text-gray-400">
                      Both identities verified
                    </span>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
