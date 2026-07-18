const {
  createFinancePayrollRunFromStaff,
  getPayrollRunComplianceErrors,
  listFinancePayrollRuns,
  upsertFinancePayrollRun
} = require("../models/financePayrollModel");
const { logAuditEvent, getClientIp } = require("../models/auditLogModel");
const { validateFinancePayrollRun } = require("../services/financePayrollWorkflow");

async function getFinancePayrollRuns(req, res) {
  try {
    const runs = await listFinancePayrollRuns();

    res.json({ runs });
  } catch (error) {
    res.status(500).json({ message: "Failed to load Finance payroll runs." });
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

    await logAuditEvent({
      userId: req.user?.userId || null,
      userName: req.user?.email,
      activityType: "Payroll",
      actionDescription: `Created Finance payroll run ${result.run.id} from staff database`,
      affectedRecord: result.run.id,
      status: "Success",
      ipAddress: getClientIp(req)
    });

    res.status(201).json({ run: result.run });
  } catch (error) {
    if (error.code === "DUPLICATE_PAYROLL_RUN") {
      return res.status(409).json({ message: error.message });
    }
    res.status(500).json({ message: "Failed to create Finance payroll run from staff database." });
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

    if (run.approvedAt) {
      const complianceErrors = await getPayrollRunComplianceErrors(Number(run.id));
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
      ipAddress: getClientIp(req)
    });

    res.json({ run: savedRun });
  } catch (error) {
    res.status(500).json({ message: "Failed to save Finance payroll run." });
  }
}

module.exports = {
  createRunFromStaffDatabase,
  getFinancePayrollRuns,
  saveFinancePayrollRun
};
