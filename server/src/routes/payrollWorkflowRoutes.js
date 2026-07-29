/**
 * EVALUATION HEADER
 * FEATURE: PAYROLL - SHARED
 * PURPOSE: Defines the available payroll Workflow Routes API endpoints and connects them to handlers.
 * LAYER: Backend route - maps HTTP methods and URLs to middleware and controller functions.
 * FIND RELATED CODE: Follow the imported controller function to find request handling.
 */
const express = require("express");
const { authenticateToken } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/rolesMiddleware");
const { getFinancePayrollRuns, getRunWorkflow } = require("../controllers/financePayrollController");

const router = express.Router();
router.use(authenticateToken, allowRoles("Admin", "Finance", "HR"));
router.get("/runs", getFinancePayrollRuns);
router.get("/runs/:runId", getRunWorkflow);

module.exports = router;
