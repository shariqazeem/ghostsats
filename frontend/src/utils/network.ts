import addresses from "@/contracts/addresses.json";

export const isMainnet = addresses.network === "mainnet";

export const EXPLORER_BASE = isMainnet
  ? "https://voyager.online"
  : "https://sepolia.voyager.online";

export const EXPLORER_TX = `${EXPLORER_BASE}/tx/`;
export const EXPLORER_CONTRACT = `${EXPLORER_BASE}/contract/`;

export const RPC_URL = isMainnet
  ? "https://rpc.starknet.lava.build"
  : "https://starknet-sepolia-rpc.publicnode.com";

export const NETWORK_LABEL = isMainnet ? "Mainnet" : "Sepolia";
