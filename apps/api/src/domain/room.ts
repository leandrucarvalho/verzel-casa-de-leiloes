import { pool } from "../db/pool.js";
import { bidderAlias } from "./alias.js";
import { getLot, type LotView } from "./lots.js";

export interface RoomView {
  lot: LotView;
  // lets the client correct its clock for the countdown
  serverTime: string;
  minimumNextBidCents: number;
  bids: { seq: number; bidder: string; amountCents: number; placedAt: string; mine: boolean }[];
  me: { leading: boolean; outbid: boolean; myBidCents: number | null } | null;
}

export async function roomView(lotId: string, userId?: string): Promise<RoomView | null> {
  const lot = await getLot(lotId);
  if (!lot || lot.status === "cancelled") return null;

  const rows = (
    await pool.query("SELECT seq, bidder_id, amount_cents, placed_at FROM bids WHERE lot_id = $1 ORDER BY seq DESC LIMIT 100", [lotId])
  ).rows;

  const bids = rows.map((r) => ({
    seq: r.seq as number,
    bidder: bidderAlias(r.bidder_id, lotId),
    amountCents: Number(r.amount_cents),
    placedAt: r.placed_at.toISOString() as string,
    mine: r.bidder_id === userId,
  }));

  let me: RoomView["me"] = null;
  if (userId) {
    const mine = (
      await pool.query("SELECT max(amount_cents) AS best FROM bids WHERE lot_id = $1 AND bidder_id = $2", [lotId, userId])
    ).rows[0];
    const leading = rows[0]?.bidder_id === userId;
    const myBidCents = mine.best === null ? null : Number(mine.best);
    me = { leading, outbid: myBidCents !== null && !leading, myBidCents };
  }

  return {
    lot,
    serverTime: new Date().toISOString(),
    minimumNextBidCents: lot.currentBidCents === null ? lot.startingBidCents : lot.currentBidCents + lot.minIncrementCents,
    bids,
    me,
  };
}
