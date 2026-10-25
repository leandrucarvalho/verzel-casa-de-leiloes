import { describe, expect, it } from "vitest";
import { RateLimiter } from "./rateLimit.js";

describe("RateLimiter", () => {
  it("allows up to max hits, then refuses until the window ends", () => {
    let t = 0;
    const limiter = new RateLimiter(3, 60_000, () => t);
    for (let i = 0; i < 3; i++) limiter.take("k");
    expect(() => limiter.take("k")).toThrow(/Muitas tentativas/);
    t = 59_999;
    expect(() => limiter.take("k")).toThrow();
    t = 60_000;
    expect(() => limiter.take("k")).not.toThrow();
  });

  it("counts keys independently and reports how long to wait", () => {
    let t = 0;
    const limiter = new RateLimiter(1, 120_000, () => t);
    limiter.take("a");
    limiter.take("b");
    t = 30_000;
    expect(() => limiter.take("a")).toThrow(/2 min/);
    t = 100_000;
    expect(() => limiter.take("a")).toThrow(/20 s/);
  });

  it("assertOpen alone does not count, and reset reopens the key", () => {
    const limiter = new RateLimiter(1, 60_000);
    for (let i = 0; i < 5; i++) limiter.assertOpen("k");
    limiter.add("k");
    expect(() => limiter.assertOpen("k")).toThrow();
    limiter.reset("k");
    expect(() => limiter.assertOpen("k")).not.toThrow();
  });
});
