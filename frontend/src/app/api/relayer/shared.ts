/**
 * Shared relayer configuration for all API routes.
 * Uses environment variables for private key and account address.
 */

import { Account, RpcProvider, ETransactionVersion } from "starknet";
import addresses from "@/contracts/addresses.json";

const network = addresses.network ?? "sepolia";

export const RPC_URL =
  process.env.STARKNET_RPC_URL ??
  (network === "mainnet"
    ? "https://rpc.starknet.lava.build"
    : "https://starknet-sepolia-rpc.publicnode.com");

export const POOL_ADDRESS = addresses.contracts.shieldedPool;
export const USDC_ADDRESS = addresses.contracts.usdc;
export const WBTC_ADDRESS = addresses.contracts.wbtc;
export const FEE_BPS = 200; // 2% relayer fee

export const AVNU_API_BASE =
  network === "mainnet"
    ? "https://starknet.api.avnu.fi"
    : "https://sepolia.api.avnu.fi";

export function getRelayerAccount(): Account | null {
  const privateKey = process.env.RELAYER_PRIVATE_KEY?.trim();
  const accountAddress = process.env.RELAYER_ACCOUNT_ADDRESS?.trim();

  if (!privateKey || !accountAddress) return null;

  // Use V1 (ETH gas) when RELAYER_ETH_GAS=true, otherwise V3 (STRK gas)
  const useEthGas = process.env.RELAYER_ETH_GAS === "true";

  return new Account({
    provider: new RpcProvider({ nodeUrl: RPC_URL }),
    address: accountAddress,
    signer: privateKey,
    ...(useEthGas
      ? { transactionVersion: ETransactionVersion.V1 as any }
      : {}),
  });
}

export function getProvider(): RpcProvider {
  return new RpcProvider({ nodeUrl: RPC_URL });
}
