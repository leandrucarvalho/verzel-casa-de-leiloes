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

// Signed pointer to the newest bid of a lot (its position and hash).
export interface Anchor {
  lotId: string;
  seq: number;
  hash: string;
  sig: string;
}

// The "anchor|" prefix keeps this signature from ever matching a bid hash.
export function signAnchor(lotId: string, seq: number, hash: string, secret: string): Anchor {
  const sig = createHmac("sha256", secret).update(["anchor", lotId, seq, hash].join("|")).digest("hex");
  return { lotId, seq, hash, sig };
}

export type ChainVerdict = { valid: true } | { valid: false; brokenAtSeq: number };

// Two optional pins on the tail: the lot's signed anchor (rewritten on every bid) and the
// receipt's final hash (written at settlement). Either one catches a removed last bid.
// shortcut: someone with DB access can restore an older, genuinely signed anchor together with the
// matching shorter chain; publishing anchors outside the database (a transparency log) would close that.
export function verifyChain(
  bids: ChainBid[],
  secret: string,
  pins: { expectedFinalHash?: string; anchor?: Anchor | null } = {},
): ChainVerdict {
  let prevHash = GENESIS_HASH;
  for (const [i, bid] of bids.entries()) {
    const seq = i + 1;
    if (bid.seq !== seq || bid.prevHash !== prevHash || bid.hash !== hashBid(bid, secret)) {
      return { valid: false, brokenAtSeq: seq };
    }
    prevHash = bid.hash;
  }
  const { anchor, expectedFinalHash } = pins;
  if (anchor) {
    if (signAnchor(anchor.lotId, anchor.seq, anchor.hash, secret).sig !== anchor.sig) {
      return { valid: false, brokenAtSeq: anchor.seq };
    }
    if (bids.length < anchor.seq) return { valid: false, brokenAtSeq: bids.length + 1 };
    if (bids.length > anchor.seq || prevHash !== anchor.hash) return { valid: false, brokenAtSeq: anchor.seq };
  }
  if (expectedFinalHash !== undefined && prevHash !== expectedFinalHash) {
    return { valid: false, brokenAtSeq: bids.length + 1 };
  }
  return { valid: true };
}
