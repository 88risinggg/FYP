import cors from "cors";
import express from "express";
import pool from "./db.js";

export function createApp() {
  const app = express();
  const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173").split(",");
  app.use(cors({ origin: allowedOrigins, credentials: true }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      database: "configured"
    });
  });

  app.get("/api/db/ping", async (_req, res) => {
    try {
      await pool.query("SELECT 1");
      res.json({ status: "ok" });
    } catch (_err) {
      res.status(500).json({ status: "error" });
    }
  });

  app.use((req, res) => res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` }));
  return app;
}
