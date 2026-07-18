const { pool } = require("../config/db");
const { DEFAULT_PAYROLL_RULES_2026 } = require("../services/statutoryPayrollEngine");

async function getAdminPayrollReportData() {
  const [[[userStats]], [payrollRuns], [roleSummary], [users], [auditLogs]] = await Promise.all([
    pool.execute("SELECT COUNT(*) AS activeUsers FROM user WHERE status = 1"),
    pool.execute(
      `SELECT
        pr.payroll_run_id, pr.payroll_month, pr.payroll_year, pr.status,
        pr.created_at, pr.updated_at, pr.approved_at, pr.payment_reference,
        COUNT(p.payroll_id) AS employee_count,
        COALESCE(SUM(COALESCE(p.net_salary, 0) + COALESCE(p.total_deductions, 0)), 0) AS gross_pay,
        COALESCE(SUM(p.total_deductions), 0) AS total_deductions,
        COALESCE(SUM(p.net_salary), 0) AS net_pay,
        COALESCE(SUM(p.employee_cpf), 0) AS employee_cpf,
        COALESCE(SUM(p.employer_cpf), 0) AS employer_cpf
       FROM payroll_run pr
       LEFT JOIN payroll p ON p.payroll_run_id = pr.payroll_run_id
       GROUP BY pr.payroll_run_id, pr.payroll_month, pr.payroll_year, pr.status,
                pr.created_at, pr.updated_at, pr.approved_at, pr.payment_reference
       ORDER BY pr.payroll_year DESC, pr.payroll_month DESC, pr.payroll_run_id DESC`
    ),
    pool.execute(
      `SELECT COALESCE(NULLIF(TRIM(role_name), ''), 'Unassigned') AS role_name,
              COUNT(*) AS user_count
       FROM user
       GROUP BY COALESCE(NULLIF(TRIM(role_name), ''), 'Unassigned')
       ORDER BY role_name`
    ),
    pool.execute(
      `SELECT u.user_id, u.name, u.email, u.status,
              COALESCE(NULLIF(TRIM(u.role_name), ''), 'Unassigned') AS role_name,
              s.employee_code, s.department_name
       FROM user u
       LEFT JOIN staff s ON s.user_user_id = u.user_id
       ORDER BY u.name`
    ),
    pool.execute(
      `SELECT audit_log_id AS log_id, action_description AS action,
              activity_type AS entity_type, affected_record AS entity_id,
              created_at, COALESCE(user_name, 'System') AS user_name,
              status
       FROM audit_logs
       ORDER BY created_at DESC
       LIMIT 100`
    )
  ]);

  const pendingApprovalCount = payrollRuns.filter(
    (run) => !["Approved for Payment", "Payment Processed", "Payslips Sent", "Reconciled"].includes(run.status)
  ).length;
  const totals = payrollRuns.reduce(
    (result, run) => ({
      grossPay: result.grossPay + Number(run.gross_pay || 0),
      deductions: result.deductions + Number(run.total_deductions || 0),
      netPay: result.netPay + Number(run.net_pay || 0),
      employeeCpf: result.employeeCpf + Number(run.employee_cpf || 0),
      employerCpf: result.employerCpf + Number(run.employer_cpf || 0)
    }),
    { grossPay: 0, deductions: 0, netPay: 0, employeeCpf: 0, employerCpf: 0 }
  );
  const settings = Object.entries(DEFAULT_PAYROLL_RULES_2026).map(([key, value]) => ({
    setting_key: `statutory_${key}`,
    setting_value: String(value),
    description: "Rules snapshot used by automated payroll runs"
  }));

  return {
    stats: {
      activeUsers: Number(userStats.activeUsers || 0),
      payrollRules: settings.length,
      payrollRuns: payrollRuns.length,
      payrollRecords: payrollRuns.reduce((sum, run) => sum + Number(run.employee_count || 0), 0),
      adminLogs: auditLogs.length,
      ...totals
    },
    pendingApprovalCount,
    payrollRuns,
    roleSummary,
    users,
    auditLogs,
    settings,
    layouts: []
  };
}

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

async function listAvailableStaffForUserCreation() {
  const [rows] = await pool.execute(
    `SELECT
      staff.employee_id,
      staff.name,
      staff.email,
      staff.phone,
      staff.hire_date,
      staff.base_salary,
      staff.status,
      department.department_id,
      department.department_name
    FROM staff
    LEFT JOIN department ON staff.department_id = department.department_id
    WHERE staff.user_user_id IS NULL
    ORDER BY staff.name`
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
      staff.race,
      staff.religion,
      staff.bank,
      staff.account_no,
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

async function createUserAccount({ email, name, passwordHash, roleId, status, staffEmployeeId, adminUserId }) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [[existingUser]] = await connection.execute(
      "SELECT user_id FROM user WHERE email = ?",
      [email]
    );

    if (existingUser) {
      await connection.rollback();
      return {
        duplicateEmail: true
      };
    }

    const [[role]] = await connection.execute(
      "SELECT role_id FROM role WHERE role_id = ?",
      [roleId]
    );

    if (!role) {
      await connection.rollback();
      return {
        invalidRole: true
      };
    }

    let staff = null;

    if (staffEmployeeId) {
      const [[selectedStaff]] = await connection.execute(
        "SELECT employee_id, user_user_id FROM staff WHERE employee_id = ?",
        [staffEmployeeId]
      );

      if (!selectedStaff) {
        await connection.rollback();
        return {
          invalidStaff: true
        };
      }

      if (selectedStaff.user_user_id) {
        await connection.rollback();
        return {
          staffAlreadyLinked: true
        };
      }

      staff = selectedStaff;
    }

    const [result] = await connection.execute(
      `INSERT INTO user (email, name, password, status, role_id)
      VALUES (?, ?, ?, ?, ?)`,
      [email, name, passwordHash, status, roleId]
    );
    const userId = result.insertId;

    if (staff) {
      await connection.execute(
        "UPDATE staff SET user_user_id = ? WHERE employee_id = ?",
        [userId, staff.employee_id]
      );
    } else {
      await connection.execute(
        "UPDATE staff SET user_user_id = ? WHERE user_user_id IS NULL AND email = ?",
        [userId, email]
      );
    }

    await connection.execute(
      `INSERT INTO audit_log (action, entity_type, entity_id, user_user_id)
      VALUES (?, ?, ?, ?)`,
      ["Created user account", "user", userId, adminUserId || null]
    );

    await connection.commit();

    return {
      userId
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
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
  createUserAccount,
  createPayslipLayout,
  getUserById,
  getDashboardStats,
  getAdminPayrollReportData,
  listAuditLogs,
  listAvailableStaffForUserCreation,
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
