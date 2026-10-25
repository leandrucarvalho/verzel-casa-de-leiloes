import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../auth/middleware.js";
import { hashPassword, verifyPassword } from "../auth/password.js";
import { signToken, type Role } from "../auth/token.js";
import { pool } from "../db/pool.js";
import { HttpError } from "../errors.js";
import { clientIp, loginFailuresByEmail, loginFailuresByIp, registrationsByIp } from "../rateLimit.js";

const registerSchema = z.object({
  email: z.email().transform((e) => e.toLowerCase()),
  password: z.string().min(8, "A senha precisa ter ao menos 8 caracteres."),
  nickname: z.string().trim().min(2).max(30),
  role: z.enum(["auctioneer", "bidder"]),
});

const loginSchema = z.object({ email: z.email().transform((e) => e.toLowerCase()), password: z.string() });

interface UserRow {
  id: string;
  email: string;
  nickname: string;
  role: Role;
  password_hash: string;
}

const publicUser = (u: UserRow) => ({ id: u.id, email: u.email, nickname: u.nickname, role: u.role });

export const authRouter = Router();

authRouter.post("/register", async (req, res) => {
  const ip = clientIp(req);
  if (ip) registrationsByIp.take(ip);
  const body = registerSchema.parse(req.body);
  const passwordHash = await hashPassword(body.password);
  try {
    const { rows } = await pool.query<UserRow>(
      "INSERT INTO users (email, password_hash, nickname, role) VALUES ($1, $2, $3, $4) RETURNING *",
      [body.email, passwordHash, body.nickname, body.role],
    );
    const user = rows[0]!;
    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  } catch (err) {
    if ((err as { code?: string }).code === "23505") {
      throw new HttpError(409, "email_taken", "Este e-mail já está cadastrado.");
    }
    throw err;
  }
});

authRouter.post("/login", async (req, res) => {
  const body = loginSchema.parse(req.body);
  const ip = clientIp(req);
  loginFailuresByEmail.assertOpen(body.email);
  if (ip) loginFailuresByIp.assertOpen(ip);
  const { rows } = await pool.query<UserRow>("SELECT * FROM users WHERE email = $1", [body.email]);
  const user = rows[0];
  if (!user || !(await verifyPassword(body.password, user.password_hash))) {
    loginFailuresByEmail.add(body.email);
    if (ip) loginFailuresByIp.add(ip);
    throw new HttpError(401, "invalid_credentials", "E-mail ou senha inválidos.");
  }
  loginFailuresByEmail.reset(body.email);
  res.json({ token: signToken(user), user: publicUser(user) });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const { rows } = await pool.query<UserRow>("SELECT * FROM users WHERE id = $1", [req.user!.id]);
  if (!rows[0]) throw new HttpError(401, "unauthorized", "Faça login para continuar.");
  res.json({ user: publicUser(rows[0]) });
});
