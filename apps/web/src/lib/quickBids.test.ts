import { describe, expect, it } from "vitest";
import { quickBids } from "./quickBids";

describe("quickBids", () => {
  it("starts at the minimum and adds one and two increments", () => {
    expect(quickBids(120_000, 5_000)).toEqual([120_000, 125_000, 130_000]);
  });

  it("works with the starting bid before anyone has bid", () => {
    expect(quickBids(100_000, 100)).toEqual([100_000, 100_100, 100_200]);
  });
});
