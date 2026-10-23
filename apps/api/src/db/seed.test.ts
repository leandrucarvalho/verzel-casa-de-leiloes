import { beforeEach, describe, expect, it } from "vitest";
import { config } from "../config.js";
import { auditLot } from "../domain/audit.js";
import { resetDb } from "../test/db.js";
import { pool } from "./pool.js";
import { seed } from "./seed.js";

beforeEach(resetDb);

describe("seed", () => {
  it("creates 1 auctioneer, 2 bidders and a published lot with open bids", async () => {
    await seed();
    const roles = await pool.query("SELECT role, count(*)::int AS n FROM users GROUP BY role ORDER BY role");
    expect(roles.rows).toEqual([
      { role: "auctioneer", n: 1 },
      { role: "bidder", n: 2 },
    ]);
    const live = await pool.query(
      "SELECT l.id FROM lots l WHERE l.status = 'published' AND l.starts_at <= now() AND l.ends_at > now() AND EXISTS (SELECT 1 FROM bids b WHERE b.lot_id = l.id)",
    );
    expect(live.rowCount).toBeGreaterThanOrEqual(1);
    expect(config.hashSecret).toBeTruthy();
    expect((await auditLot(live.rows[0].id))?.verdict).toEqual({ valid: true });
  });

  it("settles the ended demo lot and leaves the books balanced", async () => {
    await seed();
    expect((await pool.query("SELECT 1 FROM receipts")).rowCount).toBe(1);
    const sums = await pool.query("SELECT sum(balance_cents)::int AS balance FROM users");
    expect(sums.rows[0].balance).toBe(10_000_000);
  });

  it("is idempotent", async () => {
    await seed();
    await seed();
    expect((await pool.query("SELECT 1 FROM users")).rowCount).toBe(3);
  });
});
