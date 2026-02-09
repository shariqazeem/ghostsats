"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface WalletState {
  starknetAddress: string | null;
  bitcoinAddress: string | null;
  setStarknetAddress: (addr: string | null) => void;
  setBitcoinAddress: (addr: string | null) => void;
}

const WalletContext = createContext<WalletState>({
  starknetAddress: null,
  bitcoinAddress: null,
  setStarknetAddress: () => {},
  setBitcoinAddress: () => {},
});

export function WalletProvider({ children }: { children: ReactNode }) {
  const [starknetAddress, setStarknetAddress] = useState<string | null>(null);
  const [bitcoinAddress, setBitcoinAddress] = useState<string | null>(null);

  return (
    <WalletContext.Provider
      value={{ starknetAddress, bitcoinAddress, setStarknetAddress, setBitcoinAddress }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  return useContext(WalletContext);
}
