import jwt from "jsonwebtoken";
import { config } from "../config.js";

export type Role = "auctioneer" | "bidder";
export interface AuthUser {
  id: string;
  role: Role;
}

export function signToken(user: AuthUser): string {
  return jwt.sign({ role: user.role }, config.jwtSecret, { subject: user.id, expiresIn: "7d" });
}

export function readToken(token: string): AuthUser | null {
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    if (typeof payload === "string" || !payload.sub) return null;
    return { id: payload.sub, role: payload.role };
  } catch {
    return null;
  }
}
