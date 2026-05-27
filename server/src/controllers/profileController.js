const { pool } = require("../config/db");

async function ensureProfileTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS staff_profile (
      profile_id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL UNIQUE,
      salary DECIMAL(12,2) DEFAULT 0.00,
      ssn VARCHAR(64),
      date_of_birth DATE,
      department VARCHAR(100),
      FOREIGN KEY (user_id) REFERENCES user(user_id) ON DELETE CASCADE
    )
  `);
}

async function getProfileByUserId(req, res) {
  const { userId } = req.params;

  try {
    await ensureProfileTable();

    const [rows] = await pool.query(
      `SELECT sp.profile_id, sp.user_id, sp.salary, sp.ssn, sp.date_of_birth, sp.department, u.name, u.email
       FROM staff_profile sp
       JOIN user u ON sp.user_id = u.user_id
       WHERE sp.user_id = ?`,
      [userId]
    );

    if (rows.length === 0) {
      // If profile not found, try to return base user info
      const [users] = await pool.query('SELECT user_id, name, email FROM user WHERE user_id = ?', [userId]);
      if (users.length === 0) {
        return res.status(404).json({ message: 'User not found' });
      }

      const user = users[0];
      return res.json({ profile_id: null, user_id: user.user_id, name: user.name, email: user.email, salary: null, ssn: null, date_of_birth: null, department: null });
    }

    return res.json(rows[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to fetch profile' });
  }
}

async function upsertProfileByUserId(req, res) {
  const { userId } = req.params;
  const { salary, ssn, date_of_birth, department, name, email } = req.body;

  try {
    await ensureProfileTable();

    // Update user basic info if provided
    if (typeof name !== 'undefined' || typeof email !== 'undefined') {
      await pool.query('UPDATE user SET name = COALESCE(?, name), email = COALESCE(?, email) WHERE user_id = ?', [name, email, userId]);
    }

    const [existing] = await pool.query('SELECT profile_id FROM staff_profile WHERE user_id = ?', [userId]);

    if (existing.length === 0) {
      await pool.query('INSERT INTO staff_profile (user_id, salary, ssn, date_of_birth, department) VALUES (?,?,?,?,?)', [userId, salary || 0, ssn || null, date_of_birth || null, department || null]);
    } else {
      await pool.query('UPDATE staff_profile SET salary = ?, ssn = ?, date_of_birth = ?, department = ? WHERE user_id = ?', [salary || 0, ssn || null, date_of_birth || null, department || null, userId]);
    }

    const [rows] = await pool.query(
      `SELECT sp.profile_id, sp.user_id, sp.salary, sp.ssn, sp.date_of_birth, sp.department, u.name, u.email
       FROM staff_profile sp
       JOIN user u ON sp.user_id = u.user_id
       WHERE sp.user_id = ?`,
      [userId]
    );

    return res.json(rows[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to save profile' });
  }
}

module.exports = {
  getProfileByUserId,
  upsertProfileByUserId
};
