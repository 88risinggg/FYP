const { pool } = require("../config/db");

const userSelect = `
  SELECT
    user.user_id AS userId,
    user.name,
    user.email,
    user.status,
    user.created_at AS createdAt,
    user.updated_at AS updatedAt,
    role.role_id AS roleId,
    role.role_name AS roleName
  FROM user
  JOIN role ON user.role_id = role.role_id
`;

async function getRoles() {
  const [rows] = await pool.execute(
    "SELECT role_id AS roleId, role_name AS roleName FROM role ORDER BY role_id"
  );

  return rows;
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
  const [rows] = await pool.execute(
    `${userSelect} WHERE LOWER(user.email) = LOWER(?)`,
    [email]
  );

  return rows[0] || null;
}

async function listUsers({ search, roleId, status }) {
  const where = [];
  const params = [];

  if (search) {
    where.push("(user.name LIKE ? OR user.email LIKE ?)");
    params.push(`%${search}%`, `%${search}%`);
  }

  if (roleId) {
    where.push("user.role_id = ?");
    params.push(roleId);
  }

  if (status === "0" || status === "1") {
    where.push("user.status = ?");
    params.push(Number(status));
  }

  const whereSql = where.length ? ` WHERE ${where.join(" AND ")}` : "";
  const [rows] = await pool.execute(
    `${userSelect}${whereSql} ORDER BY user.created_at DESC, user.user_id DESC`,
    params
  );

  return rows;
}

async function createUser({ name, email, passwordHash, roleId, status }) {
  const [result] = await pool.execute(
    `INSERT INTO user (name, email, password, role_id, status)
     VALUES (?, ?, ?, ?, ?)`,
    [name, email, passwordHash, roleId, status]
  );

  return findUserById(result.insertId);
}

async function updateUser(userId, { name, email, roleId, status }) {
  await pool.execute(
    `UPDATE user
     SET name = ?, email = ?, role_id = ?, status = ?
     WHERE user_id = ?`,
    [name, email, roleId, status, userId]
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
  createUser,
  findRoleById,
  findUserByEmail,
  findUserById,
  getRoles,
  listUsers,
  updateUser,
  updateUserPassword,
  updateUserStatus
};
