const fs = require("fs");
const path = require("path");
const { pool } = require("../config/db");
const { createNotificationInternal } = require("../controllers/notificationController");
const { listPayslipLayouts } = require("../models/adminPayrollModel");
const { generatePayslipPDF } = require("./payslipPdfService");

const OUTPUT_ROOT = path.join(__dirname, "..", "..", "uploads", "payslips");

async function getReleasedClaims(staffEmployeeId, month, year) {
  const [rows] = await pool.query(
    `SELECT record_id AS claim_id, claim_category AS claim_type, amount,
            description, expense_date, finance_processed_at, payment_reference
     FROM claims_and_loans
     WHERE type = 'expense_claim'
       AND staff_employee_id = ?
       AND status = 'released'
       AND MONTH(COALESCE(finance_processed_at, submitted_at)) = ?
       AND YEAR(COALESCE(finance_processed_at, submitted_at)) = ?
     ORDER BY COALESCE(finance_processed_at, submitted_at), record_id`,
    [staffEmployeeId, month, year]
  );
  return rows;
}

async function getPayslipDataset(payrollId) {
  const [rows] = await pool.query(
    `SELECT p.*, p.payroll_id AS payslip_id,
            s.employee_id, s.employee_code, s.name AS employee_name,
            s.user_user_id, s.email AS staff_email, s.base_salary,
            s.department_name
     FROM payroll p
     INNER JOIN staff s ON s.employee_id = p.staff_employee_id
     WHERE p.payroll_id = ?
     LIMIT 1`,
    [payrollId]
  );
  if (!rows.length) return null;
  const payslip = rows[0];
  payslip.claims = await getReleasedClaims(
    payslip.staff_employee_id,
    Number(payslip.payroll_month),
    Number(payslip.payroll_year)
  );
  const layouts = await listPayslipLayouts();
  payslip.layout = layouts.find((layout) => Number(layout.is_default) === 1) || null;
  return payslip;
}

function safeFilePart(value) {
  return String(value || "employee").replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 80);
}

async function generateAndSendPayslip(payrollId, options = {}) {
  const payslip = await getPayslipDataset(payrollId);
  if (!payslip) return { status: 404, message: "Payslip not found" };
  if (["Sent", "sent_to_staff"].includes(payslip.payslip_status) && payslip.payslip_file_path) {
    return { status: 200, message: "Payslip was already generated and sent", payslip: { ...payslip, file_path: payslip.payslip_file_path } };
  }
  if (!["Approved", "finance_approved", "Sent", "sent_to_staff"].includes(payslip.payslip_status)) {
    return { status: 409, message: "Finance approval is required before sending the payslip" };
  }
  if (!payslip.user_user_id) {
    return { status: 409, message: `Employee ${payslip.employee_id} is not linked to a user account` };
  }

  const periodDirectory = path.join(OUTPUT_ROOT, `${payslip.payroll_year}-${String(payslip.payroll_month).padStart(2, "0")}`);
  fs.mkdirSync(periodDirectory, { recursive: true });
  const fileName = `payslip-${payslip.payroll_id}-${safeFilePart(payslip.employee_id)}.pdf`;
  const absolutePath = path.join(periodDirectory, fileName);
  const publicPath = `/uploads/payslips/${payslip.payroll_year}-${String(payslip.payroll_month).padStart(2, "0")}/${fileName}`;
  const pdf = await generatePayslipPDF(payslip, options.browser || null);
  fs.writeFileSync(absolutePath, pdf);

  const [result] = await pool.query(
    `UPDATE payroll
     SET payslip_status = 'sent_to_staff', payslip_sent_at = NOW(),
         payslip_generated_at = NOW(), payslip_file_path = ?,
         payslip_is_read = 0, payslip_read_at = NULL
     WHERE payroll_id = ? AND payslip_status IN ('Approved', 'finance_approved', 'Sent', 'sent_to_staff')`,
    [publicPath, payrollId]
  );
  if (!result.affectedRows) {
    fs.unlinkSync(absolutePath);
    return { status: 409, message: "Payslip status changed before it could be sent" };
  }

  await createNotificationInternal(
    payslip.user_user_id,
    "payslip_available",
    `Your ${payslip.payroll_month}/${payslip.payroll_year} payslip is ready`,
    `Payslip for ${payslip.employee_name} (${payslip.employee_id}) is available to view.`
  ).catch(() => null);

  return { status: 200, message: "Payslip generated and sent to the linked employee", payslip: { ...payslip, file_path: publicPath } };
}

module.exports = { generateAndSendPayslip, getPayslipDataset, getReleasedClaims };
