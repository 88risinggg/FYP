/**
 * EVALUATION HEADER
 * FEATURE: PAYROLL - SHARED
 * PURPOSE: Defines the available payroll Routes API endpoints and connects them to handlers.
 * LAYER: Backend route - maps HTTP methods and URLs to middleware and controller functions.
 * FIND RELATED CODE: Follow the imported controller function to find request handling.
 */
const express = require("express");
const ExcelJS = require("exceljs");
const { payrollRateConfig } = require("../services/data");
const { pool } = require("../config/db");
const { addAudit } = require("../services/audit");
const { authenticateToken } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/rolesMiddleware");
const { notifyRoles } = require("../services/payrollNotificationService");
const { logAuditEvent, getClientIp, getDeviceInfo } = require("../models/auditLogModel");

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

// Finance approval - transition finance_pending → finance_approved
router.put("/payslips/:id/finance-approve", authenticateToken, allowRoles("Finance"), async (req, res) => {
  try {
    const payslipId = req.params.id;

    const [rows] = await pool.query('SELECT *, payroll_id AS payslip_id, payslip_status AS status FROM payroll WHERE payroll_id = ? LIMIT 1', [payslipId]);
    if (!rows.length) {
      return res.status(404).json({ message: "Payslip not found" });
    }

    const payslip = rows[0];
    if (!['draft', 'finance_pending'].includes(String(payslip.status).toLowerCase())) {
      return res.status(400).json({ message: `Cannot approve payslip in ${payslip.status} status. Expected draft or finance_pending.` });
    }

    await pool.query(
      "UPDATE payroll SET payslip_status = 'finance_approved' WHERE payroll_id = ?",
      [payslipId]
    );

    addAudit(req.user.email, `Finance approved payslip ${payslipId}`, "Payroll");
    await logAuditEvent({
      userId: req.user.userId,
      userName: req.user.email,
      module: "Payroll",
      activityType: "Payslip Approval",
      actionDescription: `Finance approved payslip ${payslipId}`,
      affectedRecord: String(payslipId),
      status: "Success",
      ipAddress: getClientIp(req),
      deviceInfo: getDeviceInfo(req)
    });
    await notifyRoles("HR", {
      type: "payslip_approved", title: "Payslip approved by Finance",
      message: `Payslip ${payslipId} is approved and ready for the next HR action.`,
      actorUserId: req.user.userId, entityType: "payslip", entityId: payslipId,
      actionPath: "/dashboard/payroll/hr/payslips"
    }, { excludeUserId: req.user.userId });
    res.json({ message: "Payslip approved by Finance", payslip: { ...payslip, status: 'finance_approved' } });
  } catch (err) {
    res.status(500).json({ message: "Failed to approve payslip", error: err.message });
  }
});

// HR -> Finance: send payslip for finance review (draft -> finance_pending)
router.put("/payslips/:id/send-to-finance", authenticateToken, allowRoles("HR"), async (req, res) => {
  try {
    const payslipId = req.params.id;

    const [rows] = await pool.query('SELECT *, payroll_id AS payslip_id, payslip_status AS status FROM payroll WHERE payroll_id = ? LIMIT 1', [payslipId]);
    if (!rows.length) {
      return res.status(404).json({ message: "Payslip not found" });
    }

    const payslip = rows[0];
    if (!['draft', 'finance_pending'].includes(String(payslip.status).toLowerCase())) {
      return res.status(400).json({ message: `Cannot send payslip in ${payslip.status} status.` });
    }

    await pool.query(
      "UPDATE payroll SET payslip_status = 'finance_pending' WHERE payroll_id = ?",
      [payslipId]
    );

    addAudit(req.user.email, `HR sent payslip ${payslipId} to Finance`, "Payroll");
    await notifyRoles("Finance", {
      type: "payslip_finance_review", title: "Payslip awaiting Finance approval",
      message: `Payslip ${payslipId} requires Finance review.`, actorUserId: req.user.userId,
      entityType: "payslip", entityId: payslipId,
      actionPath: "/dashboard/payroll/finance/payslips-approval"
    }, { excludeUserId: req.user.userId });
    res.json({ message: "Payslip sent to Finance", payslip: { ...payslip, status: 'finance_pending' } });
  } catch (err) {
    res.status(500).json({ message: "Failed to send to Finance", error: err.message });
  }
});

// Bulk send payslips to Finance (accepts { payslip_ids: [...]} or { allDrafts: true })
router.put("/payslips/bulk-send-to-finance", authenticateToken, allowRoles("HR"), async (req, res) => {
  try {
    const { payslip_ids, allDrafts } = req.body || {};

    let targetIds = [];
    if (allDrafts) {
      const [rows] = await pool.query("SELECT payroll_id AS payslip_id FROM payroll WHERE LOWER(payslip_status) = 'draft'");
      targetIds = rows.map(r => r.payslip_id);
    } else {
      if (!Array.isArray(payslip_ids) || payslip_ids.length === 0) {
        return res.status(400).json({ message: "payslip_ids array is required unless allDrafts=true" });
      }
      targetIds = payslip_ids;
    }

    if (targetIds.length === 0) {
      return res.json({ message: "No draft payslips to send", updated_count: 0, updated_ids: [], skipped: [] });
    }

    const [result] = await pool.query(
      "UPDATE payroll SET payslip_status = 'finance_pending' WHERE payroll_id IN (?) AND LOWER(payslip_status) = 'draft'",
      [targetIds]
    );

    const updated_count = result.affectedRows;
    const skipped = targetIds.length - updated_count;

    addAudit(req.user.email, `Bulk sent ${updated_count} payslips to Finance`, "Payroll");
    if (updated_count > 0) {
      try {
        await notifyRoles("Finance", {
          type: "payslip_finance_review", title: "Payslips awaiting Finance approval",
          message: `${updated_count} payslip(s) require Finance review.`, actorUserId: req.user.userId,
          entityType: "payslip_batch", entityId: targetIds.slice(0, updated_count).join(","),
          actionPath: "/dashboard/payroll/finance/payslips-approval"
        }, { excludeUserId: req.user.userId });
      } catch (notificationErr) {
        console.error("Bulk send finance notification failed:", notificationErr);
      }
    }

    res.json({
      message: "Bulk send completed",
      updated_count,
      updated_ids: targetIds.slice(0, updated_count),
      skipped: skipped > 0 ? [{ reason: `${skipped} payslips were not in draft status` }] : []
    });
  } catch (err) {
    res.status(500).json({ message: "Bulk send failed", error: err.message });
  }
});

// Finance rejection
router.put("/payslips/:id/finance-reject", authenticateToken, allowRoles("Finance"), async (req, res) => {
  try {
    const { pool } = require("../config/db");
    const payslipId = req.params.id;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ message: "Rejection reason is required" });
    }

    const [rows] = await pool.query('SELECT *, payroll_id AS payslip_id, payslip_status AS status FROM payroll WHERE payroll_id = ? LIMIT 1', [payslipId]);
    if (!rows.length) {
      return res.status(404).json({ message: "Payslip not found" });
    }

    const payslip = rows[0];
    if (!['draft', 'finance_pending'].includes(String(payslip.status).toLowerCase())) {
      return res.status(400).json({ message: `Cannot reject payslip in ${payslip.status} status.` });
    }

    await pool.query(
      "UPDATE payroll SET payslip_status = 'Draft' WHERE payroll_id = ?",
      [payslipId]
    );

    addAudit(req.user.email, `Finance rejected payslip ${payslipId}: ${reason}`, "Payroll");
    await logAuditEvent({
      userId: req.user.userId,
      userName: req.user.email,
      module: "Payroll",
      activityType: "Payslip Rejection",
      actionDescription: `Finance returned payslip ${payslipId} for correction`,
      affectedRecord: String(payslipId),
      status: "Warning",
      newValue: JSON.stringify({ reason }),
      ipAddress: getClientIp(req),
      deviceInfo: getDeviceInfo(req)
    });
    await notifyRoles("HR", {
      type: "payslip_rejected", title: "Payslip returned by Finance",
      message: `Payslip ${payslipId} was returned for correction: ${reason}`,
      actorUserId: req.user.userId, entityType: "payslip", entityId: payslipId,
      actionPath: "/dashboard/payroll/hr/payslips"
    }, { excludeUserId: req.user.userId });
    res.json({ message: "Payslip rejected by Finance", payslip: { ...payslip, status: 'draft' } });
  } catch (err) {
    res.status(500).json({ message: "Failed to reject payslip", error: err.message });
  }
});

// Admin final approval - transition admin_pending → sent_to_staff
module.exports = router;
