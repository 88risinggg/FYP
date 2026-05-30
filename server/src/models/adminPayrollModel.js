const { pool } = require("../config/db");

async function logAdminAction({ action, entityType, entityId, userId }) {
  await pool.execute(
    `INSERT INTO audit_log (action, entity_type, entity_id, user_user_id)
    VALUES (?, ?, ?, ?)`,
    [action, entityType, entityId, userId || null]
  );
}

async function getDashboardStats() {
  const [[users]] = await pool.execute(
    "SELECT COUNT(*) AS total FROM user WHERE status = 1"
  );
  const [[settings]] = await pool.execute(
    "SELECT COUNT(*) AS total FROM payroll_setting"
  );
  const [[layouts]] = await pool.execute(
    "SELECT COUNT(*) AS total FROM payslip_layout WHERE status = 'Active'"
  );
  const [[logs]] = await pool.execute(
    "SELECT COUNT(*) AS total FROM audit_log"
  );

  return {
    activeUsers: users.total,
    payrollRules: settings.total,
    payslipLayouts: layouts.total,
    adminLogs: logs.total
  };
}

async function listPayslipLayouts() {
  const [rows] = await pool.execute(
    `SELECT
      payslip_layout.layout_id,
      payslip_layout.layout_name,
      payslip_layout.file_path,
      payslip_layout.file_type,
      payslip_layout.is_default,
      payslip_layout.status,
      payslip_layout.created_at,
      payslip_layout.updated_at,
      user.name AS created_by_name
    FROM payslip_layout
    LEFT JOIN user ON payslip_layout.created_by = user.user_id
    ORDER BY payslip_layout.is_default DESC, payslip_layout.updated_at DESC`
  );

  return rows;
}

async function createPayslipLayout({ layoutName, filePath, fileType, createdBy }) {
  const [result] = await pool.execute(
    `INSERT INTO payslip_layout
      (layout_name, file_path, file_type, created_by)
    VALUES (?, ?, ?, ?)`,
    [layoutName, filePath, fileType, createdBy || null]
  );

  return result.insertId;
}

async function setDefaultPayslipLayout(layoutId) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const [[layout]] = await connection.execute(
      "SELECT layout_id FROM payslip_layout WHERE layout_id = ?",
      [layoutId]
    );

    if (!layout) {
      await connection.rollback();
      return false;
    }

    await connection.execute("UPDATE payslip_layout SET is_default = 0");
    await connection.execute(
      "UPDATE payslip_layout SET is_default = 1, status = 'Active' WHERE layout_id = ?",
      [layoutId]
    );
    await connection.commit();

    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function listPayrollSettings() {
  const [rows] = await pool.execute(
    `SELECT
      payroll_setting.setting_id,
      payroll_setting.setting_key,
      payroll_setting.setting_value,
      payroll_setting.description,
      payroll_setting.updated_at,
      user.name AS updated_by_name
    FROM payroll_setting
    LEFT JOIN user ON payroll_setting.updated_by = user.user_id
    ORDER BY payroll_setting.setting_key`
  );

  return rows;
}

async function listMbmfEligibilitySummary() {
  const [[staffCount]] = await pool.execute(
    "SELECT COUNT(*) AS total FROM staff"
  );
  const [[setting]] = await pool.execute(
    "SELECT setting_value FROM payroll_setting WHERE setting_key = 'mbmf_applicable_religion' LIMIT 1"
  );
  const applicableReligion = String(setting?.setting_value || "Muslim").trim();
  const [religionColumns] = await pool.execute(
    "SHOW COLUMNS FROM staff LIKE 'religion'"
  );

  if (!religionColumns.length) {
    return {
      hasReligionColumn: false,
      applicableReligion,
      totalStaff: staffCount.total,
      eligibleMuslimEmployees: 0,
      nonEligibleEmployees: staffCount.total,
      sampleEmployees: []
    };
  }

  const [[summary]] = await pool.execute(
    `SELECT
      COUNT(*) AS totalStaff,
      SUM(CASE WHEN LOWER(TRIM(COALESCE(religion, ''))) = LOWER(?) THEN 1 ELSE 0 END) AS eligibleMuslimEmployees,
      SUM(CASE WHEN LOWER(TRIM(COALESCE(religion, ''))) <> LOWER(?) THEN 1 ELSE 0 END) AS nonEligibleEmployees
    FROM staff`,
    [applicableReligion, applicableReligion]
  );
  const [sampleEmployees] = await pool.execute(
    `SELECT
      staff.employee_id,
      staff.employee_code,
      staff.religion,
      user.name
    FROM staff
    LEFT JOIN user ON staff.user_user_id = user.user_id
    WHERE LOWER(TRIM(COALESCE(staff.religion, ''))) = LOWER(?)
    ORDER BY user.name
    LIMIT 5`,
    [applicableReligion]
  );

  return {
    hasReligionColumn: true,
    applicableReligion,
    totalStaff: summary.totalStaff || 0,
    eligibleMuslimEmployees: summary.eligibleMuslimEmployees || 0,
    nonEligibleEmployees: summary.nonEligibleEmployees || 0,
    sampleEmployees
  };
}

async function upsertPayrollSetting({ settingKey, settingValue, description, updatedBy }) {
  await pool.execute(
    `INSERT INTO payroll_setting
      (setting_key, setting_value, description, updated_by)
    VALUES (?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      setting_value = VALUES(setting_value),
      description = VALUES(description),
      updated_by = VALUES(updated_by)`,
    [settingKey, settingValue, description || null, updatedBy || null]
  );

  await logAdminAction({
    action: "Updated payroll setting",
    entityType: "payroll_setting",
    entityId: null,
    userId: updatedBy
  });
}

async function listPayrollRuns() {
  const [rows] = await pool.execute(
    `SELECT
      payroll_run.payroll_run_id,
      payroll_run.payroll_month,
      payroll_run.payroll_year,
      payroll_run.status,
      payroll_run.created_at,
      payroll_run.updated_at,
      user.name AS created_by_name,
      COUNT(payroll.payroll_id) AS employee_count
    FROM payroll_run
    LEFT JOIN user ON payroll_run.created_by = user.user_id
    LEFT JOIN payroll
      ON payroll.payroll_month = payroll_run.payroll_month
      AND payroll.payroll_year = payroll_run.payroll_year
    GROUP BY
      payroll_run.payroll_run_id,
      payroll_run.payroll_month,
      payroll_run.payroll_year,
      payroll_run.status,
      payroll_run.created_at,
      payroll_run.updated_at,
      user.name
    ORDER BY payroll_run.payroll_year DESC, payroll_run.payroll_month DESC`
  );

  return rows;
}

async function listAuditLogs() {
  const [rows] = await pool.execute(
    `SELECT
      audit_log.log_id,
      audit_log.action,
      audit_log.entity_type,
      audit_log.entity_id,
      audit_log.created_at,
      user.name AS user_name
    FROM audit_log
    LEFT JOIN user ON audit_log.user_user_id = user.user_id
    ORDER BY audit_log.created_at DESC
    LIMIT 25`
  );

  return rows;
}

async function listUsersWithRoles() {
  const [rows] = await pool.execute(
    `SELECT
      role.role_id,
      role.role_name,
      role.description,
      COUNT(user.user_id) AS user_count
    FROM role
    LEFT JOIN user ON user.role_id = role.role_id
    GROUP BY role.role_id, role.role_name, role.description
    ORDER BY role.role_id`
  );

  return rows;
}

async function listUsers() {
  const [rows] = await pool.execute(
    `SELECT
      user.user_id,
      user.name,
      user.email,
      user.status,
      user.created_at,
      user.updated_at,
      role.role_id,
      role.role_name,
      staff.employee_id,
      staff.employee_code,
      staff.phone,
      staff.race,
      staff.religion,
      staff.hire_date,
      staff.base_salary,
      staff.status AS staff_status,
      department.department_id,
      department.department_name
    FROM user
    JOIN role ON user.role_id = role.role_id
    LEFT JOIN staff ON staff.user_user_id = user.user_id
    LEFT JOIN department ON staff.department_id = department.department_id
    ORDER BY user.name`
  );

  return rows;
}

async function getUserById(userId) {
  const [rows] = await pool.execute(
    `SELECT
      user.user_id,
      user.name,
      user.email,
      user.status,
      user.role_id,
      role.role_name
    FROM user
    JOIN role ON user.role_id = role.role_id
    WHERE user.user_id = ?`,
    [userId]
  );

  return rows[0] || null;
}

async function updateUserStatus({ userId, status, adminUserId }) {
  const [result] = await pool.execute(
    "UPDATE user SET status = ? WHERE user_id = ?",
    [status, userId]
  );

  if (result.affectedRows > 0) {
    await logAdminAction({
      action: status === 1 ? "Activated user account" : "Deactivated user account",
      entityType: "user",
      entityId: userId,
      userId: adminUserId
    });
  }

  return result.affectedRows > 0;
}

async function updateUserRole({ userId, roleId, adminUserId }) {
  const [result] = await pool.execute(
    "UPDATE user SET role_id = ? WHERE user_id = ?",
    [roleId, userId]
  );

  if (result.affectedRows > 0) {
    await logAdminAction({
      action: "Updated user role",
      entityType: "user",
      entityId: userId,
      userId: adminUserId
    });
  }

  return result.affectedRows > 0;
}

async function updateUserPassword({ userId, passwordHash, adminUserId }) {
  const [result] = await pool.execute(
    "UPDATE user SET password = ? WHERE user_id = ?",
    [passwordHash, userId]
  );

  if (result.affectedRows > 0) {
    await logAdminAction({
      action: "Reset user password",
      entityType: "user",
      entityId: userId,
      userId: adminUserId
    });
  }

  return result.affectedRows > 0;
}

module.exports = {
  createPayslipLayout,
  getUserById,
  getDashboardStats,
  listAuditLogs,
  listMbmfEligibilitySummary,
  listPayrollRuns,
  listPayrollSettings,
  listPayslipLayouts,
  listUsers,
  listUsersWithRoles,
  setDefaultPayslipLayout,
  updateUserPassword,
  updateUserRole,
  updateUserStatus,
  upsertPayrollSetting
};
