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

const newLot = async (auth: string, title: string) =>
  (
    await request(app).post("/lots").set("Authorization", auth).send({
      externalId: "1",
      title,
      startingBidCents: 10_000,
      minIncrementCents: 500,
      startsAt: minutes(-10),
      endsAt: minutes(60),
    })
  ).body.id as string;

const bid = (lotId: string, auth: string, amountCents: number) =>
  request(app).post(`/lots/${lotId}/bids`).set("Authorization", auth).send({ amountCents });

const mine = async (auth: string) => (await request(app).get("/lots/participating").set("Authorization", auth)).body;

beforeEach(resetDb);

describe("GET /lots/participating", () => {
  it("lists the lots the bidder bid on with their standing", async () => {
    const seller = await signUp("auctioneer", "s@example.com");
    const ana = await signUp("bidder", "ana@example.com", 100_000);
    const bruno = await signUp("bidder", "bruno@example.com", 100_000);
    const leading = await newLot(seller.auth, "leading");
    const outbid = await newLot(seller.auth, "outbid");
    await newLot(seller.auth, "untouched");
    await bid(leading, ana.auth, 10_000);
    await bid(outbid, ana.auth, 10_000);
    await bid(outbid, bruno.auth, 11_000);

    const lots = await mine(ana.auth);
    const byTitle = Object.fromEntries(lots.map((l: { title: string }) => [l.title, l]));
    expect(Object.keys(byTitle).sort()).toEqual(["leading", "outbid"]);
    expect(byTitle.leading).toMatchObject({ leading: true, myBidCents: 10_000, receiptToken: null });
    expect(byTitle.outbid).toMatchObject({ leading: false, myBidCents: 10_000, currentBidCents: 11_000 });
  });

  it("gives the receipt token for won lots only", async () => {
    const seller = await signUp("auctioneer", "s@example.com");
    const ana = await signUp("bidder", "ana@example.com", 100_000);
    const bruno = await signUp("bidder", "bruno@example.com", 100_000);
    const lot = await newLot(seller.auth, "won");
    await bid(lot, ana.auth, 10_000);
    await bid(lot, bruno.auth, 11_000);
    await pool.query("UPDATE lots SET starts_at = now() - interval '2 hours', ends_at = now() - interval '1 second' WHERE id = $1", [lot]);

    const [winner] = await mine(bruno.auth);
    const [loser] = await mine(ana.auth);
    expect(winner).toMatchObject({ status: "ended", result: "sold", leading: true });
    expect(winner.receiptToken).toEqual(expect.any(String));
    expect(loser).toMatchObject({ result: "sold", leading: false, receiptToken: null });
  });

  it("is restricted to bidders", async () => {
    const seller = await signUp("auctioneer", "s@example.com");
    expect((await request(app).get("/lots/participating").set("Authorization", seller.auth)).status).toBe(403);
    expect((await request(app).get("/lots/participating")).status).toBe(401);
  });
});
