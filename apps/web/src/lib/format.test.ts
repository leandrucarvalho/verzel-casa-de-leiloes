import { describe, expect, it } from "vitest";
import { formatRemaining } from "./countdown";
import { formatBRL, parseBRLToCents } from "./format";

describe("parseBRLToCents", () => {
  it.each([
    ["12,50", 1250],
    ["12.5", 1250],
    ["1.234,56", 123456],
    ["100", 10000],
    [" 7,05 ", 705],
  ])("parses %s", (input, cents) => expect(parseBRLToCents(input)).toBe(cents));

  it.each(["", "abc", "0", "-5", "1,234", "12,5,0", "R$ 10"])("rejects %j", (input) =>
    expect(parseBRLToCents(input)).toBeNull(),
  );
});

describe("formatBRL", () => {
  it("formats cents as reais", () => {
    expect(formatBRL(123456).replace(/\s/g, " ")).toBe("R$ 1.234,56");
  });
});

describe("formatRemaining", () => {
  it.each([
    [3 * 86_400_000 + 5 * 3_600_000, "3d 5h"],
    [2 * 3_600_000 + 7 * 60_000, "2h 7min"],
    [12 * 60_000 + 5_000, "12:05"],
    [59_000, "0:59"],
    [0, "0:00"],
    [-5, "0:00"],
  ])("formats %d ms as %s", (ms, text) => expect(formatRemaining(ms)).toBe(text));
});
