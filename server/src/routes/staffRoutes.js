const express = require("express");
const { staffProfiles } = require("../services/data");
const { addAudit } = require("../services/audit");
const { authenticateToken } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/rolesMiddleware");

const router = express.Router();

// Update contact or full profile by employee_id
router.patch("/profile/:employeeId", authenticateToken, allowRoles("Staff", "Admin", "HR"), (req, res) => {
  const profile = staffProfiles.find(p => p.employee_id === req.params.employeeId);
  if (!profile) return res.status(404).json({ message: "Staff profile not found" });
  if (req.user.role === "Staff" && req.user.employeeId !== req.params.employeeId) {
    return res.status(403).json({ message: "Staff can only update own profile" });
  }

  // Allow partial updates for HR/Admin
  const updatable = [
    'name', 'email', 'phone', 'hire_date', 'base_salary', 'status',
    'department_id', 'user_user_id', 'race', 'religion', 'bank', 'account_no'
  ];
  updatable.forEach(key => {
    if (req.body[key] !== undefined) profile[key] = req.body[key];
  });

  profile.updated_at = new Date().toISOString();
  addAudit(req.user.email, `Updated profile for ${profile.employee_id}`, "Staff");
  res.json(profile);
});

// Create or import staff profile (HR/Admin)
router.post("/import", authenticateToken, allowRoles("Admin", "HR"), (req, res) => {
  const profiles = Array.isArray(req.body) ? req.body : [req.body];
  const created = [];
  profiles.forEach(p => {
    const now = new Date().toISOString();
    const employeeId = p.employee_id || p.employeeId || null;
    if (!employeeId) return; // skip invalid rows

    // Prevent duplicates
    let existing = staffProfiles.find(s => s.employee_id === employeeId);
    if (existing) {
      // Update existing
      Object.assign(existing, p);
      existing.updated_at = now;
      created.push(existing);
      return;
    }

    const profile = {
      employee_id: employeeId,
      name: p.name || p.staff_name || "",
      email: p.email || "",
      phone: p.phone || "",
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

  addAudit(req.user.email, `Imported ${created.length} staff profiles`, "Staff");
  res.json({ created, total: staffProfiles.length });
});

module.exports = router;
