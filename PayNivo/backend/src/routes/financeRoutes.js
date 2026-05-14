import { Router } from "express";
import { requireAuth } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";
import { addAudit } from "../services/audit.js";
import { payslips } from "../utils/mockPayrollStore.js";

const router = Router();

router.get("/dashboard", requireAuth, requireRole("Finance"), (_req, res) => {
  res.json({
    role: "Finance",
    pendingPayslips: payslips.filter((payslip) => payslip.approval_status === "pending").length,
    approvedPayslips: payslips.filter((payslip) => payslip.approval_status === "approved").length,
    rejectedPayslips: payslips.filter((payslip) => payslip.approval_status === "rejected").length,
    totalPayslips: payslips.length
  });
});

router.get("/payslips/pending", requireAuth, requireRole("Finance"), (_req, res) => {
  res.json(payslips.filter((payslip) => payslip.approval_status === "pending"));
});

router.post("/payslips/:id/approve", requireAuth, requireRole("Finance"), (req, res) => {
  const payslip = payslips.find((item) => item.id === Number(req.params.id));
  if (!payslip) return res.status(404).json({ message: "Payslip not found" });
  if (payslip.approval_status !== "pending") {
    return res.status(400).json({ message: "Only pending payslips can be approved" });
  }

  payslip.approval_status = "approved";
  payslip.approved_by = req.user.email;
  payslip.approved_at = new Date().toISOString();
  addAudit(req.user.email, `Approved payslip for ${payslip.staff_id}`, "Payroll");
  res.json(payslip);
});

router.post("/payslips/:id/reject", requireAuth, requireRole("Finance"), (req, res) => {
  const payslip = payslips.find((item) => item.id === Number(req.params.id));
  if (!payslip) return res.status(404).json({ message: "Payslip not found" });
  if (payslip.approval_status !== "pending") {
    return res.status(400).json({ message: "Only pending payslips can be rejected" });
  }

  payslip.approval_status = "rejected";
  payslip.approved_by = req.user.email;
  payslip.approved_at = new Date().toISOString();
  addAudit(req.user.email, `Rejected payslip for ${payslip.staff_id}`, "Payroll");
  res.json(payslip);
});

export default router;
