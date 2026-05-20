import { Router } from "express";
import {
  addAudit,
  adminRoles,
  adminUsers,
  auditLogs,
  emailLogs,
  invoiceSettings,
  payrollRates,
  reminderSettings,
  reports,
  systemSettings
} from "../data/adminData.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";

const router = Router();
const adminOnly = [requireAuth, requireRole("Admin")];

function dashboardPayload() {
  return {
    metrics: [
      { label: "Active users", value: String(adminUsers.filter((user) => user.status === "Active").length), hint: "Manage user accounts and roles" },
      { label: "Payroll rates", value: String(payrollRates.length), hint: "Configurable payroll values" },
      { label: "Reports", value: String(reports.length), hint: "View and export reports" },
      { label: "Email logs", value: String(emailLogs.length), hint: "Notification monitoring" }
    ],
    users: adminUsers,
    roles: adminRoles,
    payrollRates,
    invoiceSettings,
    reminderSettings,
    systemSettings,
    reports,
    auditLogs,
    emailLogs
  };
}

router.get("/dashboard", requireAuth, (_req, res) => res.json(dashboardPayload()));

router.post("/users", ...adminOnly, (req, res) => {
  const name = String(req.body.name || "").trim();
  const email = String(req.body.email || "").trim();
  const role = String(req.body.role || "Staff").trim();
  if (!name || !email) return res.status(400).json({ message: "Name and email are required." });

  const user = { id: `USR-${String(adminUsers.length + 1).padStart(3, "0")}`, name, email, role, status: "Active", mfa: "Pending", lastLogin: "Never" };
  adminUsers.push(user);
  const roleRecord = adminRoles.find((item) => item.role === role);
  if (roleRecord) roleRecord.users += 1;
  addAudit(req.user.name, `Created user ${name}`, "User management");
  return res.status(201).json({ user, dashboard: dashboardPayload() });
});

router.patch("/users/:id", ...adminOnly, (req, res) => {
  const user = adminUsers.find((item) => item.id === req.params.id);
  if (!user) return res.status(404).json({ message: "User not found." });
  const oldRole = user.role;
  Object.assign(user, {
    name: req.body.name ?? user.name,
    email: req.body.email ?? user.email,
    role: req.body.role ?? user.role,
    status: req.body.status ?? user.status,
    mfa: req.body.mfa ?? user.mfa
  });
  if (oldRole !== user.role) {
    const oldRecord = adminRoles.find((item) => item.role === oldRole);
    const newRecord = adminRoles.find((item) => item.role === user.role);
    if (oldRecord) oldRecord.users = Math.max(0, oldRecord.users - 1);
    if (newRecord) newRecord.users += 1;
  }
  addAudit(req.user.name, `Updated user ${user.name}`, "User management");
  return res.json({ user, dashboard: dashboardPayload() });
});

function updatePayrollRate(rate, body) {
  rate.value = body.value !== undefined ? String(body.value) : rate.value;
  rate.scope = body.scope !== undefined ? String(body.scope) : rate.scope;
  rate.totalRate = body.totalRate !== undefined ? String(body.totalRate) : rate.totalRate;
  rate.employerRate = body.employerRate !== undefined ? String(body.employerRate) : rate.employerRate;
  rate.employeeRate = body.employeeRate !== undefined ? String(body.employeeRate) : rate.employeeRate;
  rate.wageBand = body.wageBand !== undefined ? String(body.wageBand) : rate.wageBand;
  rate.effectiveFrom = body.effectiveFrom !== undefined ? String(body.effectiveFrom) : rate.effectiveFrom;
}

router.patch("/payroll-rates/cpf-tiers", ...adminOnly, (req, res) => {
  const updates = Array.isArray(req.body.rates) ? req.body.rates : [];
  const cpfRates = payrollRates.filter((item) => item.totalRate !== undefined);

  cpfRates.forEach((rate) => {
    const update = updates.find((item) => item.id === rate.id);
    if (update) updatePayrollRate(rate, update);
  });

  addAudit(req.user.name, "Updated CPF contribution tiers", "Payroll rates");
  return res.json({ rates: cpfRates, dashboard: dashboardPayload() });
});

router.patch("/payroll-rates/:id", ...adminOnly, (req, res) => {
  const rate = payrollRates.find((item) => item.id === req.params.id);
  if (!rate) return res.status(404).json({ message: "Payroll rate not found." });
  updatePayrollRate(rate, req.body);
  addAudit(req.user.name, `Updated ${rate.label}`, "Payroll rates");
  return res.json({ rate, dashboard: dashboardPayload() });
});

router.patch("/invoice-settings/:id", ...adminOnly, (req, res) => {
  const setting = invoiceSettings.find((item) => item.id === req.params.id);
  if (!setting) return res.status(404).json({ message: "Invoice setting not found." });
  setting.value = String(req.body.value || setting.value);
  setting.detail = String(req.body.detail || setting.detail);
  addAudit(req.user.name, `Updated ${setting.label}`, "Invoice settings");
  return res.json({ setting, dashboard: dashboardPayload() });
});

router.patch("/reminder-settings/:id", ...adminOnly, (req, res) => {
  const setting = reminderSettings.find((item) => item.id === req.params.id);
  if (!setting) return res.status(404).json({ message: "Reminder setting not found." });
  setting.value = String(req.body.value || setting.value);
  setting.detail = String(req.body.detail || setting.detail);
  addAudit(req.user.name, `Updated ${setting.label}`, "Reminder settings");
  return res.json({ setting, dashboard: dashboardPayload() });
});

router.patch("/system-settings", ...adminOnly, (req, res) => {
  Object.assign(systemSettings, req.body);
  addAudit(req.user.name, "Updated system settings", "System settings");
  return res.json({ systemSettings, dashboard: dashboardPayload() });
});

router.post("/reports", ...adminOnly, (req, res) => {
  const report = { id: `RPT-${String(reports.length + 1).padStart(3, "0")}`, name: String(req.body.name || "Admin report"), period: "May 2026", format: String(req.body.format || "Excel"), status: "Ready" };
  reports.unshift(report);
  addAudit(req.user.name, `Generated report ${report.id}`, "Reports");
  return res.status(201).json({ report, dashboard: dashboardPayload() });
});

router.get("/reports/export.csv", ...adminOnly, (_req, res) => {
  const rows = ["id,name,period,format,status", ...reports.map((report) => `${report.id},${report.name},${report.period},${report.format},${report.status}`)];
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=\"admin-reports.csv\"");
  return res.send(rows.join("\n"));
});

export default router;
