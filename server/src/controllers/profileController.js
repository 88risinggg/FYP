const { pool } = require("../config/db");

/* ─── CREATE ─── */

/**
 * POST /api/profile
 * Create a new staff profile. Only Admin/HR can create.
 */
async function createProfile(req, res) {
  const role = req.user.role;
  if (role !== "Admin" && role !== "HR") {
    return res.status(403).json({ message: "Access denied" });
  }

  const {
    user_user_id, employee_code, name, date_of_birth, email,
    phone, address, department_id, hire_date, status,
    race, religion, base_salary, bank, account_no
  } = req.body;

  if (!user_user_id || !name || !email) {
    return res.status(400).json({ message: "user_user_id, name, and email are required" });
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO staff (user_user_id, employee_code, name, date_of_birth, email, phone, address, department_id, hire_date, status, race, religion, base_salary, bank, account_no)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user_user_id, employee_code || null, name, date_of_birth || null, email,
        phone || null, address || null, department_id || null,
        hire_date || null, status ?? 1, race || null, religion || null,
        base_salary || 0, bank || null, account_no || null
      ]
    );

    const [rows] = await pool.query(
      `SELECT s.*, d.department_name AS department
       FROM staff s
       LEFT JOIN department d ON s.department_id = d.department_id
       WHERE s.employee_id = ?`,
      [result.insertId]
    );

    return res.status(201).json(rows[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to create profile" });
  }
}

/* ─── READ ─── */

/**
 * GET /api/profile/:userId
 * Get a staff profile by user ID.
 */
async function getProfileByUserId(req, res) {
  const { userId } = req.params;

  // Staff can only view their own profile
  if (req.user.role === "Staff" && String(req.user.userId) !== String(userId)) {
    return res.status(403).json({ message: "Access denied" });
  }

  try {
    const [rows] = await pool.query(
      `SELECT
        s.employee_id,
        s.employee_code,
        s.name,
        s.date_of_birth,
        s.email,
        s.phone,
        s.address,
        s.hire_date,
        s.status,
        s.race,
        s.religion,
        s.base_salary AS salary,
        s.bank,
        s.account_no,
        d.department_name AS department
       FROM staff s
       LEFT JOIN department d ON s.department_id = d.department_id
       WHERE s.user_user_id = ?`,
      [userId]
    );

    if (rows.length === 0) {
      const [users] = await pool.query('SELECT user_id, name, email FROM user WHERE user_id = ?', [userId]);
      if (users.length === 0) {
        return res.status(404).json({ message: "User not found" });
      }

      const user = users[0];
      return res.json({
        user_id: user.user_id,
        name: user.name,
        email: user.email,
        salary: null,
        date_of_birth: null,
        department: null,
        phone: null,
        address: null,
        hire_date: null,
        race: null,
        religion: null,
        bank: null,
        account_no: null
      });
    }

    const staff = rows[0];
    return res.json({
      user_id: Number(userId),
      employee_id: staff.employee_id,
      employee_code: staff.employee_code,
      name: staff.name,
      email: staff.email,
      date_of_birth: staff.date_of_birth,
      phone: staff.phone,
      address: staff.address,
      hire_date: staff.hire_date,
      status: staff.status,
      race: staff.race,
      religion: staff.religion,
      salary: staff.salary,
      department: staff.department,
      bank: staff.bank,
      account_no: staff.account_no
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to fetch profile" });
  }
}

/**
 * GET /api/profile
 * Get all staff profiles. Only Admin/HR/Finance can list all.
 */
async function getAllProfiles(req, res) {
  const role = req.user.role;
  if (role !== "Admin" && role !== "HR" && role !== "Finance") {
    return res.status(403).json({ message: "Access denied" });
  }

  try {
    const [rows] = await pool.query(
      `SELECT
        s.employee_id,
        s.employee_code,
        s.user_user_id AS user_id,
        s.name,
        s.email,
        s.phone,
        s.base_salary AS salary,
        s.hire_date,
        s.status,
        d.department_name AS department
       FROM staff s
       LEFT JOIN department d ON s.department_id = d.department_id
       ORDER BY s.employee_id`
    );

    return res.json(rows);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to fetch profiles" });
  }
}

/* ─── UPDATE ─── */

/**
 * PUT /api/profile/:userId
 * Update a staff profile. Staff can only edit limited fields.
 */
async function updateProfileByUserId(req, res) {
  const { userId } = req.params;
  const userRole = req.user.role;

  // Staff can only update their own profile
  if (userRole === "Staff" && String(req.user.userId) !== String(userId)) {
    return res.status(403).json({ message: "Access denied" });
  }

  const { name, email, phone, address, base_salary, bank, account_no, department_id } = req.body;

  try {
    const fields = [];
    const values = [];

    // Staff can only edit: name, email, phone, address
    if (typeof name !== 'undefined') { fields.push('name = ?'); values.push(name); }
    if (typeof email !== 'undefined') { fields.push('email = ?'); values.push(email); }
    if (typeof phone !== 'undefined') { fields.push('phone = ?'); values.push(phone); }
    if (typeof address !== 'undefined') { fields.push('address = ?'); values.push(address); }

    // Protected fields — only Admin/HR can change these
    if (userRole === "Admin" || userRole === "HR") {
      if (typeof base_salary !== 'undefined') { fields.push('base_salary = ?'); values.push(base_salary); }
      if (typeof bank !== 'undefined') { fields.push('bank = ?'); values.push(bank); }
      if (typeof account_no !== 'undefined') { fields.push('account_no = ?'); values.push(account_no); }
      if (typeof department_id !== 'undefined') { fields.push('department_id = ?'); values.push(department_id); }
    }

    if (fields.length === 0) {
      return res.status(400).json({ message: "No fields to update" });
    }

    values.push(userId);
    await pool.query(`UPDATE staff SET ${fields.join(', ')} WHERE user_user_id = ?`, values);

    // Sync name/email to user table
    if (typeof name !== 'undefined' || typeof email !== 'undefined') {
      await pool.query(
        'UPDATE user SET name = COALESCE(?, name), email = COALESCE(?, email) WHERE user_id = ?',
        [name || null, email || null, userId]
      );
    }

    // Return updated profile
    req.params.userId = userId;
    return getProfileByUserId(req, res);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to update profile" });
  }
}

/* ─── DELETE ─── */

/**
 * DELETE /api/profile/:userId
 * Delete a staff profile. Only Admin can delete.
 */
async function deleteProfileByUserId(req, res) {
  if (req.user.role !== "Admin") {
    return res.status(403).json({ message: "Access denied" });
  }

  const { userId } = req.params;

  try {
    const [result] = await pool.query("DELETE FROM staff WHERE user_user_id = ?", [userId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Profile not found" });
    }

    return res.json({ message: "Profile deleted successfully" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to delete profile" });
  }
}

module.exports = {
  createProfile,
  getProfileByUserId,
  getAllProfiles,
  updateProfileByUserId,
  deleteProfileByUserId
};
