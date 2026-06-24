// ============================================================
// MERGE INSTRUCTIONS — READ BEFORE RESOLVING ANY CONFLICT
// ============================================================
// This file is modified by ALL three branches:
//   - feature/payroll-staff-steven (Steven — Staff module)
//   - feature/payroll-hr-steven (Steven — HR module)
//   - feature/payroll-admin-ray (Ray — Admin/Finance module)
//
// CRITICAL: Keep ALL route registrations from ALL branches.
// Never drop an app.use() or route import line when resolving conflicts.
//
// Expected routes after merge:
//   [STAFF BRANCH]  app.use('/api/payslips', ...)
//   [STAFF BRANCH]  app.use('/api/profile', ...)
//   [STAFF BRANCH]  app.use('/uploads', express.static(...))
//   [HR BRANCH]     app.use('/api/hr', ...)
//   [HR BRANCH]     app.use('/api/staff', ...)
//   [HR BRANCH]     app.use('/api/payroll', ...)
//   [ADMIN BRANCH]  app.use('/api/admin', ...) — or whatever Ray registered
//
// If you see a conflict on this file, KEEP ALL LINES FROM ALL BRANCHES.
// Do not pick one side — merge all route registrations together.
// ============================================================

const cors = require("cors");
const express = require("express");
const path = require("path");
require("dotenv").config();

const healthRoutes = require("./routes/healthRoutes");
const authRoutes = require("./routes/authRoutes");
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
const allowedOrigins = [
  process.env.CLIENT_URL,
  "http://localhost:5173",
  "http://127.0.0.1:5173"
].filter(Boolean);

app.use(cors({
  origin: allowedOrigins
}));
app.use(express.json());
// [STAFF BRANCH - Steven] Static file serving for payslip PDF downloads (FR4)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/payslips", payslipRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/payroll/admin", adminPayrollRoutes);
// [HR BRANCH - Steven] HR module routes — payslip approval workflow, payroll management
app.use("/api/hr", hrRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/payroll", payrollRoutes);
app.use("/api/admin/users", adminUserRoutes);
app.use("/api/admin/invoicing", adminReminderRoutes);
app.use("/api/admin/invoicing/audit-logs", adminAuditLogRoutes);

app.use((req, res) => {
  res.status(404).json({
    message: "Route not found"
  });
});

module.exports = app;
