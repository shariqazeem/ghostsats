import addresses from "@/contracts/addresses.json";

export const isMainnet = addresses.network === "mainnet";

export const EXPLORER_BASE = isMainnet
  ? "https://starkscan.co"
  : "https://sepolia.starkscan.co";

export const EXPLORER_TX = `${EXPLORER_BASE}/tx/`;
export const EXPLORER_CONTRACT = `${EXPLORER_BASE}/contract/`;

export const RPC_URL = isMainnet
  ? "https://starknet-mainnet.public.blastapi.io"
  : "https://starknet-sepolia-rpc.publicnode.com";

export const NETWORK_LABEL = isMainnet ? "Mainnet" : "Sepolia";
