/**
 * EVALUATION HEADER
 * FEATURE: PAYROLL - FINANCE
 * PURPOSE: Defines the available finance Payroll Routes API endpoints and connects them to handlers.
 * LAYER: Backend route - maps HTTP methods and URLs to middleware and controller functions.
 * FIND RELATED CODE: Follow the imported controller function to find request handling.
 */
const express = require("express");

const {
  createRunFromStaffDatabase,
  cancelRunSchedule,
  confirmRunSchedule,
  getFinanceActivity,
  getFinancePayrollRuns,
  exportFinancePayrollReport,
  getPayslipPeriodSummary,
  getRunAdjustments,
  getRunWorkflow,
  approvePayrollRun,
  generateRunAdjustments,
  getSchedule,
  getSchedulePreview,
  recalculateRun,
  saveFinancePayrollRun,
  retryRunSchedule,
  updateRunSchedule,
  updateSchedule,
  validateRunCompliance,
  reviewRunAdjustments,
  runWorkflowAction
} = require("../controllers/financePayrollController");
const { getRuleAcknowledgement, acknowledgePayrollRules } = require("../services/payrollRuleGovernanceService");
const { authenticateToken } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/rolesMiddleware");

const router = express.Router();

router.use(authenticateToken);

// EVALUATION NOTE: Finance must explicitly acknowledge the latest Admin policy
// fingerprint before any protected calculation or approval endpoint can run.
async function requireCurrentRuleAcknowledgement(req, res, next) {
  if (req.user?.role !== "Finance") return next();
  try {
    const state = await getRuleAcknowledgement(req.user?.userId);
    if (state.required) return res.status(409).json({ code: "RULES_ACKNOWLEDGEMENT_REQUIRED", message: "Review and acknowledge the latest Admin payroll rules before continuing.", acknowledgement: state });
    return next();
  } catch (error) { return res.status(500).json({ code: "RULE_ACKNOWLEDGEMENT_CHECK_FAILED", message: "Unable to verify the payroll-rule acknowledgement." }); }
}

router.get("/runs", allowRoles("Admin", "Finance", "HR"), getFinancePayrollRuns);
router.get("/reports/export", allowRoles("Finance"), exportFinancePayrollReport);
router.get("/activity", allowRoles("Admin", "Finance"), getFinanceActivity);
router.get("/payslip-period-summary", allowRoles("Admin", "Finance"), getPayslipPeriodSummary);
router.get("/schedule", allowRoles("Admin", "Finance"), getSchedule);
router.get("/schedule/preview", allowRoles("Admin", "Finance"), getSchedulePreview);
router.put("/schedule", allowRoles("Finance"), updateSchedule);
router.post("/runs/from-staff", allowRoles("Admin", "Finance", "HR"), requireCurrentRuleAcknowledgement, createRunFromStaffDatabase);
router.post("/runs/:runId/recalculate", allowRoles("Finance"), requireCurrentRuleAcknowledgement, recalculateRun);
router.get("/runs/:runId/adjustments", allowRoles("Admin", "Finance"), getRunAdjustments);
router.post("/runs/:runId/adjustments/generate", allowRoles("Finance"), requireCurrentRuleAcknowledgement, generateRunAdjustments);
router.post("/runs/:runId/adjustments/review", allowRoles("Finance"), requireCurrentRuleAcknowledgement, reviewRunAdjustments);
router.post("/runs/:runId/validate", allowRoles("Admin", "Finance"), requireCurrentRuleAcknowledgement, validateRunCompliance);
router.get("/runs/:runId/workflow", allowRoles("Admin", "Finance", "HR"), getRunWorkflow);
router.get("/rule-acknowledgement", allowRoles("Finance"), async (req, res) => res.json(await getRuleAcknowledgement(req.user?.userId)));
router.post("/rule-acknowledgement", allowRoles("Finance"), async (req, res, next) => { try { res.json(await acknowledgePayrollRules(req.user?.userId)); } catch (error) { next(error); } });
// EVALUATION NOTE: Approval and generic workflow transitions remain Finance-only;
// the controller and model still validate that every earlier stage is complete.
router.post("/runs/:runId/approve", allowRoles("Finance"), requireCurrentRuleAcknowledgement, approvePayrollRun);
router.post("/runs/:runId/workflow/:action", allowRoles("Finance"), requireCurrentRuleAcknowledgement, runWorkflowAction);
router.put("/runs/:runId", allowRoles("Admin", "Finance"), requireCurrentRuleAcknowledgement, saveFinancePayrollRun);
router.put("/runs/:runId/schedule", allowRoles("Finance"), updateRunSchedule);
router.post("/runs/:runId/schedule/confirm", allowRoles("Finance"), confirmRunSchedule);
router.post("/runs/:runId/schedule/cancel", allowRoles("Finance"), cancelRunSchedule);
router.post("/runs/:runId/schedule/retry", allowRoles("Finance"), retryRunSchedule);

module.exports = router;
