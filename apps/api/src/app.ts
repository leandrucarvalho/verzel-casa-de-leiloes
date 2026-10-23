import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { HttpError } from "./errors.js";
import { authRouter } from "./routes/auth.js";
import { lotsRouter } from "./routes/lots.js";
import { walletRouter } from "./routes/wallet.js";

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.code, message: err.message });
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
  app.use("/auth", authRouter);
  app.use("/wallet", walletRouter);
  app.use("/lots", lotsRouter);
  app.use(errorHandler);
  return app;
}
