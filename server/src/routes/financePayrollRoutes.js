const express = require("express");

const {
  createRunFromStaffDatabase,
  getFinancePayrollRuns,
  saveFinancePayrollRun
} = require("../controllers/financePayrollController");
const { authenticateToken } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/rolesMiddleware");

const router = express.Router();

router.use(authenticateToken);
router.use(allowRoles("Admin", "Finance"));

router.get("/runs", getFinancePayrollRuns);
router.post("/runs/from-staff", createRunFromStaffDatabase);
router.put("/runs/:runId", saveFinancePayrollRun);

module.exports = router;
