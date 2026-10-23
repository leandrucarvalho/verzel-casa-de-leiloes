import cors from "cors";
import express from "express";

export function createApp() {
  const app = express();
  // CORS_ORIGIN: comma-separated list of allowed front-end origins
  app.use(cors({ origin: process.env.CORS_ORIGIN?.split(",") ?? true }));
  app.use(express.json());
  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });
  return app;
}
