/**
 * EVALUATION HEADER
 * FEATURE: PAYROLL - ADMIN
 * PURPOSE: Reads and writes admin Payroll Model data in the database.
 * LAYER: Backend model - contains database queries and persistence operations.
 * FIND RELATED CODE: Use Find All References to locate the controller/service that requests this data.
 */
const { pool } = require("../config/db");
const { writeAuditLog } = require("../services/auditService");
const {
  ensurePayrollConfigurationTable,
  getEffectivePayrollRules,
  listStoredPayrollSettings,
  upsertStoredPayrollSetting
} = require("../services/payrollRuleConfigService");
const ROLE_NAMES = Object.freeze({ 1: "Admin", 2: "Finance", 3: "HR", 4: "Staff" });
const { currentCompanyId } = require("../services/tenantContext");

function parseJson(value, fallback = {}) {
  if (!value) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function isReportableStatutorySetting(setting = {}) {
  const key = String(setting.setting_key || "").toLowerCase();
  const statutoryPrefix = ["statutory_", "cpf_", "sdl_", "mbmf_", "cdac_", "sinda_", "ecf_", "iras_", "ir21_", "foreign_worker_levy_"]
    .some((prefix) => key.startsWith(prefix));
  const operationalOrBankingReference = ["bank", "account", "payable", "expense", "clearing", "payment_method"]
    .some((fragment) => key.includes(fragment));
  return statutoryPrefix && !operationalOrBankingReference;
}

// FUNCTION: Loads database datasets used to build Admin governance reports.
async function getAdminPayrollReportData() {
  const companyId = currentCompanyId();
  const [[[userStats]], [payrollRuns], [roleSummary], [users], [auditLogs]] = await Promise.all([
    pool.execute("SELECT COUNT(*) AS activeUsers FROM user WHERE status = 1 AND company_id=?", [companyId]),
    pool.execute(
      `SELECT
        p.payroll_month, p.payroll_year,
        COALESCE(MAX(pr.status), MAX(p.run_status)) AS status,
        COALESCE(MAX(pr.created_at), MAX(p.run_created_at)) AS created_at,
        COALESCE(MAX(pr.updated_at), MAX(p.run_updated_at)) AS updated_at,
        COALESCE(MAX(pr.approved_at), MAX(p.run_approved_at)) AS approved_at,
        COALESCE(MAX(pr.payment_reference), MAX(p.payment_reference)) AS payment_reference,
        COUNT(p.payroll_id) AS employee_count
       FROM payroll p
       LEFT JOIN payroll_run pr ON pr.payroll_run_id = p.payroll_run_id
       WHERE p.company_id=?
       GROUP BY p.payroll_month, p.payroll_year
       ORDER BY p.payroll_year DESC, p.payroll_month DESC`
    , [companyId]),
    pool.execute(
      `SELECT COALESCE(NULLIF(TRIM(role_name), ''), 'Unassigned') AS role_name,
              COUNT(*) AS user_count
       FROM user WHERE company_id=?
       GROUP BY COALESCE(NULLIF(TRIM(role_name), ''), 'Unassigned')
       ORDER BY role_name`
    , [companyId]),
    pool.execute(
      `SELECT u.user_id, u.name, u.email, u.status,
              COALESCE(NULLIF(TRIM(u.role_name), ''), 'Unassigned') AS role_name,
              s.employee_code, s.department_name
       FROM user u
       LEFT JOIN staff s ON s.user_user_id = u.user_id AND s.company_id=u.company_id
       WHERE u.company_id=?
       ORDER BY u.name`
    , [companyId]),
    pool.execute(
      `SELECT a.audit_log_id AS log_id, a.action_description AS action,
              COALESCE(a.entity_type, a.activity_type) AS entity_type, a.affected_record AS entity_id,
              a.module, a.created_at, COALESCE(u.name, NULLIF(a.user_name, ''), 'System') AS user_name,
              a.status
       FROM audit_logs a
       LEFT JOIN user u ON u.user_id = a.user_id
       WHERE a.company_id=?
       ORDER BY a.created_at DESC
       LIMIT 100`
    , [companyId])
  ]);

  const pendingApprovalCount = payrollRuns.filter(
    (run) => !["Approved for Payment", "Payment Processed", "Payslips Sent", "Reconciled"].includes(run.status)
  ).length;
  const effectiveRules = await getEffectivePayrollRules();
  const settings = (await listPayrollSettings()).filter(isReportableStatutorySetting);

  return {
    stats: {
      activeUsers: Number(userStats.activeUsers || 0),
      payrollRules: effectiveRules.groupCount,
      payrollRuns: payrollRuns.length,
      payrollRecords: payrollRuns.reduce((sum, run) => sum + Number(run.employee_count || 0), 0),
      adminLogs: auditLogs.length
    },
    pendingApprovalCount,
    payrollRuns,
    roleSummary,
    users,
    auditLogs,
    effectiveRules,
    settings,
    layouts: []
  };
}

async function logAdminAction({ action, entityType, entityId, userId }) {
  await writeAuditLog({ module: "Payroll", activityType: entityType, action, entityId, entityType, userId, status: "Success" });
}

// FUNCTION: Calculates Admin dashboard totals for users, rules, runs and activity.
async function getDashboardStats() {
  const companyId = currentCompanyId();
  await ensurePayrollConfigurationTable(pool);
  const [[users]] = await pool.execute(
    "SELECT COUNT(*) AS total FROM user WHERE status = 1 AND company_id=?", [companyId]
  );
  const [[logs]] = await pool.execute(
    "SELECT COUNT(*) AS total FROM audit_logs WHERE company_id=?", [companyId]
  );
  const [[layouts]] = await pool.execute(
    "SELECT COUNT(*) AS total FROM payroll_configuration WHERE configuration_type = 'payslip_layout' AND company_id=?", [companyId]
  );

  const effectiveRules = await getEffectivePayrollRules();
  return {
    activeUsers: users.total,
    payrollRules: effectiveRules.groupCount,
    payslipLayouts: Number(layouts.total || 0),
    adminLogs: logs.total
  };
}

// FUNCTION: Reads company payslip-template records from the database.
async function listPayslipLayouts() {
  await ensurePayrollConfigurationTable(pool);
  const [rows] = await pool.execute(
    `SELECT configuration_id, configuration_value, created_at, updated_at
     FROM payroll_configuration
     WHERE configuration_type = 'payslip_layout' AND company_id=?
     ORDER BY updated_at DESC, configuration_id DESC`
    ,[currentCompanyId()]
  );

  return rows.map((row) => {
    const layout = parseJson(row.configuration_value, {});
    return {
      layout_id: row.configuration_id,
      layout_name: layout.layout_name || "Payslip layout",
      file_path: layout.file_path || "",
      file_type: layout.file_type || "PDF",
      original_file_name: layout.original_file_name || "",
      file_size: Number(layout.file_size || 0),
      status: layout.status || "Active",
      is_default: layout.is_default ? 1 : 0,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  });
}

// FUNCTION: Inserts metadata for an uploaded payslip layout.
async function createPayslipLayout({ layoutName, filePath, fileType, originalFileName, fileSize, createdBy }) {
  await ensurePayrollConfigurationTable(pool);
  const [[countRow]] = await pool.execute(
    "SELECT COUNT(*) AS total FROM payroll_configuration WHERE configuration_type = 'payslip_layout' AND company_id=?", [currentCompanyId()]
  );
  const metadata = JSON.stringify({
    layout_name: layoutName,
    file_path: filePath,
    file_type: fileType,
    original_file_name: originalFileName,
    file_size: fileSize,
    status: "Active",
    is_default: Number(countRow.total || 0) === 0
  });
  const [result] = await pool.execute(
    `INSERT INTO payroll_configuration
       (company_id, configuration_type, configuration_key, configuration_value, description, updated_by)
     VALUES (?, 'payslip_layout', ?, ?, ?, ?)`,
    [currentCompanyId(), `layout_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`, metadata, `Uploaded payslip layout: ${layoutName}`, createdBy || null]
  );
  await logAdminAction({
    action: `Uploaded payslip layout ${layoutName}`,
    entityType: "payslip_layout",
    entityId: result.insertId,
    userId: createdBy
  });
  return result.insertId;
}

// FUNCTION: Atomically clears the old default and selects a new layout.
async function setDefaultPayslipLayout(layoutId) {
  await ensurePayrollConfigurationTable(pool);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      `SELECT configuration_id, configuration_value
       FROM payroll_configuration
       WHERE configuration_type = 'payslip_layout' AND company_id=?
       FOR UPDATE`
      ,[currentCompanyId()]
    );
    if (!rows.some((row) => Number(row.configuration_id) === Number(layoutId))) {
      await connection.rollback();
      return false;
    }
    for (const row of rows) {
      const metadata = parseJson(row.configuration_value, {});
      metadata.is_default = Number(row.configuration_id) === Number(layoutId);
      await connection.execute(
        `UPDATE payroll_configuration
         SET configuration_value = ?, updated_at = CURRENT_TIMESTAMP
         WHERE configuration_id = ? AND company_id=?`,
        [JSON.stringify(metadata), row.configuration_id, currentCompanyId()]
      );
    }
    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// FUNCTION: Returns current company payroll configuration rows.
async function listPayrollSettings() {
  return listStoredPayrollSettings();
}

// FUNCTION: Summarises which staff records meet configured MBMF eligibility.
async function listMbmfEligibilitySummary() {
  const companyId = currentCompanyId();
  const [[staffCount]] = await pool.execute(
    "SELECT COUNT(*) AS total FROM staff WHERE company_id=?", [companyId]
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
    FROM staff WHERE company_id=?`,
    [applicableReligion, applicableReligion, companyId]
  );
  return {
    hasReligionColumn: true,
    applicableReligion,
    totalStaff: summary.totalStaff || 0,
    eligibleMuslimEmployees: summary.eligibleMuslimEmployees || 0,
    nonEligibleEmployees: summary.nonEligibleEmployees || 0,
    sampleEmployees: []
  };
}

// FUNCTION: Inserts/updates a company payroll setting and records its audit evidence.
async function upsertPayrollSetting({ settingKey, settingValue, description, effectiveFrom, ruleCategory, usageType, isActive, updatedBy, ipAddress, deviceInfo }) {
  const previous = (await listStoredPayrollSettings()).find((setting) => setting.setting_key === settingKey);
  await upsertStoredPayrollSetting({ settingKey, settingValue, description, effectiveFrom, ruleCategory, usageType, isActive, updatedBy });
  await writeAuditLog({
    module: "Payroll", activityType: "Payroll Configuration", action: `Updated payroll setting: ${settingKey}`,
    entityId: settingKey, entityType: "payroll_setting", userId: updatedBy, status: "Success",
    ipAddress, deviceInfo,
    previousValue: previous ? JSON.stringify({ value: previous.setting_value, effectiveFrom: previous.effective_from }) : null,
    newValue: JSON.stringify({ value: settingValue, effectiveFrom: effectiveFrom || new Date().toISOString().slice(0, 10), ruleCategory, usageType, isActive: isActive !== false })
  });
}

// FUNCTION: Returns payroll runs for Admin monitoring without approval mutation.
async function listPayrollRuns() {
  const companyId = currentCompanyId();
  const [rows] = await pool.execute(
    `SELECT
      p.payroll_month,
      p.payroll_year,
      COALESCE(MAX(pr.status), MAX(p.run_status)) AS status,
      COALESCE(MAX(pr.created_at), MAX(p.run_created_at)) AS created_at,
      COALESCE(MAX(pr.updated_at), MAX(p.run_updated_at)) AS updated_at,
      COALESCE(MAX(pr.approved_at), MAX(p.run_approved_at)) AS approved_at,
      COALESCE(MAX(pr.payment_reference), MAX(p.payment_reference)) AS payment_reference,
      COALESCE(MAX(creator.name), 'System') AS created_by_name,
      COUNT(p.payroll_id) AS employee_count
    FROM payroll p
    LEFT JOIN payroll_run pr ON pr.payroll_run_id = p.payroll_run_id
    LEFT JOIN user creator ON creator.user_id = p.run_created_by
    WHERE p.company_id=?
    GROUP BY p.payroll_month, p.payroll_year
    ORDER BY p.payroll_year DESC, p.payroll_month DESC`
  , [companyId]);

  return rows;
}

// FUNCTION: Loads recent Payroll Admin audit events.
async function listAuditLogs() {
  const companyId = currentCompanyId();
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
    WHERE audit_logs.company_id=? AND audit_logs.module = 'Payroll'
    ORDER BY audit_logs.created_at DESC
    LIMIT 25`, [companyId]
  );

  return rows;
}

// FUNCTION: Aggregates recent Admin activity for dashboard trends.
async function listAdminActivityTrends() {
  const companyId = currentCompanyId();
  const [rows] = await pool.execute(
    `SELECT
      YEAR(created_at) AS activity_year,
      MONTH(created_at) AS activity_month,
      COUNT(*) AS event_count
    FROM audit_logs
    WHERE company_id=? AND created_at >= DATE_SUB(DATE_FORMAT(CURRENT_DATE, '%Y-%m-01'), INTERVAL 5 MONTH)
    GROUP BY YEAR(created_at), MONTH(created_at)
    ORDER BY activity_year, activity_month`, [companyId]
  );

  return rows;
}

// FUNCTION: Groups audit events into requested date buckets.
async function listAuditActivityInsight({ from, to, granularity }) {
  const companyId = currentCompanyId();
  const bucketSql = {
    day: "DATE_FORMAT(created_at, '%Y-%m-%d')",
    week: "DATE_FORMAT(DATE_SUB(created_at, INTERVAL WEEKDAY(created_at) DAY), '%Y-%m-%d')",
    month: "DATE_FORMAT(created_at, '%Y-%m-01')"
  }[granularity];
  const [rows] = await pool.execute(
    `SELECT ${bucketSql} AS bucket, COUNT(*) AS event_count
     FROM audit_logs
     WHERE company_id=? AND module='Payroll'
       AND created_at >= ? AND created_at < DATE_ADD(?, INTERVAL 1 DAY)
     GROUP BY ${bucketSql}
     ORDER BY bucket`,
    [companyId, from, to]
  );
  return rows;
}

// FUNCTION: Counts payroll users by role for access-governance reporting.
async function listUserRoleInsight({ accountStatus = "all" } = {}) {
  const companyId = currentCompanyId();
  const statusClauses = {
    active: "u.status = 1",
    pending: "COALESCE(ar.has_pending, 0) = 1",
    disabled: "u.status <> 1 AND COALESCE(ar.has_pending, 0) = 0"
  };
  const statusWhere = statusClauses[accountStatus] ? ` AND ${statusClauses[accountStatus]}` : "";
  const [rows] = await pool.execute(
    `SELECT COALESCE(NULLIF(TRIM(u.role_name), ''), 'Unassigned') AS role_name,
            COUNT(*) AS user_count
     FROM user u
     LEFT JOIN (
       SELECT company_id, user_id, MAX(status = 'pending') AS has_pending
       FROM account_action_requests
       WHERE request_type = 'user_activation'
       GROUP BY company_id, user_id
     ) ar ON ar.user_id = u.user_id AND ar.company_id = u.company_id
     WHERE u.company_id=?${statusWhere}
     GROUP BY COALESCE(NULLIF(TRIM(u.role_name), ''), 'Unassigned')
     ORDER BY role_name`,
    [companyId]
  );
  return rows;
}

// FUNCTION: Counts active/inactive users, optionally filtered by role.
async function listAccountStatusInsight({ role = "all" } = {}) {
  const companyId = currentCompanyId();
  const params = [companyId];
  const roleWhere = role !== "all" ? " AND u.role_name = ?" : "";
  if (role !== "all") params.push(role);
  const [[accountCounts]] = await pool.execute(
    `SELECT
       SUM(CASE WHEN u.status = 1 THEN 1 ELSE 0 END) AS active_count,
       SUM(CASE WHEN u.status <> 1 AND COALESCE(ar.has_pending, 0) = 1 THEN 1 ELSE 0 END) AS pending_count,
       SUM(CASE WHEN u.status <> 1 AND COALESCE(ar.has_pending, 0) = 0 THEN 1 ELSE 0 END) AS disabled_count
     FROM user u
     LEFT JOIN (
       SELECT company_id, user_id, MAX(status = 'pending') AS has_pending
       FROM account_action_requests
       WHERE request_type = 'user_activation'
       GROUP BY company_id, user_id
     ) ar ON ar.user_id = u.user_id AND ar.company_id = u.company_id
     WHERE u.company_id=?${roleWhere}`,
    params
  );
  let unlinkedCount = 0;
  if (role === "all") {
    const [[unlinked]] = await pool.execute(
      "SELECT COUNT(*) AS total FROM staff WHERE user_user_id IS NULL AND company_id=?",
      [companyId]
    );
    unlinkedCount = Number(unlinked.total || 0);
  }
  return [
    { status: "Active", user_count: Number(accountCounts.active_count || 0) },
    { status: "Pending", user_count: Number(accountCounts.pending_count || 0) },
    { status: "Disabled", user_count: Number(accountCounts.disabled_count || 0) },
    { status: "Unlinked", user_count: unlinkedCount }
  ];
}

function payrollRunHealth(run, now = Date.now()) {
  const status = String(run.status || "Draft").toLowerCase();
  if (["failed", "error", "rejected"].some((value) => status.includes(value))) return "Failed";
  if (["payment processed", "payslips sent", "reconciled", "closed", "completed", "success"].some((value) => status.includes(value))) return "Completed";
  const activity = new Date(run.updated_at || run.created_at || 0).getTime();
  if (Number.isFinite(activity) && now - activity > 48 * 60 * 60 * 1000) return "Delayed";
  return "In Progress";
}

// FUNCTION: Classifies payroll runs as healthy, attention-required or delayed.
async function listRunHealthInsight({ from, to }) {
  const runs = await listPayrollRuns();
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T23:59:59`);
  const buckets = new Map();
  runs.forEach((run) => {
    const date = new Date(Number(run.payroll_year), Number(run.payroll_month) - 1, 1);
    if (date < start || date > end) return;
    const bucket = `${run.payroll_year}-${String(run.payroll_month).padStart(2, "0")}-01`;
    const counts = buckets.get(bucket) || { Completed: 0, "In Progress": 0, Delayed: 0, Failed: 0 };
    counts[payrollRunHealth(run)] += 1;
    buckets.set(bucket, counts);
  });
  return [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([bucket, counts]) => ({ bucket, ...counts }));
}

// FUNCTION: Returns payroll users with their assigned role/permission details.
async function listUsersWithRoles() {
  const companyId = currentCompanyId();
  const [counts] = await pool.execute(
    `SELECT role_name, COUNT(*) AS user_count
     FROM user WHERE company_id=?
     GROUP BY role_name`, [companyId]
  );
  const countByRole = Object.fromEntries(counts.map((row) => [row.role_name, Number(row.user_count)]));
  return Object.entries(ROLE_NAMES).map(([roleId, roleName]) => ({
    role_id: Number(roleId),
    role_name: roleName,
    description: `${roleName} payroll access`,
    user_count: countByRole[roleName] || 0
  }));
}

// FUNCTION: Finds staff profiles not yet linked to a user account.
async function listAvailableStaffForUserCreation() {
  const companyId = currentCompanyId();
  const [rows] = await pool.execute(
    `SELECT
      staff.employee_id,
      staff.name,
      staff.email,
      staff.status,
      NULL AS department_id,
      staff.department_name
    FROM staff
    WHERE staff.user_user_id IS NULL AND staff.company_id=?
    ORDER BY staff.name`, [companyId]
  );

  return rows;
}

async function listUsers() {
  const companyId = currentCompanyId();
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
      staff.status AS staff_status,
      NULL AS department_id,
      staff.department_name
    FROM user
    LEFT JOIN staff ON staff.user_user_id = user.user_id AND staff.company_id=user.company_id
    WHERE user.company_id=?
    ORDER BY user.name`, [companyId]
  );

  return rows;
}

// FUNCTION: Creates and optionally links a company-scoped payroll user transactionally.
async function createUserAccount({ email, name, passwordHash, roleId, status, staffEmployeeId, adminUserId }) {
  const companyId = currentCompanyId();
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
        "SELECT employee_id, user_user_id FROM staff WHERE employee_id = ? AND company_id=?",
        [staffEmployeeId, companyId]
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
      `INSERT INTO user (company_id, email, name, password, status, role_name)
      VALUES (?, ?, ?, ?, ?, ?)`,
      [companyId, email, name, passwordHash, status, roleName]
    );
    const userId = result.insertId;

    if (staff) {
      await connection.execute(
        "UPDATE staff SET user_user_id = ? WHERE employee_id = ? AND company_id=?",
        [userId, staff.employee_id, companyId]
      );
    } else {
      await connection.execute(
        "UPDATE staff SET user_user_id = ? WHERE user_user_id IS NULL AND email = ? AND company_id=?",
        [userId, email, companyId]
      );
    }

    await writeAuditLog({ connection, module: "Payroll", activityType: "User Management", action: "Created user account", entityId: userId, entityType: "user", userId: adminUserId, status: "Success", newValue: JSON.stringify({ roleName, status }) });

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
  const companyId = currentCompanyId();
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
    WHERE user.user_id = ? AND user.company_id=?`,
    [userId, companyId]
  );

  return rows[0] || null;
}

// FUNCTION: Persists an Admin-authorised account status change.
async function updateUserStatus({ userId, status, adminUserId }) {
  const companyId = currentCompanyId();
  const [result] = await pool.execute(
    `UPDATE user SET status = ?,
       failed_login_attempts = IF(? = 1, 0, failed_login_attempts),
       account_locked_at = IF(? = 1, NULL, account_locked_at),
       account_lock_reason = IF(? = 1, NULL, account_lock_reason)
     WHERE user_id = ? AND company_id=?`,
    [status, status, status, status, userId, companyId]
  );

  if (result.affectedRows > 0) {
    await logAdminAction({
      action: status === 1 ? "Activated or reactivated user account" : "Deactivated user account",
      entityType: "user",
      entityId: userId,
      userId: adminUserId
    });
  }

  return result.affectedRows > 0;
}

// FUNCTION: Persists an Admin-authorised role change.
async function updateUserRole({ userId, roleId, adminUserId }) {
  const companyId = currentCompanyId();
  const roleName = ROLE_NAMES[roleId];
  if (!roleName) return false;
  const [result] = await pool.execute(
    "UPDATE user SET role_name = ? WHERE user_id = ? AND company_id=?",
    [roleName, userId, companyId]
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

// FUNCTION: Stores the new password hash for an Admin reset operation.
async function updateUserPassword({ userId, passwordHash, adminUserId }) {
  const companyId = currentCompanyId();
  const [result] = await pool.execute(
    "UPDATE user SET password = ?, must_change_password = 1 WHERE user_id = ? AND company_id=?",
    [passwordHash, userId, companyId]
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
  isReportableStatutorySetting,
  listAccountStatusInsight,
  listAdminActivityTrends,
  listAuditActivityInsight,
  listAuditLogs,
  listAvailableStaffForUserCreation,
  listMbmfEligibilitySummary,
  listPayrollRuns,
  listRunHealthInsight,
  listPayrollSettings,
  listPayslipLayouts,
  listUsers,
  listUserRoleInsight,
  listUsersWithRoles,
  setDefaultPayslipLayout,
  updateUserPassword,
  updateUserRole,
  updateUserStatus,
  upsertPayrollSetting
};
