import { Router } from "express";
import { requireAuth } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";
import { auditLogs } from "../data/adminData.js";
import {
  financeCustomers,
  financeInvoices,
  financeNotifications,
  financePayments,
  financeReports
} from "../data/financeData.js";

const router = Router();

function money(amount) {
  return `$${amount.toLocaleString("en-SG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function addFinanceAudit(actor, action, area) {
  auditLogs.unshift({
    id: `AUD-${9000 + auditLogs.length + 1}`,
    actor,
    action,
    area,
    time: "Just now"
  });
}

function dashboardPayload() {
  const outstanding = financeInvoices
    .filter((invoice) => invoice.status !== "Paid")
    .reduce((total, invoice) => total + invoice.amount, 0);
  const paidThisMonth = financePayments
    .filter((payment) => ["Verified", "Settled"].includes(payment.status))
    .reduce((total, payment) => total + payment.amount, 0);
  const pendingApprovals = financePayments.filter((payment) => payment.status === "Pending admin approval").length;
  const overdueInvoices = financeInvoices.filter((invoice) => invoice.status === "Overdue").length;

  return {
    role: "Finance",
    metrics: [
      { label: "Outstanding", value: money(outstanding), hint: "Issued and overdue invoices" },
      { label: "Paid this month", value: money(paidThisMonth), hint: "Verified and settled payments" },
      { label: "Pending approvals", value: String(pendingApprovals), hint: "Manual proofs awaiting Admin" },
      { label: "Overdue invoices", value: String(overdueInvoices), hint: "Need reminder follow-up" }
    ],
    customers: financeCustomers,
    invoices: financeInvoices,
    payments: financePayments,
    reports: financeReports,
    notifications: financeNotifications,
    auditLogs: auditLogs.filter((log) => ["Invoice import", "Payments", "Reports", "Invoice settings", "Finance"].includes(log.area)).slice(0, 6)
  };
}

router.get("/dashboard", requireAuth, requireRole("Finance"), (_req, res) => {
  res.json(dashboardPayload());
});

router.patch("/invoices/:id/issue", requireAuth, requireRole("Finance"), (req, res) => {
  const invoice = financeInvoices.find((item) => item.id === req.params.id);

  if (!invoice) {
    return res.status(404).json({ message: "Invoice not found." });
  }

  if (invoice.status === "Paid") {
    return res.status(400).json({ message: "Paid invoices cannot be issued again." });
  }

  invoice.status = "Issued";
  invoice.paymentStatus = "Pending payment";
  invoice.emailStatus = "Sent";
  invoice.pdf = "Generated";

  const existingNotification = financeNotifications.find((item) => item.invoiceId === invoice.id && item.type === "Invoice email");
  if (existingNotification) {
    existingNotification.status = "Delivered";
    existingNotification.sentAt = "Just now";
  } else {
    financeNotifications.unshift({
      id: `MAIL-${7000 + financeNotifications.length + 1}`,
      invoiceId: invoice.id,
      customer: invoice.customer,
      type: "Invoice email",
      status: "Delivered",
      sentAt: "Just now"
    });
  }

  addFinanceAudit(req.user.name || "Finance", `Issued invoice ${invoice.id}`, "Finance");

  return res.json({ invoice, dashboard: dashboardPayload() });
});

router.patch("/payments/:id/verify", requireAuth, requireRole("Finance"), (req, res) => {
  const payment = financePayments.find((item) => item.id === req.params.id);

  if (!payment) {
    return res.status(404).json({ message: "Payment not found." });
  }

  payment.status = "Verified";

  const invoice = financeInvoices.find((item) => item.id === payment.invoiceId);
  if (invoice) {
    invoice.status = "Paid";
    invoice.paymentStatus = "Paid";
  }

  addFinanceAudit(req.user.name || "Finance", `Verified payment ${payment.id}`, "Payments");

  return res.json({ payment, dashboard: dashboardPayload() });
});

router.post("/invoices/:id/reminder", requireAuth, requireRole("Finance"), (req, res) => {
  const invoice = financeInvoices.find((item) => item.id === req.params.id);

  if (!invoice) {
    return res.status(404).json({ message: "Invoice not found." });
  }

  if (invoice.status === "Paid") {
    return res.status(400).json({ message: "Paid invoices do not need reminders." });
  }

  invoice.emailStatus = "Reminder sent";
  financeNotifications.unshift({
    id: `MAIL-${7000 + financeNotifications.length + 1}`,
    invoiceId: invoice.id,
    customer: invoice.customer,
    type: "Payment reminder",
    status: "Delivered",
    sentAt: "Just now"
  });

  addFinanceAudit(req.user.name || "Finance", `Sent reminder for ${invoice.id}`, "Finance");

  res.json({
    invoice,
    dashboard: dashboardPayload()
  });
});

export default router;
