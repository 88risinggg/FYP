/**
 * EVALUATION HEADER
 * FEATURE: PAYROLL - FINANCE
 * PURPOSE: Reads and writes finance Payroll Model data in the database.
 * LAYER: Backend model - contains database queries and persistence operations.
 * FIND RELATED CODE: Use Find All References to locate the controller/service that requests this data.
 */
/**
 * Finance Payroll Model
 *
 * payroll_run is the run header and payroll contains one employee result per run.
 * Legacy run_* columns on payroll are dual-written temporarily for compatibility;
 * payroll_run is the canonical source for run status, approval, configuration and payment reference.
 */

const crypto = require("crypto");
const { pool } = require("../config/db");
const {
  calculateEmployeePayroll
} = require("../services/statutoryPayrollEngine");
const { getActivePayrollRules } = require("../services/payrollRuleConfigService");
const { currentCompanyId } = require("../services/tenantContext");
const { postPayrollRecoveries } = require("../services/payrollRecoveryPostingService");
const { getUnpaidLeaveDaysForMonth, calculateUnpaidLeaveDeduction, calculateWorkingDays } = require("../controllers/leaveController");
const { getActiveHolidaysInRange } = require("../models/publicHolidayModel");

const WORKFLOW_FIELDS = [
  "reviewedAt",
  "paymentFileGeneratedAt",
  "paidAt",
  "payslipsSentAt",
  "cpfSubmissionLoggedAt",
  "otherDeductionsLoggedAt",
  "ledgerRecordedAt",
  "xeroRecordedAt",
  "reconciledAt",
  "paymentMethod",
  "paymentProvider",
  "paymentTransferCount",
  "paymentTransfers",
  "paymentRecipientsConfigured",
  "paymentSubmittedAt",
  "paymentStatus",
  "paymentFailureReason",
  "paymentBatch",
  "payslipDelivery",
  "timeline"
];

async function ensureFinancePayrollTables() {
  const [rows] = await pool.execute(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = DATABASE()
       AND table_name IN ('payroll', 'payroll_configuration', 'payroll_run', 'staff')`
  );
  if (rows.length !== 4) {
    throw new Error("Payroll database tables are incomplete. Run the payroll migrations first.");
  }
}

function parseJson(value, fallback = {}) {
  if (!value) return fallback;
  if (typeof value === "object") return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

function toMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function toDatabaseDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw Object.assign(new Error("Invalid payroll workflow timestamp."), { code: "INVALID_WORKFLOW_TIMESTAMP" });
  return date;
}

function getRulesHash(rules) {
  const canonicalize = (value) => {
    if (Array.isArray(value)) return value.map(canonicalize);
    if (value && typeof value === "object") return Object.keys(value).sort().reduce((result, key) => {
      result[key] = canonicalize(value[key]);
      return result;
    }, {});
    return value;
  };
  return crypto.createHash("sha256").update(JSON.stringify(canonicalize(rules || {}))).digest("hex");
}

function pickWorkflow(run) {
  return Object.fromEntries(WORKFLOW_FIELDS.filter((field) => run[field] !== undefined).map((field) => [field, run[field]]));
}

async function buildEmployeeFromPayroll(row, paymentRecipient = {}) {
  const breakdown = parseJson(row.deduction_breakdown, {});
  const selfHelpGroups = Array.isArray(breakdown.selfHelpGroups) ? breakdown.selfHelpGroups : [];
  const otherDeductions = Array.isArray(breakdown.otherDeductions) ? breakdown.otherDeductions : [];
  const reimbursements = Array.isArray(breakdown.reimbursements) ? breakdown.reimbursements : [];
  const totalAllowances = toMoney(row.total_allowances);
  const grossSalary = toMoney(row.gross_salary || (Number(row.net_salary) + Number(row.total_deductions)));
  const basicSalary = toMoney(grossSalary - totalAllowances);
  const employeeId = row.employee_code || `EMP-${String(row.employee_id).padStart(3, "0")}`;
  const payrollMonth = Number(row.payroll_month);
  const payrollYear = Number(row.payroll_year);

  const workingDays = await (async () => {
    if (!payrollMonth || !payrollYear) return 26;
    try {
      const firstDay = `${payrollYear}-${String(payrollMonth).padStart(2, "0")}-01`;
      const lastDay = new Date(payrollYear, payrollMonth, 0);
      const lastDayStr = `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, "0")}-${String(lastDay.getDate()).padStart(2, "0")}`;
      const holidays = await getActiveHolidaysInRange(firstDay, lastDayStr).catch(() => []);
      return calculateWorkingDays(new Date(firstDay), new Date(lastDayStr), holidays || []);
    } catch {
      return 26;
    }
  })();

  const noPayLeaveDays = await (async () => {
    try {
      return await getUnpaidLeaveDaysForMonth(row.employee_id, row.payroll_month, row.payroll_year);
    } catch {
      return 0;
    }
  })();

  return {
    id: employeeId,
    recordSource: "staff_db",
    staffEmployeeId: row.employee_id,
    payrollId: row.payroll_id,
    name: row.name,
    email: row.email,
    department: row.department_name || "",
    workLocation: "Singapore",
    workingDays,
    noPayLeave: noPayLeaveDays,
    cpfAgeGroup: breakdown.cpfTier || "Manual review",
    cpfWageBase: toMoney(breakdown.cpfWageBase),
    storedGrossPay: grossSalary,
    storedTotalDeductions: toMoney(row.total_deductions),
    storedNetPay: toMoney(row.net_salary),
    grossPay: basicSalary,
    previousGrossPay: basicSalary,
    unpaidLeaveDeduction: noPayLeaveDays > 0 ? calculateUnpaidLeaveDeduction(Number(row.base_salary || 0), workingDays, noPayLeaveDays) : 0,
    religion: row.religion || "",
    race: row.race || "",
    allowances: totalAllowances,
    deductions: toMoney(row.total_deductions),
    employeeCpf: toMoney(row.employee_cpf),
    employerCpf: toMoney(row.employer_cpf),
    earningItems: [
      { label: "Basic salary", rate: "1 Month", amount: basicSalary },
      ...(totalAllowances - reimbursements.reduce((sum, item) => sum + Number(item.amount || 0), 0) > 0
        ? [{ label: "Allowance", rate: "-", amount: toMoney(totalAllowances - reimbursements.reduce((sum, item) => sum + Number(item.amount || 0), 0)) }]
        : []),
      ...reimbursements.map((item) => ({
        label: item.label || "Claim reimbursement",
        rate: item.expenseDate ? `Expense ${String(item.expenseDate).slice(0, 10)}` : "Non-CPF",
        amount: toMoney(item.amount),
        claimId: item.claimId,
        cpfApplicable: false
      }))
    ],
    deductionItems: [
      ...(toMoney(row.employee_cpf) ? [{ label: "CPF (Employee)", amount: toMoney(row.employee_cpf) }] : []),
      ...selfHelpGroups.map((shg) => ({ label: shg.label, amount: toMoney(shg.amount) })),
      ...otherDeductions.map((od) => ({ label: od.label, amount: toMoney(od.amount) }))
    ],
    sdl: toMoney(breakdown.sdl),
    mbmf: toMoney(row.mbmf_amount),
    netPay: toMoney(row.net_salary),
    financeStatus: row.payslip_status || "Draft",
    bank: row.bank || "",
    accountNo: row.account_no || "",
    modernTreasuryCounterpartyId: paymentRecipient.modernTreasuryCounterpartyId || "",
    modernTreasuryReceivingAccountId: paymentRecipient.modernTreasuryReceivingAccountId || "",
    complianceExceptions: breakdown.complianceExceptions || []
  };
}

async function getPayrollRows(connection, month, year) {
  const companyId = currentCompanyId();
  const [rows] = await connection.execute(
    `SELECT
      p.*, s.employee_id, s.employee_code, s.name, s.email, s.base_salary, s.department_name,
      s.date_of_birth, s.race, s.religion, s.bank, s.account_no,
      pr.status AS header_run_status, pr.configuration_json AS header_configuration_json,
      pr.approved_by AS header_approved_by, pr.approved_at AS header_approved_at,
      pr.payment_reference AS header_payment_reference,
      pr.effective_claim_cutoff_at, pr.scheduled_release_at, pr.release_schedule_status,
      pr.release_confirmed_by, pr.release_confirmed_at, pr.payment_attempted_at,
      pr.release_failure_reason,
      pr.created_at AS header_created_at, pr.updated_at AS header_updated_at,
      pc.configuration_value AS rules_snapshot_json
     FROM payroll p
     JOIN staff s ON s.employee_id = p.staff_employee_id
     LEFT JOIN payroll_run pr ON pr.payroll_run_id = p.payroll_run_id
     LEFT JOIN payroll_configuration pc
       ON pc.configuration_id = pr.configuration_id AND pc.configuration_type = 'rules_snapshot'
     WHERE p.payroll_month = ? AND p.payroll_year = ? AND p.company_id = ?
       AND s.company_id = ? AND pr.company_id = ?
     ORDER BY s.name`,
    [month, year, companyId, companyId, companyId]
  );
  return rows;
}

async function mapRun(rows, activeRulesHash = null) {
  if (!rows.length) return null;
  const first = rows[0];
  const stored = parseJson(first.header_configuration_json || first.configuration_json, {});
  if (!stored.rules && first.rules_snapshot_json) stored.rules = parseJson(first.rules_snapshot_json, {});
  const workflow = stored.workflow || {};
  const rulesHash = getRulesHash(stored.rules);
  const paymentRecipients = stored.paymentRecipients || {};
  // Use a composite ID: month_year
  const runId = `${first.payroll_month}_${first.payroll_year}`;
  return {
    id: runId,
    month: Number(first.payroll_month),
    year: Number(first.payroll_year),
    status: first.header_run_status || first.run_status || "Draft",
    submittedBy: stored.submittedBy || "System",
    submittedAt: stored.submittedAt || first.header_created_at || first.run_created_at,
    approvedAt: first.header_approved_at || first.run_approved_at || workflow.approvedAt,
    bankReference: first.header_payment_reference || first.payment_reference || "",
    source: "staff_db",
    databaseRecordSource: first.source || "payroll",
    rulesVersion: stored.rules?.version || "Stored snapshot",
    rulesHash,
    rulesChanged: Boolean(!first.header_approved_at && activeRulesHash && rulesHash !== activeRulesHash),
    recalculatedAt: stored.recalculatedAt || null,
    recalculatedBy: stored.recalculatedBy || null,
    effectiveClaimCutoffAt: first.effective_claim_cutoff_at || null,
    scheduledReleaseAt: first.scheduled_release_at || null,
    releaseScheduleStatus: first.release_schedule_status || "Unscheduled",
    releaseConfirmedBy: first.release_confirmed_by || null,
    releaseConfirmedAt: first.release_confirmed_at || null,
    paymentAttemptedAt: first.payment_attempted_at || null,
    releaseFailureReason: first.release_failure_reason || null,
    updatedAt: first.header_updated_at || first.header_created_at || null,
    employees: await Promise.all(rows.map((row) => buildEmployeeFromPayroll(row, paymentRecipients[String(row.employee_id)] || {}))),
    ...workflow
  };
}

async function listFinancePayrollRuns() {
  await ensureFinancePayrollTables();
  const activeRulesHash = getRulesHash(await getActivePayrollRules());
  // Get distinct runs by month/year
  const [periods] = await pool.execute(
    `SELECT DISTINCT payroll_month, payroll_year FROM payroll WHERE company_id=? ORDER BY payroll_year DESC, payroll_month DESC`, [currentCompanyId()]
  );
  const result = [];
  for (const period of periods) {
    const rows = await getPayrollRows(pool, period.payroll_month, period.payroll_year);
    const run = await mapRun(rows, activeRulesHash);
    if (run) result.push(run);
  }
  return result;
}

async function getPayrollRunComplianceErrors(runId) {
  // runId format: "month_year"
  const [month, year] = String(runId).split("_").map(Number);
  const [rows] = await pool.execute(
    `SELECT p.payroll_id, p.deduction_breakdown, p.configuration_json, s.name,
            pr.configuration_json AS run_configuration_json, pr.approved_at,
            pc.configuration_value AS rules_snapshot_json
     FROM payroll p
     JOIN staff s ON s.employee_id = p.staff_employee_id
     LEFT JOIN payroll_run pr ON pr.payroll_run_id = p.payroll_run_id
     LEFT JOIN payroll_configuration pc
       ON pc.configuration_id = pr.configuration_id AND pc.configuration_type = 'rules_snapshot'
     WHERE p.payroll_month = ? AND p.payroll_year = ? AND p.company_id=? AND s.company_id=? AND pr.company_id=?`,
    [month, year, currentCompanyId(), currentCompanyId(), currentCompanyId()]
  );
  if (!rows.length) return [];
  const stored = parseJson(rows[0].run_configuration_json || rows[0].configuration_json, {});
  if (!stored.rules && rows[0].rules_snapshot_json) {
    stored.rules = parseJson(rows[0].rules_snapshot_json, null);
  }
  if (!stored.rules || typeof stored.rules !== "object") {
    return [{
      employee: null,
      payrollId: null,
      ruleCode: "ADMIN_RULE_SNAPSHOT_REQUIRED",
      actualValue: "Unavailable",
      expectedValue: "Stored Admin-rule snapshot",
      message: "This payroll run has no stored Admin rules snapshot.",
      correctiveAction: "Recalculate the pending run from the authoritative Admin payroll configuration before approval."
    }];
  }
  const activeRules = await getActivePayrollRules();
  const errors = [];
  if (!rows[0].approved_at && getRulesHash(stored.rules) !== getRulesHash(activeRules)) {
    errors.push({
      employee: null,
      payrollId: null,
      ruleCode: "ADMIN_RULES_CHANGED",
      actualValue: stored.rules?.version || stored.rulesHash || "Previous snapshot",
      expectedValue: activeRules.version || getRulesHash(activeRules),
      message: "Admin payroll rules changed after this run was calculated.",
      correctiveAction: "Recalculate with the latest Admin payroll rules, review the employee results, then save the Finance review again."
    });
  }
  errors.push(...rows.flatMap((row) => {
    const breakdown = parseJson(row.deduction_breakdown, {});
    return (breakdown.complianceExceptions || []).map((message) => ({
      employee: row.name,
      payrollId: row.payroll_id,
      ruleCode: String(message).toLowerCase().includes("bank") ? "BANK_ACCOUNT_REQUIRED"
        : String(message).toLowerCase().includes("department") ? "DEPARTMENT_REQUIRED"
          : String(message).toLowerCase().includes("cpf") ? "CPF_CALCULATION"
            : String(message).toLowerCase().includes("deduction") ? "DEDUCTION_LIMIT"
              : "PAYROLL_VALIDATION",
      actualValue: "Failed",
      expectedValue: "Pass",
      message,
      correctiveAction: String(message).toLowerCase().includes("bank")
        ? "Complete the employee bank and account details, then rerun payroll validation."
        : String(message).toLowerCase().includes("department")
          ? "Assign the employee department, then rerun payroll validation."
          : "Correct the employee or payroll rule source data, then rerun payroll validation."
    }));
  }));
  return errors;
}

async function getQueuedClaims(connection, month, year) {
  const companyId = currentCompanyId();
  const [rows] = await connection.execute(
    `SELECT record_id, staff_employee_id, claim_category, amount, expense_date
     FROM claims_and_loans
     WHERE type = 'expense_claim'
       AND status = 'payroll_approved' AND company_id=?
       AND payroll_inclusion_status = 'queued'
       AND ((payroll_target_month = ? AND payroll_target_year = ?)
         OR (payroll_target_month IS NULL AND payroll_target_year IS NULL))
     FOR UPDATE`,
    [companyId, month, year]
  );
  return rows;
}

async function getApprovedRecoveries(connection) {
  try {
    const [rows] = await connection.execute(
      `SELECT record_id, type, staff_employee_id, monthly_installment, outstanding_balance
       FROM claims_and_loans
       WHERE type IN ('loan', 'advance_request')
         AND status IN ('approved', 'released', 'finance_approved') AND company_id=?
         AND COALESCE(monthly_installment, 0) > 0
         AND COALESCE(outstanding_balance, 0) > 0`
    , [currentCompanyId()]);
    return rows;
  } catch {
    return [];
  }
}

async function getApprovedAdjustmentOverrides(connection, payrollRunId) {
  const [rows] = await connection.execute(
    "SELECT staff_employee_id, configuration_json FROM payroll WHERE payroll_run_id = ? AND company_id=?",
    [payrollRunId, currentCompanyId()]
  );
  const overrides = new Map();
  for (const row of rows) {
    const approved = (parseJson(row.configuration_json, {}).financeAdjustments || [])
      .filter((item) => item.status === "Approved" && item.actionable && item.proposedValue)
      .sort((a, b) => new Date(b.reviewedAt || 0) - new Date(a.reviewedAt || 0))[0];
    if (approved) overrides.set(Number(row.staff_employee_id), parseJson(approved.proposedValue, {})?.otherDeductions || []);
  }
  return overrides;
}

const adjustmentExceptionCode = (message) => {
  const text = String(message || "").toLowerCase();
  if (text.includes("date of birth")) return "DOB_REQUIRED";
  if (text.includes("bank")) return "BANK_DETAILS_REQUIRED";
  if (text.includes("department")) return "DEPARTMENT_REQUIRED";
  if (text.includes("base salary")) return "BASE_SALARY_REQUIRED";
  if (text.includes("cpf scheme") || text.includes("manual review")) return "CPF_MANUAL_REVIEW";
  return null;
};

function reconcileAdjustmentProposals(proposals, complianceExceptions, recalculatedAt) {
  const currentBlockerCodes = new Set((complianceExceptions || []).map(adjustmentExceptionCode).filter(Boolean));
  return (proposals || []).map((proposal) => {
    if (proposal.status !== "Pending") return proposal;
    const isSourceBlocker = proposal.proposalType === "source_blocker" || !proposal.actionable;
    if (isSourceBlocker && !currentBlockerCodes.has(proposal.exceptionCode)) {
      return {
        ...proposal,
        status: "Resolved",
        resolvedAt: recalculatedAt,
        resolutionReason: "The source record was corrected and payroll recalculation confirmed that this blocker no longer applies."
      };
    }
    return {
      ...proposal,
      status: "Stale",
      staleAt: recalculatedAt,
      staleReason: "Payroll was recalculated. Regenerate suggestions if this exception still requires Finance action."
    };
  });
}

async function createFinancePayrollRunFromStaff({ month, year, userId, userEmail }) {
  await ensureFinancePayrollTables();
  const activeRules = await getActivePayrollRules();
  const connection = await pool.getConnection();
  const companyId = currentCompanyId();
  try {
    await connection.beginTransaction();
    const [[existing]] = await connection.execute(
      `SELECT
         EXISTS(SELECT 1 FROM payroll WHERE payroll_month = ? AND payroll_year = ? AND company_id=?) AS payroll_exists,
         (SELECT payroll_run_id FROM payroll_run WHERE payroll_month = ? AND payroll_year = ? AND company_id=? LIMIT 1) AS empty_run_id`,
      [month, year, companyId, month, year, companyId]
    );
    if (Number(existing.payroll_exists) === 1) {
      const error = new Error("A payroll run already exists for this period.");
      error.code = "DUPLICATE_PAYROLL_RUN";
      throw error;
    }

    const [staffRows] = await connection.execute(
      `SELECT employee_id, employee_code, name, email, date_of_birth, base_salary,
              bank, account_no, race, religion, status, department_name
       FROM staff
       WHERE status = 1 AND company_id=?
       ORDER BY name`
      ,[companyId]
    );
    if (!staffRows.length) {
      await connection.rollback();
      return { noActiveStaff: true };
    }

    const now = new Date().toISOString();
    const configuration = {
      rules: activeRules,
      rulesHash: getRulesHash(activeRules),
      submittedBy: userEmail || "Finance",
      submittedAt: now,
      workflow: {
        paymentMethod: "GIRO",
        timeline: [{ action: "Payroll calculated from active staff records", at: now, owner: "System" }]
      }
    };

    const recoveries = await getApprovedRecoveries(connection);
    const queuedClaims = await getQueuedClaims(connection, month, year);
    const rulesSnapshot = JSON.stringify(activeRules);
    const [configurationResult] = await connection.execute(
      `INSERT INTO payroll_configuration
        (company_id, configuration_type, configuration_key, configuration_value, description, updated_by)
       VALUES (?, 'rules_snapshot', SHA2(?, 256), ?, 'Immutable rules used by a payroll run', ?)
       ON DUPLICATE KEY UPDATE configuration_id = LAST_INSERT_ID(configuration_id)`,
      [companyId, rulesSnapshot, rulesSnapshot, userId || null]
    );
    let payrollRunId = Number(existing.empty_run_id || 0);
    if (payrollRunId) {
      await connection.execute(
        `UPDATE payroll_run SET status = 'Submitted for Finance Review', configuration_id = ?,
           configuration_json = ?, approved_by = NULL, approved_at = NULL, payment_reference = NULL,
           updated_at = NOW()
         WHERE payroll_run_id = ?`,
        [configurationResult.insertId, JSON.stringify(configuration), payrollRunId]
      );
    } else {
      const [runResult] = await connection.execute(
        `INSERT INTO payroll_run
          (company_id, payroll_month, payroll_year, status, configuration_id, configuration_json, created_at, updated_at)
         VALUES (?, ?, ?, 'Submitted for Finance Review', ?, ?, NOW(), NOW())`,
        [companyId, month, year, configurationResult.insertId, JSON.stringify(configuration)]
      );
      payrollRunId = runResult.insertId;
    }

    for (const staff of staffRows) {
      const staffClaims = queuedClaims.filter((claim) => Number(claim.staff_employee_id) === Number(staff.employee_id));
      const reimbursements = staffClaims.map((claim) => ({
        claimId: claim.record_id,
        label: `${claim.claim_category || "Expense"} reimbursement · ${claim.record_id}`,
        amount: Number(claim.amount),
        expenseDate: claim.expense_date,
        cpfApplicable: false
      }));
      const otherDeductions = recoveries
        .filter((item) => Number(item.staff_employee_id) === Number(staff.employee_id))
        .map((item) => ({
          sourceRecordId: item.record_id,
          label: item.type === "loan" ? `Loan repayment ${item.record_id}` : `Salary advance ${item.record_id}`,
          amount: Math.min(Number(item.monthly_installment), Number(item.outstanding_balance)),
          scheduledAmount: Math.min(Number(item.monthly_installment), Number(item.outstanding_balance)),
          outstandingBefore: Number(item.outstanding_balance)
        }));
      const calculation = calculateEmployeePayroll({
        staff,
        month,
        year,
        reimbursements,
        otherDeductions,
        configuration: activeRules
      });
      const breakdown = {
        ...calculation.deductionBreakdown,
        complianceExceptions: calculation.complianceExceptions,
        cpfTier: calculation.cpfTier,
        cpfWageBase: calculation.cpfWageBase,
        sdl: calculation.sdl
      };
      const [existingPayslip] = await connection.execute(
        `SELECT payroll_id
         FROM payroll
         WHERE staff_employee_id = ? AND payroll_month = ? AND payroll_year = ? AND company_id=?
         LIMIT 1`,
        [staff.employee_id, month, year, companyId]
      );
      if (existingPayslip.length > 0) {
        continue;
      }
      const [payrollResult] = await connection.execute(
        `INSERT INTO payroll (
          staff_employee_id, payroll_month, payroll_year, payroll_run_id, gross_salary,
          total_allowances, total_deductions, employee_cpf, employer_cpf, mbmf_amount,
          deduction_breakdown, net_salary, source, payslip_status,
          run_status, run_created_by, run_created_at, configuration_json, company_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'automated_2026', ?,
          'Submitted for Finance Review', ?, NOW(), ?, ?)`,
        [
          staff.employee_id, month, year, payrollRunId, calculation.grossSalary,
          calculation.allowanceTotal, calculation.totalDeductions, calculation.cpfEmployee,
          calculation.cpfEmployer, calculation.mbmfAmount, JSON.stringify(breakdown),
          calculation.netSalary,
          calculation.complianceExceptions.length ? "Hold" : "Draft",
          userId || null, JSON.stringify(configuration), companyId
        ]
      );
      if (staffClaims.length) {
        await connection.execute(
          `UPDATE claims_and_loans
           SET payroll_inclusion_status = 'included', included_payroll_id = ?, payroll_included_at = NOW()
           WHERE record_id IN (${staffClaims.map(() => "?").join(",")})
             AND payroll_inclusion_status = 'queued' AND company_id=?`,
          [payrollResult.insertId, ...staffClaims.map((claim) => claim.record_id), companyId]
        );
      }
    }

    await connection.commit();
    const rows = await getPayrollRows(pool, month, year);
    return { run: await mapRun(rows) };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function recalculateFinancePayrollRun({ runId, userId, userEmail, connection: suppliedConnection = null, rulesOverride = null, adjustmentReview = false }) {
  await ensureFinancePayrollTables();
  const [month, year] = String(runId).split("_").map(Number);
  if (!month || !year) throw new Error("Invalid payroll run ID format. Expected 'month_year'.");
  const activeRules = rulesOverride || await getActivePayrollRules();
  const connection = suppliedConnection || await pool.getConnection();
  const ownsTransaction = !suppliedConnection;
  try {
    if (ownsTransaction) await connection.beginTransaction();
    const rows = await getPayrollRows(connection, month, year);
    if (!rows.length) throw new Error("Payroll run not found.");
    const first = rows[0];
    const oldConfiguration = parseJson(first.header_configuration_json || first.configuration_json, {});
    const oldWorkflow = oldConfiguration.workflow || {};
    if (first.header_approved_at || oldWorkflow.paidAt || oldWorkflow.paymentFileGeneratedAt || oldWorkflow.payslipsSentAt) {
      const error = new Error("Approved, payment-generated or paid payroll runs cannot be recalculated.");
      error.code = "PAYROLL_RUN_LOCKED";
      throw error;
    }

    const recoveries = await getApprovedRecoveries(connection);
    const adjustmentOverrides = await getApprovedAdjustmentOverrides(connection, first.payroll_run_id);
    const rulesSnapshot = JSON.stringify(activeRules);
    const [configurationResult] = await connection.execute(
      `INSERT INTO payroll_configuration
        (company_id, configuration_type, configuration_key, configuration_value, description, updated_by)
       VALUES (?, 'rules_snapshot', SHA2(?, 256), ?, 'Immutable rules used by a recalculated payroll run', ?)
       ON DUPLICATE KEY UPDATE configuration_id = LAST_INSERT_ID(configuration_id)`,
      [currentCompanyId(), rulesSnapshot, rulesSnapshot, userId || null]
    );
    const now = new Date().toISOString();
    const configuration = {
      ...oldConfiguration,
      rules: activeRules,
      rulesHash: getRulesHash(activeRules),
      recalculatedAt: now,
      recalculatedBy: userEmail || "Finance",
      workflow: {
        paymentMethod: oldWorkflow.paymentMethod || "GIRO",
        timeline: [
          { action: "Payroll recalculated using the latest Admin payroll rules", at: now, owner: userEmail || "Finance" },
          ...(Array.isArray(oldWorkflow.timeline) ? oldWorkflow.timeline : [])
        ]
      }
    };

    for (const row of rows) {
      const oldBreakdown = parseJson(row.deduction_breakdown, {});
      const reimbursements = Array.isArray(oldBreakdown.reimbursements) ? oldBreakdown.reimbursements : [];
      const reimbursementTotal = reimbursements.reduce((sum, item) => sum + Number(item.amount || 0), 0);
      const otherAllowanceTotal = Math.max(0, Number(row.total_allowances || 0) - reimbursementTotal);
      const allowances = otherAllowanceTotal ? [{ label: "Allowance", amount: otherAllowanceTotal }] : [];
      const calculatedRecoveries = recoveries
        .filter((item) => Number(item.staff_employee_id) === Number(row.employee_id))
        .map((item) => ({
          sourceRecordId: item.record_id,
          label: item.type === "loan" ? `Loan repayment ${item.record_id}` : `Salary advance ${item.record_id}`,
          amount: Math.min(Number(item.monthly_installment), Number(item.outstanding_balance)),
          scheduledAmount: Math.min(Number(item.monthly_installment), Number(item.outstanding_balance)),
          outstandingBefore: Number(item.outstanding_balance)
        }));
      const otherDeductions = adjustmentOverrides.has(Number(row.employee_id))
        ? adjustmentOverrides.get(Number(row.employee_id))
        : calculatedRecoveries;
      const calculation = calculateEmployeePayroll({
        staff: row,
        month,
        year,
        allowances,
        reimbursements,
        otherDeductions,
        configuration: activeRules
      });
      const breakdown = {
        ...calculation.deductionBreakdown,
        complianceExceptions: calculation.complianceExceptions,
        cpfTier: calculation.cpfTier,
        cpfWageBase: calculation.cpfWageBase,
        sdl: calculation.sdl
      };
      const financeAdjustments = reconcileAdjustmentProposals(
        parseJson(row.configuration_json, {}).financeAdjustments || [],
        calculation.complianceExceptions,
        now
      );
      await connection.execute(
        `UPDATE payroll SET gross_salary = ?, total_allowances = ?, total_deductions = ?,
           employee_cpf = ?, employer_cpf = ?, mbmf_amount = ?, deduction_breakdown = ?,
           net_salary = ?, payslip_status = ?, run_status = 'Recalculated - Finance Review Required',
           run_approved_by = NULL, run_approved_at = NULL, payment_reference = NULL,
           configuration_json = ?, run_updated_at = NOW()
         WHERE payroll_id = ?`,
        [calculation.grossSalary, calculation.allowanceTotal, calculation.totalDeductions,
          calculation.cpfEmployee, calculation.cpfEmployer, calculation.mbmfAmount,
          JSON.stringify(breakdown), calculation.netSalary,
          calculation.complianceExceptions.length ? "Hold" : "Draft",
          JSON.stringify({ ...configuration, financeAdjustments }), row.payroll_id]
      );
    }
    await connection.execute(
      `UPDATE payroll_run SET status = 'Recalculated - Finance Review Required', configuration_id = ?,
         configuration_json = ?, approved_by = NULL, approved_at = NULL, payment_reference = NULL, updated_at = NOW()
       WHERE payroll_run_id = ?`,
      [configurationResult.insertId, JSON.stringify(configuration), first.payroll_run_id]
    );
    const mapped = await mapRun(await getPayrollRows(connection, month, year), getRulesHash(activeRules));
    if (adjustmentReview) {
      mapped.timeline = [{ action: "Approved payroll adjustments applied and run recalculated", at: now, owner: userEmail || "Finance" }, ...(mapped.timeline || [])];
    }
    if (ownsTransaction) await connection.commit();
    return mapped;
  } catch (error) {
    if (ownsTransaction) await connection.rollback();
    throw error;
  } finally {
    if (ownsTransaction) connection.release();
  }
}

async function upsertFinancePayrollRun({ run, userId }) {
  await ensureFinancePayrollTables();
  // Parse run ID (format: "month_year")
  const [month, year] = String(run.id).split("_").map(Number);
  if (!month || !year) throw new Error("Invalid payroll run ID format. Expected 'month_year'.");

  const rows = await getPayrollRows(pool, month, year);
  if (!rows.length) throw new Error("Payroll run not found.");

  const stored = parseJson(rows[0].header_configuration_json || rows[0].configuration_json, {});
  if (!stored.rules && rows[0].rules_snapshot_json) {
    stored.rules = parseJson(rows[0].rules_snapshot_json, null);
  }
  if (!stored.rules || typeof stored.rules !== "object") {
    const error = new Error("This payroll run has no stored Admin rules snapshot and cannot be updated safely.");
    error.code = "PAYROLL_RULE_SNAPSHOT_REQUIRED";
    throw error;
  }
  const configuration = {
    ...stored,
    rules: stored.rules,
    workflow: { ...(stored.workflow || {}), ...pickWorkflow(run), approvedAt: run.approvedAt || stored.workflow?.approvedAt },
    paymentRecipients: Object.fromEntries((run.employees || []).map((employee) => [String(employee.staffEmployeeId), {
      modernTreasuryCounterpartyId: employee.modernTreasuryCounterpartyId || "",
      modernTreasuryReceivingAccountId: employee.modernTreasuryReceivingAccountId || ""
    }]))
  };
  const databaseApprovedAt = toDatabaseDate(run.approvedAt || stored.workflow?.approvedAt);

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    if (run.paidAt && !stored.workflow?.paidAt) {
      const recoveryPostings = await postPayrollRecoveries({
        connection,
        payrollRunId: rows[0].payroll_run_id,
        userId
      });
      configuration.workflow.recoveryPostings = {
        postedAt: run.paidAt,
        count: recoveryPostings.length,
        appliedAmount: recoveryPostings.reduce((sum, item) => sum + Number(item.appliedAmount || 0), 0),
        deferredAmount: recoveryPostings.reduce((sum, item) => sum + Number(item.deferredAmount || 0), 0)
      };
    }
    await connection.execute(
      `UPDATE payroll_run
       SET status = ?,
           approved_by = CASE WHEN approved_at IS NULL AND ? IS NOT NULL THEN ? ELSE approved_by END,
           approved_at = COALESCE(approved_at, ?), payment_reference = ?,
           release_schedule_status = CASE WHEN ? IS NOT NULL THEN 'Released' ELSE release_schedule_status END,
           payment_attempted_at = CASE WHEN ? IS NOT NULL THEN COALESCE(payment_attempted_at, NOW()) ELSE payment_attempted_at END,
           configuration_json = ?, updated_at = NOW()
       WHERE payroll_run_id = ?`,
      [run.status, databaseApprovedAt, userId || null, databaseApprovedAt,
        run.bankReference || null, run.bankReference || null, run.bankReference || null,
        JSON.stringify(configuration), rows[0].payroll_run_id]
    );
    // Update all payroll rows for this period
    await connection.execute(
      `UPDATE payroll
       SET run_status = ?,
           run_approved_by = CASE WHEN run_approved_at IS NULL AND ? IS NOT NULL THEN ? ELSE run_approved_by END,
           run_approved_at = COALESCE(run_approved_at, ?), payment_reference = ?, configuration_json = ?
       WHERE payroll_month = ? AND payroll_year = ? AND company_id=?`,
      [
        run.status,
        databaseApprovedAt,
        userId || null,
        databaseApprovedAt,
        run.bankReference || null,
        JSON.stringify(configuration),
        month, year, currentCompanyId()
      ]
    );

    for (const employee of run.employees || []) {
      // PDF generation and employee delivery are handled after this save.
      // Keep the approved status until each employee-specific PDF is safely created.
      const payslipStatus = employee.financeStatus || "Draft";
      await connection.execute(
        `UPDATE payroll
         SET payslip_status = CASE
               WHEN payslip_status IN ('Sent', 'sent_to_staff') AND payslip_file_path IS NOT NULL THEN payslip_status
               ELSE ?
             END,
             payslip_sent_at = CASE
               WHEN payslip_status IN ('Sent', 'sent_to_staff') AND payslip_file_path IS NOT NULL THEN payslip_sent_at
               ELSE NULL
             END
         WHERE payroll_month = ? AND payroll_year = ? AND staff_employee_id = ? AND company_id=?`,
        [payslipStatus, month, year, employee.staffEmployeeId, currentCompanyId()]
      );
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  const savedRows = await getPayrollRows(pool, month, year);
  return await mapRun(savedRows);
}

async function applyFinancePayrollWorkflowAction({ runId, action, payload = {}, userId }) {
  // Also accept public workflow command names at the transaction boundary.
  // This keeps older clients and direct command routes compatible even when a
  // controller-level alias is bypassed.
  action = ({
    "submit-payment": "payment-submitted",
    "confirm-payment": "payment-confirmed",
    "fail-payment": "payment-failed",
    "send-payslips": "payslips-completed",
    "record-statutory-ledger": "statutory-ledger",
    "complete-reconciliation": "reconcile"
  })[action] || action;
  const [month, year] = String(runId).split("_").map(Number);
  if (!month || !year) throw Object.assign(new Error("Invalid payroll run ID."), { code: "INVALID_RUN_ID" });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const rows = await getPayrollRows(connection, month, year);
    if (!rows.length) throw Object.assign(new Error("Payroll run not found."), { code: "PAYROLL_RUN_NOT_FOUND" });
    const current = await mapRun(rows, getRulesHash(await getActivePayrollRules()));
    if (payload.expectedUpdatedAt && current.updatedAt && new Date(payload.expectedUpdatedAt).getTime() !== new Date(current.updatedAt).getTime()) {
      throw Object.assign(new Error("This payroll run changed in another session. Refresh it before continuing."), { code: "STALE_RUN" });
    }
    const stored = parseJson(rows[0].header_configuration_json || rows[0].configuration_json, {});
    const workflow = { ...(stored.workflow || {}) };
    const now = new Date().toISOString();
    const timeline = (label) => { workflow.timeline = [{ action: label, at: now, owner: payload.actor || "Finance" }, ...(workflow.timeline || [])]; };
    let status = current.status;
    let approvedAt = current.approvedAt || null;
    let paymentReference = current.bankReference || null;

    if (action === "review") {
      const errors = await getPayrollRunComplianceErrors(runId);
      if (errors.some((item) => item.ruleCode === "ADMIN_RULES_CHANGED")) throw Object.assign(new Error(errors[0].message), { code: "RULES_CHANGED", details: errors });
      workflow.reviewedAt = now; status = errors.length ? "Exceptions Require Review" : "Exceptions Reviewed"; timeline("Automated compliance review completed");
    } else if (action === "employee-status") {
      if (current.approvedAt) throw Object.assign(new Error("Approved payroll runs are locked."), { code: "PAYROLL_RUN_LOCKED" });
      if (!["Approved", "Hold"].includes(payload.status)) throw Object.assign(new Error("Employee status must be Approved or Hold."), { code: "INVALID_EMPLOYEE_STATUS" });
      const [result] = await connection.execute(
        "UPDATE payroll SET payslip_status = ? WHERE payroll_run_id = ? AND staff_employee_id = ?",
        [payload.status, rows[0].payroll_run_id, Number(payload.staffEmployeeId)]
      );
      if (!result.affectedRows) throw Object.assign(new Error("Employee payroll record not found."), { code: "EMPLOYEE_PAYROLL_NOT_FOUND" });
      timeline(`${payload.status === "Approved" ? "Approved" : "Held"} employee payroll ${payload.staffEmployeeId}`);
    } else if (action === "bulk-approve") {
      if (current.approvedAt) throw Object.assign(new Error("Approved payroll runs are locked."), { code: "PAYROLL_RUN_LOCKED" });
      for (const row of rows) {
        const exceptions = parseJson(row.deduction_breakdown, {}).complianceExceptions || [];
        await connection.execute("UPDATE payroll SET payslip_status = ? WHERE payroll_id = ?", [exceptions.length ? "Hold" : "Approved", row.payroll_id]);
      }
      workflow.reviewedAt = now; status = "System Check Completed"; timeline("System check approved all eligible employee salaries");
    } else if (action === "approve-payroll") {
      const errors = await getPayrollRunComplianceErrors(runId);
      if (errors.some((item) => item.ruleCode === "ADMIN_RULES_CHANGED")) throw Object.assign(new Error(errors[0].message), { code: "RULES_CHANGED", details: errors });
      if (errors.length) throw Object.assign(new Error("Compliance exceptions remain."), { code: "PAYROLL_COMPLIANCE_HOLD", details: errors });
      if (!current.reviewedAt || current.employees.some((item) => item.financeStatus !== "Approved")) throw Object.assign(new Error("Every employee must be reviewed and approved first."), { code: "EMPLOYEES_NOT_APPROVED" });
      approvedAt = now; workflow.approvedAt = now; status = "Approved for Payment"; timeline("Payroll approved and locked");
    } else if (action === "payment-document") {
      if (!current.approvedAt) throw Object.assign(new Error("Approve payroll before generating its payment document."), { code: "PAYROLL_NOT_APPROVED" });
      workflow.paymentFileGeneratedAt ||= now; status = "Payment Prepared"; timeline("Payment PDF generated");
    } else if (action === "save-recipients") {
      stored.paymentRecipients = Object.fromEntries(Object.entries(payload.paymentRecipients || {}).filter(([, item]) => item?.modernTreasuryCounterpartyId && item?.modernTreasuryReceivingAccountId));
      workflow.paymentRecipientsConfigured = Object.keys(stored.paymentRecipients).length;
      timeline("Modern Treasury recipients configured");
    } else if (action === "payment-initialize") {
      if (!current.approvedAt || !current.paymentFileGeneratedAt) throw Object.assign(new Error("Approve payroll and generate the payment document first."), { code: "PAYMENT_NOT_PREPARED" });
      const previous = workflow.paymentBatch || {};
      workflow.paymentBatch = {
        batchReference: previous.batchReference || payload.batchReference,
        status: "Submitting",
        total: Number(payload.total || previous.total || 0),
        transfers: previous.transfers || {},
        updatedAt: now
      };
      workflow.paymentStatus = "Submitting";
      paymentReference = workflow.paymentBatch.batchReference;
      status = "Payment Submitting";
      timeline(`Modern Treasury submission started: ${paymentReference}`);
    } else if (action === "payment-transfer-progress") {
      const batch = workflow.paymentBatch || { batchReference: payload.batchReference, total: Number(payload.total || 0), transfers: {} };
      batch.transfers = { ...(batch.transfers || {}), [String(payload.employeeKey)]: payload.transfer };
      const values = Object.values(batch.transfers);
      const succeeded = values.filter((item) => item.status === "Submitted").length;
      const failed = values.filter((item) => item.status === "Failed").length;
      batch.processed = values.length; batch.succeeded = succeeded; batch.failed = failed;
      batch.remaining = Math.max(0, Number(batch.total || 0) - succeeded); batch.updatedAt = now;
      batch.status = batch.remaining === 0 ? "Submitted" : failed ? "Partially Submitted" : "Submitting";
      workflow.paymentBatch = batch; workflow.paymentStatus = batch.status;
      workflow.paymentTransferCount = succeeded; workflow.paymentSubmittedAt = batch.remaining === 0 ? now : workflow.paymentSubmittedAt;
      paymentReference = batch.batchReference || paymentReference;
      status = batch.status === "Submitted" ? "Payment Processing" : batch.status === "Partially Submitted" ? "Payment Partially Submitted" : "Payment Submitting";
    } else if (action === "payment-submitted") {
      if (!current.approvedAt || !current.paymentFileGeneratedAt) throw Object.assign(new Error("Approve payroll and generate the payment document first."), { code: "PAYMENT_NOT_PREPARED" });
      workflow.paymentStatus = "Processing"; workflow.paymentSubmittedAt = payload.submittedAt || now;
      workflow.paymentProvider = payload.provider || "Modern Treasury"; workflow.paymentTransfers = payload.transfers || [];
      workflow.paymentTransferCount = Number(payload.transferCount || 0); paymentReference = payload.batchReference;
      status = "Payment Processing"; timeline(`Payment batch submitted: ${paymentReference}`);
    } else if (action === "payment-confirmed") {
      if (!current.paymentSubmittedAt && !payload.manual) throw Object.assign(new Error("Submit the payment batch before confirming settlement."), { code: "PAYMENT_NOT_SUBMITTED" });
      if (!current.paidAt) {
        const postings = await postPayrollRecoveries({ connection, payrollRunId: rows[0].payroll_run_id, userId });
        workflow.recoveryPostings = { postedAt: now, count: postings.length, appliedAmount: postings.reduce((sum, item) => sum + Number(item.appliedAmount || 0), 0) };
      }
      workflow.paidAt = now; workflow.paymentStatus = "Confirmed"; paymentReference = payload.batchReference || paymentReference;
      status = "Payment Confirmed"; timeline(`Payment confirmed: ${paymentReference || "manual reference"}`);
    } else if (action === "payment-failed") {
      workflow.paymentStatus = "Failed"; workflow.paymentFailureReason = payload.reason || "Payment provider reported a failure";
      status = "Payment Failed"; timeline("Payment release failed");
    } else if (action === "payslips-progress") {
      workflow.payslipDelivery = payload.delivery || {};
      status = Number(payload.delivery?.failed || 0) ? "Payslip Delivery Incomplete" : status;
      timeline(`Payslip delivery attempted: ${payload.delivery?.sent || 0} sent, ${payload.delivery?.skipped || 0} already delivered, ${payload.delivery?.failed || 0} failed`);
    } else if (action === "payslips-completed") {
      workflow.payslipsSentAt = now; workflow.payslipDelivery = payload.delivery || {}; status = "Payslips Sent"; timeline("Employee payslip delivery completed");
    } else if (action === "statutory-ledger") {
      if (!current.payslipsSentAt) throw Object.assign(new Error("Complete payslip delivery first."), { code: "PAYSLIPS_NOT_DELIVERED" });
      workflow.cpfSubmissionLoggedAt = now; workflow.otherDeductionsLoggedAt = now; workflow.ledgerRecordedAt = now;
      status = "Statutory and Ledger Recorded"; timeline("Statutory deductions and payroll ledger recorded");
    } else if (action === "reconcile") {
      if (!current.ledgerRecordedAt && !current.xeroRecordedAt) throw Object.assign(new Error("Record statutory deductions and ledger first."), { code: "LEDGER_NOT_RECORDED" });
      workflow.reconciledAt = now; status = "Reconciled"; timeline("Payroll reconciled and reporting completed");
    } else throw Object.assign(new Error("Unsupported payroll workflow action."), { code: "INVALID_WORKFLOW_ACTION" });

    stored.workflow = workflow;
    const databaseApprovedAt = toDatabaseDate(approvedAt);
    await connection.execute(
      `UPDATE payroll_run SET status = ?, approved_by = CASE WHEN approved_at IS NULL AND ? IS NOT NULL THEN ? ELSE approved_by END,
       approved_at = COALESCE(approved_at, ?), payment_reference = ?, configuration_json = ?, updated_at = NOW()
       WHERE payroll_run_id = ?`,
      [status, databaseApprovedAt, userId || null, databaseApprovedAt, paymentReference, JSON.stringify(stored), rows[0].payroll_run_id]
    );
    await connection.execute(
      "UPDATE payroll SET run_status = ?, run_approved_at = COALESCE(run_approved_at, ?), payment_reference = ? WHERE payroll_run_id = ?",
      [status, databaseApprovedAt, paymentReference, rows[0].payroll_run_id]
    );
    await connection.commit();
    return await mapRun(await getPayrollRows(pool, month, year), getRulesHash(await getActivePayrollRules()));
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
}

module.exports = {
  createFinancePayrollRunFromStaff,
  ensureFinancePayrollTables,
  getPayrollRunComplianceErrors,
  listFinancePayrollRuns,
  recalculateFinancePayrollRun,
  _test: { adjustmentExceptionCode, reconcileAdjustmentProposals },
  applyFinancePayrollWorkflowAction,
  upsertFinancePayrollRun
};
