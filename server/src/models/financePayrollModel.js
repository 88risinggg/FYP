const { pool } = require("../config/db");
const {
  DEFAULT_PAYROLL_RULES_2026,
  calculateEmployeePayroll
} = require("../services/statutoryPayrollEngine");

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
       AND table_name IN ('payroll_run', 'payroll', 'staff')`
  );
  if (rows.length !== 3) {
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
      { label: "Employee CPF", rate: "2026 statutory rate", amount: toMoney(row.employee_cpf) },
      ...selfHelpGroups.map((item) => ({ label: item.fund, rate: "CPF Board wage band", amount: toMoney(item.amount) })),
      ...otherDeductions.map((item) => ({ label: item.label, rate: "-", amount: toMoney(item.amount) }))
    ],
    employerItems: [
      { label: "Employer CPF", rate: "2026 statutory rate", amount: toMoney(row.employer_cpf) },
      { label: "SDL", rate: "0.25% (min/max applied)", amount: toMoney(breakdown.sdl) }
    ],
    bankType: row.bank || "",
    bankAccount: row.account_no || "",
    financeStatus: ["Approved", "finance_approved"].includes(row.payslip_status) ? "Approved" : row.payslip_status === "Hold" ? "Hold" : undefined,
    complianceExceptions: Array.isArray(breakdown.complianceExceptions) ? breakdown.complianceExceptions : [],
    selfHelpGroups,
    netPay: toMoney(row.net_salary),
    modernTreasuryCounterpartyId: "",
    modernTreasuryReceivingAccountId: ""
  };
}

async function getPayrollRows(connection, runId) {
  const [rows] = await connection.execute(
    `SELECT
      p.*, s.employee_id, s.employee_code, s.name, s.email, s.department_name,
      s.date_of_birth, s.race, s.religion, s.bank, s.account_no
     FROM payroll p
     JOIN staff s ON s.employee_id = p.staff_employee_id
     WHERE p.payroll_run_id = ?
     ORDER BY s.name`,
    [runId]
  );
  return rows;
}

function mapRun(row, payrollRows) {
  const stored = parseJson(row.configuration_json, {});
  const workflow = stored.workflow || {};
  return {
    id: String(row.payroll_run_id),
    month: Number(row.payroll_month),
    year: Number(row.payroll_year),
    status: row.status,
    submittedBy: stored.submittedBy || "System",
    submittedAt: stored.submittedAt || row.created_at,
    approvedAt: row.approved_at || workflow.approvedAt,
    bankReference: row.payment_reference || "",
    source: "staff_db",
    rulesVersion: stored.rules?.version || DEFAULT_PAYROLL_RULES_2026.version,
    employees: payrollRows.map(buildEmployeeFromPayroll),
    ...workflow
  };
}

async function listFinancePayrollRuns() {
  await ensureFinancePayrollTables();
  const [runs] = await pool.execute(
    `SELECT * FROM payroll_run ORDER BY payroll_year DESC, payroll_month DESC, payroll_run_id DESC`
  );
  const result = [];
  for (const run of runs) {
    result.push(mapRun(run, await getPayrollRows(pool, run.payroll_run_id)));
  }
  return result;
}

async function getPayrollRunComplianceErrors(runId) {
  const [rows] = await pool.execute(
    `SELECT p.payroll_id, p.deduction_breakdown, s.name
     FROM payroll p
     JOIN staff s ON s.employee_id = p.staff_employee_id
     WHERE p.payroll_run_id = ?`,
    [runId]
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
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [existing] = await connection.execute(
      "SELECT payroll_run_id FROM payroll_run WHERE payroll_month = ? AND payroll_year = ? LIMIT 1",
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
      rules: DEFAULT_PAYROLL_RULES_2026,
      submittedBy: userEmail || "Finance",
      submittedAt: now,
      workflow: {
        paymentMethod: "GIRO",
        timeline: [{ action: "Payroll calculated from active staff records", at: now, owner: "System" }]
      }
    };
    const [runResult] = await connection.execute(
      `INSERT INTO payroll_run (payroll_month, payroll_year, status, configuration_json)
       VALUES (?, ?, 'Submitted for Finance Review', ?)`,
      [month, year, JSON.stringify(configuration)]
    );
    const runId = runResult.insertId;
    const recoveries = await getApprovedRecoveries(connection);

    for (const staff of staffRows) {
      const otherDeductions = recoveries
        .filter((item) => Number(item.staff_employee_id) === Number(staff.employee_id))
        .map((item) => ({
          label: item.type === "loan" ? `Loan repayment ${item.record_id}` : `Salary advance ${item.record_id}`,
          amount: Math.min(Number(item.monthly_installment), Number(item.outstanding_balance))
        }));
      const calculation = calculateEmployeePayroll({ staff, month, year, otherDeductions });
      const breakdown = {
        ...calculation.deductionBreakdown,
        complianceExceptions: calculation.complianceExceptions,
        cpfTier: calculation.cpfTier,
        cpfWageBase: calculation.cpfWageBase,
        sdl: calculation.sdl
      };
      await connection.execute(
        `INSERT INTO payroll (
          staff_employee_id, payroll_month, payroll_year, payroll_run_id, gross_salary,
          total_allowances, total_deductions, employee_cpf, employer_cpf, mbmf_amount,
          deduction_breakdown, net_salary, source, payslip_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'automated_2026', ?)`,
        [
          staff.employee_id, month, year, runId, calculation.grossSalary,
          calculation.allowanceTotal, calculation.totalDeductions, calculation.cpfEmployee,
          calculation.cpfEmployer, calculation.mbmfAmount, JSON.stringify(breakdown),
          calculation.netSalary, calculation.complianceExceptions.length ? "Hold" : "Draft"
        ]
      );
    }

    await connection.commit();
    const [runRows] = await pool.execute("SELECT * FROM payroll_run WHERE payroll_run_id = ?", [runId]);
    return { run: mapRun(runRows[0], await getPayrollRows(pool, runId)) };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function upsertFinancePayrollRun({ run, userId }) {
  await ensureFinancePayrollTables();
  const runId = Number(run.id);
  if (!Number.isInteger(runId)) throw new Error("Payroll run ID must be numeric.");
  const [currentRows] = await pool.execute("SELECT configuration_json FROM payroll_run WHERE payroll_run_id = ?", [runId]);
  if (!currentRows.length) throw new Error("Payroll run not found.");
  const stored = parseJson(currentRows[0].configuration_json, {});
  const configuration = {
    ...stored,
    rules: stored.rules || DEFAULT_PAYROLL_RULES_2026,
    workflow: { ...(stored.workflow || {}), ...pickWorkflow(run), approvedAt: run.approvedAt || stored.workflow?.approvedAt }
  };

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute(
      `UPDATE payroll_run
       SET status = ?, approved_by = ?, approved_at = ?, payment_reference = ?, configuration_json = ?
       WHERE payroll_run_id = ?`,
      [
        run.status,
        run.approvedAt ? userId || null : null,
        run.approvedAt || null,
        run.bankReference || null,
        JSON.stringify(configuration),
        runId
      ]
    );

    for (const employee of run.employees || []) {
      const payslipStatus = run.payslipsSentAt ? "Sent" : employee.financeStatus || "Draft";
      await connection.execute(
        `UPDATE payroll
         SET payslip_status = ?, payslip_sent_at = ?
         WHERE payroll_run_id = ? AND staff_employee_id = ?`,
        [payslipStatus, run.payslipsSentAt || null, runId, employee.staffEmployeeId]
      );
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  const [savedRows] = await pool.execute("SELECT * FROM payroll_run WHERE payroll_run_id = ?", [runId]);
  return mapRun(savedRows[0], await getPayrollRows(pool, runId));
}

module.exports = {
  createFinancePayrollRunFromStaff,
  ensureFinancePayrollTables,
  getPayrollRunComplianceErrors,
  listFinancePayrollRuns,
  upsertFinancePayrollRun
};
