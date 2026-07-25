const {
  createFinancePayrollRunFromStaff,
  getPayrollRunComplianceErrors,
  listFinancePayrollRuns,
  recalculateFinancePayrollRun,
  upsertFinancePayrollRun
} = require("../models/financePayrollModel");
const { logAuditEvent, getClientIp, getDeviceInfo } = require("../models/auditLogModel");
const { validateFinancePayrollRun } = require("../services/financePayrollWorkflow");
const { generateAndSendPayslip } = require("../services/payslipDeliveryService");
const { launchPayslipBrowser } = require("../services/payslipPdfService");
const { pool } = require("../config/db");
const {
  applyScheduleDefaultsToRun,
  cancelRunSchedule,
  confirmRunSchedule,
  getFinanceScheduleConfig,
  markRunForManualRetry,
  previewFinanceSchedule,
  saveFinanceScheduleConfig,
  updateRunSchedule
} = require("../services/financePayrollScheduleService");
const {
  generateAdjustmentProposals,
  listAdjustmentProposals,
  reviewAdjustmentProposals
} = require("../services/financePayrollAdjustmentService");

async function getFinancePayrollRuns(req, res) {
  try {
    const runs = await listFinancePayrollRuns();

    res.json({ runs });
  } catch (error) {
    res.status(500).json({ message: "Failed to load Finance payroll runs." });
  }
}

async function getFinanceActivity(req, res) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const where = ["(al.activity_type LIKE 'Payroll%' OR al.activity_type LIKE 'Payslip%')"];
    const params = [];
    if (req.query.startDate) { where.push("DATE(al.created_at) >= ?"); params.push(req.query.startDate); }
    if (req.query.endDate) { where.push("DATE(al.created_at) <= ?"); params.push(req.query.endDate); }
    if (req.query.eventType) { where.push("al.activity_type = ?"); params.push(req.query.eventType); }
    if (req.query.status) { where.push("al.status = ?"); params.push(req.query.status); }
    if (req.query.actor) { where.push("COALESCE(u.name, al.user_name, 'System') LIKE ?"); params.push(`%${req.query.actor}%`); }
    if (req.query.keyword) {
      where.push("(al.action_description LIKE ? OR al.affected_record LIKE ?)");
      params.push(`%${req.query.keyword}%`, `%${req.query.keyword}%`);
    }
    const whereSql = where.join(" AND ");
    const [[count]] = await pool.query(`SELECT COUNT(*) AS total FROM audit_logs al LEFT JOIN user u ON u.user_id = al.user_id WHERE ${whereSql}`, params);
    const [rows] = await pool.query(
      `SELECT al.audit_log_id AS id, al.created_at AS createdAt,
         COALESCE(u.name, al.user_name, 'System') AS actor,
         CASE WHEN al.module = 'Claims' THEN 'Claims' WHEN al.activity_type LIKE 'Payslip%' THEN 'Payslip' ELSE 'Payroll' END AS area,
         al.activity_type AS eventType, al.action_description AS action,
         al.affected_record AS affectedRecord, al.status AS outcome
       FROM audit_logs al LEFT JOIN user u ON u.user_id = al.user_id
       WHERE ${whereSql} ORDER BY al.created_at DESC, al.audit_log_id DESC LIMIT ? OFFSET ?`,
      [...params, limit, (page - 1) * limit]
    );
    const [types] = await pool.query(`SELECT DISTINCT al.activity_type AS value FROM audit_logs al WHERE ${where[0]} ORDER BY al.activity_type`);
    return res.json({ logs: rows, total: Number(count.total), page, limit, eventTypes: types.map((row) => row.value).filter(Boolean) });
  } catch (error) { return res.status(500).json({ message: "Unable to load Finance payroll activity." }); }
}

async function getPayslipPeriodSummary(req, res) {
  try {
    const month = Number(req.query.month);
    const year = Number(req.query.year);
    const params = [];
    let where = "1=1";
    if (month && year) { where = "p.payroll_month = ? AND p.payroll_year = ?"; params.push(month, year); }
    const [rows] = await pool.query(
      `SELECT p.payroll_month AS month, p.payroll_year AS year, COUNT(*) AS total,
       SUM(LOWER(p.payslip_status) = 'draft') AS prepared,
       SUM(LOWER(p.payslip_status) = 'hold') AS held,
       SUM(LOWER(p.payslip_status) = 'finance_pending') AS financePending,
       SUM(LOWER(p.payslip_status) IN ('approved','finance_approved')) AS financeApproved,
       SUM(LOWER(p.payslip_status) IN ('sent','sent_to_staff')) AS sent,
       ROUND(SUM(p.gross_salary), 2) AS totalGross,
       ROUND(SUM(p.net_salary), 2) AS totalNet,
       SUM(CASE WHEN JSON_VALID(p.deduction_breakdown)
         THEN COALESCE(JSON_LENGTH(JSON_EXTRACT(p.deduction_breakdown, '$.complianceExceptions')), 0)
         ELSE 0 END) AS exceptionCount,
       MIN(p.created_at) AS preparedAt,
       MAX(CASE WHEN p.payslip_status = 'finance_pending' THEN p.run_updated_at END) AS sentToFinanceAt,
       MAX(p.run_approved_at) AS financeApprovedAt, MAX(p.payslip_sent_at) AS sentAt
       FROM payroll p WHERE ${where}
       GROUP BY p.payroll_month, p.payroll_year ORDER BY p.payroll_year DESC, p.payroll_month DESC`, params
    );
    return res.json({ periods: rows.map((row) => {
      const values = {
        ...row,
      total: Number(row.total),
      prepared: Number(row.prepared),
      held: Number(row.held),
      financePending: Number(row.financePending),
      financeApproved: Number(row.financeApproved),
      sent: Number(row.sent),
      totalGross: Number(row.totalGross),
      totalNet: Number(row.totalNet),
        exceptionCount: Number(row.exceptionCount)
      };
      values.workflowStages = [
        { key: "prepared", count: values.total, complete: values.total > 0, blocked: 0, at: values.preparedAt },
        { key: "sentToFinance", count: values.financePending + values.financeApproved + values.sent, complete: values.financePending + values.financeApproved + values.sent + values.held === values.total, blocked: values.held, at: values.sentToFinanceAt },
        { key: "financeReview", count: values.financePending, complete: values.total > 0 && values.financePending === 0 && values.held === 0, blocked: values.held, at: values.financeApprovedAt },
        { key: "financeApproved", count: values.financeApproved + values.sent, complete: values.total > 0 && values.financeApproved + values.sent === values.total, blocked: values.held, at: values.financeApprovedAt },
        { key: "delivered", count: values.sent, complete: values.total > 0 && values.sent === values.total, blocked: values.held, at: values.sentAt }
      ];
      return values;
    }) });
  } catch (error) { return res.status(500).json({ message: "Unable to load payslip workflow summary." }); }
}

async function getSchedule(req, res) {
  try { return res.json({ schedule: await getFinanceScheduleConfig() }); }
  catch (error) { return res.status(500).json({ message: error.message || "Unable to load payroll schedule." }); }
}

async function updateSchedule(req, res) {
  try {
    const schedule = await saveFinanceScheduleConfig(req.body || {}, req.user?.userId);
    await logAuditEvent({ userId: req.user?.userId, userName: req.user?.email, activityType: "Payroll Schedule", actionDescription: "Updated Finance payroll schedule defaults", status: "Success", ipAddress: getClientIp(req), deviceInfo: getDeviceInfo(req) });
    return res.json({ schedule });
  } catch (error) { return res.status(400).json({ message: error.message }); }
}

async function getSchedulePreview(req, res) {
  try {
    const year = Number(req.query.year);
    const month = Number(req.query.month);
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return res.status(400).json({ message: "Valid payroll year and month are required." });
    return res.json({ preview: await previewFinanceSchedule(year, month, req.query) });
  } catch (error) { return res.status(400).json({ message: error.message || "Unable to preview payroll schedule." }); }
}

async function runScheduleAction(req, res, action) {
  try {
    if (action === "update") await updateRunSchedule(req.params.runId, req.body || {}, req.user?.userId);
    if (action === "confirm") await confirmRunSchedule(req.params.runId, req.user?.userId);
    if (action === "cancel") await cancelRunSchedule(req.params.runId, req.user?.userId);
    if (action === "retry") await markRunForManualRetry(req.params.runId, req.user?.userId);
    const runs = await listFinancePayrollRuns();
    return res.json({ run: runs.find((run) => run.id === req.params.runId) });
  } catch (error) { return res.status(409).json({ message: error.message, errors: error.details || [] }); }
}

async function validateRunCompliance(req, res) {
  try {
    const errors = await getPayrollRunComplianceErrors(req.params.runId);
    await logAuditEvent({
      userId: req.user?.userId || null, userName: req.user?.email,
      activityType: "Payroll",
      actionDescription: `${errors.length ? "Failed" : "Passed"} payroll compliance validation for ${req.params.runId}`,
      affectedRecord: req.params.runId, status: errors.length ? "Failed" : "Success",
      ipAddress: getClientIp(req), deviceInfo: getDeviceInfo(req)
    });
    return res.status(errors.length ? 409 : 200).json({ passed: errors.length === 0, runId: req.params.runId, checkedAt: new Date().toISOString(), errors });
  } catch (error) {
    return res.status(400).json({ message: error.message || "Unable to validate payroll compliance." });
  }
}

async function createRunFromStaffDatabase(req, res) {
  try {
    const now = new Date();
    const month = Number(req.body.month || now.getMonth() + 1);
    const year = Number(req.body.year || now.getFullYear());

    if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year) || year < 2000) {
      return res.status(400).json({ message: "Valid month and year are required." });
    }

    const result = await createFinancePayrollRunFromStaff({
      month,
      year,
      userEmail: req.user?.email,
      userId: req.user?.userId
    });

    if (result.noActiveStaff) {
      return res.status(400).json({ message: "No active staff records found in the staff database." });
    }
    await applyScheduleDefaultsToRun(result.run.id);
    result.run = (await listFinancePayrollRuns()).find((run) => run.id === result.run.id) || result.run;

    await logAuditEvent({
      userId: req.user?.userId || null,
      userName: req.user?.email,
      activityType: "Payroll",
      actionDescription: `Created Finance payroll run ${result.run.id} from staff database`,
      affectedRecord: result.run.id,
      status: "Success",
      ipAddress: getClientIp(req),
      deviceInfo: getDeviceInfo(req)
    });

    res.status(201).json({ run: result.run });
  } catch (error) {
    if (error.code === "DUPLICATE_PAYROLL_RUN") {
      return res.status(409).json({ message: error.message });
    }
    res.status(500).json({ message: "Failed to create Finance payroll run from staff database." });
  }
}

async function recalculateRun(req, res) {
  try {
    const run = await recalculateFinancePayrollRun({
      runId: req.params.runId,
      userId: req.user?.userId,
      userEmail: req.user?.email
    });
    await logAuditEvent({
      userId: req.user?.userId || null, userName: req.user?.email,
      activityType: "Payroll",
      actionDescription: `Recalculated payroll run ${run.id} using latest Admin payroll rules`,
      affectedRecord: run.id, status: "Success",
      ipAddress: getClientIp(req), deviceInfo: getDeviceInfo(req)
    });
    return res.json({ run });
  } catch (error) {
    const locked = error.code === "PAYROLL_RUN_LOCKED";
    return res.status(locked ? 409 : 400).json({
      code: error.code || "PAYROLL_RECALCULATION_FAILED",
      message: error.message || "Unable to recalculate payroll."
    });
  }
}

async function saveFinancePayrollRun(req, res) {
  try {
    const run = req.body?.run;

    if (!run || !run.id || run.id !== req.params.runId) {
      return res.status(400).json({ message: "Valid payroll run payload is required." });
    }

    const workflowErrors = validateFinancePayrollRun(run);
    if (workflowErrors.length) {
      return res.status(400).json({
        code: "INVALID_PAYROLL_WORKFLOW",
        message: workflowErrors[0],
        errors: workflowErrors
      });
    }

    if (run.approvedAt || run.paymentFileGeneratedAt || run.paidAt || run.payslipsSentAt) {
      const complianceErrors = await getPayrollRunComplianceErrors(run.id);
      if (complianceErrors.length) {
        return res.status(409).json({
          code: "PAYROLL_COMPLIANCE_HOLD",
          message: "Payroll cannot be approved while compliance exceptions remain.",
          errors: complianceErrors
        });
      }
    }

    if (run.payslipsSentAt) {
      const [payslips] = await pool.query(
        `SELECT payroll_id
         FROM payroll
         WHERE payroll_month = ? AND payroll_year = ?
         ORDER BY staff_employee_id, payroll_id`,
        [Number(run.month), Number(run.year)]
      );
      const deliveryErrors = [];
      const browser = payslips.length ? await launchPayslipBrowser() : null;
      try {
        for (const payslip of payslips) {
          try {
            const delivery = await generateAndSendPayslip(payslip.payroll_id, { browser, actorUserId: req.user?.userId });
            if (delivery.status !== 200) deliveryErrors.push(`Payslip ${payslip.payroll_id}: ${delivery.message}`);
          } catch (error) {
            deliveryErrors.push(`Payslip ${payslip.payroll_id}: ${error.message}`);
          }
        }
      } finally {
        if (browser) await browser.close();
      }
      if (deliveryErrors.length) {
        return res.status(409).json({
          code: "PAYSLIP_DELIVERY_INCOMPLETE",
          message: "Some employee payslips could not be generated or delivered.",
          errors: deliveryErrors
        });
      }
    }

    const savedRun = await upsertFinancePayrollRun({
      run,
      userId: req.user?.userId
    });

    await logAuditEvent({
      userId: req.user?.userId || null,
      userName: req.user?.email,
      activityType: "Payroll",
      actionDescription: `Updated payroll run ${run.id} to ${run.status}`,
      affectedRecord: run.id,
      status: "Success",
      ipAddress: getClientIp(req),
      deviceInfo: getDeviceInfo(req)
    });

    res.json({ run: savedRun });
  } catch (error) {
    if (error.code === "PAYROLL_RULE_SNAPSHOT_REQUIRED") {
      return res.status(409).json({ code: error.code, message: error.message });
    }
    if (error.message === "Payroll run not found.") {
      return res.status(404).json({ message: error.message });
    }
    res.status(500).json({ message: "Failed to save Finance payroll run." });
  }
}

async function getRunAdjustments(req, res) {
  try {
    return res.json({ proposals: await listAdjustmentProposals(req.params.runId) });
  } catch (error) {
    return res.status(error.code === "PAYROLL_ADJUSTMENT_MIGRATION_REQUIRED" ? 503 : 400).json({ code: error.code, message: error.message });
  }
}

async function generateRunAdjustments(req, res) {
  try {
    const proposals = await generateAdjustmentProposals(req.params.runId, req.user?.userId);
    await logAuditEvent({
      userId: req.user?.userId, userName: req.user?.email, activityType: "Payroll Adjustment",
      actionDescription: `Generated ${proposals.length} payroll adjustment proposal(s) for ${req.params.runId}`,
      affectedRecord: req.params.runId, status: "Success", ipAddress: getClientIp(req), deviceInfo: getDeviceInfo(req)
    });
    return res.status(201).json({ proposals });
  } catch (error) {
    const status = error.code === "PAYROLL_RUN_LOCKED" || error.code === "PAYROLL_RULE_SNAPSHOT_REQUIRED" ? 409 : error.code === "PAYROLL_ADJUSTMENT_MIGRATION_REQUIRED" ? 503 : 400;
    return res.status(status).json({ code: error.code, message: error.message });
  }
}

async function reviewRunAdjustments(req, res) {
  try {
    const action = req.body?.action;
    const result = await reviewAdjustmentProposals({
      runId: req.params.runId, ids: req.body?.ids, action, reason: req.body?.reason,
      userId: req.user?.userId,
      recalculate: (options) => recalculateFinancePayrollRun({ ...options, userEmail: req.user?.email })
    });
    await logAuditEvent({
      userId: req.user?.userId, userName: req.user?.email, activityType: `Payroll Adjustment ${action === "approve" ? "Approval" : "Rejection"}`,
      actionDescription: `${action === "approve" ? "Approved" : "Rejected"} ${req.body.ids.length} payroll adjustment proposal(s) for ${req.params.runId}`,
      affectedRecord: req.params.runId, status: "Success", ipAddress: getClientIp(req), deviceInfo: getDeviceInfo(req)
    });
    return res.json(result);
  } catch (error) {
    const status = ["STALE_ADJUSTMENT", "PAYROLL_RUN_LOCKED", "PAYROLL_RULE_SNAPSHOT_REQUIRED"].includes(error.code) ? 409 : 400;
    return res.status(status).json({ code: error.code, message: error.message });
  }
}

module.exports = {
  createRunFromStaffDatabase,
  getFinancePayrollRuns,
  getFinanceActivity,
  getPayslipPeriodSummary,
  getRunAdjustments,
  generateRunAdjustments,
  getSchedule,
  getSchedulePreview,
  recalculateRun,
  saveFinancePayrollRun,
  validateRunCompliance,
  updateSchedule,
  updateRunSchedule: (req, res) => runScheduleAction(req, res, "update"),
  confirmRunSchedule: (req, res) => runScheduleAction(req, res, "confirm"),
  cancelRunSchedule: (req, res) => runScheduleAction(req, res, "cancel"),
  retryRunSchedule: (req, res) => runScheduleAction(req, res, "retry"),
  reviewRunAdjustments
};
