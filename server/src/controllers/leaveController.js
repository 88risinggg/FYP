/**
 * EVALUATION HEADER
 * FEATURE: PAYROLL - SHARED
 * PURPOSE: Handles leave Controller API requests, validation, status codes, and responses.
 * LAYER: Backend controller - validates HTTP input and returns the API response.
 * FIND RELATED CODE: Follow service/model calls to find business rules and database work.
 */
"use strict";
const { pool } = require("../config/db");
const { notifyRoles, notifyUser } = require("../services/payrollNotificationService");
const { getActiveHolidaysInRange } = require("../models/publicHolidayModel");

function normalizeRole(role) {
  return String(role || "").trim().toLowerCase();
}

// ---------------------------------------------------------------------------
// Leave data lives in claims_and_loans (type = 'leave') and the staff table
// (leave_balance_json column). Leave types are defined in-memory and keyed by
// a numeric id so existing API contracts stay unchanged.
// ---------------------------------------------------------------------------

const LEAVE_TYPES = [
  { id: 1,  name: "Annual Leave",          default_entitlement: 14,  carry_forward_allowed: true,  carry_forward_cap: 3,  is_paid: true,  requires_attachment: false, applicable_gender: "All"    },
  { id: 2,  name: "Sick Leave",            default_entitlement: 14,  carry_forward_allowed: false, carry_forward_cap: 0,  is_paid: true,  requires_attachment: true,  applicable_gender: "All"    },
  { id: 3,  name: "Hospitalisation Leave", default_entitlement: 60,  carry_forward_allowed: false, carry_forward_cap: 0,  is_paid: true,  requires_attachment: true,  applicable_gender: "All"    },
  { id: 4,  name: "Maternity Leave",       default_entitlement: 112, carry_forward_allowed: false, carry_forward_cap: 0,  is_paid: true,  requires_attachment: false, applicable_gender: "Female" },
  { id: 5,  name: "Paternity Leave",       default_entitlement: 7,   carry_forward_allowed: false, carry_forward_cap: 0,  is_paid: true,  requires_attachment: false, applicable_gender: "Male"   },
  { id: 6,  name: "Childcare Leave",       default_entitlement: 6,   carry_forward_allowed: false, carry_forward_cap: 0,  is_paid: true,  requires_attachment: false, applicable_gender: "All"    },
  { id: 7,  name: "Unpaid Leave",          default_entitlement: 0,   carry_forward_allowed: false, carry_forward_cap: 0,  is_paid: false, requires_attachment: false, applicable_gender: "All"    },
  { id: 8,  name: "Off-In-Lieu",           default_entitlement: 0,   carry_forward_allowed: false, carry_forward_cap: 0,  is_paid: true,  requires_attachment: false, applicable_gender: "All"    },
];

function getLeaveTypeById(id) {
  return LEAVE_TYPES.find(t => t.id === Number(id)) || null;
}

// ---------------------------------------------------------------------------
// leave_balance_json helpers
// Schema stored on staff row: { [leaveTypeId]: { [year]: { entitled, used, carried_forward } } }
// ---------------------------------------------------------------------------

async function readBalanceJson(staffId) {
  const [rows] = await pool.query(
    "SELECT leave_balance_json FROM staff WHERE employee_id = ? LIMIT 1",
    [staffId]
  );
  if (!rows.length) return {};
  const raw = rows[0].leave_balance_json;
  if (!raw) return {};
  // mysql2 returns JSON columns as already-parsed objects
  if (typeof raw === "object") return raw;
  try { return JSON.parse(raw); } catch { return {}; }
}

async function writeBalanceJson(staffId, balanceJson) {
  await pool.query(
    "UPDATE staff SET leave_balance_json = ? WHERE employee_id = ?",
    [JSON.stringify(balanceJson), staffId]
  );
}

async function getOrCreateBalance(staffId, leaveTypeId, year, defaultEntitlement) {
  const bal = await readBalanceJson(staffId);
  const key = String(leaveTypeId);
  const ykey = String(year);
  if (!bal[key]) bal[key] = {};
  if (!bal[key][ykey]) {
    bal[key][ykey] = { entitled: defaultEntitlement, used: 0, carried_forward: 0 };
    await writeBalanceJson(staffId, bal);
  }
  return { staff_id: staffId, leave_type_id: leaveTypeId, year, ...bal[key][ykey] };
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function calculateWorkingDays(startDate, endDate, publicHolidayDates = []) {
  let count = 0;
  let current = new Date(startDate);
  const holidaySet = new Set(publicHolidayDates);
  while (current <= endDate) {
    const dow = current.getDay();
    if (dow !== 0 && dow !== 6) {
      const y = current.getFullYear();
      const m = String(current.getMonth() + 1).padStart(2, "0");
      const d = String(current.getDate()).padStart(2, "0");
      if (!holidaySet.has(`${y}-${m}-${d}`)) count++;
    }
    current.setDate(current.getDate() + 1);
  }
  return count;
}

function makeLeaveId() {
  return `LV-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
}

// ---------------------------------------------------------------------------
// POST /api/leave/apply
// ---------------------------------------------------------------------------
async function applyLeave(req, res) {
  try {
    const { leave_type_id, start_date, end_date, reason } = req.body;
    const staffId = req.user.staffId;

    if (!staffId) return res.status(400).json({ message: "No staff profile linked to this account. Contact HR." });
    if (!leave_type_id || !start_date || !end_date) return res.status(400).json({ message: "leave_type_id, start_date, and end_date are required" });

    const startDt = new Date(start_date);
    const endDt   = new Date(end_date);
    if (endDt < startDt) return res.status(400).json({ message: "end_date must be on or after start_date" });

    const leaveType = getLeaveTypeById(leave_type_id);
    if (!leaveType) return res.status(400).json({ message: "Invalid leave type" });

    if (leaveType.requires_attachment && !req.file) return res.status(400).json({ message: "Attachment required for this leave type" });

    const publicHolidays = await getActiveHolidaysInRange(start_date, end_date);
    const totalDays = calculateWorkingDays(startDt, endDt, publicHolidays);
    if (totalDays === 0) return res.status(400).json({ message: "Selected date range contains zero working days" });

    const year = startDt.getFullYear();

    if (leaveType.is_paid && leaveType.default_entitlement > 0) {
      const balance = await getOrCreateBalance(staffId, leave_type_id, year, leaveType.default_entitlement);
      const remaining = balance.entitled + balance.carried_forward - balance.used;
      if (totalDays > remaining) return res.status(400).json({ message: "Insufficient leave balance" });
    }

    const attachmentPath = req.file?.path || null;
    const recordId = makeLeaveId();

    await pool.query(
      `INSERT INTO claims_and_loans
         (record_id, type, staff_employee_id, amount, leave_type_name, start_date, end_date,
          total_days, reason, proof_path, status, submitted_at)
       VALUES (?, 'leave', ?, 0, ?, ?, ?, ?, ?, ?, 'pending', NOW())`,
      [recordId, staffId, leaveType.name, start_date, end_date, totalDays, reason || null, attachmentPath]
    );

    // Deduct balance optimistically for paid leave
    if (leaveType.is_paid && leaveType.default_entitlement > 0) {
      const bal = await readBalanceJson(staffId);
      const key = String(leave_type_id);
      const ykey = String(year);
      if (bal[key]?.[ykey]) {
        bal[key][ykey].used = (bal[key][ykey].used || 0) + totalDays;
        await writeBalanceJson(staffId, bal);
      }
    }

    await notifyRoles("HR", {
      type: "leave_request",
      title: "New Leave Request",
      message: `Staff ID ${staffId} submitted a ${leaveType.name} leave request for ${totalDays} day(s).`,
      actorUserId: req.user.userId,
      entityType: "leave_application",
      entityId: recordId,
      actionPath: "/dashboard/payroll/hr/leave-management"
    }, { excludeUserId: req.user.userId });

    return res.status(201).json({ message: "Leave application submitted successfully", application_id: recordId });
  } catch (error) {
    console.error("applyLeave error:", error);
    return res.status(500).json({ message: "Failed to submit leave application" });
  }
}

// ---------------------------------------------------------------------------
// PUT /api/leave/applications/:id/cancel
// ---------------------------------------------------------------------------
async function cancelLeave(req, res) {
  try {
    const { id } = req.params;
    const staffId = req.user.staffId;

    const [rows] = await pool.query(
      "SELECT * FROM claims_and_loans WHERE record_id = ? AND type = 'leave' AND staff_employee_id = ?",
      [id, staffId]
    );
    if (!rows.length) return res.status(404).json({ message: "Application not found" });
    const app = rows[0];
    if (app.status !== "pending") return res.status(400).json({ message: "Only pending applications can be cancelled" });

    await pool.query("UPDATE claims_and_loans SET status = 'cancelled' WHERE record_id = ?", [id]);

    // Restore balance if paid leave
    const leaveType = LEAVE_TYPES.find(t => t.name === app.leave_type_name);
    if (leaveType?.is_paid && leaveType.default_entitlement > 0 && app.total_days) {
      const year = new Date(app.start_date).getFullYear();
      const bal  = await readBalanceJson(staffId);
      const key  = String(leaveType.id);
      const ykey = String(year);
      if (bal[key]?.[ykey]) {
        bal[key][ykey].used = Math.max(0, (bal[key][ykey].used || 0) - Number(app.total_days));
        await writeBalanceJson(staffId, bal);
      }
    }

    return res.status(200).json({ message: "Leave cancelled", id });
  } catch (error) {
    console.error("cancelLeave error:", error);
    return res.status(500).json({ message: "Failed to cancel leave application" });
  }
}

// ---------------------------------------------------------------------------
// PUT /api/leave/applications/:id/status  (HR approve/reject)
// ---------------------------------------------------------------------------
async function updateLeaveStatus(req, res) {
  try {
    const { id } = req.params;
    const { status, comments, hr_comment } = req.body;
    const reviewerComment = comments || hr_comment || null;

    if (!["approved", "rejected"].includes(status))
      return res.status(400).json({ message: "Status must be 'approved' or 'rejected'" });

    const [rows] = await pool.query(
      "SELECT * FROM claims_and_loans WHERE record_id = ? AND type = 'leave'",
      [id]
    );
    if (!rows.length) return res.status(404).json({ message: "Application not found" });
    const app = rows[0];
    if (app.status !== "pending") return res.status(400).json({ message: `Cannot ${status} a ${app.status} application` });

    await pool.query(
      "UPDATE claims_and_loans SET status = ?, reviewer_comments = ?, reviewed_at = NOW() WHERE record_id = ?",
      [status, reviewerComment, id]
    );

    // Restore balance on rejection for paid leave
    if (status === "rejected") {
      const leaveType = LEAVE_TYPES.find(t => t.name === app.leave_type_name);
      if (leaveType?.is_paid && leaveType.default_entitlement > 0 && app.total_days) {
        const year = new Date(app.start_date).getFullYear();
        const bal  = await readBalanceJson(app.staff_employee_id);
        const key  = String(leaveType.id);
        const ykey = String(year);
        if (bal[key]?.[ykey]) {
          bal[key][ykey].used = Math.max(0, (bal[key][ykey].used || 0) - Number(app.total_days));
          await writeBalanceJson(app.staff_employee_id, bal);
        }
      }
    }

    // Notify staff member
    const [staffRows] = await pool.query(
      "SELECT user_user_id FROM staff WHERE employee_id = ?",
      [app.staff_employee_id]
    );
    if (staffRows.length) {
      const startDate = new Date(app.start_date).toISOString().split("T")[0];
      const endDate   = new Date(app.end_date).toISOString().split("T")[0];
      await notifyUser(staffRows[0].user_user_id, {
        type: status === "approved" ? "leave_approved" : "leave_rejected",
        title: status === "approved" ? "Leave Approved" : "Leave Rejected",
        message: `Your leave from ${startDate} to ${endDate} has been ${status}.`,
        actorUserId: req.user.userId,
        entityType: "leave_application",
        entityId: id,
        actionPath: "/dashboard/payroll/staff/leave"
      });
    }

    return res.status(200).json({ message: `Leave ${status}`, id });
  } catch (error) {
    console.error("updateLeaveStatus error:", error);
    return res.status(500).json({ message: "Failed to update leave status" });
  }
}

// ---------------------------------------------------------------------------
// GET /api/leave/my-applications
// ---------------------------------------------------------------------------
async function getMyApplications(req, res) {
  try {
    const staffId = req.user.staffId;
    const [rows] = await pool.query(
      `SELECT record_id AS id, leave_type_name, start_date, end_date,
              total_days, status, reason, reviewer_comments AS hr_comment,
              submitted_at AS created_at, reviewed_at AS updated_at
       FROM claims_and_loans
       WHERE type = 'leave' AND staff_employee_id = ?
       ORDER BY submitted_at DESC`,
      [staffId]
    );
    return res.status(200).json(rows);
  } catch (error) {
    console.error("getMyApplications error:", error);
    return res.status(500).json({ message: "Failed to retrieve leave applications" });
  }
}

// ---------------------------------------------------------------------------
// GET /api/leave/my-balance
// ---------------------------------------------------------------------------
async function getMyBalance(req, res) {
  try {
    const staffId = req.user.staffId;
    const currentYear = new Date().getFullYear();

    const [staffRows] = await pool.query("SELECT gender FROM staff WHERE employee_id = ? LIMIT 1", [staffId]);
    const staffGender  = staffRows[0]?.gender || null;

    const eligibleTypes = LEAVE_TYPES.filter(t =>
      t.applicable_gender === "All" || !staffGender || t.applicable_gender === staffGender
    );

    const balances = [];
    for (const type of eligibleTypes) {
      const balance = await getOrCreateBalance(staffId, type.id, currentYear, type.default_entitlement);
      balances.push({
        leave_type_id:   type.id,
        leave_type:      type.name,
        entitled:        balance.entitled,
        used:            balance.used,
        carried_forward: balance.carried_forward,
        remaining:       balance.entitled + balance.carried_forward - balance.used,
      });
    }
    return res.status(200).json(balances);
  } catch (error) {
    console.error("getMyBalance error:", error);
    return res.status(500).json({ message: "Failed to retrieve leave balance" });
  }
}

// ---------------------------------------------------------------------------
// GET /api/leave/types
// ---------------------------------------------------------------------------
async function getLeaveTypes(req, res) {
  try {
    const staffId = req.user.staffId;

    if (staffId) {
      const [staffRows] = await pool.query("SELECT gender FROM staff WHERE employee_id = ? LIMIT 1", [staffId]);
      const staffGender  = staffRows[0]?.gender || null;
      const filtered = staffGender
        ? LEAVE_TYPES.filter(t => t.applicable_gender === "All" || t.applicable_gender === staffGender)
        : LEAVE_TYPES.filter(t => t.applicable_gender === "All");
      return res.status(200).json(filtered);
    }
    return res.status(200).json(LEAVE_TYPES);
  } catch (error) {
    console.error("getLeaveTypes error:", error);
    return res.status(500).json({ message: "Failed to retrieve leave types" });
  }
}

// ---------------------------------------------------------------------------
// GET /api/leave/applications/pending  (HR)
// ---------------------------------------------------------------------------
async function getPendingApplications(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT cl.record_id AS id, cl.staff_employee_id AS staff_id,
              s.name AS staff_name, s.department_name AS department,
              cl.leave_type_name, cl.start_date, cl.end_date,
              cl.total_days, cl.reason, cl.proof_path AS attachment_path,
              cl.status, cl.submitted_at AS created_at
       FROM claims_and_loans cl
       JOIN staff s ON cl.staff_employee_id = s.employee_id
       WHERE cl.type = 'leave' AND cl.status = 'pending'
       ORDER BY cl.submitted_at ASC`
    );
    return res.status(200).json(rows);
  } catch (error) {
    console.error("getPendingApplications error:", error);
    return res.status(500).json({ message: "Failed to retrieve pending applications" });
  }
}

// ---------------------------------------------------------------------------
// GET /api/leave/applications/all  (HR, paginated)
// ---------------------------------------------------------------------------
async function getAllApplications(req, res) {
  try {
    const page     = Math.max(1, parseInt(req.query.page)     || 1);
    const pageSize = Math.max(1, parseInt(req.query.pageSize) || 20);
    const offset   = (page - 1) * pageSize;

    const [[{ total }]] = await pool.query(
      "SELECT COUNT(*) AS total FROM claims_and_loans WHERE type = 'leave'"
    );

    const [rows] = await pool.query(
      `SELECT cl.record_id AS id, cl.staff_employee_id AS staff_id,
              s.name AS staff_name, s.department_name AS department,
              cl.leave_type_name, cl.start_date, cl.end_date,
              cl.total_days, cl.reason, cl.status,
              cl.reviewer_comments AS hr_comment, cl.reviewed_at,
              cl.submitted_at AS created_at
       FROM claims_and_loans cl
       JOIN staff s ON cl.staff_employee_id = s.employee_id
       WHERE cl.type = 'leave'
       ORDER BY cl.submitted_at DESC
       LIMIT ? OFFSET ?`,
      [pageSize, offset]
    );

    return res.status(200).json({ applications: rows, total, page, pageSize });
  } catch (error) {
    console.error("getAllApplications error:", error);
    return res.status(500).json({ message: "Failed to retrieve applications" });
  }
}

// ---------------------------------------------------------------------------
// GET /api/leave/balances/all  (HR)
// ---------------------------------------------------------------------------
async function getAllBalances(req, res) {
  try {
    const currentYear = new Date().getFullYear();
    const [staffRows] = await pool.query(
      "SELECT employee_id, name, department_name, leave_balance_json FROM staff WHERE status = 1 ORDER BY name"
    );

    const result = [];
    for (const s of staffRows) {
      let bal = {};
      try {
        const raw = s.leave_balance_json;
        if (raw && typeof raw === "object") bal = raw;
        else if (raw && typeof raw === "string") bal = JSON.parse(raw);
      } catch { /* empty */ }

      const balances = LEAVE_TYPES.map(type => {
        const entry = bal[String(type.id)]?.[String(currentYear)] || { entitled: type.default_entitlement, used: 0, carried_forward: 0 };
        return {
          leave_type_id:   type.id,
          leave_type:      type.name,
          entitled:        entry.entitled,
          used:            entry.used,
          carried_forward: entry.carried_forward,
          remaining:       entry.entitled + entry.carried_forward - entry.used,
        };
      });

      result.push({
        staff_id:   s.employee_id,
        staff_name: s.name,
        department: s.department_name,
        balances,
      });
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error("getAllBalances error:", error);
    return res.status(500).json({ message: "Failed to retrieve staff balances" });
  }
}

// ---------------------------------------------------------------------------
// PUT /api/leave/types/:id  (HR — update in-memory config is not persistent,
// but we keep the endpoint functional so the UI doesn't 500)
// ---------------------------------------------------------------------------
async function updateLeaveType(req, res) {
  try {
    const id   = Number(req.params.id);
    const type = LEAVE_TYPES.find(t => t.id === id);
    if (!type) return res.status(404).json({ message: "Leave type not found" });

    const { default_entitlement, carry_forward_cap, requires_attachment } = req.body;
    if (default_entitlement  !== undefined) type.default_entitlement  = Number(default_entitlement);
    if (carry_forward_cap    !== undefined) type.carry_forward_cap    = Number(carry_forward_cap);
    if (requires_attachment  !== undefined) type.requires_attachment  = Boolean(requires_attachment);

    return res.status(200).json(type);
  } catch (error) {
    console.error("updateLeaveType error:", error);
    return res.status(500).json({ message: "Failed to update leave type" });
  }
}

// ---------------------------------------------------------------------------
// POST /api/leave/carry-forward  (HR)
// ---------------------------------------------------------------------------
async function runCarryForward(req, res) {
  try {
    const { from_year } = req.body;
    if (!from_year || isNaN(Number(from_year)))
      return res.status(400).json({ message: "from_year is required and must be a valid number" });

    const toYear = Number(from_year) + 1;
    const [staffRows] = await pool.query("SELECT employee_id, leave_balance_json FROM staff WHERE status = 1");

    let processed = 0;
    for (const s of staffRows) {
      let bal = {};
      try {
        const raw = s.leave_balance_json;
        if (raw && typeof raw === "object") bal = raw;
        else if (raw && typeof raw === "string") bal = JSON.parse(raw);
      } catch { /* empty */ }

      let changed = false;
      for (const type of LEAVE_TYPES.filter(t => t.carry_forward_allowed)) {
        const key   = String(type.id);
        const ykey  = String(from_year);
        const entry = bal[key]?.[ykey];
        if (!entry) continue;
        const remaining   = Math.max(0, entry.entitled + entry.carried_forward - entry.used);
        const carryAmount = Math.min(remaining, type.carry_forward_cap);
        if (carryAmount > 0) {
          if (!bal[key]) bal[key] = {};
          const toKey = String(toYear);
          if (!bal[key][toKey]) bal[key][toKey] = { entitled: type.default_entitlement, used: 0, carried_forward: 0 };
          bal[key][toKey].carried_forward = carryAmount;
          changed = true;
          processed++;
        }
      }
      if (changed) {
        await pool.query("UPDATE staff SET leave_balance_json = ? WHERE employee_id = ?", [JSON.stringify(bal), s.employee_id]);
      }
    }

    return res.status(200).json({ message: "Carry-forward complete", processed });
  } catch (error) {
    console.error("runCarryForward error:", error);
    return res.status(500).json({ message: "Failed to run carry-forward" });
  }
}

// ---------------------------------------------------------------------------
// Pure helpers (used by financePayrollModel)
// ---------------------------------------------------------------------------
function calculateUnpaidLeaveDeduction(baseSalary, workingDaysInMonth, unpaidLeaveDays) {
  if (unpaidLeaveDays === 0) return 0;
  return Math.round((baseSalary / workingDaysInMonth) * unpaidLeaveDays * 100) / 100;
}

async function getUnpaidLeaveDaysForMonth(staffId, month, year) {
  const [rows] = await pool.query(
    `SELECT SUM(total_days) AS total_unpaid_days
     FROM claims_and_loans
     WHERE type = 'leave'
       AND staff_employee_id = ?
       AND status = 'approved'
       AND MONTH(start_date) = ?
       AND YEAR(start_date) = ?
       AND leave_type_name IN (${LEAVE_TYPES.filter(t => !t.is_paid).map(() => "?").join(",")})`,
    [staffId, month, year, ...LEAVE_TYPES.filter(t => !t.is_paid).map(t => t.name)]
  );
  return Number(rows[0]?.total_unpaid_days || 0);
}

module.exports = {
  calculateWorkingDays,
  getOrCreateBalance,
  applyLeave,
  cancelLeave,
  updateLeaveStatus,
  getMyApplications,
  getMyBalance,
  getLeaveTypes,
  getPendingApplications,
  getAllApplications,
  getAllBalances,
  updateLeaveType,
  runCarryForward,
  calculateUnpaidLeaveDeduction,
  getUnpaidLeaveDaysForMonth,
};
