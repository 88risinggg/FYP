const { pool } = require("../config/db");

const loginAuditSelect = `
  COALESCE(
    (
      SELECT MAX(audit_logs.created_at)
      FROM audit_logs
      WHERE audit_logs.user_id = user.user_id
        AND audit_logs.activity_type = 'Login'
        AND audit_logs.status = 'Success'
    ),
    (
      SELECT MAX(audit_log.created_at)
      FROM audit_log
      WHERE audit_log.user_user_id = user.user_id
        AND COALESCE(audit_log.activity_type, audit_log.entity_type) = 'Login'
        AND (audit_log.status = 'Success' OR audit_log.status IS NULL)
    )
  )
`;

const userSelect = `
  SELECT
    user.user_id AS userId,
    user.name,
    user.email,
    user.status,
    user.created_at AS createdAt,
    user.updated_at AS updatedAt,
    role.role_id AS roleId,
    role.role_name AS roleName,
    role.description AS roleDescription,
    staff.employee_id AS employeeId,
    staff.department_id AS departmentId,
    COALESCE(department.department_name, staff_profile.department) AS departmentName,
    ${loginAuditSelect} AS lastLogin
  FROM user
  JOIN role ON user.role_id = role.role_id
  LEFT JOIN staff ON staff.user_user_id = user.user_id
  LEFT JOIN department ON staff.department_id = department.department_id
  LEFT JOIN staff_profile ON staff_profile.user_id = user.user_id
`;

function buildUserFilters({ search, roleId, departmentId, status, lastActiveFrom } = {}) {
  const where = [];
  const params = [];

  if (search) {
    where.push("(user.name LIKE ? OR user.email LIKE ?)");
    params.push(`%${search}%`, `%${search}%`);
  }

  if (roleId) {
    where.push("user.role_id = ?");
    params.push(Number(roleId));
  }

  if (departmentId) {
    if (String(departmentId).startsWith("profile:")) {
      where.push("staff_profile.department = ?");
      params.push(String(departmentId).replace(/^profile:/, ""));
    } else {
      where.push("staff.department_id = ?");
      params.push(Number(departmentId));
    }
  }

  if (status !== undefined && status !== null && status !== "") {
    where.push("user.status = ?");
    params.push(Number(status));
  }

  if (lastActiveFrom) {
    where.push(`${loginAuditSelect} >= ?`);
    params.push(lastActiveFrom);
  }

  return {
    whereSql: where.length ? ` WHERE ${where.join(" AND ")}` : "",
    params
  };
}

async function getRoles() {
  const [rows] = await pool.execute(
    `SELECT
      role_id AS roleId,
      role_name AS roleName,
      description
     FROM role
     ORDER BY role_id`
  );

  return rows;
}

async function getDepartments() {
  const [departments] = await pool.execute(
    `SELECT
      department_id AS departmentId,
      department_name AS departmentName
     FROM department
     ORDER BY department_name`
  );
  const [profileDepartments] = await pool.execute(
    `SELECT DISTINCT department AS departmentName
     FROM staff_profile
     WHERE department IS NOT NULL AND department <> ''
     ORDER BY department`
  );
  const existingNames = new Set(departments.map((item) => item.departmentName));
  const profileOnly = profileDepartments
    .filter((item) => !existingNames.has(item.departmentName))
    .map((item) => ({
      departmentId: `profile:${item.departmentName}`,
      departmentName: item.departmentName
    }));

  return [...departments, ...profileOnly];
}

async function getStatusOptions() {
  const [rows] = await pool.execute(
    "SELECT DISTINCT status FROM user ORDER BY status DESC"
  );

  return rows.map((row) => Number(row.status));
}

async function findRoleById(roleId) {
  const [rows] = await pool.execute(
    "SELECT role_id AS roleId, role_name AS roleName FROM role WHERE role_id = ?",
    [roleId]
  );

  return rows[0] || null;
}

async function findUserById(userId) {
  const [rows] = await pool.execute(`${userSelect} WHERE user.user_id = ?`, [userId]);

  return rows[0] || null;
}

async function findUserByEmail(email) {
  const [rows] = await pool.execute(`${userSelect} WHERE LOWER(user.email) = LOWER(?)`, [email]);

  return rows[0] || null;
}

async function countUsers(filters = {}) {
  const { whereSql, params } = buildUserFilters(filters);
  const [rows] = await pool.execute(
    `SELECT COUNT(DISTINCT user.user_id) AS total
     FROM user
     JOIN role ON user.role_id = role.role_id
     LEFT JOIN staff ON staff.user_user_id = user.user_id
     LEFT JOIN department ON staff.department_id = department.department_id
     LEFT JOIN staff_profile ON staff_profile.user_id = user.user_id
     ${whereSql}`,
    params
  );

  return Number(rows[0]?.total || 0);
}

async function listUsers(filters = {}) {
  const page = Math.max(Number(filters.page || 1), 1);
  const pageSize = Math.min(Math.max(Number(filters.pageSize || 10), 1), 50);
  const offset = (page - 1) * pageSize;
  const { whereSql, params } = buildUserFilters(filters);
  const [rows] = await pool.execute(
    `${userSelect}
     ${whereSql}
     ORDER BY user.created_at DESC, user.user_id DESC
     LIMIT ${pageSize} OFFSET ${offset}`,
    params
  );

  return {
    users: rows,
    pagination: {
      page,
      pageSize,
      total: await countUsers(filters),
      totalPages: 0
    }
  };
}

async function getUserSummary() {
  const [rows] = await pool.execute(
    `SELECT
      COUNT(*) AS totalUsers,
      SUM(status = 1) AS activeUsers,
      SUM(status = 2) AS pendingInvitations,
      SUM(status = 0) AS suspendedAccounts
     FROM user`
  );

  return {
    totalUsers: Number(rows[0]?.totalUsers || 0),
    activeUsers: Number(rows[0]?.activeUsers || 0),
    pendingInvitations: Number(rows[0]?.pendingInvitations || 0),
    suspendedAccounts: Number(rows[0]?.suspendedAccounts || 0)
  };
}

async function getRoleDistribution() {
  const [rows] = await pool.execute(
    `SELECT
      role.role_id AS roleId,
      role.role_name AS roleName,
      COUNT(user.user_id) AS userCount
     FROM role
     LEFT JOIN user ON user.role_id = role.role_id
     GROUP BY role.role_id, role.role_name
     ORDER BY role.role_id`
  );

  return rows.map((row) => ({
    roleId: row.roleId,
    roleName: row.roleName,
    userCount: Number(row.userCount || 0)
  }));
}

async function listUserActivity({ limit = 6, userId = null } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit || 6), 1), 50);
  const params = [];
  const where = ["activity_type = 'User Management'"];

  if (userId) {
    where.push("(user_id = ? OR affected_record = ?)");
    params.push(Number(userId), String(userId));
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

async function createUser({ name, email, passwordHash, roleId, status, departmentId }) {
  const [result] = await pool.execute(
    `INSERT INTO user (name, email, password, role_id, status)
     VALUES (?, ?, ?, ?, ?)`,
    [name, email, passwordHash, roleId, status]
  );

  if (departmentId && !String(departmentId).startsWith("profile:")) {
    await pool.execute(
      `INSERT INTO staff (name, email, department_id, user_user_id, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
      [name, email, Number(departmentId), result.insertId, status]
    );
  }

  return findUserById(result.insertId);
}

async function updateUser(userId, { name, email, roleId, status, departmentId }) {
  await pool.execute(
    `UPDATE user
     SET name = ?, email = ?, role_id = ?, status = ?
     WHERE user_id = ?`,
    [name, email, roleId, status, userId]
  );

  const [staffRows] = await pool.execute(
    "SELECT employee_id AS employeeId FROM staff WHERE user_user_id = ? LIMIT 1",
    [userId]
  );

  if (staffRows[0]) {
    await pool.execute(
      `UPDATE staff
       SET name = ?, email = ?, department_id = ?, status = ?, updated_at = NOW()
       WHERE user_user_id = ?`,
      [
        name,
        email,
        departmentId && !String(departmentId).startsWith("profile:") ? Number(departmentId) : null,
        status,
        userId
      ]
    );
  } else if (departmentId && !String(departmentId).startsWith("profile:")) {
    await pool.execute(
      `INSERT INTO staff (name, email, department_id, user_user_id, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
      [name, email, Number(departmentId), userId, status]
    );
  }

  return findUserById(userId);
}

async function updateUserStatus(userId, status) {
  await pool.execute("UPDATE user SET status = ? WHERE user_id = ?", [status, userId]);
  await pool.execute("UPDATE staff SET status = ?, updated_at = NOW() WHERE user_user_id = ?", [
    status,
    userId
  ]);

  return findUserById(userId);
}

async function updateUserPassword(userId, passwordHash) {
  await pool.execute("UPDATE user SET password = ? WHERE user_id = ?", [passwordHash, userId]);

  return findUserById(userId);
}

module.exports = {
  createUser,
  findRoleById,
  findUserByEmail,
  findUserById,
  getDepartments,
  getRoleDistribution,
  getRoles,
  getStatusOptions,
  getUserSummary,
  listUserActivity,
  listUsers,
  updateUser,
  updateUserPassword,
  updateUserStatus
};
