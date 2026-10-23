import { config } from "../config.js";
import { pool } from "../db/pool.js";
import { bidderAlias } from "./alias.js";
import { verifyChain, type ChainBid, type ChainVerdict } from "./hashChain.js";

export interface AuditView {
  lotId: string;
  title: string;
  verdict: ChainVerdict;
  // true once the lot has a receipt, whose final hash also catches a removed last bid
  anchoredToReceipt: boolean;
  bids: { seq: number; bidder: string; amountCents: number; placedAt: string; hash: string }[];
}

export async function auditLot(lotId: string): Promise<AuditView | null> {
  const lot = (await pool.query("SELECT id, title, status FROM lots WHERE id = $1", [lotId])).rows[0];
  if (!lot || lot.status === "cancelled") return null;

  const rows = (await pool.query("SELECT * FROM bids WHERE lot_id = $1 ORDER BY seq", [lotId])).rows;
  const receipt = (await pool.query("SELECT final_hash FROM receipts WHERE lot_id = $1", [lotId])).rows[0];

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
    verdict: verifyChain(chain, config.hashSecret, receipt?.final_hash),
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
