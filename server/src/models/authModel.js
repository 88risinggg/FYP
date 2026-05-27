const { pool } = require("../config/db");

async function findUserByEmail(email) {
  const [rows] = await pool.execute(
    `SELECT
      user.user_id,
      user.email,
      user.name,
      user.password,
      user.status,
      role.role_name
    FROM user
    JOIN role ON user.role_id = role.role_id
    WHERE user.email = ?`,
    [email]
  );

  return rows[0] || null;
}

module.exports = {
  findUserByEmail
};

