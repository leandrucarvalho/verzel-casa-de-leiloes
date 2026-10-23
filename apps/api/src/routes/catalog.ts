import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../auth/middleware.js";
import { searchCatalog } from "../external/artic.js";

const querySchema = z.object({ q: z.string().trim().min(2, "Digite ao menos 2 letras para buscar.").max(80) });

export const catalogRouter = Router();

catalogRouter.get("/search", requireAuth, requireRole("auctioneer"), async (req, res) => {
  const { q } = querySchema.parse(req.query);
  res.json(await searchCatalog(q));
});
