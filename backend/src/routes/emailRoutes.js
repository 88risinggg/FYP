import express from "express";
import { emailLogs, invoices } from "../data.js";
import { allowRoles } from "../middleware/auth.js";
import { addAudit } from "../services/audit.js";
import { sendPrototypeEmail } from "../services/email.js";

const router = express.Router();

router.post("/invoice/:invoiceId", allowRoles("Admin", "Finance"), async (req, res) => {
  const invoice = invoices.find((item) => item.id === Number(req.params.invoiceId));
  if (!invoice) return res.status(404).json({ message: "Invoice not found" });
  const subject = `Invoice ${invoice.invoiceNumber}`;
  const result = await sendPrototypeEmail({
    to: invoice.customerEmail,
    subject,
    html: `<p>Dear ${invoice.customerName},</p><p>Please review invoice ${invoice.invoiceNumber} for $${invoice.amount.toFixed(2)}.</p>`
  });
  invoice.status = "Sent";
  emailLogs.unshift({ id: emailLogs.length + 1, to: invoice.customerEmail, subject, type: "Invoice", createdAt: new Date().toISOString() });
  addAudit(req.user.email, "Email sent: invoice", "Email");
  res.json({ sent: true, invoice, result });
});

router.post("/reminder/:invoiceId", allowRoles("Admin", "Finance"), async (req, res) => {
  const invoice = invoices.find((item) => item.id === Number(req.params.invoiceId));
  if (!invoice) return res.status(404).json({ message: "Invoice not found" });
  const reminderNumber = Number(req.body.reminderNumber || 1);
  const subject = `Reminder ${reminderNumber}: overdue invoice ${invoice.invoiceNumber}`;
  const result = await sendPrototypeEmail({
    to: invoice.customerEmail,
    subject,
    html: `<p>Dear ${invoice.customerName},</p><p>This is reminder ${reminderNumber} for overdue invoice ${invoice.invoiceNumber}. Please arrange payment by Stripe, PayNow, or bank transfer.</p>`
  });
  emailLogs.unshift({ id: emailLogs.length + 1, to: invoice.customerEmail, subject, type: "Reminder", createdAt: new Date().toISOString() });
  addAudit(req.user.email, `Email sent: overdue reminder ${reminderNumber}`, "Email");
  res.json({ sent: true, result });
});

export default router;
