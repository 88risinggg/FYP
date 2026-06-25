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

    // Get payslip with employee and payroll data
    const [rows] = await pool.query(
      `SELECT
        ps.payslip_id, ps.file_path,
        p.payroll_month, p.payroll_year, p.net_salary, p.total_allowances, p.total_deductions,
        p.employee_cpf, p.employer_cpf,
        s.name AS employee_name, s.employee_code, s.department, s.designation, s.base_salary,
        s.user_user_id
      FROM payslip ps
      INNER JOIN payroll p ON ps.payroll_payroll_id = p.payroll_id
      INNER JOIN staff s ON p.staff_employee_id = s.employee_id
      WHERE ps.payslip_id = ?
      LIMIT 1`,
      [payslipId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Payslip not found." });
    }

    const payslip = rows[0];

    // Staff can only download their own payslips
    if (req.user.role === "Staff" && String(payslip.user_user_id) !== String(userId)) {
      return res.status(403).json({ message: "Access denied." });
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
