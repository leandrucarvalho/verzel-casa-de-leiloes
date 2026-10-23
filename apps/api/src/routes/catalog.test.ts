import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app.js";
import { clearCatalogCache } from "../external/cleveland.js";
import { resetDb } from "../test/db.js";

const app = createApp();

const apiBody = {
  data: [
    {
      id: 135382,
      title: "The Red Kerchief",
      creation_date: "c. 1868–73",
      technique: "oil on fabric",
      culture: ["France, 19th century"],
      creators: [{ description: "Claude Monet (French, 1840–1926)" }],
      images: { web: { url: "https://openaccess-cdn.clevelandart.org/1958.39/1958.39_web.jpg" } },
    },
    { id: 1, title: "No image", images: null },
  ],
};

const ok = (_url?: unknown, _init?: RequestInit) => Promise.resolve(new Response(JSON.stringify(apiBody)));

async function auctioneerAuth() {
  const res = await request(app)
    .post("/auth/register")
    .send({ email: "s@example.com", password: "senha-forte-1", nickname: "seller", role: "auctioneer" });
  return `Bearer ${res.body.token}`;
}

beforeEach(async () => {
  await resetDb();
  clearCatalogCache();
});
afterEach(() => vi.unstubAllGlobals());

describe("GET /catalog/search", () => {
  it("maps artworks into snapshot-ready items and drops the ones without image", async () => {
    vi.stubGlobal("fetch", vi.fn(ok));
    const res = await request(app).get("/catalog/search?q=monet").set("Authorization", await auctioneerAuth());
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([
      {
        externalId: "135382",
        title: "The Red Kerchief",
        imageUrl: "https://openaccess-cdn.clevelandart.org/1958.39/1958.39_web.jpg",
        attributes: {
          artist: "Claude Monet (French, 1840–1926)",
          date: "c. 1868–73",
          medium: "oil on fabric",
          origin: "France, 19th century",
        },
      },
    ]);
  });

  it("serves repeated searches from the cache", async () => {
    const fetchMock = vi.fn(ok);
    vi.stubGlobal("fetch", fetchMock);
    const auth = await auctioneerAuth();
    await request(app).get("/catalog/search?q=monet").set("Authorization", auth);
    await request(app).get("/catalog/search?q=Monet").set("Authorization", auth);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("answers 503 with a clear message when the API is down and nothing is cached", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("down"))));
    const res = await request(app).get("/catalog/search?q=monet").set("Authorization", await auctioneerAuth());
    expect(res.status).toBe(503);
    expect(res.body.error).toBe("catalog_unavailable");
  });

  it("treats an error status or unexpected payload as an outage", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response("<html>oops</html>", { status: 403 }))));
    const auth = await auctioneerAuth();
    expect((await request(app).get("/catalog/search?q=monet").set("Authorization", auth)).status).toBe(503);
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(JSON.stringify({ nope: true })))));
    expect((await request(app).get("/catalog/search?q=turner").set("Authorization", auth)).status).toBe(503);
  });

  it("serves stale results when the API fails after a successful search", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const fetchMock = vi.fn(ok);
    vi.stubGlobal("fetch", fetchMock);
    const auth = await auctioneerAuth();
    await request(app).get("/catalog/search?q=monet").set("Authorization", auth);
    vi.setSystemTime(Date.now() + 11 * 60_000);
    fetchMock.mockImplementation(() => Promise.reject(new Error("down")));
    const res = await request(app).get("/catalog/search?q=monet").set("Authorization", auth);
    vi.useRealTimers();
    expect(res.status).toBe(200);
    expect(res.body.stale).toBe(true);
    expect(res.body.items).toHaveLength(1);
  });

  it("validates the query and the role", async () => {
    vi.stubGlobal("fetch", vi.fn(ok));
    expect((await request(app).get("/catalog/search?q=a").set("Authorization", await auctioneerAuth())).status).toBe(400);
    const bidder = await request(app)
      .post("/auth/register")
      .send({ email: "b@example.com", password: "senha-forte-1", nickname: "bidder", role: "bidder" });
    expect((await request(app).get("/catalog/search?q=monet").set("Authorization", `Bearer ${bidder.body.token}`)).status).toBe(403);
    expect((await request(app).get("/catalog/search?q=monet")).status).toBe(401);
  });
});
