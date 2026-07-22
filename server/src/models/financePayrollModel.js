/**
 * Finance Payroll Model
 *
 * After schema consolidation, payroll_run is merged into the payroll table.
 * A "run" is identified by a unique (payroll_month, payroll_year) group.
 * Run metadata (status, approval, config) is stored on each payroll row via
 * run_status, run_created_at, run_approved_at, payment_reference, configuration_json.
 */

const { pool } = require("../config/db");
const {
  DEFAULT_PAYROLL_RULES_2026,
  calculateEmployeePayroll
} = require("../services/statutoryPayrollEngine");
const { getActivePayrollRules } = require("../services/payrollRuleConfigService");

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
  "timeline"
];

async function ensureFinancePayrollTables() {
  const [rows] = await pool.execute(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = DATABASE()
       AND table_name IN ('payroll', 'staff')`
  );
  if (rows.length !== 2) {
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

function pickWorkflow(run) {
  return Object.fromEntries(WORKFLOW_FIELDS.filter((field) => run[field] !== undefined).map((field) => [field, run[field]]));
}

function buildEmployeeFromPayroll(row) {
  const breakdown = parseJson(row.deduction_breakdown, {});
  const selfHelpGroups = Array.isArray(breakdown.selfHelpGroups) ? breakdown.selfHelpGroups : [];
  const otherDeductions = Array.isArray(breakdown.otherDeductions) ? breakdown.otherDeductions : [];
  const totalAllowances = toMoney(row.total_allowances);
  const grossSalary = toMoney(row.gross_salary || (Number(row.net_salary) + Number(row.total_deductions)));
  const basicSalary = toMoney(grossSalary - totalAllowances);
  const employeeId = row.employee_code || `EMP-${String(row.employee_id).padStart(3, "0")}`;

  return {
    id: employeeId,
    staffEmployeeId: row.employee_id,
    payrollId: row.payroll_id,
    name: row.name,
    email: row.email,
    department: row.department_name || "",
    workLocation: "Singapore",
    workingDays: 26,
    noPayLeave: 0,
    cpfAgeGroup: breakdown.cpfTier || "Manual review",
    cpfWageBase: toMoney(breakdown.cpfWageBase),
    grossPay: basicSalary,
    previousGrossPay: basicSalary,
    religion: row.religion || "",
    race: row.race || "",
    allowances: totalAllowances,
    deductions: toMoney(row.total_deductions),
    employeeCpf: toMoney(row.employee_cpf),
    employerCpf: toMoney(row.employer_cpf),
    earningItems: [
      { label: "Basic salary", rate: "1 Month", amount: basicSalary },
      ...(totalAllowances ? [{ label: "Allowance", rate: "-", amount: totalAllowances }] : [])
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
    complianceExceptions: breakdown.complianceExceptions || []
  };
}

async function getPayrollRows(connection, month, year) {
  const [rows] = await connection.execute(
    `SELECT
      p.*, s.employee_id, s.employee_code, s.name, s.email, s.department_name,
      s.date_of_birth, s.race, s.religion, s.bank, s.account_no
     FROM payroll p
     JOIN staff s ON s.employee_id = p.staff_employee_id
     WHERE p.payroll_month = ? AND p.payroll_year = ?
     ORDER BY s.name`,
    [month, year]
  );
  return rows;
}

function mapRun(rows) {
  if (!rows.length) return null;
  const first = rows[0];
  const stored = parseJson(first.configuration_json, {});
  const workflow = stored.workflow || {};
  // Use a composite ID: month_year
  const runId = `${first.payroll_month}_${first.payroll_year}`;
  return {
    id: runId,
    month: Number(first.payroll_month),
    year: Number(first.payroll_year),
    status: first.run_status || "Draft",
    submittedBy: stored.submittedBy || "System",
    submittedAt: stored.submittedAt || first.run_created_at,
    approvedAt: first.run_approved_at || workflow.approvedAt,
    bankReference: first.payment_reference || "",
    source: "staff_db",
    rulesVersion: stored.rules?.version || DEFAULT_PAYROLL_RULES_2026.version,
    employees: rows.map(buildEmployeeFromPayroll),
    ...workflow
  };
}

async function listFinancePayrollRuns() {
  await ensureFinancePayrollTables();
  // Get distinct runs by month/year
  const [periods] = await pool.execute(
    `SELECT DISTINCT payroll_month, payroll_year FROM payroll ORDER BY payroll_year DESC, payroll_month DESC`
  );
  const result = [];
  for (const period of periods) {
    const rows = await getPayrollRows(pool, period.payroll_month, period.payroll_year);
    const run = mapRun(rows);
    if (run) result.push(run);
  }
  return result;
}

async function getPayrollRunComplianceErrors(runId) {
  // runId format: "month_year"
  const [month, year] = String(runId).split("_").map(Number);
  const [rows] = await pool.execute(
    `SELECT p.payroll_id, p.deduction_breakdown, s.name
     FROM payroll p
     JOIN staff s ON s.employee_id = p.staff_employee_id
     WHERE p.payroll_month = ? AND p.payroll_year = ?`,
    [month, year]
  );
  return rows.flatMap((row) => {
    const breakdown = parseJson(row.deduction_breakdown, {});
    return (breakdown.complianceExceptions || []).map((message) => ({
      employee: row.name,
      payrollId: row.payroll_id,
      message
    }));
  });
}

async function getApprovedRecoveries(connection) {
  try {
    const [rows] = await connection.execute(
      `SELECT record_id, type, staff_employee_id, monthly_installment, outstanding_balance
       FROM claims_and_loans
       WHERE type IN ('loan', 'advance_request')
         AND status IN ('approved', 'released', 'finance_approved')
         AND COALESCE(monthly_installment, 0) > 0
         AND COALESCE(outstanding_balance, 0) > 0`
    );
    return rows;
  } catch {
    return [];
  }
}

async function createFinancePayrollRunFromStaff({ month, year, userId, userEmail }) {
  await ensureFinancePayrollTables();
  const activeRules = await getActivePayrollRules();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [existing] = await connection.execute(
      "SELECT payroll_id FROM payroll WHERE payroll_month = ? AND payroll_year = ? LIMIT 1",
      [month, year]
    );
    if (existing.length) {
      const error = new Error("A payroll run already exists for this period.");
      error.code = "DUPLICATE_PAYROLL_RUN";
      throw error;
    }

    const [staffRows] = await connection.execute(
      `SELECT employee_id, employee_code, name, email, date_of_birth, base_salary,
              bank, account_no, race, religion, status, department_name
       FROM staff
       WHERE status = 1
       ORDER BY name`
    );
    if (!staffRows.length) {
      await connection.rollback();
      return { noActiveStaff: true };
    }

    const now = new Date().toISOString();
    const configuration = {
      rules: activeRules,
      submittedBy: userEmail || "Finance",
      submittedAt: now,
      workflow: {
        paymentMethod: "GIRO",
        timeline: [{ action: "Payroll calculated from active staff records", at: now, owner: "System" }]
      }
    };

    const recoveries = await getApprovedRecoveries(connection);

    for (const staff of staffRows) {
      const otherDeductions = recoveries
        .filter((item) => Number(item.staff_employee_id) === Number(staff.employee_id))
        .map((item) => ({
          label: item.type === "loan" ? `Loan repayment ${item.record_id}` : `Salary advance ${item.record_id}`,
          amount: Math.min(Number(item.monthly_installment), Number(item.outstanding_balance))
        }));
      const calculation = calculateEmployeePayroll({
        staff,
        month,
        year,
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
      await connection.execute(
        `INSERT INTO payroll (
          staff_employee_id, payroll_month, payroll_year, gross_salary,
          total_allowances, total_deductions, employee_cpf, employer_cpf, mbmf_amount,
          deduction_breakdown, net_salary, source, payslip_status,
          run_status, run_created_by, run_created_at, configuration_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'automated_2026', ?,
          'Submitted for Finance Review', ?, NOW(), ?)`,
        [
          staff.employee_id, month, year, calculation.grossSalary,
          calculation.allowanceTotal, calculation.totalDeductions, calculation.cpfEmployee,
          calculation.cpfEmployer, calculation.mbmfAmount, JSON.stringify(breakdown),
          calculation.netSalary,
          calculation.complianceExceptions.length ? "Hold" : "Draft",
          userId || null, JSON.stringify(configuration)
        ]
      );
    }

    await connection.commit();
    const rows = await getPayrollRows(pool, month, year);
    return { run: mapRun(rows) };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function upsertFinancePayrollRun({ run, userId }) {
  await ensureFinancePayrollTables();
  // Parse run ID (format: "month_year")
  const [month, year] = String(run.id).split("_").map(Number);
  if (!month || !year) throw new Error("Invalid payroll run ID format. Expected 'month_year'.");

  const rows = await getPayrollRows(pool, month, year);
  if (!rows.length) throw new Error("Payroll run not found.");

  const stored = parseJson(rows[0].configuration_json, {});
  const configuration = {
    ...stored,
    rules: stored.rules || DEFAULT_PAYROLL_RULES_2026,
    workflow: { ...(stored.workflow || {}), ...pickWorkflow(run), approvedAt: run.approvedAt || stored.workflow?.approvedAt }
  };

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    // Update all payroll rows for this period
    await connection.execute(
      `UPDATE payroll
       SET run_status = ?, run_approved_by = ?, run_approved_at = ?, payment_reference = ?, configuration_json = ?
       WHERE payroll_month = ? AND payroll_year = ?`,
      [
        run.status,
        run.approvedAt ? userId || null : null,
        run.approvedAt || null,
        run.bankReference || null,
        JSON.stringify(configuration),
        month, year
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
         WHERE payroll_month = ? AND payroll_year = ? AND staff_employee_id = ?`,
        [payslipStatus, month, year, employee.staffEmployeeId]
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
  return mapRun(savedRows);
}

module.exports = {
  createFinancePayrollRunFromStaff,
  ensureFinancePayrollTables,
  getPayrollRunComplianceErrors,
  listFinancePayrollRuns,
  upsertFinancePayrollRun
};
