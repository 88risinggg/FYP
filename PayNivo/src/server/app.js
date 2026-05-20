import cors from "cors";
import express from "express";
import adminRoutes from "./routes/adminRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import projectRoutes from "./routes/projectRoutes.js";

export function createApp() {
  const app = express();
  const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173").split(",");
  app.use(cors({ origin: allowedOrigins, credentials: true }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      project: "Automated Invoicing and Payroll System",
      referenceSystem: "Xero Invoicing and Payroll",
      stack: {
        frontend: "React",
        backend: "Node.js + Express",
        database: "MySQL",
        pdf: "Puppeteer",
        excel: "ExcelJS",
        email: "Nodemailer",
        payments: "Stripe API",
        whatsapp: "Meta WhatsApp Cloud API"
      }
    });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/project", projectRoutes);

  app.use((req, res) => res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` }));
  return app;
}
