const cors = require("cors");
const express = require("express");
const path = require("path");
require("dotenv").config();

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
const googleAuthRoutes = require("./routes/googleAuthRoutes");
const otpAuthRoutes = require("./routes/otpAuthRoutes");
const publicRoutes = require("./routes/publicRoutes");
const financePayrollRoutes = require("./routes/financePayrollRoutes");
const payrollUserRoutes = require("./routes/payrollUserRoutes");
const claimRoutes = require("./routes/claimRoutes");
const settingsRoutes = require("./routes/settingsRoutes");
const financeDashboardRoutes = require("./routes/financeDashboardRoutes");
const vanidayImportRoutes = require("./routes/vanidayImportRoutes");

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

// Static file serving for payslip PDF downloads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes — Invoicing module
app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/public", publicRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/bulk-invoices", bulkInvoiceRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/fraud", fraudRoutes);
app.use("/api/vaniday-import", vanidayImportRoutes);

// Routes — Payroll module
app.use("/api/profile", profileRoutes);
app.use("/api/payslips", payslipRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/payroll/admin", adminPayrollRoutes);
app.use("/api/hr/reports", hrReportRoutes);
app.use("/api/hr/public-holidays", publicHolidayRoutes);
app.use("/api/hr", hrRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/payroll/finance", financePayrollRoutes);
app.use("/api/payroll/users", payrollUserRoutes);
app.use("/api/payroll/payments", paymentRoutes);
app.use("/api/payroll", payrollRoutes);
app.use("/api/leave", leaveRoutes);
app.use("/api/claims", claimRoutes);

// Routes — Admin module
app.use("/api/admin/users", adminUserRoutes);
app.use("/api/admin/roles", adminRoleRoutes);
app.use("/api/admin/invoicing", adminReminderRoutes);
app.use("/api/admin/invoicing/audit-logs", adminAuditLogRoutes);
app.use("/api/audit-logs", auditLogRoutes);
app.use("/api/auth/google", googleAuthRoutes);
app.use("/api/auth/otp", otpAuthRoutes);

// Routes — Settings module
app.use("/api/settings", settingsRoutes);

// Routes — Finance Dashboard
app.use("/api/finance", financeDashboardRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

module.exports = app;
