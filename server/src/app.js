require("dotenv").config();
require("./config/timezone");

const cors = require("cors");
const express = require("express");
const fs = require("fs");
const path = require("path");

// Route imports
const healthRoutes = require("./routes/healthRoutes");
const authRoutes = require("./routes/authRoutes");
const invoiceRoutes = require("./routes/invoiceRoutes");
const customerRoutes = require("./routes/customerRoutes");
const bulkInvoiceRoutes = require("./routes/bulkInvoiceRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const reportRoutes = require("./routes/reportRoutes");
const fraudRoutes = require("./routes/fraudRoutes");
const profileRoutes = require("./routes/profileRoutes");
const payslipRoutes = require("./routes/payslipRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const adminPayrollRoutes = require("./routes/adminPayrollRoutes");
const hrRoutes = require("./routes/hrRoutes");
const publicHolidayRoutes = require("./routes/publicHolidayRoutes");
const staffRoutes = require("./routes/staffRoutes");
const payrollRoutes = require("./routes/payrollRoutes");
const leaveRoutes = require("./routes/leaveRoutes");
const hrReportRoutes = require("./routes/hrReportRoutes");
const adminUserRoutes = require("./routes/adminUserRoutes");
const adminRoleRoutes = require("./routes/adminRoleRoutes");
const adminReminderRoutes = require("./routes/adminReminderRoutes");
const adminAuditLogRoutes = require("./routes/adminAuditLogRoutes");
const auditLogRoutes = require("./routes/auditLogRoutes");
const publicRoutes = require("./routes/publicRoutes");
const financePayrollRoutes = require("./routes/financePayrollRoutes");
const payrollWorkflowRoutes = require("./routes/payrollWorkflowRoutes");
const payrollUserRoutes = require("./routes/payrollUserRoutes");
const claimRoutes = require("./routes/claimRoutes");
const payrollRequestRoutes = require("./routes/payrollRequestRoutes");
const settingsRoutes = require("./routes/settingsRoutes");
const financeDashboardRoutes = require("./routes/financeDashboardRoutes");
const vanidayImportRoutes = require("./routes/vanidayImportRoutes");
const subscriptionRoutes = require("./routes/subscriptionRoutes");
const subscriptionReminderRoutes = require("./routes/subscriptionReminderRoutes");
const financeReminderRoutes = require("./routes/financeReminderRoutes");
const whatsappRoutes = require("./routes/whatsappRoutes");
const integrationRoutes = require("./routes/integrationRoutes");
const companyRoutes = require("./routes/companyRoutes");
const { authenticateToken } = require("./middleware/authMiddleware");
const { requireTenant } = require("./middleware/tenantMiddleware");

const app = express();

// CORS
const allowedOrigins = [
  process.env.CLIENT_URL,
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "http://127.0.0.1:5175",
  "http://127.0.0.1.nip.io:5173"
].filter(Boolean);

app.use(cors({ origin: allowedOrigins }));

// Stripe webhook needs raw body for signature verification
app.use("/api/payments/stripe/webhook", express.raw({ type: "application/json" }));
app.use((req, res, next) => {
  if (req.originalUrl === "/api/payments/stripe/webhook") {
    req.rawBody = req.body;
    try {
      req.body = JSON.parse(req.body.toString());
    } catch { /* leave as-is */ }
  }
  next();
});

app.use(express.json({ limit: "5mb" }));

// Tenant files must be served by authenticated preview/download endpoints.
app.use('/uploads', (_req, res) => res.status(404).json({ code: "AUTHENTICATED_FILE_ROUTE_REQUIRED", message: "Use the authenticated file preview or download endpoint." }));

// Routes — Invoicing module
app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/public", publicRoutes);
app.use("/api/company", companyRoutes);
app.use("/api/invoices", authenticateToken, requireTenant, invoiceRoutes);
app.use("/api/customers", authenticateToken, requireTenant, customerRoutes);
app.use("/api/bulk-invoices", authenticateToken, requireTenant, bulkInvoiceRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/reports", authenticateToken, requireTenant, reportRoutes);
app.use("/api/fraud", authenticateToken, requireTenant, fraudRoutes);
app.use("/api/vaniday-import", authenticateToken, requireTenant, vanidayImportRoutes);
app.use("/api/subscriptions", authenticateToken, requireTenant, subscriptionRoutes);
app.use("/api/subscription-reminders", authenticateToken, requireTenant, subscriptionReminderRoutes);
app.use("/api/finance-reminders", authenticateToken, requireTenant, financeReminderRoutes);
app.use("/api/whatsapp", whatsappRoutes);
app.use("/api/integrations", integrationRoutes);

// Routes — Payroll module
app.use("/api/profile", authenticateToken, requireTenant, profileRoutes);
app.use("/api/payslips", authenticateToken, requireTenant, payslipRoutes);
app.use("/api/notifications", authenticateToken, requireTenant, notificationRoutes);
app.use("/api/payroll/admin", authenticateToken, requireTenant, adminPayrollRoutes);
app.use("/api/hr/reports", authenticateToken, requireTenant, hrReportRoutes);
app.use("/api/hr/public-holidays", authenticateToken, requireTenant, publicHolidayRoutes);
app.use("/api/hr", authenticateToken, requireTenant, hrRoutes);
app.use("/api/staff", authenticateToken, requireTenant, staffRoutes);
app.use("/api/payroll/finance", authenticateToken, requireTenant, financePayrollRoutes);
app.use("/api/payroll/workflow", authenticateToken, requireTenant, payrollWorkflowRoutes);
app.use("/api/payroll/users", authenticateToken, requireTenant, payrollUserRoutes);
app.use("/api/payroll/payments", paymentRoutes);
app.use("/api/payroll", authenticateToken, requireTenant, payrollRoutes);
app.use("/api/leave", authenticateToken, requireTenant, leaveRoutes);
app.use("/api/claims", authenticateToken, requireTenant, claimRoutes);
app.use("/api/payroll-requests", authenticateToken, requireTenant, payrollRequestRoutes);

// Routes — Admin module
app.use("/api/admin/users", authenticateToken, requireTenant, adminUserRoutes);
app.use("/api/admin/roles", authenticateToken, requireTenant, adminRoleRoutes);
app.use("/api/admin/invoicing", authenticateToken, requireTenant, adminReminderRoutes);
app.use("/api/admin/invoicing/audit-logs", authenticateToken, requireTenant, adminAuditLogRoutes);
app.use("/api/audit-logs", authenticateToken, requireTenant, auditLogRoutes);

// Routes — Settings module
app.use("/api/settings", authenticateToken, requireTenant, settingsRoutes);

// Routes — Finance Dashboard
app.use("/api/finance", authenticateToken, requireTenant, financeDashboardRoutes);

// In production, Discloud exposes a single web process. Serve the Vite build
// from Express so the frontend and API share the same HTTPS origin.
const clientDistPath = path.resolve(__dirname, "../public");
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/") || req.path.startsWith("/uploads/")) return next();
    return res.sendFile(path.join(clientDistPath, "index.html"));
  });
}

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

module.exports = app;
