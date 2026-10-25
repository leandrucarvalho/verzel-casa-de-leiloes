import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { resetDb } from "../test/db.js";

const app = createApp();
const bidder = { email: "Ana@Example.com", password: "senha-forte-1", nickname: "ana", role: "bidder" };

beforeEach(resetDb);

describe("POST /auth/register", () => {
  it("creates a user and returns a token", async () => {
    const res = await request(app).post("/auth/register").send(bidder);
    expect(res.status).toBe(201);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user).toMatchObject({ email: "ana@example.com", role: "bidder" });
    expect(res.body.user.password_hash).toBeUndefined();
  });

  it("rejects a duplicated e-mail", async () => {
    await request(app).post("/auth/register").send(bidder);
    const res = await request(app).post("/auth/register").send({ ...bidder, email: "ana@example.com" });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("email_taken");
  });

  it("rejects a short password", async () => {
    const res = await request(app).post("/auth/register").send({ ...bidder, password: "123" });
    expect(res.status).toBe(400);
  });

  it("rejects an unknown role", async () => {
    const res = await request(app).post("/auth/register").send({ ...bidder, role: "admin" });
    expect(res.status).toBe(400);
  });
});

describe("POST /auth/login", () => {
  it("logs in with the right credentials", async () => {
    await request(app).post("/auth/register").send(bidder);
    const res = await request(app).post("/auth/login").send({ email: "ana@example.com", password: bidder.password });
    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
  });

  it("refuses a wrong password and an unknown e-mail with the same error", async () => {
    await request(app).post("/auth/register").send(bidder);
    const wrong = await request(app).post("/auth/login").send({ email: "ana@example.com", password: "errada-123" });
    const unknown = await request(app).post("/auth/login").send({ email: "x@example.com", password: "errada-123" });
    expect(wrong.status).toBe(401);
    expect(unknown.body).toEqual(wrong.body);
  });
});

describe("GET /auth/me", () => {
  it("returns the logged user", async () => {
    const { body } = await request(app).post("/auth/register").send(bidder);
    const res = await request(app).get("/auth/me").set("Authorization", `Bearer ${body.token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.nickname).toBe("ana");
  });

  it("requires a valid token", async () => {
    expect((await request(app).get("/auth/me")).status).toBe(401);
    expect((await request(app).get("/auth/me").set("Authorization", "Bearer lixo")).status).toBe(401);
  });
});

describe("login rate limit", () => {
  const wrong = (headers: Record<string, string> = {}) =>
    request(app).post("/auth/login").set(headers).send({ email: "ana@example.com", password: "errada-errada" });

  it("blocks an account after 10 failed attempts and tells how long to wait", async () => {
    await request(app).post("/auth/register").send(bidder);
    for (let i = 0; i < 10; i++) expect((await wrong()).status).toBe(401);
    const res = await wrong();
    expect(res.status).toBe(429);
    expect(res.body.error).toBe("too_many_requests");
    expect(res.body.message).toMatch(/Tente de novo em/);
    expect(Number(res.headers["retry-after"])).toBeGreaterThan(0);
    // even the right password waits, otherwise the limit would not slow a password guesser down
    const right = await request(app).post("/auth/login").send({ email: "ana@example.com", password: bidder.password });
    expect(right.status).toBe(429);
  });

  it("blocks the account no matter which address each attempt appears to come from", async () => {
    await request(app).post("/auth/register").send(bidder);
    for (let i = 0; i < 10; i++) expect((await wrong({ "CF-Connecting-IP": `203.0.113.${i}` })).status).toBe(401);
    expect((await wrong({ "CF-Connecting-IP": "203.0.113.200" })).status).toBe(429);
    expect((await wrong({ "X-Forwarded-For": "198.51.100.7" })).status).toBe(429);
  });

  it("does not count the failures of one account against another", async () => {
    await request(app).post("/auth/register").send(bidder);
    await request(app).post("/auth/register").send({ ...bidder, email: "bruno@example.com", nickname: "bruno" });
    for (let i = 0; i < 10; i++) await wrong();
    const other = await request(app).post("/auth/login").send({ email: "bruno@example.com", password: bidder.password });
    expect(other.status).toBe(200);
  });

  it("a correct login clears the failures", async () => {
    await request(app).post("/auth/register").send(bidder);
    for (let round = 0; round < 3; round++) {
      for (let i = 0; i < 9; i++) await wrong();
      const ok = await request(app).post("/auth/login").send({ email: "ana@example.com", password: bidder.password });
      expect(ok.status).toBe(200);
    }
  });

  const guess = (n: number, headers: Record<string, string> = {}) =>
    request(app).post("/auth/login").set(headers).send({ email: `ninguem${n}@example.com`, password: "errada-errada" });

  it("also blocks an address that tries many different e-mails, when the host reports the address", async () => {
    const from = { "CF-Connecting-IP": "203.0.113.9" };
    for (let i = 0; i < 100; i++) expect((await guess(i, from)).status).toBe(401);
    expect((await guess(100, from)).status).toBe(429);
    expect((await guess(101, { "CF-Connecting-IP": "203.0.113.10" })).status).toBe(401);
  });

  it("skips the per-address limit when the host does not report an address", async () => {
    for (let i = 0; i < 105; i++) expect((await guess(i)).status).toBe(401);
  });
});
