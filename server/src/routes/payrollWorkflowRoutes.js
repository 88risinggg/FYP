const express = require("express");
const { authenticateToken } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/rolesMiddleware");
const { getFinancePayrollRuns, getRunWorkflow } = require("../controllers/financePayrollController");

const router = express.Router();
router.use(authenticateToken, allowRoles("Admin", "Finance", "HR"));
router.get("/runs", getFinancePayrollRuns);
router.get("/runs/:runId", getRunWorkflow);

module.exports = router;
