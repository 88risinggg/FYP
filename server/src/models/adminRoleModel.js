/**
 * EVALUATION HEADER
 * FEATURE: SECURITY / ACCESS
 * PURPOSE: Reads and writes admin Role Model data in the database.
 * LAYER: Backend model - contains database queries and persistence operations.
 * FIND RELATED CODE: Use Find All References to locate the controller/service that requests this data.
 */
const { pool } = require("../config/db");

const allowedRoleNames = ["Admin", "Finance", "HR", "Staff"];

const roleSeeds = {
  Admin: {
    description: "Manages users, roles, settings, and audit logs.",
    accessLevel: "Full Access",
    keyModules: ["User Management", "Audit Logs", "Reports", "Settings"]
  },
  Finance: {
    description: "Manages invoices, payments, and financial reports.",
    accessLevel: "High Access",
    keyModules: ["Invoicing", "Payments", "Reports"]
  },
  HR: {
    description: "Manages payroll and employee payroll data.",
    accessLevel: "Moderate Access",
    keyModules: ["Payroll", "Employee Data", "Reports"]
  },
  Staff: {
    description: "Limited access. Can view assigned information or own payslip.",
    accessLevel: "Limited Access",
    keyModules: ["Payroll", "Profile / Own Payslip"]
  }
};

async function ensureRolePermissionConfig() {
  // Disabled - role_permission_config removed from 11-table schema
}

function parseModules(value) {
  if (!value) return [];

  if (Array.isArray(value)) return value;

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function formatRole(row) {
  return {
    roleId: row.roleId,
    roleName: row.roleName,
    description: row.description,
    assignedUsers: Number(row.assignedUsers || 0),
    accessLevel: row.accessLevel,
    keyModules: parseModules(row.keyModules),
    permissionCount: Number(row.permissionCount || 0),
    isActive: Number(row.isActive) === 1,
    statusLabel: Number(row.isActive) === 1 ? "Active" : "Inactive",
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function buildRoleFilters({ search, status, accessLevel } = {}) {
  const where = [`role.role_name IN (${allowedRoleNames.map(() => "?").join(", ")})`];
  const params = [...allowedRoleNames];

  if (search) {
    where.push(
      "(role.role_name LIKE ? OR role_permission_config.role_description LIKE ? OR role_permission_config.key_modules_json LIKE ?)"
    );
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  if (status !== undefined && status !== null && status !== "") {
    where.push("role_permission_config.is_active = ?");
    params.push(Number(status));
  }

  if (accessLevel) {
    where.push("role_permission_config.access_level = ?");
    params.push(accessLevel);
  }

  return {
    whereSql: `WHERE ${where.join(" AND ")}`,
    params
  };
}

async function listRoles(filters = {}) {
  await ensureRolePermissionConfig();

  const { whereSql, params } = buildRoleFilters(filters);
  const sortDirection = String(filters.sort || "asc").toLowerCase() === "desc" ? "DESC" : "ASC";
  const [rows] = await pool.execute(
    `SELECT
      role.role_id AS roleId,
      role.role_name AS roleName,
      role_permission_config.role_description AS description,
      role_permission_config.access_level AS accessLevel,
      role_permission_config.key_modules_json AS keyModules,
      role_permission_config.permission_count AS permissionCount,
      role_permission_config.is_active AS isActive,
      role.created_at AS createdAt,
      role_permission_config.updated_at AS updatedAt,
      COUNT(user.user_id) AS assignedUsers
     FROM role
     JOIN role_permission_config ON role_permission_config.role_id = role.role_id
     LEFT JOIN user ON user.role_id = role.role_id
     ${whereSql}
     GROUP BY
      role.role_id,
      role.role_name,
      role_permission_config.role_description,
      role_permission_config.access_level,
      role_permission_config.key_modules_json,
      role_permission_config.permission_count,
      role_permission_config.is_active,
      role.created_at,
      role_permission_config.updated_at
     ORDER BY CAST(role.role_name AS CHAR) ${sortDirection}`,
    params
  );

  return rows.map(formatRole);
}

async function getRoleById(roleId) {
  await ensureRolePermissionConfig();

  const [rows] = await pool.execute(
    `SELECT
      role.role_id AS roleId,
      role.role_name AS roleName,
      role_permission_config.role_description AS description,
      role_permission_config.access_level AS accessLevel,
      role_permission_config.key_modules_json AS keyModules,
      role_permission_config.permission_count AS permissionCount,
      role_permission_config.is_active AS isActive,
      role.created_at AS createdAt,
      role_permission_config.updated_at AS updatedAt,
      COUNT(user.user_id) AS assignedUsers
     FROM role
     JOIN role_permission_config ON role_permission_config.role_id = role.role_id
     LEFT JOIN user ON user.role_id = role.role_id
     WHERE role.role_id = ?
       AND role.role_name IN (${allowedRoleNames.map(() => "?").join(", ")})
     GROUP BY
      role.role_id,
      role.role_name,
      role_permission_config.role_description,
      role_permission_config.access_level,
      role_permission_config.key_modules_json,
      role_permission_config.permission_count,
      role_permission_config.is_active,
      role.created_at,
      role_permission_config.updated_at`,
    [Number(roleId), ...allowedRoleNames]
  );

  return rows[0] ? formatRole(rows[0]) : null;
}

async function getRolesSummary() {
  const roles = await listRoles({});

  return {
    totalRoles: roles.length,
    assignedUsers: roles.reduce((sum, role) => sum + role.assignedUsers, 0),
    activeRoles: roles.filter((role) => role.isActive).length,
    permissions: roles.reduce((sum, role) => sum + role.permissionCount, 0)
  };
}

async function getRoleDistribution() {
  return listRoles({ sort: "asc" });
}

async function getRoleOptions() {
  await ensureRolePermissionConfig();

  const [accessLevels] = await pool.execute(
    `SELECT DISTINCT access_level AS accessLevel
     FROM role_permission_config
     ORDER BY access_level`
  );
  return {
    accessLevels: accessLevels.map((row) => row.accessLevel),
    statuses: [
      { value: 1, label: "Active" },
      { value: 0, label: "Inactive" }
    ],
    sortOptions: [
      { value: "asc", label: "Role Name A-Z" },
      { value: "desc", label: "Role Name Z-A" }
    ]
  };
}

async function listRoleActivity({ limit = 5, roleId = null } = {}) {
  const { currentCompanyId } = require("../services/tenantContext");
  const safeLimit = Math.min(Math.max(Number(limit || 5), 1), 50);
  const params = [currentCompanyId()];
  const where = ["company_id = ?", "activity_type = 'Role Management'"];

  if (roleId) {
    where.push("affected_record = ?");
    params.push(String(roleId));
  }

  const [rows] = await pool.execute(
    `SELECT
      audit_log_id AS id,
      user_id AS actorId,
      user_name AS actorName,
      action_description AS actionDescription,
      affected_record AS affectedRecord,
      status,
      created_at AS createdAt
     FROM audit_logs
     WHERE ${where.join(" AND ")}
     ORDER BY created_at DESC, audit_log_id DESC
     LIMIT ${safeLimit}`,
    params
  );

  return rows;
}

async function deactivateRole(roleId) {
  await ensureRolePermissionConfig();
  await pool.execute(
    `UPDATE role_permission_config
     SET is_active = 0
     WHERE role_id = ?`,
    [Number(roleId)]
  );

  return getRoleById(roleId);
}

async function duplicateRole(roleId) {
  return getRoleById(roleId);
}

module.exports = {
  deactivateRole,
  duplicateRole,
  getRoleById,
  getRoleDistribution,
  getRoleOptions,
  getRolesSummary,
  listRoleActivity,
  listRoles
};
