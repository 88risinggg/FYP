/**
 * EVALUATION HEADER
 * FEATURE: PAYROLL - FINANCE
 * PURPOSE: Provides reusable payroll Recovery Posting Service business or integration operations.
 * LAYER: Backend service - contains reusable business rules or external integrations.
 * FIND RELATED CODE: Use Find All References to locate controllers, workers, or services that call it.
 */
const money = (value) => Math.round(Number(value || 0) * 100) / 100;
const { currentCompanyId } = require("./tenantContext");
const parseJson = (value, fallback = {}) => {
  if (!value) return fallback;
  if (typeof value === "object") return value;
  try { return JSON.parse(value); } catch { return fallback; }
};

function sourceRecordId(item = {}) {
  const explicit = String(item.sourceRecordId || item.claimRecordId || "").trim();
  if (explicit) return explicit;
  return String(item.label || "").match(/(?:repayment|advance)\s+([a-z0-9_-]+)$/i)?.[1] || null;
}

async function postPayrollRecoveries({ connection, payrollRunId, userId }) {
  const companyId = currentCompanyId();
  const [payrollRows] = await connection.execute(
    `SELECT payroll_id, staff_employee_id, deduction_breakdown
     FROM payroll WHERE payroll_run_id = ? AND company_id = ? FOR UPDATE`, [payrollRunId, companyId]
  );
  const postings = [];
  for (const payroll of payrollRows) {
    const breakdown = parseJson(payroll.deduction_breakdown, {});
    const deductions = Array.isArray(breakdown.otherDeductions) ? breakdown.otherDeductions : [];
    let breakdownChanged = false;
    for (const item of deductions) {
      if (item.recoveryPostedAt) continue;
      const claimId = sourceRecordId(item);
      if (!claimId || money(item.amount) <= 0) continue;
      const [[claim]] = await connection.execute(
        `SELECT record_id, staff_employee_id, monthly_installment, outstanding_balance
         FROM claims_and_loans WHERE record_id = ? AND company_id = ? FOR UPDATE`, [claimId, companyId]
      );
      if (!claim || Number(claim.staff_employee_id) !== Number(payroll.staff_employee_id)) continue;
      const balanceBefore = money(claim.outstanding_balance);
      const applied = money(Math.min(balanceBefore, money(item.amount)));
      const scheduled = money(item.scheduledAmount ?? Math.min(Number(claim.monthly_installment), balanceBefore));
      const deferred = money(Math.max(0, scheduled - applied));
      const balanceAfter = money(Math.max(0, balanceBefore - applied));
      await connection.execute(
        `UPDATE claims_and_loans SET outstanding_balance = ?, total_paid = COALESCE(total_paid,0) + ? WHERE record_id = ? AND company_id = ?`,
        [balanceAfter, applied, claimId, companyId]
      );
      item.sourceRecordId = claimId;
      item.scheduledAmount = scheduled;
      item.deferredAmount = deferred;
      item.balanceBefore = balanceBefore;
      item.balanceAfter = balanceAfter;
      item.recoveryPostedAt = new Date().toISOString();
      item.recoveryPostedBy = userId || null;
      breakdownChanged = true;
      postings.push({ claimRecordId: claimId, appliedAmount: applied, deferredAmount: deferred, balanceAfter });
    }
    if (breakdownChanged) {
      breakdown.otherDeductions = deductions;
      await connection.execute("UPDATE payroll SET deduction_breakdown = ? WHERE payroll_id = ? AND company_id = ?", [JSON.stringify(breakdown), payroll.payroll_id, companyId]);
    }
  }
  return postings;
}

module.exports = { postPayrollRecoveries, _test: { sourceRecordId } };
