/**
 * Notes Manager for GhostSats.
 *
 * Reads notes from localStorage and checks their on-chain status
 * by querying the ShieldedPool contract's batch results.
 */

import type { GhostNote } from "./privacy";
import { loadNotes } from "./privacy";
import { RpcProvider, Contract, type Abi } from "starknet";
import { SHIELDED_POOL_ABI } from "@/contracts/abi";
import addresses from "@/contracts/addresses.json";

export type NoteStatus = "PENDING" | "READY" | "CLAIMED";

export interface NoteWithStatus extends GhostNote {
  status: NoteStatus;
  wbtcShare?: string; // estimated WBTC share if batch is finalized
}

/** Get all notes from localStorage. */
export function getNotes(): GhostNote[] {
  return loadNotes();
}

/** Get active (unclaimed) notes. */
export function getActiveNotes(): GhostNote[] {
  return loadNotes().filter((n) => !n.claimed);
}

/**
 * Check the on-chain status of a single note.
 *
 * Logic:
 * 1. If note.claimed → CLAIMED
 * 2. Read get_batch_result(note.batchId) from the ShieldedPool
 * 3. If batch.is_finalized → READY (and compute estimated WBTC share)
 * 4. Otherwise → PENDING
 */
export async function checkNoteStatus(
  note: GhostNote,
  provider?: RpcProvider,
): Promise<NoteWithStatus> {
  if (note.claimed) {
    return { ...note, status: "CLAIMED" };
  }

  const poolAddress = addresses.contracts.shieldedPool;
  if (!poolAddress) {
    return { ...note, status: "PENDING" };
  }

  try {
    const rpc =
      provider ??
      new RpcProvider({
        nodeUrl: "https://starknet-sepolia.public.blastapi.io/rpc/v0_7",
      });

    const pool = new Contract({
      abi: SHIELDED_POOL_ABI as unknown as Abi,
      address: poolAddress,
      providerOrAccount: rpc,
    });
    const batch = await pool.call("get_batch_result", [note.batchId]);

    // BatchResult is returned as a struct: { total_usdc_in, total_wbtc_out, timestamp, is_finalized }
    const result = batch as Record<string, bigint | boolean>;
    const isFinalized = Boolean(result.is_finalized);

    if (!isFinalized) {
      return { ...note, status: "PENDING" };
    }

    // Calculate pro-rata share: user_share = (amount * total_wbtc_out) / total_usdc_in
    const amount = BigInt(note.amount);
    const totalUsdcIn = BigInt(result.total_usdc_in?.toString() ?? "0");
    const totalWbtcOut = BigInt(result.total_wbtc_out?.toString() ?? "0");

    let wbtcShare = "0";
    if (totalUsdcIn > 0n) {
      wbtcShare = ((amount * totalWbtcOut) / totalUsdcIn).toString();
    }

    return { ...note, status: "READY", wbtcShare };
  } catch {
    // If contract call fails (e.g. not deployed), treat as pending
    return { ...note, status: "PENDING" };
  }
}

/**
 * Check status of all active notes.
 */
export async function checkAllNoteStatuses(
  provider?: RpcProvider,
): Promise<NoteWithStatus[]> {
  const notes = loadNotes();
  return Promise.all(notes.map((n) => checkNoteStatus(n, provider)));
}
