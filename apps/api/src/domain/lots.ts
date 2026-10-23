import { pool } from "../db/pool.js";
import { HttpError } from "../errors.js";
import { notifyLotChanged } from "./events.js";

export type Phase = "scheduled" | "live" | "ended";

export interface NewLot {
  externalId: string;
  title: string;
  imageUrl: string | null;
  attributes: Record<string, unknown>;
  startingBidCents: number;
  minIncrementCents: number;
  startsAt: Date;
  endsAt: Date;
}

// Single source of truth for the lot phase. Cancelled lots are filtered out by callers.
const PHASE_SQL = `CASE
  WHEN l.status = 'settled' OR l.ends_at <= now() THEN 'ended'
  WHEN l.starts_at > now() THEN 'scheduled'
  ELSE 'live'
END`;

const SELECT_LOTS = `
  SELECT l.*, u.nickname AS auctioneer_nickname,
    ${PHASE_SQL} AS phase,
    b.current_bid_cents, COALESCE(b.bid_count, 0) AS bid_count
  FROM lots l
  JOIN users u ON u.id = l.auctioneer_id
  LEFT JOIN LATERAL (
    SELECT max(amount_cents) AS current_bid_cents, count(*) AS bid_count FROM bids WHERE lot_id = l.id
  ) b ON true`;

function toView(r: Record<string, any>) {
  return {
    id: r.id as string,
    title: r.title as string,
    imageUrl: r.image_url as string | null,
    attributes: r.attributes as Record<string, unknown>,
    startingBidCents: Number(r.starting_bid_cents),
    minIncrementCents: Number(r.min_increment_cents),
    startsAt: r.starts_at.toISOString() as string,
    endsAt: r.ends_at.toISOString() as string,
    status: (r.status === "cancelled" ? "cancelled" : r.phase) as Phase | "cancelled",
    auctioneer: r.auctioneer_nickname as string,
    currentBidCents: r.current_bid_cents === null ? null : Number(r.current_bid_cents),
    // set once settled: null while open, "sold" or "unsold" afterwards
    result: (r.status === "settled" ? (r.winner_id ? "sold" : "unsold") : null) as "sold" | "unsold" | null,
    winningBidCents: r.winning_bid_cents === null ? null : Number(r.winning_bid_cents),
    bidCount: Number(r.bid_count),
  };
}

export type LotView = ReturnType<typeof toView>;

export async function createLot(auctioneerId: string, lot: NewLot): Promise<LotView> {
  const { rows } = await pool.query(
    `INSERT INTO lots (auctioneer_id, external_id, title, image_url, attributes,
       starting_bid_cents, min_increment_cents, starts_at, ends_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
    [
      auctioneerId,
      lot.externalId,
      lot.title,
      lot.imageUrl,
      lot.attributes,
      lot.startingBidCents,
      lot.minIncrementCents,
      lot.startsAt,
      lot.endsAt,
    ],
  );
  return (await getLot(rows[0].id))!;
}

export async function getLot(id: string): Promise<LotView | null> {
  const { rows } = await pool.query(`${SELECT_LOTS} WHERE l.id = $1`, [id]);
  return rows[0] ? toView(rows[0]) : null;
}

export async function listLots(filter: { phase?: Phase; q?: string; auctioneerId?: string }): Promise<LotView[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.auctioneerId) {
    // the owner sees their cancelled lots too
    params.push(filter.auctioneerId);
    where.push(`l.auctioneer_id = $${params.length}`);
  } else {
    where.push("l.status <> 'cancelled'");
  }
  if (filter.q) {
    params.push(`%${filter.q}%`);
    where.push(`l.title ILIKE $${params.length}`);
  }
  if (filter.phase) {
    params.push(filter.phase);
    where.push(`l.status <> 'cancelled' AND (${PHASE_SQL}) = $${params.length}`);
  }
  const { rows } = await pool.query(`${SELECT_LOTS} WHERE ${where.join(" AND ")} ORDER BY l.ends_at ASC`, params);
  return rows.map(toView);
}

// Lots where the bidder placed at least one bid, with their standing in each one.
export async function listParticipating(bidderId: string) {
  const { rows } = await pool.query(
    `${SELECT_LOTS} WHERE EXISTS (SELECT 1 FROM bids x WHERE x.lot_id = l.id AND x.bidder_id = $1) ORDER BY l.ends_at DESC`,
    [bidderId],
  );
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const standing = await pool.query(
    `SELECT lot_id,
            max(amount_cents) FILTER (WHERE bidder_id = $1) AS my_bid,
            (array_agg(bidder_id ORDER BY seq DESC))[1] AS leader
     FROM bids WHERE lot_id = ANY($2) GROUP BY lot_id`,
    [bidderId, ids],
  );
  const receipts = await pool.query("SELECT lot_id, token FROM receipts WHERE lot_id = ANY($1)", [ids]);
  return rows.map((r) => {
    const s = standing.rows.find((x) => x.lot_id === r.id);
    return {
      ...toView(r),
      myBidCents: Number(s.my_bid),
      leading: s.leader === bidderId,
      receiptToken: r.winner_id === bidderId ? (receipts.rows.find((x) => x.lot_id === r.id)?.token as string) : null,
    };
  });
}

export async function totalReceived(auctioneerId: string): Promise<number> {
  const { rows } = await pool.query(
    "SELECT COALESCE(sum(winning_bid_cents), 0) AS total FROM lots WHERE auctioneer_id = $1 AND status = 'settled'",
    [auctioneerId],
  );
  return Number(rows[0].total);
}

// Cancelling a lot with bids releases what the leader had committed and records a refund entry.
// Nobody else holds money for the lot (outbid bidders were already released), and no balance moved yet,
// so "refund" means giving back the reserved amount, not reversing a payment.
export async function cancelLot(lotId: string, auctioneerId: string): Promise<LotView> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const lot = (await client.query("SELECT auctioneer_id, status, ends_at FROM lots WHERE id = $1 FOR UPDATE", [lotId])).rows[0];
    if (!lot || lot.auctioneer_id !== auctioneerId) throw new HttpError(404, "lot_not_found", "Lote não encontrado.");
    const now: Date = (await client.query("SELECT clock_timestamp() AS now")).rows[0].now;
    if (lot.status !== "published" || lot.ends_at <= now) {
      throw new HttpError(409, "lot_not_cancellable", "Este lote não pode mais ser cancelado.");
    }
    const last = (
      await client.query("SELECT bidder_id, amount_cents FROM bids WHERE lot_id = $1 ORDER BY seq DESC LIMIT 1", [lotId])
    ).rows[0];
    if (last) {
      await client.query("SELECT id FROM users WHERE id = $1 FOR UPDATE", [last.bidder_id]);
      await client.query("UPDATE users SET committed_cents = committed_cents - $2 WHERE id = $1", [last.bidder_id, last.amount_cents]);
      await client.query("INSERT INTO wallet_entries (user_id, kind, amount_cents, lot_id) VALUES ($1, 'refund', $2, $3)", [
        last.bidder_id,
        last.amount_cents,
        lotId,
      ]);
    }
    await client.query("UPDATE lots SET status = 'cancelled' WHERE id = $1", [lotId]);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
  notifyLotChanged(lotId);
  return (await getLot(lotId))!;
}
