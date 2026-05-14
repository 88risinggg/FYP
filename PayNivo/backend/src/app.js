import cors from "cors";
import express from "express";
import authRoutes from "./routes/authRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import financeRoutes from "./routes/financeRoutes.js";
import hrRoutes from "./routes/hrRoutes.js";
import staffRoutes from "./routes/staffRoutes.js";
import customerRoutes from "./routes/customerRoutes.js";

export function createApp() {
  const app = express();

  app.use(cors({
    origin(origin, callback) {
      const configuredOrigin = process.env.FRONTEND_URL;
      const isLocalVite = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin || "");

      if (!origin || isLocalVite || origin === configuredOrigin) {
        return callback(null, true);
      }

      return callback(new Error(`CORS blocked origin: ${origin}`));
    },
    credentials: true
  }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", app: "PayNivo" });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/finance", financeRoutes);
  app.use("/api/hr", hrRoutes);
  app.use("/api/staff", staffRoutes);
  app.use("/api/customer", customerRoutes);

  app.use((req, res) => {
    res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
  });

  return app;
}
