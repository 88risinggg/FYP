const { pool } = require("../config/db");
const { DEFAULT_PAYROLL_RULES_2026 } = require("../services/statutoryPayrollEngine");
const ROLE_NAMES = Object.freeze({ 1: "Admin", 2: "Finance", 3: "HR", 4: "Staff" });

function parseJson(value, fallback = {}) {
  if (!value) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

async function getAdminPayrollReportData() {
  const [[[userStats]], [payrollRuns], [roleSummary], [users], [auditLogs]] = await Promise.all([
    pool.execute("SELECT COUNT(*) AS activeUsers FROM user WHERE status = 1"),
    pool.execute(
      `SELECT
        p.payroll_month, p.payroll_year, p.run_status AS status,
        p.run_created_at AS created_at, p.run_updated_at AS updated_at,
        p.run_approved_at AS approved_at, p.payment_reference,
        COUNT(p.payroll_id) AS employee_count,
        COALESCE(SUM(COALESCE(p.net_salary, 0) + COALESCE(p.total_deductions, 0)), 0) AS gross_pay,
        COALESCE(SUM(p.total_deductions), 0) AS total_deductions,
        COALESCE(SUM(p.net_salary), 0) AS net_pay,
        COALESCE(SUM(p.employee_cpf), 0) AS employee_cpf,
        COALESCE(SUM(p.employer_cpf), 0) AS employer_cpf
       FROM payroll p
       GROUP BY p.payroll_month, p.payroll_year, p.run_status,
                p.run_created_at, p.run_updated_at, p.run_approved_at, p.payment_reference
       ORDER BY p.payroll_year DESC, p.payroll_month DESC`
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
    `INSERT INTO audit_logs
      (activity_type, action_description, affected_record, user_id, status)
     VALUES (?, ?, ?, ?, 'Success')`,
    [entityType, action, entityId == null ? null : String(entityId), userId || null]
  );
}

async function getDashboardStats() {
  const [[users]] = await pool.execute(
    "SELECT COUNT(*) AS total FROM user WHERE status = 1"
  );
  const [[logs]] = await pool.execute(
    "SELECT COUNT(*) AS total FROM audit_logs"
  );

  return {
    activeUsers: users.total,
    payrollRules: Object.keys(DEFAULT_PAYROLL_RULES_2026).length,
    payslipLayouts: 0,
    adminLogs: logs.total
  };
}

async function listPayslipLayouts() {
  // Payslip layouts are no longer stored in a separate table
  return [];
}

async function createPayslipLayout({ layoutName, filePath, fileType, createdBy }) {
  // No-op: payslip layouts are handled in-memory
  return 0;
}

async function setDefaultPayslipLayout(layoutId) {
  // No-op
  return true;
}

async function listPayrollSettings() {
  // Return statutory rules as settings
  return Object.entries(DEFAULT_PAYROLL_RULES_2026).map(([key, value]) => ({
    setting_id: key,
    setting_key: `statutory_${key}`,
    setting_value: String(value),
    description: "Statutory payroll rule",
    updated_at: null,
    updated_by_name: "System"
  }));
}

async function listMbmfEligibilitySummary() {
  const [[staffCount]] = await pool.execute(
    "SELECT COUNT(*) AS total FROM staff"
  );
  const applicableReligion = "Muslim";
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
  // Payroll settings are now managed via statutory engine defaults
  await logAdminAction({
    action: `Updated payroll setting: ${settingKey}`,
    entityType: "payroll_setting",
    entityId: null,
    userId: updatedBy
  });
}

async function listPayrollRuns() {
  const [rows] = await pool.execute(
    `SELECT
      p.payroll_month,
      p.payroll_year,
      p.run_status AS status,
      p.run_created_at AS created_at,
      p.run_updated_at AS updated_at,
      COUNT(p.payroll_id) AS employee_count
    FROM payroll p
    GROUP BY p.payroll_month, p.payroll_year, p.run_status, p.run_created_at, p.run_updated_at
    ORDER BY p.payroll_year DESC, p.payroll_month DESC`
  );

  return rows;
}

async function listAuditLogs() {
  const [rows] = await pool.execute(
    `SELECT
      audit_logs.audit_log_id AS log_id,
      audit_logs.action_description AS action,
      audit_logs.activity_type AS entity_type,
      audit_logs.affected_record AS entity_id,
      audit_logs.created_at,
      COALESCE(audit_logs.user_name, user.name, 'System') AS user_name
    FROM audit_logs
    LEFT JOIN user ON audit_logs.user_id = user.user_id
    ORDER BY audit_logs.created_at DESC
    LIMIT 25`
  );

  return rows;
}

async function listUsersWithRoles() {
  const [counts] = await pool.execute(
    `SELECT role_name, COUNT(*) AS user_count
     FROM user
     GROUP BY role_name`
  );
  const countByRole = Object.fromEntries(counts.map((row) => [row.role_name, Number(row.user_count)]));
  return Object.entries(ROLE_NAMES).map(([roleId, roleName]) => ({
    role_id: Number(roleId),
    role_name: roleName,
    description: `${roleName} payroll access`,
    user_count: countByRole[roleName] || 0
  }));
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
      NULL AS department_id,
      staff.department_name
    FROM staff
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
      CASE user.role_name
        WHEN 'Admin' THEN 1 WHEN 'Finance' THEN 2 WHEN 'HR' THEN 3 WHEN 'Staff' THEN 4
        ELSE 0
      END AS role_id,
      user.role_name,
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
      NULL AS department_id,
      staff.department_name
    FROM user
    LEFT JOIN staff ON staff.user_user_id = user.user_id
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

    const roleName = ROLE_NAMES[roleId];
    if (!roleName) {
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
      `INSERT INTO user (email, name, password, status, role_name)
      VALUES (?, ?, ?, ?, ?)`,
      [email, name, passwordHash, status, roleName]
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
      `INSERT INTO audit_logs
        (activity_type, action_description, affected_record, user_id, status)
       VALUES ('user', 'Created user account', ?, ?, 'Success')`,
      [String(userId), adminUserId || null]
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
      CASE user.role_name
        WHEN 'Admin' THEN 1 WHEN 'Finance' THEN 2 WHEN 'HR' THEN 3 WHEN 'Staff' THEN 4
        ELSE 0
      END AS role_id,
      user.role_name
    FROM user
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
  const roleName = ROLE_NAMES[roleId];
  if (!roleName) return false;
  const [result] = await pool.execute(
    "UPDATE user SET role_name = ? WHERE user_id = ?",
    [roleName, userId]
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
