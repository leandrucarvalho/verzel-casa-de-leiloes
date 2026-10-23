import type { PoolClient } from "pg";
import { config } from "../config.js";
import { pool } from "../db/pool.js";
import { HttpError } from "../errors.js";
import { GENESIS_HASH, hashBid } from "./hashChain.js";

const SNIPING_WINDOW_MS = 2 * 60_000;
const rule = (code: string, message: string, details?: Record<string, unknown>) =>
  new HttpError(422, code, message, details);
const brl = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export interface PlacedBid {
  seq: number;
  amountCents: number;
  placedAt: string;
  endsAt: string;
  extended: boolean;
}

export async function placeBid(lotId: string, bidderId: string, amountCents: number): Promise<PlacedBid> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await placeBidTx(client, lotId, bidderId, amountCents);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function placeBidTx(client: PoolClient, lotId: string, bidderId: string, amountCents: number): Promise<PlacedBid> {
  // Locks are always taken lot first, then users ordered by id, so concurrent bids cannot deadlock.
  const lot = (await client.query("SELECT * FROM lots WHERE id = $1 FOR UPDATE", [lotId])).rows[0];
  if (!lot || lot.status === "cancelled") throw new HttpError(404, "lot_not_found", "Lote não encontrado.");

  // clock_timestamp(), not now(): now() is frozen at transaction start, before waiting for the lock.
  const now: Date = (await client.query("SELECT clock_timestamp() AS now")).rows[0].now;
  if (lot.status === "settled" || now >= lot.ends_at) throw rule("lot_ended", "Este lote já foi encerrado.");
  if (now < lot.starts_at) throw rule("lot_not_started", "Este lote ainda não começou.");

  const last = (
    await client.query("SELECT seq, bidder_id, amount_cents, hash FROM bids WHERE lot_id = $1 ORDER BY seq DESC LIMIT 1", [lotId])
  ).rows[0];

  const ids = [bidderId, ...(last ? [last.bidder_id] : [])].sort();
  const users = (await client.query("SELECT id, balance_cents, committed_cents FROM users WHERE id = ANY($1) ORDER BY id FOR UPDATE", [ids])).rows;
  const bidder = users.find((u) => u.id === bidderId);
  if (!bidder) throw new HttpError(404, "user_not_found", "Usuário não encontrado.");

  if (last?.bidder_id === bidderId) throw rule("already_leading", "Você já está ganhando este lote.");

  const minimumCents = last
    ? Number(last.amount_cents) + Number(lot.min_increment_cents)
    : Number(lot.starting_bid_cents);
  if (amountCents < minimumCents) {
    throw rule("below_minimum", `O lance mínimo é ${brl(minimumCents)}.`, { minimumCents });
  }

  const availableCents = Number(bidder.balance_cents) - Number(bidder.committed_cents);
  if (amountCents > availableCents) {
    throw rule("insufficient_funds", `Saldo disponível insuficiente (${brl(availableCents)}).`, { availableCents });
  }

  const seq = last ? last.seq + 1 : 1;
  const prevHash = last?.hash ?? GENESIS_HASH;
  const placedAt = now.toISOString();
  const hash = hashBid({ lotId, bidderId, amountCents, placedAt, seq, prevHash }, config.hashSecret);
  await client.query(
    "INSERT INTO bids (lot_id, bidder_id, amount_cents, placed_at, seq, prev_hash, hash) VALUES ($1, $2, $3, $4, $5, $6, $7)",
    [lotId, bidderId, amountCents, now, seq, prevHash, hash],
  );

  await client.query("UPDATE users SET committed_cents = committed_cents + $2 WHERE id = $1", [bidderId, amountCents]);
  if (last) {
    await client.query("UPDATE users SET committed_cents = committed_cents - $2 WHERE id = $1", [last.bidder_id, last.amount_cents]);
  }

  // anti-sniping: a bid in the last 2 minutes pushes the end 2 minutes further
  const extended = lot.ends_at.getTime() - now.getTime() <= SNIPING_WINDOW_MS;
  const endsAt = extended ? new Date(lot.ends_at.getTime() + SNIPING_WINDOW_MS) : lot.ends_at;
  if (extended) await client.query("UPDATE lots SET ends_at = $2 WHERE id = $1", [lotId, endsAt]);

  return { seq, amountCents, placedAt, endsAt: endsAt.toISOString(), extended };
}
