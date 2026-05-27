const express = require("express");

const {
  addPayslipLayout,
  changeUserRole,
  changeUserStatus,
  getAdminPayrollDashboard,
  getPayrollRuleConfig,
  getPayslipLayouts,
  makeDefaultPayslipLayout,
  resetUserPassword,
  updatePayrollSetting
} = require("../controllers/adminPayrollController");
const { authenticateToken } = require("../middleware/authMiddleware");

const router = express.Router();

function requireAdmin(req, res, next) {
  if (req.user?.role !== "Admin") {
    return res.status(403).json({
      message: "Admin access required"
    });
  }

  next();
}

function requirePayrollConfigReader(req, res, next) {
  if (!["Admin", "Finance"].includes(req.user?.role)) {
    return res.status(403).json({
      message: "Payroll config access required"
    });
  }

  next();
}

router.use(authenticateToken);

router.get("/config", requirePayrollConfigReader, getPayrollRuleConfig);

router.use(requireAdmin);

router.get("/dashboard", getAdminPayrollDashboard);
router.get("/payslip-layouts", getPayslipLayouts);
router.post("/payslip-layouts", addPayslipLayout);
router.patch("/payslip-layouts/:layoutId/default", makeDefaultPayslipLayout);
router.patch("/users/:userId/status", changeUserStatus);
router.patch("/users/:userId/role", changeUserRole);
router.post("/users/:userId/reset-password", resetUserPassword);
router.patch("/settings/:settingKey", updatePayrollSetting);

module.exports = router;
