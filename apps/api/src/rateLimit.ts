import type { Request } from "express";
import { HttpError } from "./errors.js";

// Fixed-window counters per key. Small on purpose, no dependency.
// shortcut: counters live in this process's memory, so a restart clears them and each instance counts on its own;
// move them to Redis or a table when the API runs on more than one instance.
export class RateLimiter {
  private hits = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private max: number,
    private windowMs: number,
    private now: () => number = Date.now,
  ) {}

  // Throws 429 when the key already used all its hits in the current window.
  assertOpen(key: string) {
    const entry = this.hits.get(key);
    if (!entry || entry.resetAt <= this.now() || entry.count < this.max) return;
    const seconds = Math.ceil((entry.resetAt - this.now()) / 1000);
    const wait = seconds >= 60 ? `${Math.ceil(seconds / 60)} min` : `${seconds} s`;
    throw new HttpError(429, "too_many_requests", `Muitas tentativas. Tente de novo em ${wait}.`, { retryAfterSeconds: seconds });
  }

  add(key: string) {
    const now = this.now();
    if (this.hits.size > 5_000) for (const [k, v] of this.hits) if (v.resetAt <= now) this.hits.delete(k);
    const entry = this.hits.get(key);
    if (!entry || entry.resetAt <= now) this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
    else entry.count += 1;
  }

  // Counts one hit, refusing it when the key is out of hits.
  take(key: string) {
    this.assertOpen(key);
    this.add(key);
  }

  reset(key: string) {
    this.hits.delete(key);
  }

  clear() {
    this.hits.clear();
  }
}

const MINUTE = 60_000;

// Only failed logins count, so people who know their password are never locked out.
// The account limit is keyed by e-mail alone: behind the host's proxies the address the API sees changes from one
// request to the next, so an IP-based key never filled up (found by testing in production).
// shortcut: anyone can lock an account for the window by failing on purpose; add a CAPTCHA or a per-device token if that matters.
export const loginFailuresByEmail = new RateLimiter(10, 15 * MINUTE);
export const loginFailuresByIp = new RateLimiter(100, 15 * MINUTE);
export const registrationsByIp = new RateLimiter(30, 60 * MINUTE);
export const bidsByUser = new RateLimiter(30, MINUTE);

// The real client address as Cloudflare (in front of Render) reports it, which callers cannot overwrite there.
// Without that header (local runs, other hosts) clients cannot be told apart, so the per-IP limits are skipped.
export const clientIp = (req: Request) => req.get("cf-connecting-ip") || undefined;

export function resetRateLimits() {
  for (const l of [loginFailuresByEmail, loginFailuresByIp, registrationsByIp, bidsByUser]) l.clear();
}
