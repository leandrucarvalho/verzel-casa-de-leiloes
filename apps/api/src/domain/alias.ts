import { createHmac } from "node:crypto";
import { config } from "../config.js";

// Public pseudonym of a bidder inside one lot: stable for that lot, unlinkable across lots,
// and not reversible without the server secret. No nickname or e-mail is exposed.
export function bidderAlias(userId: string, lotId: string): string {
  return `Licitante ${createHmac("sha256", config.hashSecret).update(`${lotId}:${userId}`).digest("hex").slice(0, 6)}`;
}
