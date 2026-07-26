const {
  createFinancePayrollRunFromStaff,
  getPayrollRunComplianceErrors,
  listFinancePayrollRuns,
  recalculateFinancePayrollRun,
  applyFinancePayrollWorkflowAction,
  upsertFinancePayrollRun
} = require("../models/financePayrollModel");
const { logAuditEvent, getClientIp, getDeviceInfo } = require("../models/auditLogModel");
const { validateFinancePayrollRun } = require("../services/financePayrollWorkflow");
const { generateAndSendPayslip } = require("../services/payslipDeliveryService");
const { launchPayslipBrowser } = require("../services/payslipPdfService");
const { notifyRoles } = require("../services/payrollNotificationService");
const { pool } = require("../config/db");
const { buildFinanceWorkflowState } = require("../services/financePayrollWorkflowState");
const { submitModernTreasuryEmployeePayment } = require("../services/modernTreasuryPaymentService");
const ExcelJS = require("exceljs");
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
    const where = ["al.company_id = ?", "(al.activity_type LIKE 'Payroll%' OR al.activity_type LIKE 'Payslip%')"];
    const params = [req.user.companyId];
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
    const [types] = await pool.query(`SELECT DISTINCT al.activity_type AS value FROM audit_logs al WHERE al.company_id=? AND ${where[1]} ORDER BY al.activity_type`, [req.user.companyId]);
    return res.json({ logs: rows, total: Number(count.total), page, limit, eventTypes: types.map((row) => row.value).filter(Boolean) });
  } catch (error) { return res.status(500).json({ message: "Unable to load Finance payroll activity." }); }
}

async function getPayslipPeriodSummary(req, res) {
  try {
    const month = Number(req.query.month);
    const year = Number(req.query.year);
    const params = [req.user.companyId];
    let where = "p.company_id = ?";
    if (month && year) { where += " AND p.payroll_month = ? AND p.payroll_year = ?"; params.push(month, year); }
    const [rows] = await pool.query(
      `SELECT p.payroll_month AS month, p.payroll_year AS year, COUNT(*) AS total,
       SUM(LOWER(p.payslip_status) = 'draft') AS prepared,
       SUM(LOWER(p.payslip_status) = 'hold') AS held,
       SUM(LOWER(p.payslip_status) = 'finance_pending') AS financePending,
       SUM(LOWER(p.payslip_status) = 'finance_approved') AS financeApproved,
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
    console.error("Finance payroll legacy save failed", { runId: req.params.runId, code: error.code, message: error.message, sqlState: error.sqlState });
    if (error.code === "PAYROLL_RULE_SNAPSHOT_REQUIRED") {
      return res.status(409).json({ code: error.code, message: error.message });
    }
    if (error.message === "Payroll run not found.") {
      return res.status(404).json({ message: error.message });
    }
    res.status(500).json({ code: error.code || "PAYROLL_SAVE_FAILED", message: `Failed to save Finance payroll run at the database stage. ${error.message || "Check the server log for details."}` });
  }
}

async function findFinanceRun(runId) {
  return (await listFinancePayrollRuns()).find((run) => run.id === runId) || null;
}

function financeReportDefinition(reportType, run) {
  const employees = run.employees || [];
  const money = (value) => Number(value || 0);
  // The stored deductions value is already the full payroll deduction total,
  // including employee CPF and self-help-group amounts.
  const deductions = (employee) => money(employee.totalDeductions ?? employee.storedTotalDeductions ?? employee.deductions);
  const net = (employee) => money(employee.netPay ?? (money(employee.grossPay ?? employee.basicPay) + money(employee.allowances) - deductions(employee)));
  const exceptions = employees.flatMap((employee) => (employee.complianceExceptions || []).map((item) => [employee.name, employee.department || "Missing", item.message || item.reason || String(item), employee.financeStatus || "Draft"]));
  const definitions = {
    "Payroll Summary": ["Payroll Summary", ["Employee", "Department", "Gross Earnings", "Total Deductions", "Net Pay", "Finance Status"], employees.map((e) => [e.name, e.department || "Missing", money(e.grossPay ?? e.basicPay) + money(e.allowances), deductions(e), net(e), e.financeStatus || "Draft"])],
    "Pay Run Summary": ["Pay Run Summary", ["Run ID", "Period", "Status", "Employees", "Payment Status", "Payment Reference"], [[run.id, `${String(run.month).padStart(2, "0")}/${run.year}`, run.status, employees.length, run.paymentStatus || "Pending", run.bankReference || ""]]],
    "Payment File": ["Payment File", ["Employee", "Bank", "Account Ending", "Net Payment", "Recipient Status", "Provider Reference"], employees.map((e) => [e.name, e.bank || e.bankType || "Missing", String(e.accountNo || e.bankAccount || "").slice(-4), net(e), e.modernTreasuryCounterpartyId ? "Configured" : "Pending", e.modernTreasuryReference || ""])],
    "Exception Summary": ["Exceptions", ["Employee", "Department", "Exception", "Finance Status"], exceptions.length ? exceptions : [["All employees", "All departments", "No automated exceptions detected", "Clear"]]],
    "CPF Summary": ["CPF Summary", ["Employee", "CPF Wage", "Employee CPF", "Employer CPF", "Total CPF"], employees.map((e) => [e.name, money(e.cpfApplicableEarnings ?? e.grossPay ?? e.basicPay), money(e.employeeCpf), money(e.employerCpf), money(e.employeeCpf) + money(e.employerCpf)])],
    "MBMF Summary": ["MBMF Summary", ["Employee", "Religion", "Employee MBMF", "Employer MBMF", "Eligibility"], employees.map((e) => [e.name, e.religion || "Not recorded", money(e.employeeMbmf), money(e.employerMbmf), money(e.employeeMbmf) || money(e.employerMbmf) ? "Applied" : "Not applied"])],
    "Deduction Summary": ["Deductions", ["Employee", "Other Deductions", "Employee CPF", "MBMF", "Total Deductions", "Net Pay"], employees.map((e) => [e.name, Math.max(0, deductions(e) - money(e.employeeCpf) - money(e.employeeMbmf ?? e.mbmf)), money(e.employeeCpf), money(e.employeeMbmf ?? e.mbmf), deductions(e), net(e)])],
    "Compliance Checklist": ["Compliance", ["Check", "Status", "Detail"], [["Rule snapshot", run.rulesChanged ? "Action required" : "Passed", run.rulesChanged ? "Admin rules changed after calculation" : "Stored rule snapshot is current"], ["Employee review", employees.every((e) => e.financeStatus === "Approved") ? "Passed" : "Action required", `${employees.filter((e) => e.financeStatus === "Approved").length}/${employees.length} approved`], ["Exceptions", exceptions.length ? "Action required" : "Passed", `${exceptions.length} exception(s)`]]],
    "Audit Trail": ["Audit Trail", ["Date Time", "Action", "Owner"], (run.timeline || []).map((e) => [e.at, e.action, e.owner || "System"])],
    "Cost to Company": ["Cost to Company", ["Employee", "Gross Earnings", "Employer CPF", "SDL", "Total Employer Cost"], employees.map((e) => { const gross = money(e.grossPay ?? e.basicPay) + money(e.allowances); return [e.name, gross, money(e.employerCpf), money(e.sdl), gross + money(e.employerCpf) + money(e.sdl)]; })]
  };
  return definitions[reportType] || null;
}

async function exportFinancePayrollReport(req, res) {
  try {
    const run = await findFinanceRun(String(req.query.runId || ""));
    if (!run) return res.status(404).json({ code: "PAYROLL_RUN_NOT_FOUND", message: "Payroll run not found." });
    const definition = financeReportDefinition(String(req.query.reportType || ""), run);
    if (!definition) return res.status(400).json({ code: "REPORT_NOT_EXPORTABLE", message: "This Finance report is not available as Excel." });
    const [sheetName, headers, rows] = definition;
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "PayNivo";
    workbook.created = new Date();
    workbook.properties.subject = `${req.query.reportType} for payroll run ${run.id}`;
    const sheet = workbook.addWorksheet(sheetName.slice(0, 31), { views: [{ state: "frozen", ySplit: 1 }] });
    sheet.addRow(headers);
    rows.forEach((row) => sheet.addRow(row));
    const header = sheet.getRow(1);
    header.font = { bold: true, color: { argb: "FFFFFFFF" } };
    header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF38978" } };
    header.alignment = { vertical: "middle" };
    header.height = 24;
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };
    sheet.columns.forEach((column, index) => {
      column.width = Math.min(44, Math.max(14, headers[index].length + 3, ...rows.map((row) => String(row[index] ?? "").length + 2)));
      if (rows.some((row) => typeof row[index] === "number")) column.numFmt = "#,##0.00";
    });
    sheet.eachRow((row, rowNumber) => { if (rowNumber > 1 && rowNumber % 2 === 0) row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF8F5" } }; });
    const slug = String(req.query.reportType).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${slug}-${run.id}.xlsx"`);
    await workbook.xlsx.write(res);
    return res.end();
  } catch (error) {
    console.error("Finance payroll Excel export failed", { runId: req.query.runId, reportType: req.query.reportType, message: error.message });
    return res.status(500).json({ code: "FINANCE_REPORT_EXPORT_FAILED", message: "Failed to export the Finance payroll report." });
  }
}

function workflowResponse(run, actionReference = null) {
  return { run, workflow: buildFinanceWorkflowState(run), actionReference };
}

async function getRunWorkflow(req, res) {
  try {
    const run = await findFinanceRun(req.params.runId);
    if (!run) return res.status(404).json({ code: "PAYROLL_RUN_NOT_FOUND", message: "Payroll run not found." });
    return res.json(workflowResponse(run));
  } catch (error) {
    console.error("Finance payroll workflow read failed", { runId: req.params.runId, code: error.code, message: error.message });
    return res.status(500).json({ code: "WORKFLOW_READ_FAILED", message: "Unable to restore payroll workflow state from the database." });
  }
}

async function runWorkflowAction(req, res) {
  const action = req.workflowAction || req.params.action;
  if (action === "send-payslips") {
    return res.status(403).json({ code: "ACTION_OWNED_BY_HR", message: "Payslip delivery is owned by HR. Finance can monitor its progress in the payroll-run tracker." });
  }
  const actionReference = `${req.params.runId}:${action}:${Date.now()}`;
  try {
    let payload = { ...(req.body || {}), actor: req.user?.email };
    if (["submit-payment", "retry-payment"].includes(action)) {
      let current = await findFinanceRun(req.params.runId);
      if (!current) return res.status(404).json({ code: "PAYROLL_RUN_NOT_FOUND", message: "Payroll run not found." });
      if (["Processing", "Submitted"].includes(current.paymentStatus) && current.bankReference) return res.json(workflowResponse(current, current.bankReference));
      const employees = current.employees.filter((employee) => employee.financeStatus === "Approved").map((employee) => ({
        employeeId: employee.id, payrollId: employee.payrollId, staffEmployeeId: employee.staffEmployeeId, employeeName: employee.name, bankName: employee.bank,
        bankAccount: employee.accountNo, amount: employee.netPay, currency: "SGD",
        modernTreasuryCounterpartyId: employee.modernTreasuryCounterpartyId,
        modernTreasuryReceivingAccountId: employee.modernTreasuryReceivingAccountId
      }));
      const batchReference = current.paymentBatch?.batchReference || current.bankReference || `MT-PAYROLL-${current.id}`;
      current = await applyFinancePayrollWorkflowAction({ runId: current.id, action: "payment-initialize", payload: { batchReference, total: employees.length, actor: req.user?.email }, userId: req.user?.userId });
      const completed = current.paymentBatch?.transfers || {};
      for (const employee of employees) {
        const employeeKey = String(employee.payrollId || employee.staffEmployeeId);
        if (completed[employeeKey]?.status === "Submitted") continue;
        let transfer;
        try {
          const providerTransfer = await submitModernTreasuryEmployeePayment({ payrollRunId: current.id, payrollPeriod: `${current.month}/${current.year}`, employee, batchReference });
          transfer = { status: "Submitted", transferId: providerTransfer.transferId, modernTreasuryReference: providerTransfer.modernTreasuryReference, idempotencyKey: providerTransfer.idempotencyKey, employeeId: employee.employeeId };
        } catch (providerError) {
          transfer = { status: "Failed", employeeId: employee.employeeId, message: String(providerError.message || "Provider submission failed").slice(0, 300) };
        }
        current = await applyFinancePayrollWorkflowAction({ runId: current.id, action: "payment-transfer-progress", payload: { batchReference, total: employees.length, employeeKey, transfer, actor: req.user?.email }, userId: req.user?.userId });
      }
      await logAuditEvent({ userId: req.user?.userId, userName: req.user?.email, activityType: "Payroll Workflow", actionDescription: `Modern Treasury batch ${current.paymentBatch?.status} for ${current.id}: ${current.paymentBatch?.succeeded || 0}/${employees.length}`, affectedRecord: current.id, status: current.paymentBatch?.failed ? "Partial" : "Success", ipAddress: getClientIp(req), deviceInfo: getDeviceInfo(req) });
      return res.status(current.paymentBatch?.failed ? 207 : 200).json(workflowResponse(current, batchReference));
    }
    if (action === "send-payslips") {
      const current = await findFinanceRun(req.params.runId);
      if (!current?.paidAt) throw Object.assign(new Error("Confirm payment before sending payslips."), { code: "PAYMENT_NOT_CONFIRMED" });
      const delivery = { sent: 0, failed: 0, skipped: 0, errors: [] };
      const browser = current.employees.length ? await launchPayslipBrowser() : null;
      try {
        for (const employee of current.employees) {
          try {
            const result = await generateAndSendPayslip(employee.payrollId, { browser, actorUserId: req.user?.userId });
            if (result.status === 200) result.message.includes("already") ? delivery.skipped++ : delivery.sent++;
            else { delivery.failed++; delivery.errors.push({ employee: employee.name, employeeId: employee.id, payrollId: employee.payrollId, message: result.message, correctiveAction: result.message.includes("not linked to a user account") ? "HR must create the linked account, Admin must approve it, and then Finance can retry pending payslips." : result.message.includes("awaiting Admin activation") ? "Admin must approve the pending activation request before Finance retries pending payslips." : "Correct the employee payslip source data, then retry pending payslips." }); }
          } catch (error) { delivery.failed++; delivery.errors.push({ employee: employee.name, employeeId: employee.id, payrollId: employee.payrollId, message: error.message, correctiveAction: "Correct the employee payslip or user-account data, then retry pending payslips." }); }
        }
      } finally { if (browser) await browser.close(); }
      if (delivery.failed) {
        const run = await applyFinancePayrollWorkflowAction({ runId: current.id, action: "payslips-progress", payload: { delivery, actor: req.user?.email }, userId: req.user?.userId });
        return res.status(409).json({ code: "PAYSLIP_DELIVERY_INCOMPLETE", message: `${delivery.failed} payslip(s) could not be delivered. Successful records were retained; retry sends only unsuccessful records.`, errors: delivery.errors, delivery, run, workflow: buildFinanceWorkflowState(run) });
      }
      payload.delivery = delivery;
    }
    const modelAction = ({
      "submit-payment": "payment-submitted", "retry-payment": "payment-submitted", "confirm-payment": "payment-confirmed", "fail-payment": "payment-failed",
      "send-payslips": "payslips-completed", "record-statutory-ledger": "statutory-ledger"
    })[action] || action;
    const run = await applyFinancePayrollWorkflowAction({ runId: req.params.runId, action: modelAction, payload, userId: req.user?.userId });
    if (action === "confirm-payment") {
      await notifyRoles("HR", { type: "payslips_ready", title: "Payroll payslips ready for delivery", message: `Finance confirmed payment for ${run.id}. HR can now preview and deliver employee payslips.`, entityType: "payroll_run", entityId: run.id, actionPath: "/dashboard/payroll/hr/payslips" });
    }
    await logAuditEvent({ userId: req.user?.userId, userName: req.user?.email, activityType: "Payroll Workflow", actionDescription: `Completed ${action} for ${req.params.runId}`, affectedRecord: req.params.runId, status: "Success", ipAddress: getClientIp(req), deviceInfo: getDeviceInfo(req) });
    return res.json(workflowResponse(run, actionReference));
  } catch (error) {
    console.error("Finance payroll workflow action failed", { runId: req.params.runId, action, code: error.code, message: error.message, sqlState: error.sqlState });
    const conflictCodes = ["STALE_RUN", "RULES_CHANGED", "PAYROLL_RUN_LOCKED", "PAYROLL_COMPLIANCE_HOLD", "EMPLOYEES_NOT_APPROVED", "PAYMENT_NOT_CONFIRMED", "PAYMENT_NOT_PREPARED", "PAYSLIPS_NOT_DELIVERED", "LEDGER_NOT_RECORDED"];
    const status = conflictCodes.includes(error.code) ? 409 : error.code?.includes("NOT_FOUND") ? 404 : error.sqlState ? 500 : 400;
    return res.status(status).json({ code: error.code || (error.sqlState ? "WORKFLOW_DATABASE_FAILED" : "WORKFLOW_ACTION_FAILED"), message: error.sqlState ? `The ${action} database transaction failed and was rolled back.` : error.message || `Unable to complete ${action}.`, errors: error.details || [] });
  }
}

function approvePayrollRun(req, res) {
  req.workflowAction = "approve-payroll";
  return runWorkflowAction(req, res);
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
  exportFinancePayrollReport,
  getFinanceActivity,
  getPayslipPeriodSummary,
  getRunAdjustments,
  getRunWorkflow,
  approvePayrollRun,
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
  reviewRunAdjustments,
  runWorkflowAction
};
