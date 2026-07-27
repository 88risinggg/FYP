/**
 * Payroll Controller
 *
 * Handles payroll template downloads, rate configuration,
 * and payslip approval workflow (Finance approve/reject, HR submit).
 *
 * Primary table: payroll
 */

const ExcelJS = require("exceljs");
const { payrollRateConfig } = require("../services/data");
const { pool } = require("../config/db");
const { writeAuditLog } = require("../services/auditService");
const { notifyRoles } = require("../services/payrollNotificationService");
const { logAuditEvent, getClientIp, getDeviceInfo } = require("../models/auditLogModel");

/**
 * GET /api/payroll/template
 * Download payroll Excel template.
 */
async function downloadTemplate(req, res) {
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
  sheet.columns.forEach((c) => (c.width = 18));
  sheet.getRow(1).font = { bold: true };
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=PayrollTemplate.xlsx");
  await workbook.xlsx.write(res);
  writeAuditLog({ module: "Payroll", activityType: "template_download", action: "Downloaded payroll template", userId: req.user?.userId, userName: req.user?.email });
  res.end();
}

/**
 * GET /api/payroll/rates
 * Get payroll rate configuration.
 */
function getRates(_req, res) {
  res.json(payrollRateConfig);
}

/**
 * PUT /api/payroll/rates
 * Update payroll rate configuration.
 */
function updateRates(req, res) {
  payrollRateConfig.employeeCpfRate = Number(req.body.employeeCpfRate ?? payrollRateConfig.employeeCpfRate);
  payrollRateConfig.employerCpfRate = Number(req.body.employerCpfRate ?? payrollRateConfig.employerCpfRate);
  payrollRateConfig.sdlRate = Number(req.body.sdlRate ?? payrollRateConfig.sdlRate);
  payrollRateConfig.defaultAllowanceRate = Number(req.body.defaultAllowanceRate ?? payrollRateConfig.defaultAllowanceRate);
  payrollRateConfig.defaultDeductionRate = Number(req.body.defaultDeductionRate ?? payrollRateConfig.defaultDeductionRate);
  payrollRateConfig.updatedAt = new Date().toISOString();
  writeAuditLog({ module: "Payroll", activityType: "rate_config_updated", action: "Rate configuration updated", userId: req.user?.userId, userName: req.user?.email });
  res.json(payrollRateConfig);
}

/**
 * PUT /api/payroll/payslips/:id/finance-approve
 * Finance approves a payslip: finance_pending → finance_approved
 */
async function financeApprovePayslip(req, res) {
  try {
    const payslipId = req.params.id;

    const [rows] = await pool.query(
      "SELECT *, payroll_id AS payslip_id, payslip_status AS status FROM payroll WHERE payroll_id = ? LIMIT 1",
      [payslipId]
    );
    if (!rows.length) {
      return res.status(404).json({ message: "Payslip not found" });
    }

    const payslip = rows[0];
    if (!["draft", "finance_pending"].includes(String(payslip.status).toLowerCase())) {
      return res.status(400).json({ message: `Cannot approve payslip in ${payslip.status} status. Expected draft or finance_pending.` });
    }

    await pool.query("UPDATE payroll SET payslip_status = 'finance_approved' WHERE payroll_id = ?", [payslipId]);

    writeAuditLog({ module: "Payroll", activityType: "Payslip Approval", action: `Finance approved payslip ${payslipId}`, entityType: "payslip", entityId: payslipId, userId: req.user?.userId, userName: req.user?.email });
    await logAuditEvent({
      userId: req.user.userId,
      userName: req.user.email,
      module: "Payroll",
      activityType: "Payslip Approval",
      actionDescription: `Finance approved payslip ${payslipId}`,
      affectedRecord: String(payslipId),
      status: "Success",
      ipAddress: getClientIp(req),
      deviceInfo: getDeviceInfo(req),
    });
    await notifyRoles("HR", {
      type: "payslip_approved",
      title: "Payslip approved by Finance",
      message: `Payslip ${payslipId} is approved and ready for the next HR action.`,
      actorUserId: req.user.userId,
      entityType: "payslip",
      entityId: payslipId,
      actionPath: "/dashboard/payroll/hr/payslips",
    }, { excludeUserId: req.user.userId });

    res.json({ message: "Payslip approved by Finance", payslip: { ...payslip, status: "finance_approved" } });
  } catch (err) {
    res.status(500).json({ message: "Failed to approve payslip", error: err.message });
  }
}

/**
 * PUT /api/payroll/payslips/:id/send-to-finance
 * HR sends a payslip for Finance review: draft → finance_pending
 */
async function sendPayslipToFinance(req, res) {
  try {
    const payslipId = req.params.id;

    const [rows] = await pool.query(
      "SELECT *, payroll_id AS payslip_id, payslip_status AS status FROM payroll WHERE payroll_id = ? LIMIT 1",
      [payslipId]
    );
    if (!rows.length) {
      return res.status(404).json({ message: "Payslip not found" });
    }

    const payslip = rows[0];
    if (!["draft", "finance_pending"].includes(String(payslip.status).toLowerCase())) {
      return res.status(400).json({ message: `Cannot send payslip in ${payslip.status} status.` });
    }

    await pool.query("UPDATE payroll SET payslip_status = 'finance_pending' WHERE payroll_id = ?", [payslipId]);

    writeAuditLog({ module: "Payroll", activityType: "payslip_submitted", action: `HR sent payslip ${payslipId} to Finance`, entityType: "payslip", entityId: payslipId, userId: req.user?.userId, userName: req.user?.email });
    await notifyRoles("Finance", {
      type: "payslip_finance_review",
      title: "Payslip awaiting Finance approval",
      message: `Payslip ${payslipId} requires Finance review.`,
      actorUserId: req.user.userId,
      entityType: "payslip",
      entityId: payslipId,
      actionPath: "/dashboard/payroll/finance/payslips-approval",
    }, { excludeUserId: req.user.userId });

    res.json({ message: "Payslip sent to Finance", payslip: { ...payslip, status: "finance_pending" } });
  } catch (err) {
    res.status(500).json({ message: "Failed to send to Finance", error: err.message });
  }
}

/**
 * PUT /api/payroll/payslips/bulk-send-to-finance
 * Bulk send payslips to Finance. Accepts { payslip_ids: [...] } or { allDrafts: true }
 */
async function bulkSendToFinance(req, res) {
  try {
    const { payslip_ids, allDrafts } = req.body || {};

    let targetIds = [];
    if (allDrafts) {
      const [rows] = await pool.query("SELECT payroll_id AS payslip_id FROM payroll WHERE LOWER(payslip_status) = 'draft'");
      targetIds = rows.map((r) => r.payslip_id);
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

    writeAuditLog({ module: "Payroll", activityType: "payslip_bulk_submitted", action: `Bulk sent ${updated_count} payslips to Finance`, userId: req.user?.userId, userName: req.user?.email });
    if (updated_count > 0) {
      try {
        await notifyRoles("Finance", {
          type: "payslip_finance_review",
          title: "Payslips awaiting Finance approval",
          message: `${updated_count} payslip(s) require Finance review.`,
          actorUserId: req.user.userId,
          entityType: "payslip_batch",
          entityId: targetIds.slice(0, updated_count).join(","),
          actionPath: "/dashboard/payroll/finance/payslips-approval",
        }, { excludeUserId: req.user.userId });
      } catch (notificationErr) {
        console.error("Bulk send finance notification failed:", notificationErr);
      }
    }

    res.json({
      message: "Bulk send completed",
      updated_count,
      updated_ids: targetIds.slice(0, updated_count),
      skipped: skipped > 0 ? [{ reason: `${skipped} payslips were not in draft status` }] : [],
    });
  } catch (err) {
    res.status(500).json({ message: "Bulk send failed", error: err.message });
  }
}

/**
 * PUT /api/payroll/payslips/:id/finance-reject
 * Finance rejects a payslip: finance_pending → Draft
 */
async function financeRejectPayslip(req, res) {
  try {
    const payslipId = req.params.id;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ message: "Rejection reason is required" });
    }

    const [rows] = await pool.query(
      "SELECT *, payroll_id AS payslip_id, payslip_status AS status FROM payroll WHERE payroll_id = ? LIMIT 1",
      [payslipId]
    );
    if (!rows.length) {
      return res.status(404).json({ message: "Payslip not found" });
    }

    const payslip = rows[0];
    if (!["draft", "finance_pending"].includes(String(payslip.status).toLowerCase())) {
      return res.status(400).json({ message: `Cannot reject payslip in ${payslip.status} status.` });
    }

    await pool.query("UPDATE payroll SET payslip_status = 'Draft' WHERE payroll_id = ?", [payslipId]);

    writeAuditLog({ module: "Payroll", activityType: "Payslip Rejection", action: `Finance rejected payslip ${payslipId}: ${reason}`, entityType: "payslip", entityId: payslipId, userId: req.user?.userId, userName: req.user?.email, status: "Warning" });
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
      deviceInfo: getDeviceInfo(req),
    });
    await notifyRoles("HR", {
      type: "payslip_rejected",
      title: "Payslip returned by Finance",
      message: `Payslip ${payslipId} was returned for correction: ${reason}`,
      actorUserId: req.user.userId,
      entityType: "payslip",
      entityId: payslipId,
      actionPath: "/dashboard/payroll/hr/payslips",
    }, { excludeUserId: req.user.userId });

    res.json({ message: "Payslip rejected by Finance", payslip: { ...payslip, status: "draft" } });
  } catch (err) {
    res.status(500).json({ message: "Failed to reject payslip", error: err.message });
  }
}

module.exports = {
  downloadTemplate,
  getRates,
  updateRates,
  financeApprovePayslip,
  sendPayslipToFinance,
  bulkSendToFinance,
  financeRejectPayslip,
};
