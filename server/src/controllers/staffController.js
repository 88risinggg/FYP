const { pool } = require('../config/db');
const { addAudit } = require('../services/audit');

/**
 * Create staff record
 * POST /api/staff
 */
async function createStaff(req, res) {
  const body = req.body || {};
  const now = new Date();
  try {
    const [result] = await pool.query(
      `INSERT INTO staff
        (employee_code, name, date_of_birth, gender, email, phone, address,
         department_name, hire_date, status, race, religion, base_salary,
         bank, account_no, user_user_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        body.employee_code || null,
        body.name || body.staff_name || '',
        body.date_of_birth || null,
        body.gender || null,
        body.email || '',
        body.phone || null,
        body.address || null,
        body.department_name || null,
        body.hire_date || null,
        body.status !== undefined ? body.status : 1,
        body.race || null,
        body.religion || null,
        body.base_salary ? Number(body.base_salary) : 0,
        body.bank || null,
        body.account_no || null,
        body.user_user_id || null,
        now,
        now
      ]
    );
    const insertId = result.insertId;
    const [rows] = await pool.query('SELECT * FROM staff WHERE employee_id = ? LIMIT 1', [insertId]);
    addAudit(
      req.user && req.user.email ? req.user.email : 'system',
      `Added staff record ${insertId}`,
      'Staff'
    );
    return res.status(201).json(rows[0]);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to create staff record', error: err.message });
  }
}

/**
 * List all staff
 * GET /api/staff
 */
async function getStaffList(req, res) {
  try {
    const [rows] = await pool.query('SELECT * FROM staff ORDER BY name');
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to retrieve staff list', error: err.message });
  }
}

/**
 * Get a single staff member by employee_id
 * GET /api/staff/:id
 */
async function getStaffById(req, res) {
  const id = req.params.id || req.params.employeeId;
  try {
    const [rows] = await pool.query(
      'SELECT * FROM staff WHERE employee_id = ? LIMIT 1',
      [id]
    );
    if (!rows.length) return res.status(404).json({ message: 'Staff profile not found' });
    return res.json(rows[0]);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to retrieve staff profile', error: err.message });
  }
}

/**
 * Update a staff member by employee_id
 * PUT /api/staff/:id  or  PATCH /api/staff/profile/:employeeId
 */
async function updateStaff(req, res) {
  const employeeId = req.params.id || req.params.employeeId;

  // Staff-role self-update restriction
  if (req.user && req.user.role === 'Staff' && req.user.employeeId !== employeeId) {
    return res.status(403).json({ message: 'Staff can only update own profile' });
  }

  const allowed = [
    'name', 'email', 'phone', 'date_of_birth', 'gender', 'address',
    'hire_date', 'base_salary', 'status', 'department_name',
    'user_user_id', 'race', 'religion', 'bank', 'account_no'
  ];

  const updates = [];
  const values = [];
  allowed.forEach(k => {
    if (req.body[k] !== undefined) {
      updates.push(`${k} = ?`);
      values.push(req.body[k]);
    }
  });

  if (!updates.length) {
    return res.status(400).json({ message: 'No updatable fields provided' });
  }

  updates.push('updated_at = ?');
  values.push(new Date());
  values.push(employeeId);

  try {
    const [result] = await pool.query(
      `UPDATE staff SET ${updates.join(', ')} WHERE employee_id = ?`,
      values
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Staff profile not found' });
    }
    const [rows] = await pool.query('SELECT * FROM staff WHERE employee_id = ? LIMIT 1', [employeeId]);
    addAudit(
      req.user && req.user.email ? req.user.email : 'system',
      `Updated profile for ${employeeId}`,
      'Staff'
    );
    return res.json(rows[0]);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to update staff profile', error: err.message });
  }
}

/**
 * Delete a staff member by employee_id
 * DELETE /api/staff/:id
 */
async function deleteStaff(req, res) {
  const id = req.params.id || req.params.employeeId;
  try {
    const [rows] = await pool.query('SELECT * FROM staff WHERE employee_id = ? LIMIT 1', [id]);
    if (!rows.length) return res.status(404).json({ message: 'Staff record not found' });
    await pool.query('DELETE FROM staff WHERE employee_id = ?', [id]);
    addAudit(
      req.user && req.user.email ? req.user.email : 'system',
      `Deleted staff record ${id}`,
      'Staff'
    );
    return res.json({ message: 'Staff record deleted', deleted: rows[0] });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to delete staff record', error: err.message });
  }
}

/**
 * Bulk import / upsert staff profiles
 * POST /api/staff/import
 */
async function importProfiles(req, res) {
  const profiles = Array.isArray(req.body) ? req.body : [req.body];
  const created = [];
  const now = new Date();

  try {
    for (const p of profiles) {
      const employeeId = p.employee_id || p.employeeId || null;
      if (!employeeId) continue;

      // Upsert: update if exists, insert if not
      const [existing] = await pool.query(
        'SELECT employee_id FROM staff WHERE employee_id = ? LIMIT 1',
        [employeeId]
      );

      if (existing.length) {
        await pool.query(
          `UPDATE staff SET
            employee_code = COALESCE(?, employee_code),
            name = COALESCE(?, name),
            email = COALESCE(?, email),
            phone = COALESCE(?, phone),
            date_of_birth = COALESCE(?, date_of_birth),
            gender = COALESCE(?, gender),
            address = COALESCE(?, address),
            department_name = COALESCE(?, department_name),
            hire_date = COALESCE(?, hire_date),
            status = COALESCE(?, status),
            race = COALESCE(?, race),
            religion = COALESCE(?, religion),
            base_salary = COALESCE(?, base_salary),
            bank = COALESCE(?, bank),
            account_no = COALESCE(?, account_no),
            user_user_id = COALESCE(?, user_user_id),
            updated_at = ?
           WHERE employee_id = ?`,
          [
            p.employee_code || null,
            p.name || p.staff_name || null,
            p.email || null,
            p.phone || null,
            p.date_of_birth || null,
            p.gender || null,
            p.address || null,
            p.department_name || null,
            p.hire_date || null,
            p.status !== undefined ? p.status : null,
            p.race || null,
            p.religion || null,
            p.base_salary ? Number(p.base_salary) : null,
            p.bank || null,
            p.account_no || null,
            p.user_user_id || null,
            now,
            employeeId
          ]
        );
      } else {
        await pool.query(
          `INSERT INTO staff
            (employee_id, employee_code, name, email, phone, date_of_birth, gender,
             address, department_name, hire_date, status, race, religion,
             base_salary, bank, account_no, user_user_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            employeeId,
            p.employee_code || null,
            p.name || p.staff_name || '',
            p.email || '',
            p.phone || null,
            p.date_of_birth || null,
            p.gender || null,
            p.address || null,
            p.department_name || null,
            p.hire_date || null,
            p.status !== undefined ? p.status : 1,
            p.race || null,
            p.religion || null,
            p.base_salary ? Number(p.base_salary) : 0,
            p.bank || null,
            p.account_no || null,
            p.user_user_id || null,
            p.created_at || now,
            now
          ]
        );
      }

      const [saved] = await pool.query('SELECT * FROM staff WHERE employee_id = ? LIMIT 1', [employeeId]);
      if (saved.length) created.push(saved[0]);
    }

    addAudit(
      req.user && req.user.email ? req.user.email : 'system',
      `Imported ${created.length} staff profiles`,
      'Staff'
    );

    const [countRows] = await pool.query('SELECT COUNT(*) AS total FROM staff');
    return res.json({ created, total: countRows[0].total });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to import staff profiles', error: err.message });
  }
}

module.exports = {
  createStaff,
  getStaffList,
  getStaffById,
  updateStaff,
  deleteStaff,
  importProfiles
};
