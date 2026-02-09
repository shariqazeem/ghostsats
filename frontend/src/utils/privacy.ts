/**
 * Privacy utilities for GhostSats.
 *
 * Mirrors the Cairo contract's Pedersen commitment exactly:
 *   commitment = pedersen(pedersen(0, amount_hash), secret_hash)
 *
 * IMPORTANT: Cairo's PedersenTrait::new(0).update(a).update(b).finalize()
 * does NOT append the element count. finalize() just returns the state.
 * So the chain is: pedersen(pedersen(0, a), b) — that's it.
 *
 * This is DIFFERENT from starknet.js computeHashOnElements which appends length.
 * We use computePedersenHash (single pedersen) to build the chain manually.
 */

import { hash, num, ec } from "starknet";

export interface GhostNote {
  secret: string;      // hex felt252
  blinder: string;     // hex felt252
  amount: string;      // decimal string (raw u256, e.g. "1000000" for 1 USDC)
  commitment: string;  // hex felt252
  batchId: number;     // batch ID at deposit time (from get_current_batch_id)
  claimed: boolean;    // true after successful withdrawal
  timestamp: number;
}

/** Generate a random felt252-safe value (< 2^251). */
function randomFelt(): string {
  const bytes = new Uint8Array(31); // 248 bits — safely within felt252 range
  crypto.getRandomValues(bytes);
  const hex = "0x" + Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  return hex;
}

/**
 * Split a u256 amount into (low, high) felt252 components.
 * low  = amount & ((1n << 128n) - 1n)
 * high = amount >> 128n
 */
function splitU256(amount: bigint): { low: string; high: string } {
  const mask = (1n << 128n) - 1n;
  return {
    low: num.toHex(amount & mask),
    high: num.toHex(amount >> 128n),
  };
}

/**
 * Cairo's Pedersen chain: PedersenTrait::new(0).update(a).update(b).finalize()
 *   = pedersen(pedersen(0, a), b)
 *
 * finalize() just returns state — NO length appended (unlike computeHashOnElements).
 */
function pedersenChain(a: string, b: string): string {
  const step1 = hash.computePedersenHash("0x0", a);
  return hash.computePedersenHash(step1, b);
}

/**
 * Compute a Pedersen commitment matching the Cairo contract exactly.
 *
 * Cairo logic:
 *   amount_hash = PedersenTrait::new(0).update(amount_low).update(amount_high).finalize()
 *   secret_hash = PedersenTrait::new(0).update(secret).update(blinder).finalize()
 *   commitment  = PedersenTrait::new(0).update(amount_hash).update(secret_hash).finalize()
 *
 * Each chain is: pedersen(pedersen(0, x), y) — no length suffix.
 */
export function computeCommitment(
  amount: bigint,
  secret: string,
  blinder: string,
): string {
  const { low, high } = splitU256(amount);
  const amountHash = pedersenChain(low, high);
  const secretHash = pedersenChain(secret, blinder);
  return pedersenChain(amountHash, secretHash);
}

/**
 * Generate a new GhostNote with random secret & blinder.
 * The commitment is computed client-side and matches what the contract will verify.
 */
export function generateNote(amount: bigint, batchId: number = 0): GhostNote {
  const secret = randomFelt();
  const blinder = randomFelt();
  const commitment = computeCommitment(amount, secret, blinder);
  return {
    secret,
    blinder,
    amount: amount.toString(),
    commitment,
    batchId,
    claimed: false,
    timestamp: Date.now(),
  };
}

/** Save a note to localStorage under the "ghost-notes" key. */
export function saveNote(note: GhostNote): void {
  const stored = loadNotes();
  stored.push(note);
  localStorage.setItem("ghost-notes", JSON.stringify(stored));
}

/** Load all saved notes from localStorage. */
export function loadNotes(): GhostNote[] {
  try {
    const raw = localStorage.getItem("ghost-notes");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Mark a note as claimed by commitment hash. */
export function markNoteClaimed(commitment: string): void {
  const notes = loadNotes();
  const updated = notes.map((n) =>
    n.commitment === commitment ? { ...n, claimed: true } : n,
  );
  localStorage.setItem("ghost-notes", JSON.stringify(updated));
}
