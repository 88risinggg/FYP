const express = require("express");
const { authenticateToken } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/rolesMiddleware");
const {
  downloadTemplate,
  getRates,
  updateRates,
  financeApprovePayslip,
  sendPayslipToFinance,
  bulkSendToFinance,
  financeRejectPayslip,
} = require("../controllers/payrollController");

const router = express.Router();

// Payroll template download
router.get("/template", authenticateToken, allowRoles("Admin", "HR"), downloadTemplate);

// Rate configuration
router.get("/rates", authenticateToken, allowRoles("Admin", "HR"), getRates);
router.put("/rates", authenticateToken, allowRoles("Admin"), updateRates);

// Payslip approval workflow
router.put("/payslips/:id/finance-approve", authenticateToken, allowRoles("Finance"), financeApprovePayslip);
router.put("/payslips/:id/send-to-finance", authenticateToken, allowRoles("HR"), sendPayslipToFinance);
router.put("/payslips/bulk-send-to-finance", authenticateToken, allowRoles("HR"), bulkSendToFinance);
router.put("/payslips/:id/finance-reject", authenticateToken, allowRoles("Finance"), financeRejectPayslip);

module.exports = router;
