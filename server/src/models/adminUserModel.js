const { pool } = require("../config/db");

const allowedRoleNames = ["Admin", "Finance", "HR", "Staff"];

const userSelect = `
  SELECT
    user.user_id AS userId,
    user.name,
    user.email,
    user.status,
    user.created_at AS createdAt,
    user.updated_at AS updatedAt,
    user.role_name AS roleName
  FROM user
`;

async function getRoles() {
  // Return static role list since roles are stored inline in user.role_name
  return allowedRoleNames.map((name, idx) => ({ roleId: idx + 1, roleName: name }));
}

async function findRoleById(roleId) {
  const roleName = allowedRoleNames[roleId - 1];
  if (!roleName) return null;
  return { roleId, roleName };
}

async function findRoleByName(roleName) {
  const idx = allowedRoleNames.indexOf(roleName);
  if (idx === -1) return null;
  return { roleId: idx + 1, roleName };
}

async function findUserById(userId) {
  const [rows] = await pool.execute(`${userSelect} WHERE user.user_id = ?`, [userId]);
  return rows[0] || null;
}

async function findUserByEmail(email) {
  const [rows] = await pool.execute(
    `${userSelect} WHERE LOWER(user.email) = LOWER(?)`,
    [email]
  );
  return rows[0] || null;
}

async function listUsers({ search, roleId, status }) {
  const where = [];
  const params = [];
  const hasSearch = Boolean(search);

  if (hasSearch) {
    where.push("LOWER(user.email) LIKE LOWER(?)");
    params.push(`${search}%`);
  }

  if (roleId) {
    // Map roleId to role_name
    const roleName = allowedRoleNames[roleId - 1];
    if (roleName) {
      where.push("user.role_name = ?");
      params.push(roleName);
    }
  }

  if (status === "0" || status === "1") {
    where.push("user.status = ?");
    params.push(Number(status));
  }

  const whereSql = where.length ? ` WHERE ${where.join(" AND ")}` : "";
  const orderSql = hasSearch
    ? "ORDER BY LOWER(user.name) ASC, LOWER(user.email) ASC, user.user_id DESC"
    : "ORDER BY user.created_at DESC, user.user_id DESC";
  const [rows] = await pool.execute(
    `${userSelect}${whereSql} ${orderSql}`,
    params
  );

  return rows;
}

async function createUser({ name, email, passwordHash, roleId, status }) {
  const roleName = allowedRoleNames[roleId - 1] || "Staff";
  const [result] = await pool.execute(
    `INSERT INTO user (name, email, password, role_name, status)
     VALUES (?, ?, ?, ?, ?)`,
    [name, email, passwordHash, roleName, status]
  );

  return findUserById(result.insertId);
}

async function updateUser(userId, { name, email, roleId, status }) {
  const roleName = allowedRoleNames[roleId - 1] || "Staff";
  await pool.execute(
    `UPDATE user
     SET name = ?, email = ?, role_name = ?, status = ?
     WHERE user_id = ?`,
    [name, email, roleName, status, userId]
  );

  return findUserById(userId);
}

async function updateUserStatus(userId, status) {
  await pool.execute("UPDATE user SET status = ? WHERE user_id = ?", [status, userId]);
  return findUserById(userId);
}

async function updateUserPassword(userId, passwordHash) {
  await pool.execute("UPDATE user SET password = ? WHERE user_id = ?", [passwordHash, userId]);
  return findUserById(userId);
}

module.exports = {
  allowedRoleNames,
  createUser,
  findRoleById,
  findRoleByName,
  findUserByEmail,
  findUserById,
  getRoles,
  listUsers,
  updateUser,
  updateUserPassword,
  updateUserStatus
};
