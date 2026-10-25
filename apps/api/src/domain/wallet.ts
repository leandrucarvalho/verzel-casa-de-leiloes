import { pool } from "../db/pool.js";
import { HttpError } from "../errors.js";

export const MAX_DEPOSIT_CENTS = 1_000_000_00;

export interface WalletView {
  totalCents: number;
  committedCents: number;
  availableCents: number;
  entries: { id: number; kind: string; amountCents: number; lotId: string | null; lotTitle: string | null; createdAt: string }[];
}

export async function getWallet(userId: string): Promise<WalletView> {
  const user = await pool.query("SELECT balance_cents, committed_cents FROM users WHERE id = $1", [userId]);
  if (!user.rows[0]) throw new HttpError(404, "user_not_found", "Usuário não encontrado.");
  const entries = await pool.query(
    `SELECT e.id, e.kind, e.amount_cents, e.lot_id, l.title AS lot_title, e.created_at
     FROM wallet_entries e LEFT JOIN lots l ON l.id = e.lot_id
     WHERE e.user_id = $1 ORDER BY e.id DESC LIMIT 50`,
    [userId],
  );
  const total = Number(user.rows[0].balance_cents);
  const committed = Number(user.rows[0].committed_cents);
  return {
    totalCents: total,
    committedCents: committed,
    availableCents: total - committed,
    entries: entries.rows.map((e) => ({
      id: Number(e.id),
      kind: e.kind,
      amountCents: Number(e.amount_cents),
      lotId: e.lot_id,
      lotTitle: e.lot_title,
      createdAt: e.created_at.toISOString(),
    })),
  };
}

export async function deposit(userId: string, amountCents: number) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("UPDATE users SET balance_cents = balance_cents + $2 WHERE id = $1", [userId, amountCents]);
    await client.query("INSERT INTO wallet_entries (user_id, kind, amount_cents) VALUES ($1, 'deposit', $2)", [
      userId,
      amountCents,
    ]);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
