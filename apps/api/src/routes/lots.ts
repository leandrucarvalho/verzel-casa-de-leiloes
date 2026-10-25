import { Router } from "express";
import { z } from "zod";
import { optionalAuth, requireAuth, requireRole } from "../auth/middleware.js";
import { auditLot } from "../domain/audit.js";
import { placeBid } from "../domain/bids.js";
import { onLotChanged } from "../domain/events.js";
import { roomView } from "../domain/room.js";
import { cancelLot, createLot, getLot, listLots, listParticipating, totalReceived } from "../domain/lots.js";
import { HttpError } from "../errors.js";
import { bidsByUser } from "../rateLimit.js";

const createSchema = z
  .object({
    externalId: z.string().min(1),
    title: z.string().trim().min(1).max(200),
    imageUrl: z.url().nullable().default(null),
    attributes: z.record(z.string(), z.unknown()).default({}),
    startingBidCents: z.number().int().positive("O lance inicial deve ser maior que zero."),
    minIncrementCents: z.number().int().positive("O incremento mínimo deve ser maior que zero."),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
  })
  .refine((l) => l.endsAt > l.startsAt, { message: "O fim deve ser depois do início." })
  .refine((l) => l.endsAt > new Date(), { message: "O fim deve estar no futuro." });

const listSchema = z.object({
  status: z.enum(["scheduled", "live", "ended"]).optional(),
  q: z.string().trim().min(1).optional(),
});

export const lotsRouter = Router();

lotsRouter.get("/", async (req, res) => {
  const { status, q } = listSchema.parse(req.query);
  res.json(await listLots({ phase: status, q }));
});

lotsRouter.get("/mine", requireAuth, requireRole("auctioneer"), async (req, res) => {
  const [lots, totalReceivedCents] = await Promise.all([
    listLots({ auctioneerId: req.user!.id }),
    totalReceived(req.user!.id),
  ]);
  res.json({ lots, totalReceivedCents });
});

lotsRouter.get("/participating", requireAuth, requireRole("bidder"), async (req, res) => {
  res.json(await listParticipating(req.user!.id));
});

// Public, no login: anyone can recompute the hash chain of a lot.
lotsRouter.get("/:id/audit", async (req, res) => {
  const id = z.uuid().safeParse(req.params.id);
  const audit = id.success ? await auditLot(id.data) : null;
  if (!audit) throw new HttpError(404, "lot_not_found", "Lote não encontrado.");
  res.json(audit);
});

// Everything the live room needs in one call; "mine" and "me" only appear for a logged user.
lotsRouter.get("/:id/room", optionalAuth, async (req, res) => {
  const id = z.uuid().safeParse(req.params.id);
  const room = id.success ? await roomView(id.data, req.user?.id) : null;
  if (!room) throw new HttpError(404, "lot_not_found", "Lote não encontrado.");
  res.json(room);
});

// Server-sent events: a bare "update" ping whenever the lot changes. Clients refetch /room,
// so each one still gets its own "mine"/"me" and no private data travels on the stream.
lotsRouter.get("/:id/events", (req, res) => {
  const id = z.uuid().safeParse(req.params.id);
  if (!id.success) throw new HttpError(404, "lot_not_found", "Lote não encontrado.");
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write(": connected\n\n");
  const off = onLotChanged(id.data, () => res.write("event: update\ndata: {}\n\n"));
  const heartbeat = setInterval(() => res.write(": ping\n\n"), 25_000);
  req.on("close", () => {
    off();
    clearInterval(heartbeat);
  });
});

lotsRouter.get("/:id", async (req, res) => {
  const id = z.uuid().safeParse(req.params.id);
  const lot = id.success ? await getLot(id.data) : null;
  if (!lot || lot.status === "cancelled") throw new HttpError(404, "lot_not_found", "Lote não encontrado.");
  res.json(lot);
});

lotsRouter.post("/", requireAuth, requireRole("auctioneer"), async (req, res) => {
  res.status(201).json(await createLot(req.user!.id, createSchema.parse(req.body)));
});

lotsRouter.post("/:id/cancel", requireAuth, requireRole("auctioneer"), async (req, res) => {
  const id = z.uuid().safeParse(req.params.id);
  if (!id.success) throw new HttpError(404, "lot_not_found", "Lote não encontrado.");
  res.json(await cancelLot(id.data, req.user!.id));
});

const bidSchema = z.object({
  amountCents: z.number().int("O valor deve estar em centavos.").positive("Informe um valor maior que zero."),
});

lotsRouter.post("/:id/bids", requireAuth, requireRole("bidder"), async (req, res) => {
  const id = z.uuid().safeParse(req.params.id);
  if (!id.success) throw new HttpError(404, "lot_not_found", "Lote não encontrado.");
  const { amountCents } = bidSchema.parse(req.body);
  bidsByUser.take(req.user!.id);
  res.status(201).json(await placeBid(id.data, req.user!.id, amountCents));
});
