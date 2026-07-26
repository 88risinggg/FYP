const { listFinancePayrollRuns, applyFinancePayrollWorkflowAction } = require("../models/financePayrollModel");
const { generateAndSendPayslip } = require("./payslipDeliveryService");
const { launchPayslipBrowser } = require("./payslipPdfService");
const { buildFinanceWorkflowState } = require("./financePayrollWorkflowState");

async function findRun(runId) {
  return (await listFinancePayrollRuns()).find((run) => run.id === runId) || null;
}

async function deliverRunPayslips({ runId, userId, actor }) {
  const current = await findRun(runId);
  if (!current) throw Object.assign(new Error("Payroll run not found."), { code: "PAYROLL_RUN_NOT_FOUND" });
  if (!current.paidAt) throw Object.assign(new Error("Finance must confirm payment before HR can deliver payslips."), { code: "PAYMENT_NOT_CONFIRMED" });
  const delivery = { total: current.employees.length, sent: 0, failed: 0, skipped: 0, pending: current.employees.length, errors: [], owner: "HR", attemptedAt: new Date().toISOString() };
  const browser = current.employees.length ? await launchPayslipBrowser() : null;
  try {
    for (const employee of current.employees) {
      try {
        const result = await generateAndSendPayslip(employee.payrollId, { browser, actorUserId: userId });
        if (result.status === 200) result.message.includes("already") ? delivery.skipped++ : delivery.sent++;
        else {
          delivery.failed++;
          delivery.errors.push({ employee: employee.name, employeeId: employee.id, payrollId: employee.payrollId, message: result.message, correctiveAction: result.message.includes("not linked to a user account") ? "HR must create the linked account and Admin must approve it before retrying." : result.message.includes("awaiting Admin activation") ? "Admin must approve the pending activation request before HR retries." : "Correct the employee account or payslip source data, then retry." });
        }
      } catch (error) {
        delivery.failed++;
        delivery.errors.push({ employee: employee.name, employeeId: employee.id, payrollId: employee.payrollId, message: error.message, correctiveAction: "Correct the employee account or payslip source data, then retry." });
      }
      delivery.pending = Math.max(0, delivery.total - delivery.sent - delivery.skipped - delivery.failed);
    }
  } finally { if (browser) await browser.close(); }

  const action = delivery.failed ? "payslips-progress" : "payslips-completed";
  const run = await applyFinancePayrollWorkflowAction({ runId, action, payload: { delivery, actor: actor || "HR" }, userId });
  return { run, workflow: buildFinanceWorkflowState(run), delivery };
}

module.exports = { deliverRunPayslips, findRun };
