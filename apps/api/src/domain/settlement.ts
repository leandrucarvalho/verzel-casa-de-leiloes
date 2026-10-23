import { randomBytes } from "node:crypto";
import { pool } from "../db/pool.js";

// Settles one lot if it is due. Idempotent: the lot row lock plus the status check
// make a second call (job and lazy access racing) a no-op.
export async function settleLot(lotId: string): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const lot = (await client.query("SELECT * FROM lots WHERE id = $1 FOR UPDATE", [lotId])).rows[0];
    const now: Date = (await client.query("SELECT clock_timestamp() AS now")).rows[0].now;
    if (!lot || lot.status !== "published" || lot.ends_at > now) {
      await client.query("ROLLBACK");
      return false;
    }

    const last = (
      await client.query("SELECT bidder_id, amount_cents, hash FROM bids WHERE lot_id = $1 ORDER BY seq DESC LIMIT 1", [lotId])
    ).rows[0];

    if (!last) {
      await client.query("UPDATE lots SET status = 'settled', settled_at = $2 WHERE id = $1", [lotId, now]);
    } else {
      const amount = Number(last.amount_cents);
      const ids = [last.bidder_id, lot.auctioneer_id].sort();
      await client.query("SELECT id FROM users WHERE id = ANY($1) ORDER BY id FOR UPDATE", [ids]);
      await client.query(
        "UPDATE users SET balance_cents = balance_cents - $2, committed_cents = committed_cents - $2 WHERE id = $1",
        [last.bidder_id, amount],
      );
      await client.query("UPDATE users SET balance_cents = balance_cents + $2 WHERE id = $1", [lot.auctioneer_id, amount]);
      await client.query(
        `INSERT INTO wallet_entries (user_id, kind, amount_cents, lot_id) VALUES ($1, 'settlement_debit', $3, $4), ($2, 'settlement_credit', $3, $4)`,
        [last.bidder_id, lot.auctioneer_id, amount, lotId],
      );
      await client.query(
        "UPDATE lots SET status = 'settled', settled_at = $2, winner_id = $3, winning_bid_cents = $4 WHERE id = $1",
        [lotId, now, last.bidder_id, amount],
      );
      await client.query("INSERT INTO receipts (lot_id, token, final_hash) VALUES ($1, $2, $3)", [
        lotId,
        randomBytes(16).toString("base64url"),
        last.hash,
      ]);
    }
    await client.query("COMMIT");
    return true;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function settleDueLots(): Promise<number> {
  const { rows } = await pool.query("SELECT id FROM lots WHERE status = 'published' AND ends_at <= clock_timestamp()");
  let settled = 0;
  for (const { id } of rows) {
    try {
      if (await settleLot(id)) settled++;
    } catch (err) {
      console.error(`failed to settle lot ${id}`, err);
    }
  }
  return settled;
}
