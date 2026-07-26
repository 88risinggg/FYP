const { pool } = require("../config/db");
const { createNotificationInternal } = require("./notificationController");

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
    phone, address, department_name, hire_date, status,
    race, religion, base_salary, bank, account_no
  } = req.body;

  if (!user_user_id || !name || !email) {
    return res.status(400).json({ message: "user_user_id, name, and email are required" });
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO staff (user_user_id, employee_code, name, date_of_birth, email, phone, address, department_name, hire_date, status, race, religion, base_salary, bank, account_no)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user_user_id, employee_code || null, name, date_of_birth || null, email,
        phone || null, address || null, department_name || null,
        hire_date || null, status ?? 1, race || null, religion || null,
        base_salary || 0, bank || null, account_no || null
      ]
    );

    const [rows] = await pool.query(
      `SELECT s.*, s.department_name AS department
       FROM staff s
       
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
        s.department_name AS department
       FROM staff s
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
        s.department_name AS department
       FROM staff s
       
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

  const { name, email, phone, address, base_salary, bank, account_no, department_name, department_id } = req.body;

  try {
    const fields = [];
    const values = [];

    // Staff can edit: name, email, phone, address, bank, account_no
    if (typeof name !== 'undefined') { fields.push('name = ?'); values.push(name); }
    if (typeof email !== 'undefined') { fields.push('email = ?'); values.push(email); }
    if (typeof phone !== 'undefined') { fields.push('phone = ?'); values.push(phone); }
    if (typeof address !== 'undefined') { fields.push('address = ?'); values.push(address); }
    if (typeof bank !== 'undefined') { fields.push('bank = ?'); values.push(bank); }
    if (typeof account_no !== 'undefined') { fields.push('account_no = ?'); values.push(account_no); }

    // Protected fields — only Admin/HR can change these
    if (userRole === "Admin" || userRole === "HR") {
      if (typeof base_salary !== 'undefined') { fields.push('base_salary = ?'); values.push(base_salary); }
      const deptValue = department_name || department_id;
      if (typeof deptValue !== 'undefined') { fields.push('department_name = ?'); values.push(deptValue); }
    }

    if (fields.length === 0) {
      return res.status(400).json({ message: "No fields to update" });
    }

    // [STAFF BRANCH - Steven] Fetch old values for audit trail comparison (staff_profile_audit_log)
    const [existingRows] = await pool.query(
      'SELECT employee_id, name, email, phone, address, bank, account_no FROM staff WHERE user_user_id = ?',
      [userId]
    );

    // Non-staff roles (HR, Finance, Admin) may not have a staff row — update user table directly
    if (existingRows.length === 0) {
      if (userRole === "Staff") {
        return res.status(404).json({ message: "Staff profile not found" });
      }
      // HR/Finance/Admin: persist name and email on the user table.
      // phone/address are not on the user table — acknowledge them but skip silently.
      const userFields = [];
      const userValues = [];
      if (typeof name  !== 'undefined') { userFields.push('name = ?');  userValues.push(name); }
      if (typeof email !== 'undefined') { userFields.push('email = ?'); userValues.push(email); }
      if (userFields.length > 0) {
        userValues.push(userId);
        await pool.query(`UPDATE user SET ${userFields.join(', ')} WHERE user_id = ?`, userValues);
      }
      // Return updated profile (phone/address will be null for non-staff — that is expected)
      return getProfileByUserId(req, res);
    }

    const oldProfile = existingRows[0];

    values.push(userId);
    await pool.query(`UPDATE staff SET ${fields.join(', ')} WHERE user_user_id = ?`, values);

    // Sync name/email to user table
    if (typeof name !== 'undefined' || typeof email !== 'undefined') {
      await pool.query(
        'UPDATE user SET name = COALESCE(?, name), email = COALESCE(?, email) WHERE user_id = ?',
        [name || null, email || null, userId]
      );
    }

    // [STAFF BRANCH - Steven] Audit trail — log changed fields to staff_profile_audit_log
    // Fails silently — audit error must never block profile save response
    try {
      const auditFields = ['name', 'email', 'phone', 'address', 'bank', 'account_no'];
      const submitted = { name, email, phone, address, bank, account_no };
      for (const field of auditFields) {
        if (typeof submitted[field] === 'undefined') continue;
        const oldVal = oldProfile[field] || null;
        const newVal = submitted[field] || null;
        if (oldVal === newVal) continue;
        await pool.query(
          'INSERT INTO staff_profile_audit_log (employee_id, field_changed, old_value, new_value, changed_by) VALUES (?, ?, ?, ?, ?)',
          [oldProfile.employee_id, field, oldVal, newVal, oldProfile.employee_id]
        );
      }
    } catch (auditErr) {
      console.error('Audit log error:', auditErr.message, auditErr.stack);
    }

    // Notify Finance/HR when staff updates their bank details
    if (userRole === "Staff") {
      try {
        const bankChanged = (typeof bank !== 'undefined' && bank !== (oldProfile.bank || '')) ||
                            (typeof account_no !== 'undefined' && account_no !== (oldProfile.account_no || ''));

        if (bankChanged) {
          const staffName = name || oldProfile.name || 'A staff member';
          const maskedAccount = account_no ? '****' + String(account_no).slice(-4) : null;
          const notifTitle = `${staffName} updated bank details`;
          const notifMessage = maskedAccount
            ? `Bank account updated (ending ${maskedAccount}). Please verify before next payroll run.`
            : `Bank details updated. Please verify before next payroll run.`;

          // Send notification to all Finance and HR users
          const [finHrUsers] = await pool.query(
            "SELECT u.user_id FROM user u JOIN role r ON u.role_id = r.role_id WHERE r.role_name IN ('Finance', 'HR')"
          );
          for (const u of finHrUsers) {
            await createNotificationInternal(u.user_id, 'profile_updated', notifTitle, notifMessage);
          }

          // Notify the staff member themselves
          await createNotificationInternal(
            userId,
            'profile_updated',
            'Bank details updated',
            'Your bank details have been updated successfully. Your next pay will be sent to the new account.'
          );
        }

        // Notify staff when personal info changes
        const changedFields = [];
        if (typeof name !== 'undefined' && name !== (oldProfile.name || '')) changedFields.push('name');
        if (typeof email !== 'undefined' && email !== (oldProfile.email || '')) changedFields.push('email');
        if (typeof phone !== 'undefined' && phone !== (oldProfile.phone || '')) changedFields.push('phone');
        if (typeof address !== 'undefined' && address !== (oldProfile.address || '')) changedFields.push('address');

        if (changedFields.length > 0) {
          await createNotificationInternal(
            userId,
            'profile_updated',
            'Profile updated',
            `You updated your ${changedFields.join(', ')}.`
          );
        }
      } catch (notifErr) {
        console.error('Profile notification error:', notifErr.message);
      }
    }

    // Return updated profile
    req.params.userId = userId;
    return getProfileByUserId(req, res);
  } catch (error) {
    console.error('UPDATE PROFILE ERROR:', error.message, error.code, error.stack);
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

/* ─── EMERGENCY CONTACTS ─── */
// [STAFF BRANCH - Steven] Emergency contact CRUD

/**
 * Helper: resolve employee_id from a userId (staff.user_user_id)
 */
async function resolveEmployeeId(userId) {
  const [rows] = await pool.query(
    "SELECT employee_id FROM staff WHERE user_user_id = ? LIMIT 1",
    [userId]
  );
  return rows.length > 0 ? rows[0].employee_id : null;
}

/**
 * GET /api/profile/:userId/emergency-contacts
 * Staff: can only view their own. HR/Admin: can view any. Finance: 403.
 */
async function getEmergencyContacts(req, res) {
  const { userId } = req.params;
  const role = req.user.role;

  // Finance cannot access
  if (role === "Finance") {
    return res.status(403).json({ message: "Access denied" });
  }

  // Staff can only view their own
  if (role === "Staff" && String(req.user.userId) !== String(userId)) {
    return res.status(403).json({ message: "Access denied" });
  }

  try {
    const employeeId = await resolveEmployeeId(userId);
    if (!employeeId) {
      return res.json([]);
    }

    const [rows] = await pool.query(
      "SELECT * FROM emergency_contact WHERE employee_id = ? ORDER BY is_primary DESC, created_at ASC",
      [employeeId]
    );

    return res.json(rows);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to fetch emergency contacts" });
  }
}

/**
 * POST /api/profile/:userId/emergency-contacts
 * Staff only — add emergency contact to own profile.
 */
async function addEmergencyContact(req, res) {
  const { userId } = req.params;
  const role = req.user.role;

  // Only Staff can add emergency contacts
  if (role !== "Staff") {
    return res.status(403).json({ message: "Access denied" });
  }

  // Must be their own profile
  if (String(req.user.userId) !== String(userId)) {
    return res.status(403).json({ message: "Access denied" });
  }

  const { name, relationship, phone, is_primary } = req.body;

  // Validate required fields
  if (!name || !name.trim()) {
    return res.status(400).json({ message: "name is required" });
  }
  if (!relationship || !relationship.trim()) {
    return res.status(400).json({ message: "relationship is required" });
  }
  if (!phone || !phone.trim()) {
    return res.status(400).json({ message: "phone is required" });
  }

  // Phone format validation
  const phoneRegex = /^[0-9+\-() ]{6,20}$/;
  if (!phoneRegex.test(phone)) {
    return res.status(400).json({ message: "Invalid phone format" });
  }

  try {
    const employeeId = await resolveEmployeeId(req.user.userId);
    if (!employeeId) {
      return res.status(404).json({ message: "Staff profile not found" });
    }

    // Check max 3 contacts
    const [countRows] = await pool.query(
      "SELECT COUNT(*) AS cnt FROM emergency_contact WHERE employee_id = ?",
      [employeeId]
    );
    if (countRows[0].cnt >= 3) {
      return res.status(400).json({ message: "Maximum 3 emergency contacts allowed" });
    }

    // If is_primary, unset others first
    const primaryVal = is_primary ? 1 : 0;
    if (primaryVal === 1) {
      await pool.query(
        "UPDATE emergency_contact SET is_primary = 0 WHERE employee_id = ?",
        [employeeId]
      );
    }

    // Insert
    const [result] = await pool.query(
      "INSERT INTO emergency_contact (employee_id, name, relationship, phone, is_primary) VALUES (?, ?, ?, ?, ?)",
      [employeeId, name.trim(), relationship.trim(), phone.trim(), primaryVal]
    );

    // Return created contact
    const [newRows] = await pool.query(
      "SELECT * FROM emergency_contact WHERE contact_id = ?",
      [result.insertId]
    );

    return res.status(201).json(newRows[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to add emergency contact" });
  }
}

/**
 * PUT /api/profile/:userId/emergency-contacts/:contactId
 * Staff only — update own emergency contact.
 */
async function updateEmergencyContact(req, res) {
  const { userId, contactId } = req.params;
  const role = req.user.role;

  // Only Staff can update
  if (role !== "Staff") {
    return res.status(403).json({ message: "Access denied" });
  }

  // Must be their own profile
  if (String(req.user.userId) !== String(userId)) {
    return res.status(403).json({ message: "Access denied" });
  }

  const { name, relationship, phone, is_primary } = req.body;

  // Phone format validation (if provided)
  if (phone) {
    const phoneRegex = /^[0-9+\-() ]{6,20}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({ message: "Invalid phone format" });
    }
  }

  try {
    const employeeId = await resolveEmployeeId(req.user.userId);
    if (!employeeId) {
      return res.status(404).json({ message: "Staff profile not found" });
    }

    // Verify ownership
    const [contactRows] = await pool.query(
      "SELECT employee_id, name, relationship, phone, is_primary FROM emergency_contact WHERE contact_id = ?",
      [contactId]
    );
    if (contactRows.length === 0) {
      return res.status(404).json({ message: "Emergency contact not found" });
    }
    if (contactRows[0].employee_id !== employeeId) {
      return res.status(403).json({ message: "Access denied" });
    }

    // If setting as primary, unset others first
    const primaryVal = is_primary ? 1 : 0;
    if (primaryVal === 1) {
      await pool.query(
        "UPDATE emergency_contact SET is_primary = 0 WHERE employee_id = ?",
        [employeeId]
      );
    }

    // Update
    await pool.query(
      "UPDATE emergency_contact SET name = ?, relationship = ?, phone = ?, is_primary = ? WHERE contact_id = ?",
      [
        name ? name.trim() : contactRows[0].name,
        relationship ? relationship.trim() : contactRows[0].relationship,
        phone ? phone.trim() : contactRows[0].phone,
        primaryVal,
        contactId
      ]
    );

    // Return updated
    const [updatedRows] = await pool.query(
      "SELECT * FROM emergency_contact WHERE contact_id = ?",
      [contactId]
    );

    return res.json(updatedRows[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to update emergency contact" });
  }
}

/**
 * DELETE /api/profile/:userId/emergency-contacts/:contactId
 * Staff only — delete own emergency contact.
 */
async function deleteEmergencyContact(req, res) {
  const { userId, contactId } = req.params;
  const role = req.user.role;

  // Only Staff can delete
  if (role !== "Staff") {
    return res.status(403).json({ message: "Access denied" });
  }

  // Must be their own profile
  if (String(req.user.userId) !== String(userId)) {
    return res.status(403).json({ message: "Access denied" });
  }

  try {
    const employeeId = await resolveEmployeeId(req.user.userId);
    if (!employeeId) {
      return res.status(404).json({ message: "Staff profile not found" });
    }

    // Verify ownership
    const [contactRows] = await pool.query(
      "SELECT employee_id FROM emergency_contact WHERE contact_id = ?",
      [contactId]
    );
    if (contactRows.length === 0) {
      return res.status(404).json({ message: "Emergency contact not found" });
    }
    if (contactRows[0].employee_id !== employeeId) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Delete
    await pool.query("DELETE FROM emergency_contact WHERE contact_id = ?", [contactId]);

    return res.json({ message: "Contact deleted" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to delete emergency contact" });
  }
}

module.exports = {
  createProfile,
  getProfileByUserId,
  getAllProfiles,
  updateProfileByUserId,
  deleteProfileByUserId,
  getEmergencyContacts,
  addEmergencyContact,
  updateEmergencyContact,
  deleteEmergencyContact
};
