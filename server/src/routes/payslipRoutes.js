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
const { generatePayslipPDF } = require("../services/payslipPdfService");
const { getPayslipDataset } = require("../services/payslipDeliveryService");
const { pool } = require("../config/db");

const router = express.Router();

// Staff-facing read routes
router.get("/user/:userId", authenticateToken, getPayslipsByUserId);
router.get("/user/:userId/summary", authenticateToken, getPayrollSummary);
// [STAFF BRANCH - Steven] New routes for notification badge (FR6)
router.get("/user/:userId/unread-count", authenticateToken, getUnreadPayslipCount);
router.patch("/:payslipId/read", authenticateToken, markPayslipAsRead);
router.get("/:payslipId", authenticateToken, getPayslipById);

/**
 * GET /api/payslips/:payslipId/pdf
 * Download payslip as PDF. Staff can only download their own.
 */
router.get("/:payslipId/pdf", authenticateToken, async (req, res) => {
  try {
    const payslipId = Number(req.params.payslipId);
    const userId = req.user.userId;

    const payslip = await getPayslipDataset(payslipId);
    if (!payslip) {
      return res.status(404).json({ message: "Payslip not found." });
    }

    // Staff can only download their own payslips
    if (req.user.role === "Staff" && String(payslip.user_user_id) !== String(userId)) {
      return res.status(403).json({ message: "Access denied." });
    }
    if (req.user.role === "Staff" && !["Sent", "sent_to_staff"].includes(payslip.payslip_status)) {
      return res.status(403).json({ message: "This payslip has not been sent to you yet." });
    }

    const pdfBuffer = await generatePayslipPDF(payslip);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="payslip-${payslip.payroll_month}-${payslip.payroll_year}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    res.status(500).json({ message: "Failed to generate payslip PDF.", detail: error.message });
  }
});

// Admin/HR/Finance CRUD
router.post("/", authenticateToken, createPayslip);
router.put("/:payslipId", authenticateToken, updatePayslip);
router.delete("/:payslipId", authenticateToken, deletePayslip);

module.exports = router;
