import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { resetDb } from "../test/db.js";

const app = createApp();

async function signUp(role: "bidder" | "auctioneer", email: string) {
  const res = await request(app).post("/auth/register").send({ email, password: "senha-forte-1", nickname: "nick", role });
  return `Bearer ${res.body.token}`;
}

beforeEach(resetDb);

describe("wallet", () => {
  it("starts empty", async () => {
    const auth = await signUp("bidder", "a@example.com");
    const res = await request(app).get("/wallet").set("Authorization", auth);
    expect(res.body).toMatchObject({ totalCents: 0, committedCents: 0, availableCents: 0, entries: [] });
  });

  it("accumulates deposits and records them", async () => {
    const auth = await signUp("bidder", "a@example.com");
    await request(app).post("/wallet/deposit").set("Authorization", auth).send({ amountCents: 10_000 });
    const res = await request(app).post("/wallet/deposit").set("Authorization", auth).send({ amountCents: 2_500 });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ totalCents: 12_500, availableCents: 12_500 });
    expect(res.body.entries).toHaveLength(2);
  });

  it.each([0, -5, 10.5, 1_000_000_01])("rejects an invalid amount (%s)", async (amountCents) => {
    const auth = await signUp("bidder", "a@example.com");
    const res = await request(app).post("/wallet/deposit").set("Authorization", auth).send({ amountCents });
    expect(res.status).toBe(400);
  });

  it("does not let an auctioneer deposit", async () => {
    const auth = await signUp("auctioneer", "l@example.com");
    const res = await request(app).post("/wallet/deposit").set("Authorization", auth).send({ amountCents: 100 });
    expect(res.status).toBe(403);
  });

  it("requires login", async () => {
    expect((await request(app).get("/wallet")).status).toBe(401);
  });
});
