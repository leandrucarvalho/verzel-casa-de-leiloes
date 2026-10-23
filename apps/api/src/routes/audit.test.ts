import { createHash } from "node:crypto";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { pool } from "../db/pool.js";
import { resetDb } from "../test/db.js";

const app = createApp();
const minutes = (m: number) => new Date(Date.now() + m * 60_000).toISOString();

async function signUp(role: "bidder" | "auctioneer", email: string, depositCents = 0) {
  const res = await request(app)
    .post("/auth/register")
    .send({ email, password: "senha-forte-1", nickname: `${email.split("@")[0]}-nick`, role });
  const auth = `Bearer ${res.body.token}`;
  if (depositCents) await request(app).post("/wallet/deposit").set("Authorization", auth).send({ amountCents: depositCents });
  return { auth, id: res.body.user.id as string };
}

const bid = (lotId: string, auth: string, amountCents: number) =>
  request(app).post(`/lots/${lotId}/bids`).set("Authorization", auth).send({ amountCents });

const audit = (lotId: string) => request(app).get(`/lots/${lotId}/audit`);

async function lotWithFourBids() {
  const seller = await signUp("auctioneer", "s@example.com");
  const ana = await signUp("bidder", "ana@example.com", 100_000);
  const bruno = await signUp("bidder", "bruno@example.com", 100_000);
  const res = await request(app).post("/lots").set("Authorization", seller.auth).send({
    externalId: "1",
    title: "Lote",
    startingBidCents: 10_000,
    minIncrementCents: 500,
    startsAt: minutes(-10),
    endsAt: minutes(60),
  });
  const lot = res.body.id as string;
  await bid(lot, ana.auth, 10_000);
  await bid(lot, bruno.auth, 11_000);
  await bid(lot, ana.auth, 12_000);
  await bid(lot, bruno.auth, 13_000);
  return { lot, ana, bruno };
}

const endNow = (lot: string) =>
  pool.query("UPDATE lots SET starts_at = now() - interval '2 hours', ends_at = now() - interval '1 second' WHERE id = $1", [lot]);

beforeEach(resetDb);

describe("GET /lots/:id/audit", () => {
  it("is public and reports an untouched history as intact", async () => {
    const { lot } = await lotWithFourBids();
    const res = await audit(lot);
    expect(res.status).toBe(200);
    expect(res.body.verdict).toEqual({ valid: true });
    expect(res.body.bids.map((b: { amountCents: number }) => b.amountCents)).toEqual([10_000, 11_000, 12_000, 13_000]);
  });

  it("identifies bidders only by a per-lot alias", async () => {
    const { lot, ana, bruno } = await lotWithFourBids();
    const body = (await audit(lot)).body;
    const aliases = new Set(body.bids.map((b: { bidder: string }) => b.bidder));
    expect(aliases.size).toBe(2);
    const text = JSON.stringify(body);
    for (const secret of ["ana", "bruno", "example.com", ana.id, bruno.id]) expect(text).not.toContain(secret);
  });

  it("returns 404 for unknown and malformed ids", async () => {
    expect((await audit("6b0cbd2a-0000-4000-8000-000000000000")).status).toBe(404);
    expect((await audit("nope")).status).toBe(404);
  });

  it("works for a lot with no bids", async () => {
    const seller = await signUp("auctioneer", "s@example.com");
    const res = await request(app).post("/lots").set("Authorization", seller.auth).send({
      externalId: "1",
      title: "Vazio",
      startingBidCents: 100,
      minIncrementCents: 10,
      startsAt: minutes(-1),
      endsAt: minutes(5),
    });
    expect((await audit(res.body.id)).body).toMatchObject({ verdict: { valid: true }, bids: [] });
  });
});

describe("tampering straight in the database", () => {
  it("detects an altered amount", async () => {
    const { lot } = await lotWithFourBids();
    await pool.query("UPDATE bids SET amount_cents = 99999 WHERE lot_id = $1 AND seq = 2", [lot]);
    expect((await audit(lot)).body.verdict).toEqual({ valid: false, brokenAtSeq: 2 });
  });

  it("detects an altered bidder", async () => {
    const { lot, ana } = await lotWithFourBids();
    await pool.query("UPDATE bids SET bidder_id = $2 WHERE lot_id = $1 AND seq = 4", [lot, ana.id]);
    expect((await audit(lot)).body.verdict).toEqual({ valid: false, brokenAtSeq: 4 });
  });

  it("detects a removed bid in the middle", async () => {
    const { lot } = await lotWithFourBids();
    await pool.query("DELETE FROM bids WHERE lot_id = $1 AND seq = 2", [lot]);
    expect((await audit(lot)).body.verdict.valid).toBe(false);
  });

  it("detects a bid inserted afterwards, even linked to the previous hash", async () => {
    const { lot, ana } = await lotWithFourBids();
    await pool.query(
      `INSERT INTO bids (lot_id, bidder_id, amount_cents, placed_at, seq, prev_hash, hash)
       SELECT lot_id, $2, 500000, now(), 5, hash, 'forged' FROM bids WHERE lot_id = $1 AND seq = 4`,
      [lot, ana.id],
    );
    expect((await audit(lot)).body.verdict).toEqual({ valid: false, brokenAtSeq: 5 });
  });

  it("detects a chain rebuilt without the server secret", async () => {
    const { lot } = await lotWithFourBids();
    await pool.query("DELETE FROM bids WHERE lot_id = $1 AND seq > 1", [lot]);
    const first = (await pool.query("SELECT * FROM bids WHERE lot_id = $1", [lot])).rows[0];
    const forgedHash = createHash("sha256").update("anything").digest("hex");
    await pool.query(
      "INSERT INTO bids (lot_id, bidder_id, amount_cents, placed_at, seq, prev_hash, hash) VALUES ($1, $2, 10500, now(), 2, $3, $4)",
      [lot, first.bidder_id, first.hash, forgedHash],
    );
    expect((await audit(lot)).body.verdict).toEqual({ valid: false, brokenAtSeq: 2 });
  });

  it("detects a removed last bid once the lot is settled, thanks to the receipt hash", async () => {
    const { lot } = await lotWithFourBids();
    await endNow(lot);
    // reading through the lots router settles the lot lazily, creating the receipt
    expect((await audit(lot)).body).toMatchObject({ verdict: { valid: true }, anchoredToReceipt: true });
    await pool.query("DELETE FROM bids WHERE lot_id = $1 AND seq = 4", [lot]);
    expect((await audit(lot)).body.verdict).toEqual({ valid: false, brokenAtSeq: 4 });
  });
});
