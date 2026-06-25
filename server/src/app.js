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
const staffRoutes = require("./routes/staffRoutes");
const payrollRoutes = require("./routes/payrollRoutes");
const adminUserRoutes = require("./routes/adminUserRoutes");
const adminReminderRoutes = require("./routes/adminReminderRoutes");
const adminAuditLogRoutes = require("./routes/adminAuditLogRoutes");

const app = express();

// CORS
const allowedOrigins = [
  process.env.CLIENT_URL,
  "http://localhost:5173",
  "http://127.0.0.1:5173"
].filter(Boolean);

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

// Static file serving for payslip PDF downloads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes — Invoicing module
app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/bulk-invoices", bulkInvoiceRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/fraud", fraudRoutes);

// Routes — Payroll module
app.use("/api/profile", profileRoutes);
app.use("/api/payslips", payslipRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/payroll/admin", adminPayrollRoutes);
app.use("/api/hr", hrRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/payroll", payrollRoutes);

// Routes — Admin module
app.use("/api/admin/users", adminUserRoutes);
app.use("/api/admin/invoicing", adminReminderRoutes);
app.use("/api/admin/invoicing/audit-logs", adminAuditLogRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

module.exports = app;
