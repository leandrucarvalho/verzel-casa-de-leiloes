import { pool } from "../db/pool.js";

export async function resetDb() {
  await pool.query("TRUNCATE receipts, bids, wallet_entries, lots, users RESTART IDENTITY CASCADE");
}
