import express from "express";
import { invoices, payments } from "../data.js";
import { allowRoles } from "../middleware/auth.js";
import { addAudit } from "../services/audit.js";

const router = express.Router();

router.get("/", allowRoles("Admin", "Finance"), (_req, res) => {
  res.json(payments.map((payment) => ({
    ...payment,
    invoice: invoices.find((invoice) => invoice.id === payment.invoiceId)
  })));
});

router.post("/:invoiceId/proof", allowRoles("Admin", "Finance"), (req, res) => {
  const invoice = invoices.find((item) => item.id === Number(req.params.invoiceId));
  if (!invoice) return res.status(404).json({ message: "Invoice not found" });
  const payment = {
    id: payments.length + 1,
    invoiceId: invoice.id,
    method: req.body.method || invoice.paymentMethod,
    status: "Pending",
    proofUrl: req.body.proofUrl || "manual-proof-upload-placeholder.pdf",
    uploadedAt: new Date().toISOString()
  };
  payments.push(payment);
  addAudit(req.user.email, `Payment proof uploaded for ${invoice.invoiceNumber}`, "Payment");
  res.status(201).json(payment);
});

router.post("/:invoiceId/approve", allowRoles("Admin", "Finance"), (req, res) => {
  const invoice = invoices.find((item) => item.id === Number(req.params.invoiceId));
  if (!invoice) return res.status(404).json({ message: "Invoice not found" });
  invoice.status = "Paid";
  const payment = payments.find((item) => item.invoiceId === invoice.id) || { id: payments.length + 1, invoiceId: invoice.id, method: invoice.paymentMethod };
  payment.status = "Approved";
  if (!payments.find((item) => item.id === payment.id)) payments.push(payment);
  addAudit(req.user.email, `Payment approved for ${invoice.invoiceNumber}`, "Payment");
  res.json({ invoice, payment });
});

router.post("/bulk-approve", allowRoles("Admin", "Finance"), (req, res) => {
  const ids = req.body.invoiceIds || [];
  const approved = [];
  ids.forEach((id) => {
    const invoice = invoices.find((item) => item.id === Number(id));
    if (!invoice) return;
    invoice.status = "Paid";
    const payment = payments.find((item) => item.invoiceId === invoice.id) || { id: payments.length + 1, invoiceId: invoice.id, method: invoice.paymentMethod };
    payment.status = "Approved";
    if (!payments.find((item) => item.id === payment.id)) payments.push(payment);
    approved.push(invoice);
  });
  addAudit(req.user.email, `Bulk approved ${approved.length} payment(s)`, "Payment");
  res.json({ approved });
});

export default router;
