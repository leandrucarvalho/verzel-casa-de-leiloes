import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../auth/middleware.js";
import { MAX_DEPOSIT_CENTS, deposit, getWallet } from "../domain/wallet.js";

const depositSchema = z.object({
  amountCents: z
    .number()
    .int("O valor deve estar em centavos.")
    .positive("O valor do depósito deve ser maior que zero.")
    .max(MAX_DEPOSIT_CENTS, "Valor acima do limite por depósito."),
});

export const walletRouter = Router();
walletRouter.use(requireAuth);

walletRouter.get("/", async (req, res) => {
  res.json(await getWallet(req.user!.id));
});

walletRouter.post("/deposit", requireRole("bidder"), async (req, res) => {
  const { amountCents } = depositSchema.parse(req.body);
  await deposit(req.user!.id, amountCents);
  res.status(201).json(await getWallet(req.user!.id));
});
