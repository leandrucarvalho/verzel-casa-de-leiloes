import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { pool } from "../db/pool.js";
import { settleDueLots, settleLot } from "../domain/settlement.js";
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

async function createLot(auth: string) {
  const res = await request(app).post("/lots").set("Authorization", auth).send({
    externalId: "1",
    title: "Lote",
    startingBidCents: 10_000,
    minIncrementCents: 500,
    startsAt: minutes(-10),
    endsAt: minutes(60),
  });
  return res.body.id as string;
}

const bid = (lotId: string, auth: string, amountCents: number) =>
  request(app).post(`/lots/${lotId}/bids`).set("Authorization", auth).send({ amountCents });

const wallet = async (auth: string) => (await request(app).get("/wallet").set("Authorization", auth)).body;

const endNow = (lotId: string) =>
  pool.query("UPDATE lots SET starts_at = now() - interval '2 hours', ends_at = now() - interval '1 second' WHERE id = $1", [lotId]);

async function auctionWithBids() {
  const seller = await signUp("auctioneer", "s@example.com");
  const ana = await signUp("bidder", "ana@example.com", 50_000);
  const bruno = await signUp("bidder", "bruno@example.com", 50_000);
  const lot = await createLot(seller.auth);
  await bid(lot, ana.auth, 10_000);
  await bid(lot, bruno.auth, 12_000);
  return { seller, ana, bruno, lot };
}

beforeEach(resetDb);

describe("settlement", () => {
  it("debits the winner, credits the auctioneer and releases everything else", async () => {
    const { seller, ana, bruno, lot } = await auctionWithBids();
    await endNow(lot);
    expect(await settleLot(lot)).toBe(true);

    expect(await wallet(bruno.auth)).toMatchObject({ totalCents: 38_000, committedCents: 0, availableCents: 38_000 });
    expect(await wallet(ana.auth)).toMatchObject({ totalCents: 50_000, committedCents: 0 });
    expect(await wallet(seller.auth)).toMatchObject({ totalCents: 12_000, committedCents: 0 });
    const kinds = (await wallet(bruno.auth)).entries.map((e: { kind: string }) => e.kind);
    expect(kinds).toContain("settlement_debit");

    const { rows } = await pool.query("SELECT status, winner_id, winning_bid_cents FROM lots WHERE id = $1", [lot]);
    expect(rows[0]).toMatchObject({ status: "settled", winner_id: bruno.id, winning_bid_cents: "12000" });
  });

  it("stores the last bid hash in the receipt", async () => {
    const { lot } = await auctionWithBids();
    await endNow(lot);
    await settleLot(lot);
    const { rows } = await pool.query(
      "SELECT r.final_hash, (SELECT hash FROM bids WHERE lot_id = r.lot_id ORDER BY seq DESC LIMIT 1) AS last_hash FROM receipts r",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].final_hash).toBe(rows[0].last_hash);
  });

  it("closes a lot without bids with no winner and no receipt", async () => {
    const seller = await signUp("auctioneer", "s@example.com");
    const lot = await createLot(seller.auth);
    await endNow(lot);
    await settleLot(lot);
    const { rows } = await pool.query("SELECT status, winner_id FROM lots WHERE id = $1", [lot]);
    expect(rows[0]).toMatchObject({ status: "settled", winner_id: null });
    expect((await pool.query("SELECT 1 FROM receipts")).rowCount).toBe(0);
    const view = await request(app).get(`/lots/${lot}`);
    expect(view.body).toMatchObject({ status: "ended", result: "unsold", winningBidCents: null });
  });

  it("does not settle a lot that is still running or was cancelled", async () => {
    const { lot } = await auctionWithBids();
    expect(await settleLot(lot)).toBe(false);
    const seller = await signUp("auctioneer", "s2@example.com");
    const cancelled = await createLot(seller.auth);
    await request(app).post(`/lots/${cancelled}/cancel`).set("Authorization", seller.auth);
    await pool.query("UPDATE lots SET starts_at = now() - interval '2 hours', ends_at = now() - interval '1 second' WHERE id = $1", [cancelled]);
    expect(await settleLot(cancelled)).toBe(false);
  });

  it("is idempotent even when several settlements race", async () => {
    const { seller, lot } = await auctionWithBids();
    await endNow(lot);
    const results = await Promise.all([1, 2, 3, 4, 5].map(() => settleLot(lot)));
    expect(results.filter(Boolean)).toHaveLength(1);
    expect((await pool.query("SELECT 1 FROM receipts")).rowCount).toBe(1);
    expect((await wallet(seller.auth)).totalCents).toBe(12_000);
    expect(await settleDueLots()).toBe(0);
  });

  it("settles lazily when someone reads the wallet after the end", async () => {
    const { seller, lot } = await auctionWithBids();
    await endNow(lot);
    expect((await wallet(seller.auth)).totalCents).toBe(12_000);
  });
});

describe("receipts and results", () => {
  it("shows the winner a receipt that anyone can open without exposing personal data", async () => {
    const { bruno, lot } = await auctionWithBids();
    await endNow(lot);
    const mine = await request(app).get("/receipts").set("Authorization", bruno.auth);
    expect(mine.status).toBe(200);
    expect(mine.body).toHaveLength(1);

    const shared = await request(app).get(`/receipts/${mine.body[0].token}`);
    expect(shared.status).toBe(200);
    expect(shared.body).toMatchObject({ title: "Lote", winningBidCents: 12_000, lotId: lot });
    expect(shared.body.winner).toMatch(/^Licitante [0-9a-f]{6}$/);
    const text = JSON.stringify(shared.body);
    expect(text).not.toContain("bruno");
    expect(text).not.toContain(bruno.id);
  });

  it("returns 404 for an unknown receipt and hides receipts from non-winners", async () => {
    const { ana, lot } = await auctionWithBids();
    await endNow(lot);
    expect((await request(app).get("/receipts/nao-existe")).status).toBe(404);
    expect((await request(app).get("/receipts").set("Authorization", ana.auth)).body).toEqual([]);
  });

  it("reports the result and total received to the auctioneer", async () => {
    const { seller, lot } = await auctionWithBids();
    await endNow(lot);
    const res = await request(app).get("/lots/mine").set("Authorization", seller.auth);
    expect(res.body.totalReceivedCents).toBe(12_000);
    expect(res.body.lots[0]).toMatchObject({ result: "sold", winningBidCents: 12_000 });
  });
});
