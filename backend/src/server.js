import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import authRoutes from "./routes/authRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import financeRoutes from "./routes/financeRoutes.js";
import hrRoutes from "./routes/hrRoutes.js";
import staffRoutes from "./routes/staffRoutes.js";
import payrollRoutes from "./routes/payrollRoutes.js";
import invoiceRoutes from "./routes/invoiceRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import emailRoutes from "./routes/emailRoutes.js";
import settingsRoutes from "./routes/settingsRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
import auditRoutes from "./routes/auditRoutes.js";
import legacyRoutes from "./routes/legacyRoutes.js";
import { requireAuth } from "./middleware/auth.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const upload = multer({ dest: path.join(__dirname, "uploads") });
const PORT = Number(process.env.PORT || 4001);
const allowedOrigins = [process.env.FRONTEND_URL].filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    const isLocalFrontend = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin || "");
    if (!origin || isLocalFrontend || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS blocked origin: ${origin}`));
  }
}));

app.use(express.json());
app.use("/generated", express.static(path.join(__dirname, "generated")));

app.get("/api/health", (_req, res) => res.json({ status: "ok", app: "PayNivo API" }));
app.use("/api/auth", authRoutes);

// Role routes for cleaner GitHub structure.
app.use("/api/admin", requireAuth, adminRoutes);
app.use("/api/finance", requireAuth, financeRoutes);
app.use("/api/hr", requireAuth, hrRoutes);
app.use("/api/staff", requireAuth, staffRoutes);

// Feature routes grouped by domain and role permissions.
app.use("/api/payroll", requireAuth, upload.single("file"), payrollRoutes);
app.use("/api/invoices", requireAuth, upload.single("file"), invoiceRoutes);
app.use("/api/payments", requireAuth, paymentRoutes);
app.use("/api/email", requireAuth, emailRoutes);
app.use("/api/settings", requireAuth, settingsRoutes);
app.use("/api/reports", requireAuth, reportRoutes);
app.use("/api/audit-logs", requireAuth, auditRoutes);
app.use("/api", requireAuth, legacyRoutes);

app.listen(PORT, () => {
  console.log(`PayNivo API running on http://localhost:${PORT}`);
});
