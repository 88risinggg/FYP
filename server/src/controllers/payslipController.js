const { pool } = require("../config/db");
const { createNotificationInternal } = require("./notificationController");

/**
 * Visibility filter: staff can only see payslips from runs with these statuses.
 */
const VISIBLE_RUN_STATUSES = ["Payslips Generated", "Closed"];

/**
 * Resolves the staff employee_id from the logged-in user's JWT userId.
 * Never trusts employee_id from params/query/body.
 */
async function getEmployeeIdFromUserId(userId) {
  const [rows] = await pool.query(
    "SELECT employee_id FROM staff WHERE user_user_id = ? LIMIT 1",
    [userId]
  );
  return rows.length > 0 ? rows[0].employee_id : null;
}

/* ─── READ: List payslips for staff ─── */

/**
 * GET /api/payslips/user/:userId
 * Optional query params: ?year=2026&month=6
 * Returns payroll records (with payslip info) visible to the logged-in staff member.
 */
async function getPayslipsByUserId(req, res) {
  const { userId } = req.params;

  // Staff can only view their own
  if (req.user.role === "Staff" && String(req.user.userId) !== String(userId)) {
    return res.status(403).json({ message: "Access denied" });
  }

  try {
    const employeeId = await getEmployeeIdFromUserId(userId);
    if (!employeeId) {
      return res.json([]);
    }

    let sql = `
      SELECT
        p.payroll_id,
        p.payroll_month,
        p.payroll_year,
        p.total_allowances,
        p.total_deductions,
        p.net_salary,
        s.base_salary,
        s.name AS employee_name,
        s.employee_code,
        pr.status AS run_status,
        ps.payslip_id,
        ps.file_path,
        ps.generated_at,
        ps.is_read_by_staff
      FROM payroll p
      JOIN staff s ON p.staff_employee_id = s.employee_id
      JOIN payroll_run pr ON p.payroll_run_id = pr.payroll_run_id
      LEFT JOIN payslip ps ON ps.payroll_payroll_id = p.payroll_id
      WHERE s.employee_id = ?
        AND pr.status IN (?, ?)
    `;
    const params = [employeeId, ...VISIBLE_RUN_STATUSES];

    // Optional year filter
    if (req.query.year) {
      sql += " AND p.payroll_year = ?";
      params.push(Number(req.query.year));
    }

    // Optional month filter
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

/* ─── READ: Single payslip detail ─── */

/**
 * GET /api/payslips/:payslipId
 * Returns full payslip detail including allowance/deduction line items.
 */
async function getPayslipById(req, res) {
  const { payslipId } = req.params;

  try {
    // Get payslip + payroll + staff info and verify ownership
    const [rows] = await pool.query(
      `SELECT
        ps.payslip_id,
        ps.file_path,
        ps.generated_at,
        ps.is_read_by_staff,
        ps.read_at,
        p.payroll_id,
        p.payroll_month,
        p.payroll_year,
        p.total_allowances,
        p.total_deductions,
        p.net_salary,
        s.base_salary,
        s.name AS employee_name,
        s.employee_code,
        s.user_user_id,
        pr.status AS run_status
      FROM payslip ps
      JOIN payroll p ON ps.payroll_payroll_id = p.payroll_id
      JOIN staff s ON p.staff_employee_id = s.employee_id
      JOIN payroll_run pr ON p.payroll_run_id = pr.payroll_run_id
      WHERE ps.payslip_id = ?
        AND pr.status IN (?, ?)`,
      [payslipId, ...VISIBLE_RUN_STATUSES]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Payslip not found" });
    }

    const payslip = rows[0];

    // Staff can only view their own
    if (req.user.role === "Staff" && String(req.user.userId) !== String(payslip.user_user_id)) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Get allowance line items
    const [allowances] = await pool.query(
      "SELECT allowance_id, allowance_type, amount FROM payroll_allowance WHERE payroll_payroll_id = ?",
      [payslip.payroll_id]
    );

    // Get deduction line items
    const [deductions] = await pool.query(
      "SELECT deduction_id, deduction_type, amount FROM payroll_deduction WHERE payroll_payroll_id = ?",
      [payslip.payroll_id]
    );

    return res.json({
      ...payslip,
      allowances,
      deductions
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to fetch payslip" });
  }
}

/* ─── READ: YTD Summary ─── */

/**
 * GET /api/payslips/user/:userId/summary
 * Returns YTD totals for the logged-in staff member.
 */
async function getPayrollSummary(req, res) {
  const { userId } = req.params;

  if (req.user.role === "Staff" && String(req.user.userId) !== String(userId)) {
    return res.status(403).json({ message: "Access denied" });
  }

  try {
    const employeeId = await getEmployeeIdFromUserId(userId);
    if (!employeeId) {
      return res.json({ ytd: null, latest: null });
    }

    const currentYear = new Date().getFullYear();

    // YTD aggregates
    const [ytdRows] = await pool.query(
      `SELECT
        COUNT(*) AS total_payslips,
        COALESCE(SUM(p.net_salary), 0) AS ytd_net_pay,
        COALESCE(SUM(s.base_salary), 0) AS ytd_gross,
        COALESCE(SUM(p.total_allowances), 0) AS ytd_allowances,
        COALESCE(SUM(p.total_deductions), 0) AS ytd_deductions
      FROM payroll p
      JOIN staff s ON p.staff_employee_id = s.employee_id
      JOIN payroll_run pr ON p.payroll_run_id = pr.payroll_run_id
      WHERE s.employee_id = ?
        AND p.payroll_year = ?
        AND pr.status IN (?, ?)`,
      [employeeId, currentYear, ...VISIBLE_RUN_STATUSES]
    );

    // Latest payroll record
    const [latestRows] = await pool.query(
      `SELECT
        p.payroll_id,
        p.payroll_month,
        p.payroll_year,
        p.net_salary,
        s.base_salary,
        p.total_allowances,
        p.total_deductions,
        pr.status AS run_status,
        ps.payslip_id,
        ps.file_path
      FROM payroll p
      JOIN staff s ON p.staff_employee_id = s.employee_id
      JOIN payroll_run pr ON p.payroll_run_id = pr.payroll_run_id
      LEFT JOIN payslip ps ON ps.payroll_payroll_id = p.payroll_id
      WHERE s.employee_id = ?
        AND pr.status IN (?, ?)
      ORDER BY p.payroll_year DESC, p.payroll_month DESC
      LIMIT 1`,
      [employeeId, ...VISIBLE_RUN_STATUSES]
    );

    return res.json({
      ytd: ytdRows[0] || null,
      latest: latestRows[0] || null
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to fetch payroll summary" });
  }
}

/* ─── READ: Unread payslip count ─── */

/**
 * GET /api/payslips/user/:userId/unread-count
 * Returns count of unread payslips for the logged-in staff member.
 */
async function getUnreadPayslipCount(req, res) {
  const { userId } = req.params;

  if (req.user.role === "Staff" && String(req.user.userId) !== String(userId)) {
    return res.status(403).json({ message: "Access denied" });
  }

  try {
    const employeeId = await getEmployeeIdFromUserId(userId);
    if (!employeeId) {
      return res.json({ unread_count: 0 });
    }

    const [rows] = await pool.query(
      `SELECT COUNT(*) AS unread_count
       FROM payslip ps
       JOIN payroll p ON ps.payroll_payroll_id = p.payroll_id
       JOIN staff s ON p.staff_employee_id = s.employee_id
       JOIN payroll_run pr ON p.payroll_run_id = pr.payroll_run_id
       WHERE s.employee_id = ?
         AND (ps.is_read_by_staff = 0 OR ps.is_read_by_staff IS NULL)
         AND pr.status IN (?, ?)`,
      [employeeId, ...VISIBLE_RUN_STATUSES]
    );

    return res.json({ unread_count: rows[0].unread_count });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to fetch unread count" });
  }
}

/* ─── UPDATE: Mark payslip as read ─── */

/**
 * PUT /api/payslips/:payslipId/read
 * Marks a payslip as read by the staff member.
 */
async function markPayslipAsRead(req, res) {
  const { payslipId } = req.params;

  try {
    // Verify ownership via join chain
    const [rows] = await pool.query(
      `SELECT ps.payslip_id, s.user_user_id
       FROM payslip ps
       JOIN payroll p ON ps.payroll_payroll_id = p.payroll_id
       JOIN staff s ON p.staff_employee_id = s.employee_id
       JOIN payroll_run pr ON p.payroll_run_id = pr.payroll_run_id
       WHERE ps.payslip_id = ?
         AND pr.status IN (?, ?)`,
      [payslipId, ...VISIBLE_RUN_STATUSES]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Payslip not found" });
    }

    if (req.user.role === "Staff" && String(req.user.userId) !== String(rows[0].user_user_id)) {
      return res.status(403).json({ message: "Access denied" });
    }

    await pool.query(
      "UPDATE payslip SET is_read_by_staff = 1, read_at = NOW() WHERE payslip_id = ?",
      [payslipId]
    );

    return res.json({ message: "Payslip marked as read" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to mark payslip as read" });
  }
}

/* ─── CREATE (Admin/HR/Finance only) ─── */

/**
 * POST /api/payslips
 * Create a new payslip. Only Admin/HR/Finance can create.
 */
async function createPayslip(req, res) {
  const role = req.user.role;
  if (role !== "Admin" && role !== "HR" && role !== "Finance") {
    return res.status(403).json({ message: "Access denied" });
  }

  const { payroll_payroll_id, file_path } = req.body;

  if (!payroll_payroll_id) {
    return res.status(400).json({ message: "payroll_payroll_id is required" });
  }

  try {
    const [result] = await pool.query(
      "INSERT INTO payslip (payroll_payroll_id, file_path, generated_at) VALUES (?, ?, NOW())",
      [payroll_payroll_id, file_path || null]
    );

    const [rows] = await pool.query("SELECT * FROM payslip WHERE payslip_id = ?", [result.insertId]);

    // Send notification to the staff member
    try {
      const [staffRows] = await pool.query(
        `SELECT s.user_user_id, p.payroll_month, p.payroll_year
         FROM payroll p
         JOIN staff s ON p.staff_employee_id = s.employee_id
         WHERE p.payroll_id = ?`,
        [payroll_payroll_id]
      );
      if (staffRows.length > 0 && staffRows[0].user_user_id) {
        const monthNames = ["", "January", "February", "March", "April", "May", "June",
                            "July", "August", "September", "October", "November", "December"];
        const label = `${monthNames[staffRows[0].payroll_month] || ""} ${staffRows[0].payroll_year}`;
        await createNotificationInternal(
          staffRows[0].user_user_id,
          "payslip_available",
          `Your ${label} payslip is ready`,
          `Your payslip for ${label} has been generated. You can now view and download it.`
        );
      }
    } catch (_notifErr) { /* non-critical */ }

    return res.status(201).json(rows[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to create payslip" });
  }
}

/* ─── UPDATE (Admin/HR/Finance only) ─── */

/**
 * PUT /api/payslips/:payslipId
 * Update a payslip. Only Admin/HR/Finance can update.
 */
async function updatePayslip(req, res) {
  const role = req.user.role;
  if (role !== "Admin" && role !== "HR" && role !== "Finance") {
    return res.status(403).json({ message: "Access denied" });
  }

  const { payslipId } = req.params;
  const { file_path, generated_at } = req.body;

  try {
    const fields = [];
    const values = [];

    if (typeof file_path !== 'undefined') { fields.push('file_path = ?'); values.push(file_path); }
    if (typeof generated_at !== 'undefined') { fields.push('generated_at = ?'); values.push(generated_at); }

    if (fields.length === 0) {
      return res.status(400).json({ message: "No fields to update" });
    }

    values.push(payslipId);
    const [result] = await pool.query(`UPDATE payslip SET ${fields.join(', ')} WHERE payslip_id = ?`, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Payslip not found" });
    }

    const [rows] = await pool.query("SELECT * FROM payslip WHERE payslip_id = ?", [payslipId]);
    return res.json(rows[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to update payslip" });
  }
}

/* ─── DELETE (Admin only) ─── */

/**
 * DELETE /api/payslips/:payslipId
 * Delete a payslip. Only Admin can delete.
 */
async function deletePayslip(req, res) {
  if (req.user.role !== "Admin") {
    return res.status(403).json({ message: "Access denied" });
  }

  const { payslipId } = req.params;

  try {
    const [result] = await pool.query("DELETE FROM payslip WHERE payslip_id = ?", [payslipId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Payslip not found" });
    }

    return res.json({ message: "Payslip deleted successfully" });
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
