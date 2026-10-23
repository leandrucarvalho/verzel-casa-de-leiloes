import { Router } from "express";
import { requireAuth, requireRole } from "../auth/middleware.js";
import { bidderAlias } from "../domain/alias.js";
import { pool } from "../db/pool.js";
import { HttpError } from "../errors.js";

const SELECT_RECEIPT = `
  SELECT r.token, r.final_hash, r.created_at, l.id AS lot_id, l.title, l.image_url, l.attributes,
         l.winner_id, l.winning_bid_cents, l.settled_at, u.nickname AS auctioneer
  FROM receipts r JOIN lots l ON l.id = r.lot_id JOIN users u ON u.id = l.auctioneer_id`;

function toView(r: Record<string, any>) {
  return {
    token: r.token as string,
    lotId: r.lot_id as string,
    title: r.title as string,
    imageUrl: r.image_url as string | null,
    attributes: r.attributes as Record<string, unknown>,
    winningBidCents: Number(r.winning_bid_cents),
    winner: bidderAlias(r.winner_id, r.lot_id),
    auctioneer: r.auctioneer as string,
    settledAt: r.settled_at.toISOString() as string,
    finalHash: r.final_hash as string,
  };
}

export const receiptsRouter = Router();

receiptsRouter.get("/", requireAuth, requireRole("bidder"), async (req, res) => {
  const { rows } = await pool.query(`${SELECT_RECEIPT} WHERE l.winner_id = $1 ORDER BY l.settled_at DESC`, [req.user!.id]);
  res.json(rows.map(toView));
});

// Public: the token is the share link.
receiptsRouter.get("/:token", async (req, res) => {
  const { rows } = await pool.query(`${SELECT_RECEIPT} WHERE r.token = $1`, [req.params.token]);
  if (!rows[0]) throw new HttpError(404, "receipt_not_found", "Comprovante não encontrado.");
  res.json(toView(rows[0]));
});
