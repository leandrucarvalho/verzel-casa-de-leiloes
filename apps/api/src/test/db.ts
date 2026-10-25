import { pool } from "../db/pool.js";
import { resetRateLimits } from "../rateLimit.js";

export async function resetDb() {
  resetRateLimits();
  await pool.query("TRUNCATE receipts, bids, wallet_entries, lots, users RESTART IDENTITY CASCADE");
}
