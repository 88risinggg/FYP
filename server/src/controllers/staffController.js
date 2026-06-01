const { staffProfiles } = require('../services/data');
const { addAudit } = require('../services/audit');

/**
 * Create staff record (Create)
 * Endpoint expected use: POST /api/hr/staff or POST /api/staff (if present)
 */
function createStaff(req, res) {
  const body = req.body || {};
  const employee_id = body.employee_id || body.staff_id || `STF${String(staffProfiles.length + 1).padStart(3,'0')}`;
  const now = new Date().toISOString();
  const profile = {
    employee_id,
    name: body.name || body.staff_name || '',
    email: body.email || '',
    phone: body.phone || '',
    hire_date: body.hire_date || null,
    base_salary: body.base_salary ? Number(body.base_salary) : 0,
    status: body.status || 'Active',
    created_at: now,
    updated_at: now,
    department_id: body.department_id || null,
    user_user_id: body.user_user_id || null,
    race: body.race || null,
    religion: body.religion || null,
    bank: body.bank || null,
    account_no: body.account_no || null
  };
  staffProfiles.push(profile);
  addAudit(req.user && req.user.email ? req.user.email : 'system', `Added staff record ${profile.employee_id}`, 'Staff');
  return res.status(201).json(profile);
}

/**
 * List staff (Read - list)
 * Endpoint expected use: GET /api/staff
 */
function getStaffList(req, res) {
  return res.json(staffProfiles);
}

/**
 * Get single staff by id (Read - single)
 * Endpoint expected use: GET /api/hr/staff/:id or GET /api/staff/:id
 */
function getStaffById(req, res) {
  const id = req.params.id || req.params.employeeId;
  const staff = staffProfiles.find(s => s.staff_id === id || s.employee_id === id);
  if (!staff) return res.status(404).json({ message: 'Staff profile not found' });
  return res.json(staff);
}

/**
 * Update staff by id (Update)
 * Endpoint expected use: PUT/PATCH /api/hr/staff/:id or PATCH /api/staff/profile/:employeeId
 * Should enforce Staff-role self-update restriction if present.
 */
function updateStaff(req, res) {
  const employeeId = req.params.id || req.params.employeeId;
  const profile = staffProfiles.find(p => p.employee_id === employeeId || p.staff_id === employeeId);
  if (!profile) return res.status(404).json({ message: 'Staff profile not found' });

  // Keep the same Staff self-edit restriction used in routes
  if (req.user && req.user.role === 'Staff' && req.user.employeeId !== employeeId) {
    return res.status(403).json({ message: 'Staff can only update own profile' });
  }

  const updatable = [
    'name', 'email', 'phone', 'hire_date', 'base_salary', 'status',
    'department_id', 'user_user_id', 'race', 'religion', 'bank', 'account_no'
  ];
  updatable.forEach(k => {
    if (req.body[k] !== undefined) profile[k] = req.body[k];
  });

  profile.updated_at = new Date().toISOString();
  addAudit(req.user && req.user.email ? req.user.email : 'system', `Updated profile for ${profile.employee_id}`, 'Staff');
  return res.json(profile);
}

/**
 * Delete staff by id (Delete)
 * Endpoint expected use: DELETE /api/hr/staff/:id
 */
function deleteStaff(req, res) {
  const id = req.params.id || req.params.employeeId;
  const index = staffProfiles.findIndex(s => s.staff_id === id || s.employee_id === id);
  if (index === -1) return res.status(404).json({ message: 'Staff record not found' });
  const deleted = staffProfiles.splice(index, 1)[0];
  addAudit(req.user && req.user.email ? req.user.email : 'system', `Deleted staff record ${id}`, 'Staff');
  return res.json({ message: 'Staff record deleted', deleted });
}

/**
 * Bulk import / create staff profiles (existing POST /import behaviour)
 * Endpoint expected use: POST /api/staff/import
 */
function importProfiles(req, res) {
  const profiles = Array.isArray(req.body) ? req.body : [req.body];
  const created = [];
  profiles.forEach(p => {
    const now = new Date().toISOString();
    const employeeId = p.employee_id || p.employeeId || null;
    if (!employeeId) return; // skip invalid rows

    // Prevent duplicates: update if exists
    let existing = staffProfiles.find(s => s.employee_id === employeeId);
    if (existing) {
      Object.assign(existing, p);
      existing.updated_at = now;
      created.push(existing);
      return;
    }

    const profile = {
      employee_id: employeeId,
      name: p.name || p.staff_name || '',
      email: p.email || '',
      phone: p.phone || '',
      hire_date: p.hire_date || null,
      base_salary: p.base_salary ? Number(p.base_salary) : 0,
      status: p.status || 'active',
      created_at: p.created_at || now,
      updated_at: p.updated_at || now,
      department_id: p.department_id || null,
      user_user_id: p.user_user_id || null,
      race: p.race || null,
      religion: p.religion || null,
      bank: p.bank || null,
      account_no: p.account_no || null
    };
    staffProfiles.push(profile);
    created.push(profile);
  });

  addAudit(req.user && req.user.email ? req.user.email : 'system', `Imported ${created.length} staff profiles`, 'Staff');
  return res.json({ created, total: staffProfiles.length });
}

module.exports = {
  createStaff,
  getStaffList,
  getStaffById,
  updateStaff,
  deleteStaff,
  importProfiles
};