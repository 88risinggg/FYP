const express = require("express");
const ExcelJS = require("exceljs");
const { payrollRateConfig, payslips, PAYSLIP_STATUSES } = require("../services/data");
const { addAudit } = require("../services/audit");
const { authenticateToken } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/rolesMiddleware");

const router = express.Router();

router.get("/template", authenticateToken, allowRoles("Admin", "HR"), async (req, res) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Payroll Template");
  const headers = [
    "staff_id",
    "staff_name",
    "email",
    "payroll_month",
    "working_days",
    "no_pay_leave_days",
    "basic_salary",
    "services_commission",
    "product_commission",
    "credit_commission",
    "allowance",
    "loan_deduction",
    "other_deduction"
  ];
  sheet.addRow(headers);
  sheet.columns.forEach(c => (c.width = 18));
  sheet.getRow(1).font = { bold: true };
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=PayrollTemplate.xlsx");
  await workbook.xlsx.write(res);
  addAudit(req.user.email, "Downloaded payroll template", "Payroll");
  res.end();
});

router.get("/rates", authenticateToken, allowRoles("Admin", "HR"), (_req, res) => {
  res.json(payrollRateConfig);
});

router.put("/rates", authenticateToken, allowRoles("Admin"), (req, res) => {
  payrollRateConfig.employeeCpfRate = Number(req.body.employeeCpfRate ?? payrollRateConfig.employeeCpfRate);
  payrollRateConfig.employerCpfRate = Number(req.body.employerCpfRate ?? payrollRateConfig.employerCpfRate);
  payrollRateConfig.sdlRate = Number(req.body.sdlRate ?? payrollRateConfig.sdlRate);
  payrollRateConfig.defaultAllowanceRate = Number(req.body.defaultAllowanceRate ?? payrollRateConfig.defaultAllowanceRate);
  payrollRateConfig.defaultDeductionRate = Number(req.body.defaultDeductionRate ?? payrollRateConfig.defaultDeductionRate);
  payrollRateConfig.updatedAt = new Date().toISOString();
  addAudit(req.user.email, "Rate configuration updated", "Payroll");
  res.json(payrollRateConfig);
});

// ----- Payslip Approval Workflow -----

// Finance approval - transition draft → finance_pending → finance_approved
router.put("/payslips/:id/finance-approve", authenticateToken, allowRoles("Admin", "Finance"), (req, res) => {
  const payslip = payslips.find((p) => p.payslip_id === req.params.id);
  if (!payslip) {
    return res.status(404).json({ message: "Payslip not found" });
  }

  // Check if already in finance_pending or draft status
  if (payslip.status !== PAYSLIP_STATUSES.DRAFT && payslip.status !== PAYSLIP_STATUSES.FINANCE_PENDING) {
    return res.status(400).json({
      message: `Cannot approve payslip in ${payslip.status} status. Expected draft or finance_pending.`
    });
  }

  payslip.status = PAYSLIP_STATUSES.ADMIN_PENDING;
  payslip.finance_approval = true;
  payslip.finance_approved_at = new Date().toISOString();
  payslip.finance_approved_by = req.user.email;
  payslip.finance_rejection_reason = null;
  payslip.updated_at = new Date().toISOString();

  addAudit(req.user.email, `Finance approved payslip ${req.params.id}`, "Payroll");
  res.json({
    message: "Payslip approved by Finance",
    payslip
  });
});

// HR -> Finance: send payslip for finance review (draft -> finance_pending)
router.put("/payslips/:id/send-to-finance", authenticateToken, allowRoles("Admin", "HR"), (req, res) => {
  const payslip = payslips.find((p) => p.payslip_id === req.params.id);
  if (!payslip) {
    return res.status(404).json({ message: "Payslip not found" });
  }

  // Only allow sending when in draft status (idempotent if already pending)
  if (payslip.status !== PAYSLIP_STATUSES.DRAFT && payslip.status !== PAYSLIP_STATUSES.FINANCE_PENDING) {
    return res.status(400).json({ message: `Cannot send payslip in ${payslip.status} status.` });
  }

  payslip.status = PAYSLIP_STATUSES.FINANCE_PENDING;
  payslip.updated_at = new Date().toISOString();

  addAudit(req.user.email, `HR sent payslip ${req.params.id} to Finance`, "Payroll");

  res.json({ message: "Payslip sent to Finance", payslip });
});

// Bulk send payslips to Finance (accepts { payslip_ids: [...]} or { allDrafts: true })
router.put("/payslips/bulk-send-to-finance", authenticateToken, allowRoles("Admin", "HR"), (req, res) => {
  try {
    const { payslip_ids, allDrafts } = req.body || {};

    let targets = [];
    if (allDrafts) {
      targets = payslips.filter((p) => p.status === PAYSLIP_STATUSES.DRAFT);
    } else {
      if (!Array.isArray(payslip_ids) || payslip_ids.length === 0) {
        return res.status(400).json({ message: "payslip_ids array is required unless allDrafts=true" });
      }
      targets = payslips.filter((p) => payslip_ids.includes(p.payslip_id));
    }

    const updated = [];
    const skipped = [];

    targets.forEach((p) => {
      if (p.status !== PAYSLIP_STATUSES.DRAFT && p.status !== PAYSLIP_STATUSES.FINANCE_PENDING) {
        skipped.push({ payslip_id: p.payslip_id, reason: `Invalid status ${p.status}` });
        return;
      }

      p.status = PAYSLIP_STATUSES.FINANCE_PENDING;
      p.updated_at = new Date().toISOString();
      updated.push(p.payslip_id);
      addAudit(req.user.email, `HR sent payslip ${p.payslip_id} to Finance (bulk)`, "Payroll");
    });

    res.json({ message: "Bulk send completed", updated_count: updated.length, updated_ids: updated, skipped });
  } catch (err) {
    res.status(500).json({ message: "Bulk send failed", error: err.message });
  }
});

// Finance rejection
router.put("/payslips/:id/finance-reject", authenticateToken, allowRoles("Admin", "Finance"), (req, res) => {
  const payslip = payslips.find((p) => p.payslip_id === req.params.id);
  if (!payslip) {
    return res.status(404).json({ message: "Payslip not found" });
  }

  const { reason } = req.body;
  if (!reason) {
    return res.status(400).json({ message: "Rejection reason is required" });
  }

  // Can reject from draft or finance_pending
  if (payslip.status !== PAYSLIP_STATUSES.DRAFT && payslip.status !== PAYSLIP_STATUSES.FINANCE_PENDING) {
    return res.status(400).json({
      message: `Cannot reject payslip in ${payslip.status} status.`
    });
  }

  payslip.status = PAYSLIP_STATUSES.DRAFT;
  payslip.finance_approval = false;
  payslip.finance_approved_at = null;
  payslip.finance_approved_by = null;
  payslip.finance_rejection_reason = reason;
  payslip.updated_at = new Date().toISOString();

  addAudit(req.user.email, `Finance rejected payslip ${req.params.id}: ${reason}`, "Payroll");
  res.json({
    message: "Payslip rejected by Finance",
    payslip
  });
});

// Admin final approval - transition admin_pending → sent_to_staff
router.put("/payslips/:id/admin-approve", authenticateToken, allowRoles("Admin"), (req, res) => {
  const payslip = payslips.find((p) => p.payslip_id === req.params.id);
  if (!payslip) {
    return res.status(404).json({ message: "Payslip not found" });
  }

  if (payslip.status !== PAYSLIP_STATUSES.ADMIN_PENDING) {
    return res.status(400).json({
      message: `Cannot approve payslip in ${payslip.status} status. Expected admin_pending.`
    });
  }

  payslip.status = PAYSLIP_STATUSES.SENT_TO_STAFF;
  payslip.admin_approval = true;
  payslip.admin_approved_at = new Date().toISOString();
  payslip.admin_approved_by = req.user.email;
  payslip.admin_rejection_reason = null;
  payslip.sent_to_staff_at = new Date().toISOString();
  payslip.updated_at = new Date().toISOString();

  addAudit(req.user.email, `Admin approved payslip ${req.params.id} and sent to staff`, "Payroll");
  res.json({
    message: "Payslip approved by Admin and sent to staff",
    payslip
  });
});

// Admin rejection
router.put("/payslips/:id/admin-reject", authenticateToken, allowRoles("Admin"), (req, res) => {
  const payslip = payslips.find((p) => p.payslip_id === req.params.id);
  if (!payslip) {
    return res.status(404).json({ message: "Payslip not found" });
  }

  const { reason } = req.body;
  if (!reason) {
    return res.status(400).json({ message: "Rejection reason is required" });
  }

  if (payslip.status !== PAYSLIP_STATUSES.ADMIN_PENDING) {
    return res.status(400).json({
      message: `Cannot reject payslip in ${payslip.status} status.`
    });
  }

  payslip.status = PAYSLIP_STATUSES.DRAFT;
  payslip.admin_approval = false;
  payslip.admin_approved_at = null;
  payslip.admin_approved_by = null;
  payslip.admin_rejection_reason = reason;
  payslip.updated_at = new Date().toISOString();

  addAudit(req.user.email, `Admin rejected payslip ${req.params.id}: ${reason}`, "Payroll");
  res.json({
    message: "Payslip rejected by Admin",
    payslip
  });
});

module.exports = router;
