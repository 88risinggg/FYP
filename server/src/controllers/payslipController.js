// Payslips are stored directly in `payroll`; payroll_id is the payslip ID.
// This avoids separate payslip, allowance and deduction tables.
const { pool } = require("../config/db");
const { createNotificationInternal } = require("./notificationController");

const VISIBLE_RUN_STATUS = "Closed";

async function getEmployeeIdFromUserId(userId) {
  const [rows] = await pool.query(
    "SELECT employee_id FROM staff WHERE user_user_id = ? LIMIT 1",
    [userId]
  );
  return rows[0]?.employee_id || null;
}

function parseJson(value, fallback) {
  if (!value) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function toAllowanceItems(value) {
  const items = parseJson(value, []);
  return (Array.isArray(items) ? items : []).map((item, index) => ({
    allowance_id: index + 1,
    allowance_type: item.allowance_type || item.label || "Allowance",
    amount: Number(item.amount || 0)
  }));
}

function toDeductionItems(value) {
  const breakdown = parseJson(value, {});
  if (Array.isArray(breakdown)) {
    return breakdown.map((item, index) => ({
      deduction_id: index + 1,
      deduction_type: item.deduction_type || item.label || "Deduction",
      amount: Number(item.amount || 0)
    }));
  }

  const items = [];
  if (Number(breakdown.employeeCpf || 0) > 0) {
    items.push({ deduction_type: "Employee CPF", amount: Number(breakdown.employeeCpf) });
  }
  for (const item of breakdown.selfHelpGroups || []) {
    items.push({ deduction_type: item.fund || "Self-help group", amount: Number(item.amount || 0) });
  }
  for (const item of breakdown.otherDeductions || []) {
    items.push({ deduction_type: item.label || "Other deduction", amount: Number(item.amount || 0) });
  }
  return items.map((item, index) => ({ deduction_id: index + 1, ...item }));
}

async function getPayslipsByUserId(req, res) {
  const { userId } = req.params;
  if (req.user.role === "Staff" && String(req.user.userId) !== String(userId)) {
    return res.status(403).json({ message: "Access denied" });
  }

  try {
    const employeeId = await getEmployeeIdFromUserId(userId);
    if (!employeeId) return res.json([]);

    let sql = `
      SELECT
        p.payroll_id,
        p.payroll_id AS payslip_id,
        p.payroll_month,
        p.payroll_year,
        p.gross_salary,
        p.total_allowances,
        p.total_deductions,
        p.net_salary,
        p.payslip_status,
        p.payslip_file_path AS file_path,
        p.payslip_generated_at AS generated_at,
        p.payslip_is_read AS is_read_by_staff,
        s.base_salary,
        s.name AS employee_name,
        s.employee_code,
        pr.status AS run_status
      FROM payroll p
      JOIN staff s ON p.staff_employee_id = s.employee_id
      JOIN payroll_run pr ON p.payroll_run_id = pr.payroll_run_id
      WHERE s.employee_id = ? AND pr.status = ?`;
    const params = [employeeId, VISIBLE_RUN_STATUS];

    if (req.query.year) {
      sql += " AND p.payroll_year = ?";
      params.push(Number(req.query.year));
    }
    if (req.query.month) {
      sql += " AND p.payroll_month = ?";
      params.push(Number(req.query.month));
    }
    sql += " ORDER BY p.payroll_year DESC, p.payroll_month DESC";

    const [rows] = await pool.query(sql, params);
    return res.json(rows);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to fetch payslips" });
  }
}

async function getPayslipById(req, res) {
  const { payslipId } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT
        p.*,
        p.payroll_id AS payslip_id,
        p.payslip_file_path AS file_path,
        p.payslip_generated_at AS generated_at,
        p.payslip_is_read AS is_read_by_staff,
        p.payslip_read_at AS read_at,
        s.base_salary,
        s.name AS employee_name,
        s.employee_code,
        s.user_user_id,
        s.department_name,
        pr.status AS run_status
       FROM payroll p
       JOIN staff s ON p.staff_employee_id = s.employee_id
       JOIN payroll_run pr ON p.payroll_run_id = pr.payroll_run_id
       WHERE p.payroll_id = ? AND pr.status = ?`,
      [payslipId, VISIBLE_RUN_STATUS]
    );
    if (!rows.length) return res.status(404).json({ message: "Payslip not found" });

    const payslip = rows[0];
    if (req.user.role === "Staff" && String(req.user.userId) !== String(payslip.user_user_id)) {
      return res.status(403).json({ message: "Access denied" });
    }
    return res.json({
      ...payslip,
      allowances: toAllowanceItems(payslip.allowance_breakdown),
      deductions: toDeductionItems(payslip.deduction_breakdown)
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to fetch payslip" });
  }
}

async function getPayrollSummary(req, res) {
  const { userId } = req.params;
  if (req.user.role === "Staff" && String(req.user.userId) !== String(userId)) {
    return res.status(403).json({ message: "Access denied" });
  }

  try {
    const employeeId = await getEmployeeIdFromUserId(userId);
    if (!employeeId) return res.json({ ytd: null, latest: null });
    const currentYear = new Date().getFullYear();

    const [ytdRows] = await pool.query(
      `SELECT COUNT(*) AS total_payslips,
              COALESCE(SUM(p.net_salary), 0) AS ytd_net_pay,
              COALESCE(SUM(p.gross_salary), 0) AS ytd_gross,
              COALESCE(SUM(p.total_allowances), 0) AS ytd_allowances,
              COALESCE(SUM(p.total_deductions), 0) AS ytd_deductions
       FROM payroll p
       JOIN payroll_run pr ON p.payroll_run_id = pr.payroll_run_id
       WHERE p.staff_employee_id = ? AND p.payroll_year = ? AND pr.status = ?`,
      [employeeId, currentYear, VISIBLE_RUN_STATUS]
    );
    const [latestRows] = await pool.query(
      `SELECT p.*, p.payroll_id AS payslip_id,
              p.payslip_file_path AS file_path, pr.status AS run_status
       FROM payroll p
       JOIN payroll_run pr ON p.payroll_run_id = pr.payroll_run_id
       WHERE p.staff_employee_id = ? AND pr.status = ?
       ORDER BY p.payroll_year DESC, p.payroll_month DESC
       LIMIT 1`,
      [employeeId, VISIBLE_RUN_STATUS]
    );
    return res.json({ ytd: ytdRows[0] || null, latest: latestRows[0] || null });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to fetch payroll summary" });
  }
}

async function getUnreadPayslipCount(req, res) {
  const { userId } = req.params;
  if (req.user.role === "Staff" && String(req.user.userId) !== String(userId)) {
    return res.status(403).json({ message: "Access denied" });
  }
  try {
    const employeeId = await getEmployeeIdFromUserId(userId);
    if (!employeeId) return res.json({ unread_count: 0 });
    const [[row]] = await pool.query(
      `SELECT COUNT(*) AS unread_count
       FROM payroll p
       JOIN payroll_run pr ON p.payroll_run_id = pr.payroll_run_id
       WHERE p.staff_employee_id = ? AND p.payslip_is_read = 0 AND pr.status = ?`,
      [employeeId, VISIBLE_RUN_STATUS]
    );
    return res.json({ unread_count: row.unread_count });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to fetch unread count" });
  }
}

async function markPayslipAsRead(req, res) {
  const { payslipId } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT p.payroll_id AS payslip_id, s.user_user_id
       FROM payroll p
       JOIN staff s ON p.staff_employee_id = s.employee_id
       JOIN payroll_run pr ON p.payroll_run_id = pr.payroll_run_id
       WHERE p.payroll_id = ? AND pr.status = ?`,
      [payslipId, VISIBLE_RUN_STATUS]
    );
    if (!rows.length) return res.status(404).json({ message: "Payslip not found" });
    if (req.user.role === "Staff" && String(req.user.userId) !== String(rows[0].user_user_id)) {
      return res.status(403).json({ message: "Access denied" });
    }
    await pool.query(
      "UPDATE payroll SET payslip_is_read = 1, payslip_read_at = NOW() WHERE payroll_id = ?",
      [payslipId]
    );
    return res.json({ message: "Payslip marked as read" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to mark payslip as read" });
  }
}

async function createPayslip(req, res) {
  if (!["Admin", "HR", "Finance"].includes(req.user.role)) {
    return res.status(403).json({ message: "Access denied" });
  }
  const { payroll_payroll_id, file_path } = req.body;
  if (!payroll_payroll_id) return res.status(400).json({ message: "payroll_payroll_id is required" });

  try {
    const [result] = await pool.query(
      `UPDATE payroll
       SET payslip_file_path = ?, payslip_generated_at = NOW(), payslip_is_read = 0, payslip_read_at = NULL
       WHERE payroll_id = ?`,
      [file_path || null, payroll_payroll_id]
    );
    if (!result.affectedRows) return res.status(404).json({ message: "Payroll record not found" });
    const [[payslip]] = await pool.query(
      `SELECT p.*, p.payroll_id AS payslip_id, p.payslip_file_path AS file_path,
              p.payslip_generated_at AS generated_at
       FROM payroll p WHERE p.payroll_id = ?`,
      [payroll_payroll_id]
    );

    try {
      const [[staff]] = await pool.query(
        `SELECT s.user_user_id, p.payroll_month, p.payroll_year
         FROM payroll p JOIN staff s ON p.staff_employee_id = s.employee_id
         WHERE p.payroll_id = ?`,
        [payroll_payroll_id]
      );
      if (staff?.user_user_id) {
        await createNotificationInternal(
          staff.user_user_id,
          "payslip_available",
          `Your ${staff.payroll_month}/${staff.payroll_year} payslip is ready`,
          "Your payslip has been generated and is ready to view."
        );
      }
    } catch { /* Notification failure must not roll back payslip generation. */ }

    return res.status(201).json(payslip);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to create payslip" });
  }
}

async function updatePayslip(req, res) {
  if (!["Admin", "HR", "Finance"].includes(req.user.role)) {
    return res.status(403).json({ message: "Access denied" });
  }
  const { payslipId } = req.params;
  const { file_path, generated_at } = req.body;
  const fields = [];
  const values = [];
  if (typeof file_path !== "undefined") { fields.push("payslip_file_path = ?"); values.push(file_path); }
  if (typeof generated_at !== "undefined") { fields.push("payslip_generated_at = ?"); values.push(generated_at); }
  if (!fields.length) return res.status(400).json({ message: "No fields to update" });

  try {
    values.push(payslipId);
    const [result] = await pool.query(`UPDATE payroll SET ${fields.join(", ")} WHERE payroll_id = ?`, values);
    if (!result.affectedRows) return res.status(404).json({ message: "Payslip not found" });
    const [[row]] = await pool.query(
      `SELECT p.*, p.payroll_id AS payslip_id, p.payslip_file_path AS file_path,
              p.payslip_generated_at AS generated_at
       FROM payroll p WHERE p.payroll_id = ?`,
      [payslipId]
    );
    return res.json(row);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to update payslip" });
  }
}

async function deletePayslip(req, res) {
  if (req.user.role !== "Admin") return res.status(403).json({ message: "Access denied" });
  try {
    const [result] = await pool.query(
      `UPDATE payroll
       SET payslip_file_path = NULL, payslip_generated_at = NULL,
           payslip_is_read = 0, payslip_read_at = NULL
       WHERE payroll_id = ?`,
      [req.params.payslipId]
    );
    if (!result.affectedRows) return res.status(404).json({ message: "Payslip not found" });
    return res.json({ message: "Payslip metadata cleared; payroll record preserved" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to delete payslip" });
  }
}

module.exports = {
  createPayslip,
  getPayslipsByUserId,
  getPayslipById,
  getPayrollSummary,
  getUnreadPayslipCount,
  markPayslipAsRead,
  updatePayslip,
  deletePayslip
};
