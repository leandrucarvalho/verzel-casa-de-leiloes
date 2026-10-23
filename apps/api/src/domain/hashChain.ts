import { createHmac } from "node:crypto";

export const GENESIS_HASH = "0".repeat(64);

export interface ChainBid {
  lotId: string;
  bidderId: string;
  amountCents: number;
  placedAt: string;
  seq: number;
  prevHash: string;
  hash: string;
}

type HashInput = Omit<ChainBid, "hash">;

// HMAC with a secret kept outside the database: someone with only DB access
// cannot recompute a valid chain after editing rows.
export function hashBid(bid: HashInput, secret: string): string {
  const payload = [bid.prevHash, bid.lotId, bid.seq, bid.bidderId, bid.amountCents, bid.placedAt].join("|");
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export type ChainVerdict = { valid: true } | { valid: false; brokenAtSeq: number };

// `expectedFinalHash` (stored in the receipt) also catches truncation of the tail.
export function verifyChain(bids: ChainBid[], secret: string, expectedFinalHash?: string): ChainVerdict {
  let prevHash = GENESIS_HASH;
  for (const [i, bid] of bids.entries()) {
    const seq = i + 1;
    if (bid.seq !== seq || bid.prevHash !== prevHash || bid.hash !== hashBid(bid, secret)) {
      return { valid: false, brokenAtSeq: seq };
    }
    prevHash = bid.hash;
  }
  if (expectedFinalHash !== undefined && prevHash !== expectedFinalHash) {
    return { valid: false, brokenAtSeq: bids.length + 1 };
  }
  return { valid: true };
}
