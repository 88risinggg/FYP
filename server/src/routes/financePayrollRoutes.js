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

router.get("/runs", allowRoles("Admin", "Finance", "HR"), getFinancePayrollRuns);
router.post("/runs/from-staff", allowRoles("Admin", "Finance", "HR"), createRunFromStaffDatabase);
router.put("/runs/:runId", allowRoles("Admin", "Finance"), saveFinancePayrollRun);

module.exports = router;
