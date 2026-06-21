const express = require("express");
const { authenticateToken } = require("../middleware/authMiddleware");
const {
  createPayslip,
  getPayslipsByUserId,
  getPayslipById,
  getPayrollSummary,
  getUnreadPayslipCount,
  markPayslipAsRead,
  updatePayslip,
  deletePayslip
} = require("../controllers/payslipController");

const router = express.Router();

// Staff-facing read routes
router.get("/user/:userId", authenticateToken, getPayslipsByUserId);
router.get("/user/:userId/summary", authenticateToken, getPayrollSummary);
router.get("/user/:userId/unread-count", authenticateToken, getUnreadPayslipCount);
router.patch("/:payslipId/read", authenticateToken, markPayslipAsRead);
router.get("/:payslipId", authenticateToken, getPayslipById);

// Admin/HR/Finance CRUD
router.post("/", authenticateToken, createPayslip);
router.put("/:payslipId", authenticateToken, updatePayslip);
router.delete("/:payslipId", authenticateToken, deletePayslip);

module.exports = router;
