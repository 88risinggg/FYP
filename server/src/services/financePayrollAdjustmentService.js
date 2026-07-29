/**
 * EVALUATION HEADER
 * FEATURE: PAYROLL - FINANCE
 * PURPOSE: Provides reusable finance Payroll Adjustment Service business or integration operations.
 * LAYER: Backend service - contains reusable business rules or external integrations.
 * FIND RELATED CODE: Use Find All References to locate controllers, workers, or services that call it.
 */
const crypto = require("crypto");
const { pool } = require("../config/db");
const { calculateEmployeePayroll } = require("./statutoryPayrollEngine");
const { currentCompanyId } = require("./tenantContext");

const parseJson = (value, fallback = {}) => {
  if (!value) return fallback;
  if (typeof value === "object") return value;
  try { return JSON.parse(value); } catch { return fallback; }
};
const money = (value) => Math.round(Number(value || 0) * 100) / 100;
const canonicalize = (value) => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") return Object.keys(value).sort().reduce((result, key) => {
    result[key] = canonicalize(value[key]);
    return result;
  }, {});
  return value;
};
const rulesHash = (rules) => crypto.createHash("sha256").update(JSON.stringify(canonicalize(rules || {}))).digest("hex");

async function ensureAdjustmentTable(connection = pool) {
  return connection;
}

function lockedRun(row, configuration) {
  const workflow = configuration.workflow || {};
  return Boolean(row.approved_at || workflow.paidAt || workflow.paymentFileGeneratedAt || workflow.payslipsSentAt || workflow.reconciledAt);
}

function blockerFor(message) {
  const text = String(message).toLowerCase();
  if (text.includes("date of birth")) return { code: "DOB_REQUIRED", owner: "HR", field: "date_of_birth" };
  if (text.includes("bank")) return { code: "BANK_DETAILS_REQUIRED", owner: "HR", field: "bank/account_no" };
  if (text.includes("department")) return { code: "DEPARTMENT_REQUIRED", owner: "HR", field: "department_name" };
  if (text.includes("base salary")) return { code: "BASE_SALARY_REQUIRED", owner: "HR/Admin", field: "base_salary" };
  if (text.includes("cpf scheme") || text.includes("manual review")) return { code: "CPF_MANUAL_REVIEW", owner: "Admin/HR", field: "CPF source data" };
  return null;
}

function capDeductions(items, limit) {
  let remaining = Math.max(0, money(limit));
  return items.map((item) => {
    const amount = Math.min(money(item.amount), remaining);
    remaining = money(remaining - amount);
    const scheduledAmount = money(item.scheduledAmount ?? item.amount);
    return { ...item, scheduledAmount, amount, deferredAmount: money(Math.max(0, scheduledAmount - amount)) };
  });
}

function resultSummary(calculation, otherDeductions) {
  return {
    grossPay: money(calculation.grossSalary),
    totalDeductions: money(calculation.totalDeductions),
    employeeCpf: money(calculation.cpfEmployee),
    employerCpf: money(calculation.cpfEmployer),
    mbmf: money(calculation.mbmfAmount),
    sdl: money(calculation.sdl),
    netPay: money(calculation.netSalary),
    otherDeductions
  };
}

const COMPONENT_LABELS = {
  grossPay: "Gross pay",
  totalDeductions: "Total deductions",
  employeeCpf: "Employee CPF",
  employerCpf: "Employer CPF",
  mbmf: "MBMF",
  sdl: "SDL",
  netPay: "Net pay"
};

function changedComponents(original = {}, proposed = {}) {
  return Object.keys(COMPONENT_LABELS).filter((key) => money(original[key]) !== money(proposed[key]));
}

function buildSourceBlockerExplanation({ blocker, exception, rules, run, month, year }) {
  return {
    flaggedBecause: exception,
    ruleApplied: `${rules.version || "Stored Admin snapshot"}: ${blocker.field} is required before payroll can pass compliance.`,
    changeMade: "No automatic payroll value was changed because the missing employee source value cannot be inferred safely.",
    expectedOutcome: `After ${blocker.owner} corrects the source record, Finance must regenerate suggestions or recalculate the ${month}/${year} payroll run.`,
    calculationSteps: ["No calculation was performed.", `Blocked source field: ${blocker.field}.`, "The payroll result remains on hold until the source record is corrected."],
    affectedComponents: [],
    sourceActionRequired: `${blocker.owner} must correct ${blocker.field} in the staff master record.`,
    rulesHash: rulesHash(rules),
    runUpdatedAt: run.updated_at,
    period: { month, year }
  };
}

function buildAdjustmentExplanation({ code, exceptions, original, proposed, rules, run, month, year, positiveNetContext = null }) {
  const recoveryBefore = money((original.otherDeductions || []).reduce((sum, item) => sum + Number(item.amount || 0), 0));
  const recoveryAfter = money((proposed.otherDeductions || []).reduce((sum, item) => sum + Number(item.amount || 0), 0));
  const deferred = money(Math.max(0, recoveryBefore - recoveryAfter));
  const components = changedComponents(original, proposed);
  const componentNames = components.map((key) => COMPONENT_LABELS[key]);
  const base = {
    flaggedBecause: exceptions.length ? exceptions.join("; ") : "Stored payroll results differ from the immutable calculation snapshot.",
    affectedComponents: componentNames,
    sourceActionRequired: null,
    rulesHash: rulesHash(rules),
    runUpdatedAt: run.updated_at,
    period: { month, year }
  };
  if (code === "DEDUCTION_CAP") {
    const percent = Number(rules.maxOtherDeductionPercent || 30);
    const limit = money(Number(original.grossPay || 0) * percent / 100);
    return {
      ...base,
      ruleApplied: `${rules.version || "Stored Admin snapshot"}: non-statutory recoveries may not exceed ${percent}% of gross pay (${money(original.grossPay)} × ${percent}% = ${limit}).`,
      changeMade: `The current-period recovery is reduced from ${recoveryBefore} to ${recoveryAfter}. The remaining ${deferred} is deferred rather than written off.`,
      expectedOutcome: `Net pay increases by ${money(Number(proposed.netPay) - Number(original.netPay))}; ${deferred} remains available for a later payroll period.`,
      calculationSteps: [
        `Current recovery total: ${recoveryBefore}.`,
        `Maximum permitted recovery: ${money(original.grossPay)} × ${percent}% = ${limit}.`,
        `Suggested current-period recovery: ${recoveryAfter}.`,
        `Deferred recovery: ${recoveryBefore} − ${recoveryAfter} = ${deferred}.`
      ]
    };
  }
  if (code === "POSITIVE_NET_PROTECTION") {
    const context = positiveNetContext || {};
    return {
      ...base,
      ruleApplied: `${rules.version || "Stored Admin snapshot"}: net salary must remain positive after statutory and other deductions.`,
      changeMade: `The current-period recovery is reduced from ${recoveryBefore} to ${recoveryAfter}, preserving at least SGD 0.01 of payable salary.`,
      expectedOutcome: `Suggested net pay becomes ${money(proposed.netPay)} and ${deferred} of recovery is deferred to a later payroll period.`,
      calculationSteps: [
        `Net pay before other recoveries: ${money(context.netWithoutRecoveries)}.`,
        `Maximum safe recovery: ${money(context.netWithoutRecoveries)} − 0.01 = ${money(context.maximumSafeRecovery)}.`,
        `Suggested current-period recovery: ${recoveryAfter}.`,
        `Resulting net pay: ${money(proposed.netPay)}.`
      ]
    };
  }
  return {
    ...base,
    ruleApplied: `${rules.version || "Stored Admin snapshot"}: statutory payroll results must match the stored CPF, community-fund and SDL calculation inputs for this run.`,
    changeMade: `${componentNames.join(", ") || "Stored payroll values"} will be recalculated from the run snapshot without editing staff master data.`,
    expectedOutcome: `The pending payroll row will be replaced with the snapshot-calculated result; net pay changes by ${money(Number(proposed.netPay) - Number(original.netPay))}.`,
    calculationSteps: components.map((key) => `${COMPONENT_LABELS[key]}: ${money(original[key])} → ${money(proposed[key])} (${money(Number(proposed[key]) - Number(original[key]))}).`)
  };
}

function fallbackExplanation(row) {
  const blocker = row.proposalType === "source_blocker" || !row.actionable;
  return {
    flaggedBecause: row.reason || "This proposal was generated by an earlier payroll review.",
    ruleApplied: row.ruleReference || "Stored Admin-rule snapshot",
    changeMade: blocker ? "No automatic change is available for this source-data blocker." : "Regenerate this pending proposal to view the exact calculation used.",
    expectedOutcome: blocker ? "Correct the source record and recalculate payroll." : "Regeneration will replace this legacy explanation with current persisted calculation details.",
    calculationSteps: [],
    affectedComponents: [],
    sourceActionRequired: blocker ? row.reason : null
  };
}

async function loadRunContext(connection, runId, lock = false) {
  const companyId = currentCompanyId();
  if (!companyId) throw Object.assign(new Error("A company workspace is required."), { code: "TENANT_REQUIRED" });
  const [month, year] = String(runId).split("_").map(Number);
  if (!month || !year) throw new Error("Invalid payroll run ID.");
  const [rows] = await connection.query(
    `SELECT pr.*, pc.configuration_value AS snapshot_rules, p.*, s.employee_id, s.name,
       s.date_of_birth, s.base_salary, s.bank, s.account_no, s.race, s.religion, s.department_name
     FROM payroll_run pr JOIN payroll p ON p.payroll_run_id = pr.payroll_run_id
     JOIN staff s ON s.employee_id = p.staff_employee_id
     LEFT JOIN payroll_configuration pc ON pc.configuration_id = pr.configuration_id
       AND pc.configuration_type = 'rules_snapshot'
     WHERE pr.company_id = ? AND p.company_id = ? AND s.company_id = ?
       AND pr.payroll_month = ? AND pr.payroll_year = ? ORDER BY p.payroll_id${lock ? " FOR UPDATE" : ""}`,
    [companyId, companyId, companyId, month, year]
  );
  if (!rows.length) throw new Error("Payroll run not found.");
  const configuration = parseJson(rows[0].configuration_json, {});
  const rules = configuration.rules || parseJson(rows[0].snapshot_rules, null);
  if (!rules) {
    const error = new Error("This run has no immutable Admin-rule snapshot.");
    error.code = "PAYROLL_RULE_SNAPSHOT_REQUIRED";
    throw error;
  }
  if (lockedRun(rows[0], configuration)) {
    const error = new Error("Approved, paid, delivered or reconciled runs cannot be adjusted.");
    error.code = "PAYROLL_RUN_LOCKED";
    throw error;
  }
  return { month, year, rows, configuration, rules, run: rows[0] };
}

async function recoveriesForStaff(connection, employeeId) {
  const companyId = currentCompanyId();
  const [rows] = await connection.query(
    `SELECT record_id, type, monthly_installment, outstanding_balance FROM claims_and_loans
     WHERE company_id = ? AND staff_employee_id = ? AND type IN ('loan','advance_request')
       AND status IN ('approved','released','finance_approved')
       AND COALESCE(monthly_installment,0) > 0 AND COALESCE(outstanding_balance,0) > 0
     ORDER BY record_id`, [companyId, employeeId]
  );
  return rows.map((item) => ({
    sourceRecordId: item.record_id,
    label: item.type === "loan" ? `Loan repayment ${item.record_id}` : `Salary advance ${item.record_id}`,
    amount: money(Math.min(Number(item.monthly_installment), Number(item.outstanding_balance))),
    scheduledAmount: money(Math.min(Number(item.monthly_installment), Number(item.outstanding_balance))),
    outstandingBefore: money(item.outstanding_balance)
  }));
}

function allowancesFromRow(row) {
  const breakdown = parseJson(row.deduction_breakdown, {});
  const reimbursements = Array.isArray(breakdown.reimbursements) ? breakdown.reimbursements : [];
  const reimbursementTotal = reimbursements.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const allowance = Math.max(0, Number(row.total_allowances || 0) - reimbursementTotal);
  return { reimbursements, allowances: allowance ? [{ label: "Allowance", amount: allowance }] : [] };
}

async function generateAdjustmentProposals(runId, userId) {
  await ensureAdjustmentTable();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const context = await loadRunContext(connection, runId, true);
    for (const row of context.rows) {
      const storedBreakdown = parseJson(row.deduction_breakdown, {});
      const exceptions = Array.isArray(storedBreakdown.complianceExceptions) ? storedBreakdown.complianceExceptions : [];
      const { allowances, reimbursements } = allowancesFromRow(row);
      const recoveries = await recoveriesForStaff(connection, row.employee_id);
      const gross = money(row.gross_salary);
      const capped = capDeductions(recoveries, gross * (Number(context.rules.maxOtherDeductionPercent || 30) / 100));
      let calculation = calculateEmployeePayroll({ staff: row, month: context.month, year: context.year, allowances, reimbursements, otherDeductions: capped, configuration: context.rules });
      let positiveNetContext = null;
      if (calculation.netSalary <= 0 && capped.some((item) => item.amount > 0)) {
        const statutoryWithoutRecoveries = calculateEmployeePayroll({ staff: row, month: context.month, year: context.year, allowances, reimbursements, otherDeductions: [], configuration: context.rules });
        const positiveLimit = Math.max(0, money(statutoryWithoutRecoveries.netSalary - 0.01));
        positiveNetContext = { netWithoutRecoveries: statutoryWithoutRecoveries.netSalary, maximumSafeRecovery: positiveLimit };
        calculation = calculateEmployeePayroll({ staff: row, month: context.month, year: context.year, allowances, reimbursements, otherDeductions: capDeductions(capped, positiveLimit), configuration: context.rules });
      }
      const blockers = exceptions.map((exception) => ({ exception, blocker: blockerFor(exception) })).filter(({ blocker }) => Boolean(blocker));
      const original = {
        grossPay: money(row.gross_salary), totalDeductions: money(row.total_deductions), employeeCpf: money(row.employee_cpf),
        employerCpf: money(row.employer_cpf), mbmf: money(row.mbmf_amount), sdl: money(storedBreakdown.sdl), netPay: money(row.net_salary),
        otherDeductions: recoveries
      };
      const proposed = resultSummary(calculation, calculation.deductionBreakdown.otherDeductions || capped);
      const changes = ["grossPay", "totalDeductions", "employeeCpf", "employerCpf", "mbmf", "sdl", "netPay"]
        .some((key) => money(original[key]) !== money(proposed[key]))
        || recoveries.some((item, index) => money(item.amount) !== money(proposed.otherDeductions?.[index]?.amount));
      const cappedByPercentage = recoveries.some((item, index) => money(item.amount) !== money(capped[index]?.amount));
      const adjustmentCode = positiveNetContext ? "POSITIVE_NET_PROTECTION" : cappedByPercentage ? "DEDUCTION_CAP" : "STATUTORY_RECALCULATION";
      const proposals = [
        ...blockers.map(({ blocker, exception }) => ({
          type: "source_blocker", code: blocker.code, actionable: 0, source: "staff", sourceId: String(row.employee_id),
          reason: `${blocker.owner} must correct ${blocker.field}; the system will not invent employee master data.`, proposed: null,
          explanation: buildSourceBlockerExplanation({ blocker, exception, rules: context.rules, run: context.run, month: context.month, year: context.year })
        })),
        ...(changes && !blockers.length ? [{
          type: "safe_recalculation", code: adjustmentCode, actionable: 1, source: "period_adjustment", sourceId: String(row.payroll_id),
          reason: "Stored payroll values can be safely aligned with this run's Admin-rule snapshot.", proposed,
          explanation: buildAdjustmentExplanation({ code: adjustmentCode, exceptions, original, proposed, rules: context.rules, run: context.run, month: context.month, year: context.year, positiveNetContext })
        }] : [])
      ];
      for (const proposal of proposals) {
        proposal.id = crypto.randomUUID();
      }
      const rowConfiguration = parseJson(row.configuration_json, {});
      rowConfiguration.financeAdjustments = proposals.map((proposal) => ({
        id: proposal.id, payrollId: row.payroll_id, staffEmployeeId: row.employee_id,
        proposalType: proposal.type, exceptionCode: proposal.code,
        ruleReference: context.rules.version || "Stored Admin snapshot", reason: proposal.reason,
        sourceEntity: proposal.source, sourceRecordId: proposal.sourceId,
        originalValue: { ...original, explanation: proposal.explanation },
        proposedValue: proposal.proposed ? { ...proposal.proposed, explanation: proposal.explanation } : null,
        explanation: proposal.explanation, status: "Pending", actionable: Boolean(proposal.actionable),
        runUpdatedAt: context.run.updated_at, rulesHash: rulesHash(context.rules), generatedBy: userId || null,
        createdAt: new Date().toISOString(), reviewedAt: null, rejectionReason: null
      }));
      await connection.execute("UPDATE payroll SET configuration_json = ? WHERE payroll_id = ?", [JSON.stringify(rowConfiguration), row.payroll_id]);
    }
    await connection.commit();
    return listAdjustmentProposals(runId);
  } catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
}

async function listAdjustmentProposals(runId) {
  const companyId = currentCompanyId();
  const [month, year] = String(runId).split("_").map(Number);
  const [rows] = await pool.query(
    `SELECT p.payroll_id, p.staff_employee_id, p.configuration_json, s.name AS employee
     FROM payroll p JOIN staff s ON s.employee_id=p.staff_employee_id
     WHERE p.company_id=? AND s.company_id=? AND p.payroll_month=? AND p.payroll_year=? ORDER BY s.name,p.payroll_id`, [companyId, companyId, month, year]
  );
  return rows.flatMap((row) => (parseJson(row.configuration_json, {}).financeAdjustments || []).map((stored) => {
    const proposal = { ...stored, payrollId: stored.payrollId || row.payroll_id, staffEmployeeId: stored.staffEmployeeId || row.staff_employee_id, employee: row.employee };
    const originalValue = parseJson(proposal.originalValue);
    const proposedValue = parseJson(proposal.proposedValue, null);
    const actionable = Boolean(proposal.actionable);
    const persistedExplanation = proposal.explanation || proposedValue?.explanation || originalValue?.explanation;
    return { ...proposal, actionable, originalValue, proposedValue,
      explanation: persistedExplanation || fallbackExplanation({ ...proposal, actionable }), legacyExplanation: !persistedExplanation };
  })).sort((a, b) => Number(b.actionable) - Number(a.actionable) || a.employee.localeCompare(b.employee));
}

async function reviewAdjustmentProposals({ runId, ids, action, reason, userId, recalculate }) {
  await ensureAdjustmentTable();
  if (!Array.isArray(ids) || !ids.length) throw new Error("Select at least one adjustment proposal.");
  if (!['approve','reject'].includes(action)) throw new Error("Action must be approve or reject.");
  if (action === 'reject' && !String(reason || '').trim()) throw new Error("A rejection reason is required.");
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const context = await loadRunContext(connection, runId, true);
    const wanted = new Set(ids.map(String));
    const proposalRows = context.rows.map((row) => ({ row, configuration: parseJson(row.configuration_json, {}) }));
    const proposals = proposalRows.flatMap(({ configuration }) => configuration.financeAdjustments || []).filter((item) => wanted.has(String(item.id)));
    if (proposals.length !== ids.length || proposals.some((item) => item.status !== 'Pending')) throw Object.assign(new Error("One or more proposals are no longer pending."), { code: 'STALE_ADJUSTMENT' });
    if (proposals.some((item) => new Date(item.runUpdatedAt || item.run_updated_at).getTime() !== new Date(context.run.updated_at).getTime() || (item.rulesHash || item.rules_hash) !== rulesHash(context.rules))) throw Object.assign(new Error("The payroll run changed. Regenerate adjustment proposals."), { code: 'STALE_ADJUSTMENT' });
    if (action === 'approve' && proposals.some((item) => !item.actionable)) throw new Error("Source-data blockers cannot be approved as automatic adjustments.");
    const reviewedAt = new Date().toISOString();
    for (const { row, configuration } of proposalRows) {
      let changed = false;
      configuration.financeAdjustments = (configuration.financeAdjustments || []).map((item) => {
        if (!wanted.has(String(item.id))) return item;
        changed = true;
        return { ...item, status: action === "approve" ? "Approved" : "Rejected", reviewedBy: userId || null,
          reviewedAt, rejectionReason: action === "reject" ? String(reason).trim() : null };
      });
      if (changed) await connection.execute("UPDATE payroll SET configuration_json = ? WHERE payroll_id = ?", [JSON.stringify(configuration), row.payroll_id]);
    }
    let run = null;
    if (action === 'approve') run = await recalculate({ runId, userId, connection, rulesOverride: context.rules, adjustmentReview: true });
    await connection.commit();
    return { proposals: await listAdjustmentProposals(runId), run };
  } catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
}

module.exports = {
  ensureAdjustmentTable, generateAdjustmentProposals, listAdjustmentProposals, reviewAdjustmentProposals,
  _test: { blockerFor, capDeductions, resultSummary, changedComponents, buildSourceBlockerExplanation, buildAdjustmentExplanation, fallbackExplanation, rulesHash }
};
