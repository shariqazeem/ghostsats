"use client";

import { sepolia } from "@starknet-react/chains";
import { StarknetConfig, jsonRpcProvider, argent, braavos } from "@starknet-react/core";
import { ReactNode } from "react";

const chains = [sepolia];
const connectors = [argent(), braavos()];

function rpc() {
  return {
    nodeUrl: "https://starknet-sepolia-rpc.publicnode.com",
  };
}

export function StarknetProvider({ children }: { children: ReactNode }) {
  return (
    <StarknetConfig
      chains={chains}
      provider={jsonRpcProvider({ rpc })}
      connectors={connectors}
      autoConnect
    >
      {children}
    </StarknetConfig>
  );
}
