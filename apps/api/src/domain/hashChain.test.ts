import { describe, expect, it } from "vitest";
import { GENESIS_HASH, hashBid, verifyChain, type ChainBid } from "./hashChain.js";

const secret = "test-secret";

function build(inputs: Omit<ChainBid, "seq" | "prevHash" | "hash">[]): ChainBid[] {
  const chain: ChainBid[] = [];
  for (const input of inputs) {
    const seq = chain.length + 1;
    const prevHash = chain.at(-1)?.hash ?? GENESIS_HASH;
    chain.push({ ...input, seq, prevHash, hash: hashBid({ ...input, seq, prevHash }, secret) });
  }
  return chain;
}

const bids = () =>
  build([
    { lotId: "lot-1", bidderId: "a", amountCents: 1000, placedAt: "2026-10-25T10:00:00.000Z" },
    { lotId: "lot-1", bidderId: "b", amountCents: 1500, placedAt: "2026-10-25T10:01:00.000Z" },
    { lotId: "lot-1", bidderId: "a", amountCents: 2000, placedAt: "2026-10-25T10:02:00.000Z" },
  ]);

describe("verifyChain", () => {
  it("accepts an untouched chain", () => {
    expect(verifyChain(bids(), secret)).toEqual({ valid: true });
  });

  it("accepts an empty chain", () => {
    expect(verifyChain([], secret)).toEqual({ valid: true });
  });

  it("detects an altered amount", () => {
    const chain = bids();
    chain[1]!.amountCents = 1;
    expect(verifyChain(chain, secret)).toEqual({ valid: false, brokenAtSeq: 2 });
  });

  it("detects a removed bid", () => {
    const chain = bids();
    chain.splice(1, 1);
    expect(verifyChain(chain, secret).valid).toBe(false);
  });

  it("detects a bid inserted later", () => {
    const chain = bids();
    const forged: ChainBid = { ...chain[0]!, seq: 2, bidderId: "c", amountCents: 1200 };
    chain.splice(1, 0, forged);
    expect(verifyChain(chain, secret).valid).toBe(false);
  });

  it("detects a removed last bid when the expected final hash is known", () => {
    const chain = bids();
    const finalHash = chain.at(-1)!.hash;
    chain.pop();
    expect(verifyChain(chain, secret, finalHash)).toEqual({ valid: false, brokenAtSeq: 3 });
  });

  it("detects a recalculated chain when the secret is not known", () => {
    const forged = build([{ lotId: "lot-1", bidderId: "x", amountCents: 1, placedAt: "2026-10-25T10:00:00.000Z" }]);
    expect(verifyChain(forged, "wrong-secret").valid).toBe(false);
  });
});
