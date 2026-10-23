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
