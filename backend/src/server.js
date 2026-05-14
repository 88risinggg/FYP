import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import fs from "fs";
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
const uploadsDir = path.join(__dirname, "uploads");

// Ensure uploads directory exists
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const app = express();
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(7);
    const ext = path.extname(file.originalname);
    cb(null, `${timestamp}-${randomStr}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/csv"
    ];
    const allowedExtensions = [".csv", ".xlsx", ".xls"];
    const fileExt = path.extname(file.originalname).toLowerCase();
    
    if (allowedMimes.includes(file.mimetype) || allowedExtensions.includes(fileExt)) {
      cb(null, true);
    } else {
      cb(new Error("Only CSV and XLSX files are allowed"));
    }
  }
});
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
