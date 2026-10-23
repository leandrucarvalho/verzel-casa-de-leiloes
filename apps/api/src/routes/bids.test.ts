import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { config } from "../config.js";
import { pool } from "../db/pool.js";
import { verifyChain, type ChainBid } from "../domain/hashChain.js";
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

async function createLot(auth: string, over: Record<string, unknown> = {}) {
  const res = await request(app)
    .post("/lots")
    .set("Authorization", auth)
    .send({
      externalId: "1",
      title: "Lote",
      startingBidCents: 10_000,
      minIncrementCents: 500,
      startsAt: minutes(-10),
      endsAt: minutes(60),
      ...over,
    });
  return res.body.id as string;
}

const bid = (lotId: string, auth: string, amountCents: number) =>
  request(app).post(`/lots/${lotId}/bids`).set("Authorization", auth).send({ amountCents });

const wallet = async (auth: string) => (await request(app).get("/wallet").set("Authorization", auth)).body;

async function storedChain(lotId: string): Promise<ChainBid[]> {
  const { rows } = await pool.query("SELECT * FROM bids WHERE lot_id = $1 ORDER BY seq", [lotId]);
  return rows.map((r) => ({
    lotId: r.lot_id,
    bidderId: r.bidder_id,
    amountCents: Number(r.amount_cents),
    placedAt: r.placed_at.toISOString(),
    seq: r.seq,
    prevHash: r.prev_hash,
    hash: r.hash,
  }));
}

beforeEach(resetDb);

describe("bid rules", () => {
  it("accepts the first bid at the starting price and commits the balance", async () => {
    const seller = await signUp("auctioneer", "s@example.com");
    const ana = await signUp("bidder", "ana@example.com", 50_000);
    const lot = await createLot(seller.auth);
    const res = await bid(lot, ana.auth, 10_000);
    expect(res.status).toBe(201);
    expect(await wallet(ana.auth)).toMatchObject({ totalCents: 50_000, committedCents: 10_000, availableCents: 40_000 });
  });

  it("refuses a first bid below the starting price", async () => {
    const seller = await signUp("auctioneer", "s@example.com");
    const ana = await signUp("bidder", "ana@example.com", 50_000);
    const lot = await createLot(seller.auth);
    const res = await bid(lot, ana.auth, 9_999);
    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({ error: "below_minimum", minimumCents: 10_000 });
  });

  it("requires current bid + increment and gives the money back when outbid", async () => {
    const seller = await signUp("auctioneer", "s@example.com");
    const ana = await signUp("bidder", "ana@example.com", 50_000);
    const bruno = await signUp("bidder", "bruno@example.com", 50_000);
    const lot = await createLot(seller.auth);
    await bid(lot, ana.auth, 10_000);

    const low = await bid(lot, bruno.auth, 10_499);
    expect(low.body).toMatchObject({ error: "below_minimum", minimumCents: 10_500 });

    expect((await bid(lot, bruno.auth, 10_500)).status).toBe(201);
    expect(await wallet(ana.auth)).toMatchObject({ committedCents: 0, availableCents: 50_000 });
    expect(await wallet(bruno.auth)).toMatchObject({ committedCents: 10_500 });
  });

  it("does not let the leader outbid themselves", async () => {
    const seller = await signUp("auctioneer", "s@example.com");
    const ana = await signUp("bidder", "ana@example.com", 50_000);
    const lot = await createLot(seller.auth);
    await bid(lot, ana.auth, 10_000);
    const res = await bid(lot, ana.auth, 20_000);
    expect(res.body.error).toBe("already_leading");
  });

  it("refuses a bid above the available balance", async () => {
    const seller = await signUp("auctioneer", "s@example.com");
    const ana = await signUp("bidder", "ana@example.com", 10_000);
    const lot = await createLot(seller.auth);
    const res = await bid(lot, ana.auth, 10_001);
    expect(res.body).toMatchObject({ error: "insufficient_funds", availableCents: 10_000 });
  });

  it("counts the balance committed on other lots as unavailable", async () => {
    const seller = await signUp("auctioneer", "s@example.com");
    const ana = await signUp("bidder", "ana@example.com", 15_000);
    const lotA = await createLot(seller.auth);
    const lotB = await createLot(seller.auth);
    await bid(lotA, ana.auth, 10_000);
    const res = await bid(lotB, ana.auth, 10_000);
    expect(res.body).toMatchObject({ error: "insufficient_funds", availableCents: 5_000 });
  });

  it("refuses bids before the start and after the end", async () => {
    const seller = await signUp("auctioneer", "s@example.com");
    const ana = await signUp("bidder", "ana@example.com", 50_000);
    const future = await createLot(seller.auth, { startsAt: minutes(10), endsAt: minutes(20) });
    const over = await createLot(seller.auth);
    await pool.query(
      "UPDATE lots SET starts_at = now() - interval '2 hours', ends_at = now() - interval '1 hour' WHERE id = $1",
      [over],
    );
    expect((await bid(future, ana.auth, 10_000)).body.error).toBe("lot_not_started");
    expect((await bid(over, ana.auth, 10_000)).body.error).toBe("lot_ended");
  });

  it("refuses cancelled lots, auctioneers and anonymous users", async () => {
    const seller = await signUp("auctioneer", "s@example.com");
    const ana = await signUp("bidder", "ana@example.com", 50_000);
    const lot = await createLot(seller.auth);
    expect((await bid(lot, seller.auth, 10_000)).status).toBe(403);
    expect((await request(app).post(`/lots/${lot}/bids`).send({ amountCents: 10_000 })).status).toBe(401);
    await request(app).post(`/lots/${lot}/cancel`).set("Authorization", seller.auth);
    expect((await bid(lot, ana.auth, 10_000)).status).toBe(404);
  });
});

describe("anti-sniping", () => {
  it("extends the end by 2 minutes when a bid lands in the last 2 minutes", async () => {
    const seller = await signUp("auctioneer", "s@example.com");
    const ana = await signUp("bidder", "ana@example.com", 50_000);
    const endsAt = minutes(1);
    const lot = await createLot(seller.auth, { endsAt });
    const res = await bid(lot, ana.auth, 10_000);
    expect(res.body.extended).toBe(true);
    expect(new Date(res.body.endsAt).getTime() - new Date(endsAt).getTime()).toBe(120_000);
  });

  it("leaves the end alone for earlier bids", async () => {
    const seller = await signUp("auctioneer", "s@example.com");
    const ana = await signUp("bidder", "ana@example.com", 50_000);
    const lot = await createLot(seller.auth, { endsAt: minutes(30) });
    expect((await bid(lot, ana.auth, 10_000)).body.extended).toBe(false);
  });
});

describe("hash chain", () => {
  it("links every accepted bid, and an edit made straight in the database is detected", async () => {
    const seller = await signUp("auctioneer", "s@example.com");
    const ana = await signUp("bidder", "ana@example.com", 50_000);
    const bruno = await signUp("bidder", "bruno@example.com", 50_000);
    const lot = await createLot(seller.auth);
    await bid(lot, ana.auth, 10_000);
    await bid(lot, bruno.auth, 11_000);
    await bid(lot, ana.auth, 12_000);

    expect(verifyChain(await storedChain(lot), config.hashSecret)).toEqual({ valid: true });

    await pool.query("UPDATE bids SET amount_cents = 1 WHERE lot_id = $1 AND seq = 2", [lot]);
    expect(verifyChain(await storedChain(lot), config.hashSecret)).toEqual({ valid: false, brokenAtSeq: 2 });
  });
});

describe("concurrency", () => {
  it("accepts exactly one of several simultaneous identical bids", async () => {
    const seller = await signUp("auctioneer", "s@example.com");
    const bidders = await Promise.all([1, 2, 3, 4, 5].map((i) => signUp("bidder", `b${i}@example.com`, 50_000)));
    const lot = await createLot(seller.auth);
    const results = await Promise.all(bidders.map((b) => bid(lot, b.auth, 10_000)));

    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(results.filter((r) => r.body.error === "below_minimum")).toHaveLength(4);
    const { rows } = await pool.query("SELECT sum(committed_cents)::int AS committed FROM users");
    expect(rows[0].committed).toBe(10_000);
  });

  it("accepts only one bid when a single bidder fires several in parallel", async () => {
    const seller = await signUp("auctioneer", "s@example.com");
    const ana = await signUp("bidder", "ana@example.com", 100_000);
    const lot = await createLot(seller.auth);
    const results = await Promise.all([10_000, 11_000, 12_000, 13_000].map((a) => bid(lot, ana.auth, a)));
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    const accepted = results.find((r) => r.status === 201)!;
    expect((await wallet(ana.auth)).committedCents).toBe(accepted.body.amountCents);
  });

  it("keeps the ledger consistent under a bidding war on one lot", async () => {
    const seller = await signUp("auctioneer", "s@example.com");
    const bidders = await Promise.all([1, 2, 3].map((i) => signUp("bidder", `w${i}@example.com`, 1_000_000)));
    const lot = await createLot(seller.auth);
    const amounts = Array.from({ length: 12 }, (_, i) => 10_000 + i * 500);
    await Promise.all(amounts.map((a, i) => bid(lot, bidders[i % 3]!.auth, a)));

    const chain = await storedChain(lot);
    chain.forEach((b, i) => expect(b.seq).toBe(i + 1));
    for (let i = 1; i < chain.length; i++) {
      expect(chain[i]!.amountCents).toBeGreaterThanOrEqual(chain[i - 1]!.amountCents + 500);
      expect(chain[i]!.bidderId).not.toBe(chain[i - 1]!.bidderId);
    }
    expect(verifyChain(chain, config.hashSecret)).toEqual({ valid: true });
    const committed = await pool.query("SELECT sum(committed_cents)::int AS c FROM users");
    expect(committed.rows[0].c).toBe(chain.at(-1)!.amountCents);
  });

  it("does not deadlock when bidders cross-bid on two lots at once", async () => {
    const seller = await signUp("auctioneer", "s@example.com");
    const ana = await signUp("bidder", "ana@example.com", 100_000);
    const bruno = await signUp("bidder", "bruno@example.com", 100_000);
    const lot1 = await createLot(seller.auth);
    const lot2 = await createLot(seller.auth);
    await bid(lot1, bruno.auth, 10_000);
    await bid(lot2, ana.auth, 10_000);
    const results = await Promise.all([bid(lot1, ana.auth, 20_000), bid(lot2, bruno.auth, 20_000)]);
    expect(results.map((r) => r.status)).toEqual([201, 201]);
  });
});
