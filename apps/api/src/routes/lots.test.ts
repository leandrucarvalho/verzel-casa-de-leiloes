import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { pool } from "../db/pool.js";
import { resetDb } from "../test/db.js";

const app = createApp();
const hours = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();

async function signUp(role: "bidder" | "auctioneer", email: string) {
  const res = await request(app).post("/auth/register").send({ email, password: "senha-forte-1", nickname: "nick", role });
  return { auth: `Bearer ${res.body.token}`, id: res.body.user.id as string };
}

const lotBody = (over: Record<string, unknown> = {}) => ({
  externalId: "27992",
  title: "A Sunday on La Grande Jatte",
  imageUrl: "https://example.com/a.jpg",
  attributes: { artist: "Seurat" },
  startingBidCents: 10_000,
  minIncrementCents: 500,
  startsAt: hours(-1),
  endsAt: hours(1),
  ...over,
});

async function create(auth: string, over: Record<string, unknown> = {}) {
  return request(app).post("/lots").set("Authorization", auth).send(lotBody(over));
}

beforeEach(resetDb);

describe("POST /lots", () => {
  it("creates a lot with an item snapshot", async () => {
    const { auth } = await signUp("auctioneer", "l@example.com");
    const res = await create(auth);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ title: "A Sunday on La Grande Jatte", status: "live", currentBidCents: null, bidCount: 0 });
  });

  it("is restricted to auctioneers", async () => {
    const { auth } = await signUp("bidder", "b@example.com");
    expect((await create(auth)).status).toBe(403);
    expect((await request(app).post("/lots").send(lotBody())).status).toBe(401);
  });

  it.each([
    ["end before start", { startsAt: hours(2), endsAt: hours(1) }],
    ["end in the past", { startsAt: hours(-3), endsAt: hours(-2) }],
    ["zero starting bid", { startingBidCents: 0 }],
    ["fractional increment", { minIncrementCents: 1.5 }],
  ])("rejects %s", async (_name, over) => {
    const { auth } = await signUp("auctioneer", "l@example.com");
    expect((await create(auth, over)).status).toBe(400);
  });
});

describe("GET /lots", () => {
  it("splits lots by phase and hides cancelled ones", async () => {
    const { auth } = await signUp("auctioneer", "l@example.com");
    await create(auth, { title: "live" });
    await create(auth, { title: "scheduled", startsAt: hours(1), endsAt: hours(2) });
    const ended = await create(auth, { title: "ended" });
    await pool.query("UPDATE lots SET starts_at = now() - interval '3 hours', ends_at = now() - interval '1 hour' WHERE id = $1", [ended.body.id]);
    const cancelled = await create(auth, { title: "cancelled" });
    await request(app).post(`/lots/${cancelled.body.id}/cancel`).set("Authorization", auth);

    const titles = async (query: string) => (await request(app).get(`/lots${query}`)).body.map((l: { title: string }) => l.title);
    expect(await titles("?status=live")).toEqual(["live"]);
    expect(await titles("?status=scheduled")).toEqual(["scheduled"]);
    expect(await titles("?status=ended")).toEqual(["ended"]);
    expect((await titles("")).sort()).toEqual(["ended", "live", "scheduled"]);
  });

  it("filters by title", async () => {
    const { auth } = await signUp("auctioneer", "l@example.com");
    await create(auth, { title: "Mona Lisa" });
    await create(auth, { title: "Starry Night" });
    const res = await request(app).get("/lots?q=starry");
    expect(res.body.map((l: { title: string }) => l.title)).toEqual(["Starry Night"]);
  });

  it("filters by artist too", async () => {
    const { auth } = await signUp("auctioneer", "l@example.com");
    await create(auth, { title: "The Red Kerchief", attributes: { artist: "Claude Monet (French, 1840–1926)" } });
    await create(auth, { title: "Starry Night", attributes: { artist: "Vincent van Gogh" } });
    const res = await request(app).get("/lots?q=monet");
    expect(res.body.map((l: { title: string }) => l.title)).toEqual(["The Red Kerchief"]);
  });

  it("rejects an unknown status", async () => {
    expect((await request(app).get("/lots?status=foo")).status).toBe(400);
  });
});

describe("GET /lots/:id", () => {
  it("returns a lot and 404s for unknown, malformed or cancelled ids", async () => {
    const { auth } = await signUp("auctioneer", "l@example.com");
    const lot = await create(auth);
    expect((await request(app).get(`/lots/${lot.body.id}`)).status).toBe(200);
    expect((await request(app).get("/lots/not-a-uuid")).status).toBe(404);
    expect((await request(app).get("/lots/6b0cbd2a-0000-4000-8000-000000000000")).status).toBe(404);
    await request(app).post(`/lots/${lot.body.id}/cancel`).set("Authorization", auth);
    expect((await request(app).get(`/lots/${lot.body.id}`)).status).toBe(404);
  });
});

describe("POST /lots/:id/cancel", () => {
  it("cancels a lot without bids", async () => {
    const { auth } = await signUp("auctioneer", "l@example.com");
    const lot = await create(auth);
    const res = await request(app).post(`/lots/${lot.body.id}/cancel`).set("Authorization", auth);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("cancelled");
  });

  it("releases the leader's committed balance and records a refund", async () => {
    const { auth } = await signUp("auctioneer", "l@example.com");
    const ana = await signUp("bidder", "a@example.com");
    const bruno = await signUp("bidder", "b@example.com");
    for (const b of [ana, bruno]) await request(app).post("/wallet/deposit").set("Authorization", b.auth).send({ amountCents: 50_000 });
    const lot = await create(auth);
    await request(app).post(`/lots/${lot.body.id}/bids`).set("Authorization", ana.auth).send({ amountCents: 10_000 });
    await request(app).post(`/lots/${lot.body.id}/bids`).set("Authorization", bruno.auth).send({ amountCents: 10_500 });

    const res = await request(app).post(`/lots/${lot.body.id}/cancel`).set("Authorization", auth);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("cancelled");

    const brunoWallet = (await request(app).get("/wallet").set("Authorization", bruno.auth)).body;
    expect(brunoWallet).toMatchObject({ totalCents: 50_000, committedCents: 0, availableCents: 50_000 });
    expect(brunoWallet.entries[0]).toMatchObject({ kind: "refund", amountCents: 10_500, lotId: lot.body.id });

    // Ana was outbid earlier, so she had nothing left to release
    const anaWallet = (await request(app).get("/wallet").set("Authorization", ana.auth)).body;
    expect(anaWallet).toMatchObject({ totalCents: 50_000, committedCents: 0 });
    expect(anaWallet.entries.some((e: { kind: string }) => e.kind === "refund")).toBe(false);
  });

  it("stops accepting bids on the cancelled lot", async () => {
    const { auth } = await signUp("auctioneer", "l@example.com");
    const bidder = await signUp("bidder", "b@example.com");
    await request(app).post("/wallet/deposit").set("Authorization", bidder.auth).send({ amountCents: 50_000 });
    const lot = await create(auth);
    await request(app).post(`/lots/${lot.body.id}/cancel`).set("Authorization", auth);
    const res = await request(app).post(`/lots/${lot.body.id}/bids`).set("Authorization", bidder.auth).send({ amountCents: 10_000 });
    expect(res.status).toBe(404);
  });

  it("refuses to cancel a lot whose time is up", async () => {
    const { auth } = await signUp("auctioneer", "l@example.com");
    const lot = await create(auth);
    await pool.query("UPDATE lots SET starts_at = now() - interval '2 hours', ends_at = now() - interval '1 hour' WHERE id = $1", [lot.body.id]);
    const res = await request(app).post(`/lots/${lot.body.id}/cancel`).set("Authorization", auth);
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("lot_not_cancellable");
  });

  it("refuses another auctioneer", async () => {
    const owner = await signUp("auctioneer", "l@example.com");
    const other = await signUp("auctioneer", "o@example.com");
    const lot = await create(owner.auth);
    expect((await request(app).post(`/lots/${lot.body.id}/cancel`).set("Authorization", other.auth)).status).toBe(404);
  });
});

describe("GET /lots/mine", () => {
  it("lists only the auctioneer's lots, including cancelled", async () => {
    const owner = await signUp("auctioneer", "l@example.com");
    const other = await signUp("auctioneer", "o@example.com");
    const lot = await create(owner.auth, { title: "mine" });
    await create(other.auth, { title: "theirs" });
    await request(app).post(`/lots/${lot.body.id}/cancel`).set("Authorization", owner.auth);
    const res = await request(app).get("/lots/mine").set("Authorization", owner.auth);
    expect(res.body.lots.map((l: { title: string; status: string }) => [l.title, l.status])).toEqual([["mine", "cancelled"]]);
    expect(res.body.totalReceivedCents).toBe(0);
  });
});
