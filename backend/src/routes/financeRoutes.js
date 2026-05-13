import express from "express";
import { invoices, payslips } from "../data.js";
import { allowRoles } from "../middleware/auth.js";
import { addAudit } from "../services/audit.js";

const router = express.Router();

router.get("/dashboard", allowRoles("Finance"), (_req, res) => {
  res.json({
    invoices: invoices.length,
    paidInvoices: invoices.filter((invoice) => invoice.status === "Paid").length,
    unpaidInvoices: invoices.filter((invoice) => invoice.status !== "Paid").length,
    invoiceAmount: invoices.reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0),
    pendingPayslips: payslips.filter((ps) => ps.approval_status === "pending").length,
    approvedPayslips: payslips.filter((ps) => ps.approval_status === "approved").length
  });
});

router.get("/payslips/pending", allowRoles("Finance"), (_req, res) => {
  const pending = payslips.filter((ps) => ps.approval_status === "pending");
  res.json(pending);
});

router.post("/payslips/:payslipId/approve", allowRoles("Finance"), (req, res) => {
  const payslip = payslips.find((item) => item.id === Number(req.params.payslipId));
  if (!payslip) return res.status(404).json({ message: "Payslip not found" });
  if (payslip.approval_status !== "pending") return res.status(400).json({ message: "Only pending payslips can be approved" });
  payslip.approval_status = "approved";
  payslip.approved_by = req.user.email;
  payslip.approved_at = new Date().toISOString();
  addAudit(req.user.email, `Approved payslip for ${payslip.staff_id}`, "Payroll");
  res.json(payslip);
});

router.post("/payslips/:payslipId/reject", allowRoles("Finance"), (req, res) => {
  const payslip = payslips.find((item) => item.id === Number(req.params.payslipId));
  if (!payslip) return res.status(404).json({ message: "Payslip not found" });
  if (payslip.approval_status !== "pending") return res.status(400).json({ message: "Only pending payslips can be rejected" });
  payslip.approval_status = "rejected";
  payslip.approved_by = req.user.email;
  payslip.approved_at = new Date().toISOString();
  addAudit(req.user.email, `Rejected payslip for ${payslip.staff_id}`, "Payroll");
  res.json(payslip);
});

export default router;
