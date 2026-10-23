import type { AddressInfo } from "node:net";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
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

async function newLot(auth: string) {
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

beforeEach(resetDb);

describe("GET /lots/:id/room", () => {
  it("is public and tells the minimum next bid", async () => {
    const seller = await signUp("auctioneer", "s@example.com");
    const ana = await signUp("bidder", "ana@example.com", 100_000);
    const lot = await newLot(seller.auth);

    const empty = await request(app).get(`/lots/${lot}/room`);
    expect(empty.status).toBe(200);
    expect(empty.body).toMatchObject({ minimumNextBidCents: 10_000, bids: [], me: null });
    expect(new Date(empty.body.serverTime).getTime()).toBeGreaterThan(0);

    await bid(lot, ana.auth, 10_000);
    const after = await request(app).get(`/lots/${lot}/room`);
    expect(after.body.minimumNextBidCents).toBe(10_500);
    expect(after.body.bids).toHaveLength(1);
    expect(after.body.bids[0].mine).toBe(false);
  });

  it("lists the newest bids first with aliases only", async () => {
    const seller = await signUp("auctioneer", "s@example.com");
    const ana = await signUp("bidder", "ana@example.com", 100_000);
    const bruno = await signUp("bidder", "bruno@example.com", 100_000);
    const lot = await newLot(seller.auth);
    await bid(lot, ana.auth, 10_000);
    await bid(lot, bruno.auth, 11_000);
    const { body } = await request(app).get(`/lots/${lot}/room`);
    expect(body.bids.map((b: { amountCents: number }) => b.amountCents)).toEqual([11_000, 10_000]);
    const text = JSON.stringify(body.bids);
    for (const hidden of ["ana", "bruno", ana.id, bruno.id]) expect(text).not.toContain(hidden);
  });

  it("tells the logged bidder whether they are leading or outbid", async () => {
    const seller = await signUp("auctioneer", "s@example.com");
    const ana = await signUp("bidder", "ana@example.com", 100_000);
    const bruno = await signUp("bidder", "bruno@example.com", 100_000);
    const lot = await newLot(seller.auth);
    await bid(lot, ana.auth, 10_000);

    const room = (auth: string) => request(app).get(`/lots/${lot}/room`).set("Authorization", auth).then((r) => r.body);
    expect((await room(ana.auth)).me).toEqual({ leading: true, outbid: false, myBidCents: 10_000 });
    expect((await room(bruno.auth)).me).toEqual({ leading: false, outbid: false, myBidCents: null });

    await bid(lot, bruno.auth, 11_000);
    const anaView = await room(ana.auth);
    expect(anaView.me).toEqual({ leading: false, outbid: true, myBidCents: 10_000 });
    expect(anaView.bids.find((b: { mine: boolean }) => b.mine).amountCents).toBe(10_000);
  });

  it("treats an invalid token as anonymous and 404s for cancelled or unknown lots", async () => {
    const seller = await signUp("auctioneer", "s@example.com");
    const lot = await newLot(seller.auth);
    const res = await request(app).get(`/lots/${lot}/room`).set("Authorization", "Bearer lixo");
    expect(res.status).toBe(200);
    expect(res.body.me).toBeNull();
    await request(app).post(`/lots/${lot}/cancel`).set("Authorization", seller.auth);
    expect((await request(app).get(`/lots/${lot}/room`)).status).toBe(404);
    expect((await request(app).get("/lots/nope/room")).status).toBe(404);
  });
});

describe("GET /lots/:id/events", () => {
  it("pushes an update to subscribers when a bid is placed", async () => {
    const seller = await signUp("auctioneer", "s@example.com");
    const ana = await signUp("bidder", "ana@example.com", 100_000);
    const lot = await newLot(seller.auth);

    const server = app.listen(0);
    const controller = new AbortController();
    try {
      const { port } = server.address() as AddressInfo;
      const res = await fetch(`http://127.0.0.1:${port}/lots/${lot}/events`, { signal: controller.signal });
      expect(res.headers.get("content-type")).toContain("text/event-stream");
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();

      const readUntil = async (needle: string) => {
        let text = "";
        while (!text.includes(needle)) {
          const { value, done } = await reader.read();
          if (done) break;
          text += decoder.decode(value);
        }
        return text;
      };

      expect(await readUntil(": connected")).toContain(": connected");
      await bid(lot, ana.auth, 10_000);
      expect(await readUntil("event: update")).toContain("event: update");
    } finally {
      controller.abort();
      server.close();
    }
  });

  it("rejects a malformed id", async () => {
    expect((await request(app).get("/lots/nope/events")).status).toBe(404);
  });
});
