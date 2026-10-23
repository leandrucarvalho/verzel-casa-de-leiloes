import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../errors.js";
import { readToken, type AuthUser, type Role } from "./token.js";

declare module "express-serve-static-core" {
  interface Request {
    user?: AuthUser;
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? "";
  const user = header.startsWith("Bearer ") ? readToken(header.slice(7)) : null;
  if (!user) throw new HttpError(401, "unauthorized", "Faça login para continuar.");
  req.user = user;
  next();
}

// For public routes that tailor the answer to the logged user (an invalid token is just anonymous).
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? "";
  const user = header.startsWith("Bearer ") ? readToken(header.slice(7)) : null;
  if (user) req.user = user;
  next();
}

export function requireRole(role: Role) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (req.user?.role !== role) throw new HttpError(403, "forbidden", "Seu perfil não pode fazer isso.");
    next();
  };
}
