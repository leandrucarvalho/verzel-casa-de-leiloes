import cors from "cors";
import express, { type ErrorRequestHandler, type RequestHandler } from "express";
import { ZodError } from "zod";
import { HttpError } from "./errors.js";
import { settleDueLots } from "./domain/settlement.js";
import { authRouter } from "./routes/auth.js";
import { catalogRouter } from "./routes/catalog.js";
import { lotsRouter } from "./routes/lots.js";
import { receiptsRouter } from "./routes/receipts.js";
import { walletRouter } from "./routes/wallet.js";

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.code, message: err.message, ...err.details });
  } else if (err instanceof ZodError) {
    res.status(400).json({ error: "invalid_input", message: err.issues[0]?.message ?? "Dados inválidos." });
  } else {
    console.error(err);
    res.status(500).json({ error: "internal", message: "Erro interno." });
  }
};

export function createApp() {
  const app = express();
  // CORS_ORIGIN: comma-separated list of allowed front-end origins
  app.use(cors({ origin: process.env.CORS_ORIGIN?.split(",") ?? true }));
  app.use(express.json());
  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });
  // Lazy settlement: whoever reads lots, wallet or receipts first settles what is due,
  // so results are right even if the periodic job did not run (e.g. the free host was asleep).
  const settleFirst: RequestHandler = async (_req, _res, next) => {
    try {
      await settleDueLots();
      next();
    } catch (err) {
      next(err);
    }
  };
  app.use("/auth", authRouter);
  app.use("/catalog", catalogRouter);
  app.use("/wallet", settleFirst, walletRouter);
  app.use("/lots", settleFirst, lotsRouter);
  app.use("/receipts", settleFirst, receiptsRouter);
  app.use(errorHandler);
  return app;
}
