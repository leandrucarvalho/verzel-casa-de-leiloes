import { config } from "../config.js";
import { pool } from "../db/pool.js";
import { bidderAlias } from "./alias.js";
import { verifyChain, type Anchor, type ChainBid, type ChainVerdict } from "./hashChain.js";
import type { BidRow, LotRow } from "./rows.js";

export interface AuditView {
  lotId: string;
  title: string;
  verdict: ChainVerdict;
  // true when a signed anchor (kept on every bid) or the receipt hash pins the newest bid,
  // which is what lets the audit notice a removed last bid
  anchored: boolean;
  // true once the lot has a receipt, whose final hash is a second pin on the tail
  anchoredToReceipt: boolean;
  bids: { seq: number; bidder: string; amountCents: number; placedAt: string; hash: string }[];
}

export async function auditLot(lotId: string): Promise<AuditView | null> {
  const lot = (
    await pool.query<Pick<LotRow, "id" | "title" | "status" | "anchor_seq" | "anchor_hash" | "anchor_sig">>(
      "SELECT id, title, status, anchor_seq, anchor_hash, anchor_sig FROM lots WHERE id = $1",
      [lotId],
    )
  ).rows[0];
  if (!lot || lot.status === "cancelled") return null;

  const rows = (await pool.query<BidRow>("SELECT * FROM bids WHERE lot_id = $1 ORDER BY seq", [lotId])).rows;
  const receipt = (await pool.query<{ final_hash: string | null }>("SELECT final_hash FROM receipts WHERE lot_id = $1", [lotId])).rows[0];
  // lots created before the anchor existed have none; they keep the receipt pin only
  const anchor: Anchor | null =
    lot.anchor_seq !== null && lot.anchor_hash !== null && lot.anchor_sig !== null
      ? { lotId, seq: lot.anchor_seq, hash: lot.anchor_hash, sig: lot.anchor_sig }
      : null;

  const chain: ChainBid[] = rows.map((r) => ({
    lotId: r.lot_id,
    bidderId: r.bidder_id,
    amountCents: Number(r.amount_cents),
    placedAt: r.placed_at.toISOString(),
    seq: r.seq,
    prevHash: r.prev_hash,
    hash: r.hash,
  }));

  return {
    lotId,
    title: lot.title,
    verdict: verifyChain(chain, config.hashSecret, { expectedFinalHash: receipt?.final_hash ?? undefined, anchor }),
    anchored: Boolean(anchor ?? receipt),
    anchoredToReceipt: Boolean(receipt),
    bids: chain.map((b) => ({
      seq: b.seq,
      bidder: bidderAlias(b.bidderId, lotId),
      amountCents: b.amountCents,
      placedAt: b.placedAt,
      hash: b.hash,
    })),
  };
}
