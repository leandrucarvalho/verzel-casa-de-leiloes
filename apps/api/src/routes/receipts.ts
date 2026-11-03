import { Router } from "express";
import { requireAuth, requireRole } from "../auth/middleware.js";
import { bidderAlias } from "../domain/alias.js";
import { pool } from "../db/pool.js";
import type { ReceiptRow } from "../domain/rows.js";
import { HttpError } from "../errors.js";

const SELECT_RECEIPT = `
  SELECT r.token, r.final_hash, r.created_at, l.id AS lot_id, l.title, l.image_url, l.attributes,
         l.winner_id, l.winning_bid_cents, l.settled_at, u.nickname AS auctioneer
  FROM receipts r JOIN lots l ON l.id = r.lot_id JOIN users u ON u.id = l.auctioneer_id`;

function toView(r: ReceiptRow) {
  return {
    token: r.token,
    lotId: r.lot_id,
    title: r.title,
    imageUrl: r.image_url,
    attributes: r.attributes,
    winningBidCents: Number(r.winning_bid_cents),
    winner: bidderAlias(r.winner_id, r.lot_id),
    auctioneer: r.auctioneer,
    settledAt: r.settled_at.toISOString(),
    finalHash: r.final_hash,
  };
}

export const receiptsRouter = Router();

receiptsRouter.get("/", requireAuth, requireRole("bidder"), async (req, res) => {
  const { rows } = await pool.query<ReceiptRow>(`${SELECT_RECEIPT} WHERE l.winner_id = $1 ORDER BY l.settled_at DESC`, [req.user!.id]);
  res.json(rows.map(toView));
});

// Public: the token is the share link.
receiptsRouter.get("/:token", async (req, res) => {
  const { rows } = await pool.query<ReceiptRow>(`${SELECT_RECEIPT} WHERE r.token = $1`, [req.params.token]);
  const receipt = rows[0];
  if (!receipt) throw new HttpError(404, "receipt_not_found", "Comprovante não encontrado.");
  res.json(toView(receipt));
});
