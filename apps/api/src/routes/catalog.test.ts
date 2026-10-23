import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app.js";
import { clearCatalogCache } from "../external/artic.js";
import { resetDb } from "../test/db.js";

const app = createApp();

const apiBody = {
  data: [
    {
      id: 27992,
      title: "A Sunday on La Grande Jatte",
      image_id: "abc",
      artist_display: "Georges Seurat\nFrench, 1859–1891",
      date_display: "1884",
      medium_display: "Oil on canvas",
      place_of_origin: "France",
    },
    { id: 1, title: "No image", image_id: null },
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
    const fetchMock = vi.fn(ok);
    vi.stubGlobal("fetch", fetchMock);
    const res = await request(app).get("/catalog/search?q=seurat").set("Authorization", await auctioneerAuth());
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([
      {
        externalId: "27992",
        title: "A Sunday on La Grande Jatte",
        imageUrl: "https://www.artic.edu/iiif/2/abc/full/843,/0/default.jpg",
        attributes: { artist: "Georges Seurat — French, 1859–1891", date: "1884", medium: "Oil on canvas", origin: "France" },
      },
    ]);
    const headers = fetchMock.mock.calls[0]![1]!.headers as Record<string, string>;
    expect(headers["User-Agent"]).toContain("verzel");
  });

  it("serves repeated searches from the cache", async () => {
    const fetchMock = vi.fn(ok);
    vi.stubGlobal("fetch", fetchMock);
    const auth = await auctioneerAuth();
    await request(app).get("/catalog/search?q=seurat").set("Authorization", auth);
    await request(app).get("/catalog/search?q=Seurat").set("Authorization", auth);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("answers 503 with a clear message when the API is down and nothing is cached", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("down"))));
    const res = await request(app).get("/catalog/search?q=seurat").set("Authorization", await auctioneerAuth());
    expect(res.status).toBe(503);
    expect(res.body.error).toBe("catalog_unavailable");
  });

  it("treats a challenge page or unexpected payload as an outage", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response("<html>Just a moment...</html>", { status: 403 }))));
    const res = await request(app).get("/catalog/search?q=seurat").set("Authorization", await auctioneerAuth());
    expect(res.status).toBe(503);
  });

  it("serves stale results when the API fails after a successful search", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const fetchMock = vi.fn(ok);
    vi.stubGlobal("fetch", fetchMock);
    const auth = await auctioneerAuth();
    await request(app).get("/catalog/search?q=seurat").set("Authorization", auth);
    vi.setSystemTime(Date.now() + 11 * 60_000);
    fetchMock.mockImplementation(() => Promise.reject(new Error("down")));
    const res = await request(app).get("/catalog/search?q=seurat").set("Authorization", auth);
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
    expect((await request(app).get("/catalog/search?q=seurat").set("Authorization", `Bearer ${bidder.body.token}`)).status).toBe(403);
    expect((await request(app).get("/catalog/search?q=seurat")).status).toBe(401);
  });
});
