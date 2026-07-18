const { pool } = require("../config/db");

async function ensureFinancePayrollTables() {
  // Disabled - 11 table schema
}

function parseRunData(row) {
  try {
    return JSON.parse(row.run_data);
  } catch {
    return null;
  }
}

function padDatePart(value) {
  return String(value).padStart(2, "0");
}

function toMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function buildEmployeeFromStaff(staff) {
  const baseSalary = toMoney(staff.base_salary || 0);
  const employeeCpf = Math.round(baseSalary * 0.2);
  const employerCpf = Math.round(baseSalary * 0.17);
  const sdl = toMoney(Math.max(2, Math.min(11.25, baseSalary * 0.0025)));
  const employeeId = staff.employee_code || `EMP-${String(staff.employee_id).padStart(3, "0")}`;

  return {
    id: employeeId,
    staffEmployeeId: staff.employee_id,
    name: staff.name,
    email: staff.email,
    department: staff.department_name || "Unassigned",
    workLocation: "Singapore",
    workingDays: 26,
    noPayLeave: 0,
    cpfAgeGroup: "55 and below",
    grossPay: baseSalary,
    previousGrossPay: baseSalary,
    religion: staff.religion || "",
    race: staff.race || "",
    allowances: 0,
    deductions: 0,
    employeeCpf,
    employerCpf,
    earningItems: [
      { label: "Basic salary", rate: "1 Month", amount: baseSalary }
    ],
    deductionItems: [
      { label: "Employee CPF", rate: "20%", amount: employeeCpf }
    ],
    employerItems: [
      { label: "Employer CPF", rate: "17%", amount: employerCpf },
      { label: "SDL", rate: "-", amount: sdl }
    ],
    bankType: staff.bank || "",
    bankAccount: staff.account_no || "",
    financeStatus: staff.bank && staff.account_no ? "Approved" : "Hold",
    modernTreasuryCounterpartyId: "",
    modernTreasuryReceivingAccountId: ""
  };
}

async function listFinancePayrollRuns() {
  await ensureFinancePayrollTables();

  const [rows] = await pool.execute(
    `SELECT run_id, run_data, source, created_at, updated_at
     FROM finance_payroll_run
     ORDER BY updated_at DESC, created_at DESC`
  );

  return rows.map(parseRunData).filter(Boolean);
}

async function upsertFinancePayrollRun({ run, userId }) {
  await ensureFinancePayrollTables();

  await pool.execute(
    `INSERT INTO finance_payroll_run (run_id, run_data, source, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
      run_data = VALUES(run_data),
      updated_by = VALUES(updated_by),
      updated_at = CURRENT_TIMESTAMP`,
    [run.id, JSON.stringify(run), run.source || "finance", userId || null, userId || null]
  );

  return run;
}

async function createFinancePayrollRunFromStaff({ month, year, userId, userEmail }) {
  await ensureFinancePayrollTables();

  const [staffRows] = await pool.execute(
    `SELECT
      staff.employee_id,
      staff.employee_code,
      staff.name,
      staff.email,
      staff.base_salary,
      staff.bank,
      staff.account_no,
      staff.race,
      staff.religion,
      staff.status,
      department.department_name
    FROM staff
    LEFT JOIN department ON staff.department_id = department.department_id
    WHERE staff.status = 1 OR staff.status = 'Active'
    ORDER BY staff.name`
  );

  if (!staffRows.length) {
    return { noActiveStaff: true };
  }

  const duplicateCount = await getFinanceRunCountForPeriod({ month, year });
  const runId = `PAY-${year}-${padDatePart(month)}-DB${duplicateCount ? `-${duplicateCount + 1}` : ""}`;
  const now = new Date().toISOString();
  const run = {
    id: runId,
    month,
    year,
    status: "Submitted for Finance Review",
    submittedBy: userEmail || "Finance",
    submittedAt: now,
    bankReference: "",
    paymentMethod: "Modern Treasury SGD Simulation",
    source: "staff_db",
    employees: staffRows.map(buildEmployeeFromStaff),
    timeline: [
      {
        action: "Finance payroll run created from staff database",
        at: now,
        owner: "Finance"
      }
    ]
  };

  await upsertFinancePayrollRun({ run, userId });

  return { run };
}

async function getFinanceRunCountForPeriod({ month, year }) {
  const [rows] = await pool.execute(
    `SELECT COUNT(*) AS total
     FROM finance_payroll_run
     WHERE run_id LIKE ?`,
    [`PAY-${year}-${padDatePart(month)}-DB%`]
  );

  return Number(rows[0]?.total || 0);
}

module.exports = {
  createFinancePayrollRunFromStaff,
  ensureFinancePayrollTables,
  listFinancePayrollRuns,
  upsertFinancePayrollRun
};
