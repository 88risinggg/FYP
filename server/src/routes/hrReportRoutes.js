const express = require("express");
const { authenticateToken } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/rolesMiddleware");
const ctrl = require("../controllers/hrReportController");

const router = express.Router();
router.use(authenticateToken);

// HR organizational reports
router.get("/payroll", allowRoles("HR"), ctrl.getPayrollReport);
router.get("/payroll/export", allowRoles("HR"), ctrl.exportPayrollReport);
router.get("/leave", allowRoles("HR"), ctrl.getLeaveReport);
router.get("/leave/export", allowRoles("HR"), ctrl.exportLeaveReport);
router.get("/employees", allowRoles("HR"), ctrl.getEmployeeReport);
router.get("/employees/export", allowRoles("HR"), ctrl.exportEmployeeReport);
router.get("/loans", allowRoles("HR"), ctrl.getLoanReport);
router.get("/loans/export", allowRoles("HR"), ctrl.exportLoanReport);
router.get("/advances", allowRoles("HR"), ctrl.getAdvanceReport);
router.get("/advances/export", allowRoles("HR"), ctrl.exportAdvanceReport);

// Staff personal reports
router.get("/my/payroll", allowRoles("Staff", "HR"), ctrl.getMyPayrollReport);
router.get("/my/payroll/export", allowRoles("Staff", "HR"), ctrl.exportMyPayrollReport);
router.get("/my/leave", allowRoles("Staff", "HR"), ctrl.getMyLeaveReport);
router.get("/my/leave/export", allowRoles("Staff", "HR"), ctrl.exportMyLeaveReport);
router.get("/my/loans", allowRoles("Staff", "HR"), ctrl.getMyLoanReport);
router.get("/my/loans/export", allowRoles("Staff", "HR"), ctrl.exportMyLoanReport);

module.exports = router;
