import { Router } from "express";
import { requireAuth } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";
import {
  adminRoles,
  adminUsers,
  auditLogs,
  invoiceSettings,
  manualPayments,
  payrollRates
} from "../data/adminData.js";

const router = Router();

router.get("/dashboard", requireAuth, requireRole("Admin"), (_req, res) => {
  res.json({
    role: "Admin",
    metrics: [
      { label: "Active users", value: String(adminUsers.filter((user) => user.status === "Active").length), hint: "Across all demo roles" },
      { label: "Roles managed", value: String(adminRoles.length), hint: "Admin, Finance, HR, Staff, Customer" },
      { label: "Pending approvals", value: String(manualPayments.filter((payment) => payment.status === "Pending approval").length), hint: "PayNow and bank transfer proof" },
      { label: "Audit events", value: String(auditLogs.length), hint: "Recent system activity" }
    ],
    users: adminUsers,
    roles: adminRoles,
    payrollRates,
    invoiceSettings,
    manualPayments,
    auditLogs,
    systemSettings: {
      verificationCodeLogin: "Enabled",
      sessionTimeout: "8 hours",
      emailNotifications: "Monitored",
      invoiceCsvFormat: "Vaniday"
    }
  });
});

router.patch("/users/:id/status", requireAuth, requireRole("Admin"), (req, res) => {
  const user = adminUsers.find((item) => item.id === req.params.id);
  const nextStatus = String(req.body.status || "").trim();

  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }

  if (!["Active", "Suspended"].includes(nextStatus)) {
    return res.status(400).json({ message: "Status must be Active or Suspended." });
  }

  user.status = nextStatus;
  auditLogs.unshift({
    id: `AUD-${9000 + auditLogs.length + 1}`,
    actor: req.user.name || "Admin",
    action: `Changed ${user.name} status to ${nextStatus}`,
    area: "User management",
    time: "Just now"
  });

  return res.json({ user, auditLogs });
});

router.patch("/payments/:id/approve", requireAuth, requireRole("Admin"), (req, res) => {
  const payment = manualPayments.find((item) => item.id === req.params.id);

  if (!payment) {
    return res.status(404).json({ message: "Payment not found." });
  }

  payment.status = "Approved";
  auditLogs.unshift({
    id: `AUD-${9000 + auditLogs.length + 1}`,
    actor: req.user.name || "Admin",
    action: `Approved manual payment ${payment.id}`,
    area: "Payments",
    time: "Just now"
  });

  return res.json({ payment, auditLogs, manualPayments });
});

export default router;
