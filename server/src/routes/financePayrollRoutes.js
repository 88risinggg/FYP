const express = require("express");

const {
  createRunFromStaffDatabase,
  cancelRunSchedule,
  confirmRunSchedule,
  getFinanceActivity,
  getFinancePayrollRuns,
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
const { authenticateToken } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/rolesMiddleware");

const router = express.Router();

router.use(authenticateToken);

router.get("/runs", allowRoles("Admin", "Finance", "HR"), getFinancePayrollRuns);
router.get("/activity", allowRoles("Admin", "Finance"), getFinanceActivity);
router.get("/payslip-period-summary", allowRoles("Admin", "Finance"), getPayslipPeriodSummary);
router.get("/schedule", allowRoles("Admin", "Finance"), getSchedule);
router.get("/schedule/preview", allowRoles("Admin", "Finance"), getSchedulePreview);
router.put("/schedule", allowRoles("Finance"), updateSchedule);
router.post("/runs/from-staff", allowRoles("Admin", "Finance", "HR"), createRunFromStaffDatabase);
router.post("/runs/:runId/recalculate", allowRoles("Finance"), recalculateRun);
router.get("/runs/:runId/adjustments", allowRoles("Admin", "Finance"), getRunAdjustments);
router.post("/runs/:runId/adjustments/generate", allowRoles("Finance"), generateRunAdjustments);
router.post("/runs/:runId/adjustments/review", allowRoles("Finance"), reviewRunAdjustments);
router.post("/runs/:runId/validate", allowRoles("Admin", "Finance"), validateRunCompliance);
router.get("/runs/:runId/workflow", allowRoles("Admin", "Finance"), getRunWorkflow);
router.post("/runs/:runId/approve", allowRoles("Finance"), approvePayrollRun);
router.post("/runs/:runId/workflow/:action", allowRoles("Finance"), runWorkflowAction);
router.put("/runs/:runId", allowRoles("Admin", "Finance"), saveFinancePayrollRun);
router.put("/runs/:runId/schedule", allowRoles("Finance"), updateRunSchedule);
router.post("/runs/:runId/schedule/confirm", allowRoles("Finance"), confirmRunSchedule);
router.post("/runs/:runId/schedule/cancel", allowRoles("Finance"), cancelRunSchedule);
router.post("/runs/:runId/schedule/retry", allowRoles("Finance"), retryRunSchedule);

module.exports = router;
