const { pool } = require("../config/db");
const { notifyRoles, notifyUser } = require("../services/payrollNotificationService");
const { getActiveHolidaysInRange } = require("../models/publicHolidayModel");

// [STAFF BRANCH - Steven] Leave tables disabled - 11 table schema
// Leave management removed from database structure

/**
 * Calculate the number of working days between two dates (inclusive).
 * Excludes Saturdays, Sundays, and active public holidays.
 *
 * @param {Date} startDate - The start date
 * @param {Date} endDate - The end date
 * @param {string[]} [publicHolidayDates] - Array of ISO date strings (YYYY-MM-DD) to exclude
 * @returns {number} Number of working days (Mon-Fri, excluding public holidays) in the range
 */
function calculateWorkingDays(startDate, endDate, publicHolidayDates = []) {
  let count = 0;
  let current = new Date(startDate);

  // Convert public holiday dates to a Set for O(1) lookup
  const holidaySet = new Set(publicHolidayDates);

  while (current <= endDate) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      // Check if this weekday is a public holiday (use local date parts to avoid timezone issues)
      const y = current.getFullYear();
      const m = String(current.getMonth() + 1).padStart(2, "0");
      const d = String(current.getDate()).padStart(2, "0");
      const dateStr = `${y}-${m}-${d}`;
      if (!holidaySet.has(dateStr)) {
        count++;
      }
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}

/**
 * Ensure a leave_balance record exists for the given staff/type/year.
 * Creates with default entitlement if missing.
 *
 * @param {number} staffId - The staff ID
 * @param {number} leaveTypeId - The leave type ID
 * @param {number} year - The year
 * @param {number} defaultEntitlement - Default entitlement to set if creating new record
 * @returns {Promise<Object>} The balance record (existing or newly created)
 */
async function getOrCreateBalance(staffId, leaveTypeId, year, defaultEntitlement) {
  const [existing] = await pool.query(
    "SELECT * FROM leave_balance WHERE staff_id = ? AND leave_type_id = ? AND year = ?",
    [staffId, leaveTypeId, year]
  );

  if (existing.length) return existing[0];

  await pool.query(
    "INSERT INTO leave_balance (staff_id, leave_type_id, year, entitled, used, carried_forward) VALUES (?, ?, ?, ?, 0, 0)",
    [staffId, leaveTypeId, year, defaultEntitlement]
  );

  return {
    staff_id: staffId,
    leave_type_id: leaveTypeId,
    year,
    entitled: defaultEntitlement,
    used: 0,
    carried_forward: 0,
  };
}

/**
 * POST /api/leave/apply
 * Staff submits a leave application.
 */
async function applyLeave(req, res) {
  try {
    const { leave_type_id, start_date, end_date, reason } = req.body;
    const staffId = req.user.staffId;

    if (!staffId) {
      return res.status(400).json({ message: "No staff profile linked to this account. Contact HR." });
    }

    // Validate required fields
    if (!leave_type_id || !start_date || !end_date) {
      return res.status(400).json({ message: "leave_type_id, start_date, and end_date are required" });
    }

    // Validate end_date >= start_date
    const startDt = new Date(start_date);
    const endDt = new Date(end_date);
    if (endDt < startDt) {
      return res.status(400).json({ message: "end_date must be on or after start_date" });
    }

    // Calculate working days (excluding weekends and public holidays)
    const publicHolidays = await getActiveHolidaysInRange(start_date, end_date);
    const totalDays = calculateWorkingDays(startDt, endDt, publicHolidays);
    if (totalDays === 0) {
      return res.status(400).json({ message: "Selected date range contains zero working days" });
    }

    // Fetch leave type configuration
    const [leaveTypes] = await pool.query(
      "SELECT * FROM leave_type WHERE id = ?",
      [leave_type_id]
    );
    if (!leaveTypes.length) {
      return res.status(400).json({ message: "Invalid leave type" });
    }
    const leaveType = leaveTypes[0];

    // Check attachment requirement
    if (leaveType.requires_attachment && !req.file) {
      return res.status(400).json({ message: "Attachment required for this leave type" });
    }

    // Balance check for paid leave
    const year = new Date(start_date).getFullYear();
    if (leaveType.is_paid) {
      const balance = await getOrCreateBalance(staffId, leave_type_id, year, leaveType.default_entitlement);
      const remaining = balance.entitled + balance.carried_forward - balance.used;
      if (totalDays > remaining) {
        return res.status(400).json({ message: "Insufficient leave balance" });
      }
    }

    // Insert leave application
    const attachmentPath = req.file?.path || null;
    const [insertResult] = await pool.query(
      `INSERT INTO leave_application (staff_id, leave_type_id, start_date, end_date, total_days, reason, attachment_path, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [staffId, leave_type_id, start_date, end_date, totalDays, reason || null, attachmentPath]
    );

    // Optimistic deduction for paid leave
    if (leaveType.is_paid) {
      await pool.query(
        "UPDATE leave_balance SET used = used + ? WHERE staff_id = ? AND leave_type_id = ? AND year = ?",
        [totalDays, staffId, leave_type_id, year]
      );
    }

    // Notify all HR users
    await notifyRoles("HR", {
      type: "leave_request",
      title: "New Leave Request",
      message: `Staff ID ${staffId} submitted a ${leaveType.name} leave request for ${totalDays} day(s).`,
      actorUserId: req.user.userId,
      entityType: "leave_application",
      entityId: insertResult.insertId,
      actionPath: "/dashboard/payroll/hr/leave-management"
    }, { excludeUserId: req.user.userId });

    return res.status(201).json({
      message: "Leave application submitted successfully",
      application_id: insertResult.insertId,
    });
  } catch (error) {
    console.error("applyLeave error:", error);
    return res.status(500).json({ message: "Failed to submit leave application" });
  }
}

/**
 * PUT /api/leave/applications/:id/cancel
 * Staff cancels their own pending leave application.
 */
async function cancelLeave(req, res) {
  try {
    const { id } = req.params;
    const staffId = req.user.staffId;

    // Fetch application owned by this staff
    const [rows] = await pool.query(
      "SELECT * FROM leave_application WHERE id = ? AND staff_id = ?",
      [id, staffId]
    );
    if (!rows.length) {
      return res.status(404).json({ message: "Application not found" });
    }
    const application = rows[0];

    // Only pending applications can be cancelled
    if (application.status !== "pending") {
      return res.status(400).json({ message: "Only pending applications can be cancelled" });
    }

    // Update status to cancelled
    await pool.query(
      "UPDATE leave_application SET status = 'cancelled' WHERE id = ?",
      [id]
    );

    // Restore balance for paid leave types
    const year = new Date(application.start_date).getFullYear();
    const [typeRows] = await pool.query(
      "SELECT is_paid FROM leave_type WHERE id = ?",
      [application.leave_type_id]
    );
    if (typeRows.length && typeRows[0].is_paid) {
      await pool.query(
        "UPDATE leave_balance SET used = used - ? WHERE staff_id = ? AND leave_type_id = ? AND year = ?",
        [application.total_days, staffId, application.leave_type_id, year]
      );
    }

    return res.status(200).json({ message: "Leave cancelled", id });
  } catch (error) {
    console.error("cancelLeave error:", error);
    return res.status(500).json({ message: "Failed to cancel leave application" });
  }
}

/**
 * PUT /api/leave/applications/:id/status
 * HR approves or rejects a pending leave application.
 */
async function updateLeaveStatus(req, res) {
  try {
    const { id } = req.params;
    const { status, hr_comment } = req.body;
    const reviewerId = req.user.userId;

    // Validate status value
    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Status must be 'approved' or 'rejected'" });
    }

    // Fetch application
    const [rows] = await pool.query(
      "SELECT * FROM leave_application WHERE id = ?",
      [id]
    );
    if (!rows.length) {
      return res.status(404).json({ message: "Application not found" });
    }
    const application = rows[0];

    // Only pending applications can be approved/rejected
    if (application.status !== "pending") {
      return res.status(400).json({
        message: `Cannot ${status} a ${application.status} application`,
      });
    }

    // Update application status
    await pool.query(
      "UPDATE leave_application SET status = ?, hr_comment = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ?",
      [status, hr_comment || null, reviewerId, id]
    );

    // If rejected, restore leave balance
    if (status === "rejected") {
      const year = new Date(application.start_date).getFullYear();
      const [typeRows] = await pool.query(
        "SELECT is_paid FROM leave_type WHERE id = ?",
        [application.leave_type_id]
      );
      if (typeRows.length && typeRows[0].is_paid) {
        await pool.query(
          "UPDATE leave_balance SET used = used - ? WHERE staff_id = ? AND leave_type_id = ? AND year = ?",
          [application.total_days, application.staff_id, application.leave_type_id, year]
        );
      }
    }

    // Notify the staff member
    const [staffRows] = await pool.query(
      "SELECT user_user_id FROM staff WHERE employee_id = ?",
      [application.staff_id]
    );
    if (staffRows.length) {
      const staffUserId = staffRows[0].user_user_id;
      const notificationType = status === "approved" ? "leave_approved" : "leave_rejected";
      const notificationTitle = status === "approved" ? "Leave Approved" : "Leave Rejected";
      const startDate = new Date(application.start_date).toISOString().split("T")[0];
      const endDate = new Date(application.end_date).toISOString().split("T")[0];
      const notificationMessage = `Your leave from ${startDate} to ${endDate} has been ${status}.`;

      await notifyUser(staffUserId, {
        type: notificationType,
        title: notificationTitle,
        message: notificationMessage,
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

/**
 * GET /api/leave/my-applications
 * Returns all leave applications for the authenticated staff member,
 * joined with leave_type to include the type name, ordered by created_at descending.
 */
async function getMyApplications(req, res) {
  try {
    const staffId = req.user.staffId;

    const [applications] = await pool.query(
      `SELECT la.id, lt.name AS leave_type_name, la.start_date, la.end_date,
              la.total_days, la.status, la.reason, la.hr_comment,
              la.created_at, la.updated_at
       FROM leave_application la
       JOIN leave_type lt ON la.leave_type_id = lt.id
       WHERE la.staff_id = ?
       ORDER BY la.created_at DESC`,
      [staffId]
    );

    return res.status(200).json(applications);
  } catch (error) {
    console.error("getMyApplications error:", error);
    return res.status(500).json({ message: "Failed to retrieve leave applications" });
  }
}

/**
 * GET /api/leave/my-balance
 * Returns all leave types with the staff's balance for the current year.
 * For each type: entitled, used, carried_forward, and remaining (entitled + carried_forward - used).
 * Auto-creates balance records via getOrCreateBalance if none exist for a type/year.
 */
async function getMyBalance(req, res) {
  try {
    const staffId = req.user.staffId;
    const currentYear = new Date().getFullYear();

    // [HR BRANCH - Steven] Gender filter for leave type eligibility
    // applicable_gender: All = everyone, Male = male staff only, Female = female staff only
    const [staffRows] = await pool.query(
      "SELECT gender FROM staff WHERE employee_id = ? LIMIT 1",
      [staffId]
    );
    const staffGender = staffRows.length > 0 ? staffRows[0].gender : null;

    let leaveTypes;
    if (staffGender) {
      [leaveTypes] = await pool.query(
        "SELECT * FROM leave_type WHERE applicable_gender = 'All' OR applicable_gender = ?",
        [staffGender]
      );
    } else {
      [leaveTypes] = await pool.query(
        "SELECT * FROM leave_type WHERE applicable_gender = 'All'"
      );
    }

    const balances = [];
    for (const type of leaveTypes) {
      const balance = await getOrCreateBalance(staffId, type.id, currentYear, type.default_entitlement);
      balances.push({
        leave_type_id: type.id,
        leave_type: type.name,
        entitled: balance.entitled,
        used: balance.used,
        carried_forward: balance.carried_forward,
        remaining: balance.entitled + balance.carried_forward - balance.used,
      });
    }

    return res.status(200).json(balances);
  } catch (error) {
    console.error("getMyBalance error:", error);
    return res.status(500).json({ message: "Failed to retrieve leave balance" });
  }
}

/**
 * GET /api/leave/types
 * Returns all leave_type records. Accessible by both Staff and HR.
 */
async function getLeaveTypes(req, res) {
  try {
    // [HR BRANCH - Steven] Gender filter for leave type eligibility
    // applicable_gender: All = everyone, Male = male staff only, Female = female staff only
    // Staff: filter by their gender. HR/Admin: return all types unfiltered.
    const role = req.user.role;
    const staffId = req.user.staffId;

    if (role === "Staff" && staffId) {
      const [staffRows] = await pool.query(
        "SELECT gender FROM staff WHERE employee_id = ? LIMIT 1",
        [staffId]
      );
      const staffGender = staffRows.length > 0 ? staffRows[0].gender : null;

      let leaveTypes;
      if (staffGender) {
        [leaveTypes] = await pool.query(
          "SELECT * FROM leave_type WHERE applicable_gender = 'All' OR applicable_gender = ?",
          [staffGender]
        );
      } else {
        [leaveTypes] = await pool.query(
          "SELECT * FROM leave_type WHERE applicable_gender = 'All'"
        );
      }
      return res.status(200).json(leaveTypes);
    }

    // HR/Admin: return all types unfiltered
    const [leaveTypes] = await pool.query("SELECT * FROM leave_type");
    return res.status(200).json(leaveTypes);
  } catch (error) {
    console.error("getLeaveTypes error:", error);
    return res.status(500).json({ message: "Failed to retrieve leave types" });
  }
}

/**
 * GET /api/leave/applications/pending
 * HR views all pending leave applications with staff name and department,
 * ordered by created_at ascending.
 */
async function getPendingApplications(req, res) {
  try {
    const [applications] = await pool.query(
      `SELECT la.id, la.staff_id, s.name AS staff_name,
              s.department_name AS department, lt.name AS leave_type_name,
              la.start_date, la.end_date, la.total_days,
              la.reason, la.attachment_path, la.status, la.created_at
       FROM leave_application la
       JOIN staff s ON la.staff_id = s.employee_id
       JOIN leave_type lt ON la.leave_type_id = lt.id
       
       WHERE la.status = 'pending'
       ORDER BY la.created_at ASC`
    );

    return res.status(200).json(applications);
  } catch (error) {
    console.error("getPendingApplications error:", error);
    return res.status(500).json({ message: "Failed to retrieve pending applications" });
  }
}

/**
 * GET /api/leave/applications/all
 * HR views all leave applications across all staff with pagination.
 * Query params: page (default 1), pageSize (default 20).
 */
async function getAllApplications(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.max(1, parseInt(req.query.pageSize) || 20);
    const offset = (page - 1) * pageSize;

    // Get total count
    const [countResult] = await pool.query(
      "SELECT COUNT(*) AS total FROM leave_application"
    );
    const total = countResult[0].total;

    // Get paginated applications with staff and reviewer info
    const [applications] = await pool.query(
      `SELECT la.id, la.staff_id,
              s.name AS staff_name,
              s.department_name AS department, lt.name AS leave_type_name,
              la.start_date, la.end_date, la.total_days,
              la.reason, la.status, la.hr_comment,
              la.reviewed_by, la.created_at,
              CASE WHEN r.user_id IS NOT NULL
                THEN rs.name
                ELSE NULL
              END AS reviewer_name
       FROM leave_application la
       JOIN staff s ON la.staff_id = s.employee_id
       JOIN leave_type lt ON la.leave_type_id = lt.id
       
       LEFT JOIN user r ON la.reviewed_by = r.user_id
       LEFT JOIN staff rs ON r.user_id = rs.user_user_id
       ORDER BY la.created_at DESC
       LIMIT ? OFFSET ?`,
      [pageSize, offset]
    );

    return res.status(200).json({
      applications,
      total,
      page,
      pageSize,
    });
  } catch (error) {
    console.error("getAllApplications error:", error);
    return res.status(500).json({ message: "Failed to retrieve applications" });
  }
}

/**
 * GET /api/leave/balances/all
 * HR views all staff balances grouped by staff.
 * Each staff entry includes their balance records for each leave type.
 */
async function getAllBalances(req, res) {
  try {
    const currentYear = new Date().getFullYear();

    const [rows] = await pool.query(
      `SELECT lb.staff_id,
              s.name AS staff_name,
              s.department_name AS department,
              lt.id AS leave_type_id, lt.name AS leave_type_name,
              lb.entitled, lb.used, lb.carried_forward,
              (lb.entitled + lb.carried_forward - lb.used) AS remaining
       FROM leave_balance lb
       JOIN staff s ON lb.staff_id = s.employee_id
       JOIN leave_type lt ON lb.leave_type_id = lt.id
       
       WHERE lb.year = ?
       ORDER BY s.name ASC, lt.name ASC`,
      [currentYear]
    );

    // Group by staff
    const staffMap = {};
    for (const row of rows) {
      if (!staffMap[row.staff_id]) {
        staffMap[row.staff_id] = {
          staff_id: row.staff_id,
          staff_name: row.staff_name,
          department: row.department,
          balances: [],
        };
      }
      staffMap[row.staff_id].balances.push({
        leave_type_id: row.leave_type_id,
        leave_type: row.leave_type_name,
        entitled: row.entitled,
        used: row.used,
        carried_forward: row.carried_forward,
        remaining: row.remaining,
      });
    }

    const result = Object.values(staffMap);
    return res.status(200).json(result);
  } catch (error) {
    console.error("getAllBalances error:", error);
    return res.status(500).json({ message: "Failed to retrieve staff balances" });
  }
}

/**
 * PUT /api/leave/types/:id
 * HR updates a leave type's configuration (default_entitlement, carry_forward_cap, requires_attachment).
 * Only provided fields are updated; existing balances are not retroactively changed.
 */
async function updateLeaveType(req, res) {
  try {
    const { id } = req.params;
    const { default_entitlement, carry_forward_cap, requires_attachment } = req.body;

    // Validate that at least one field is provided
    if (
      default_entitlement === undefined &&
      carry_forward_cap === undefined &&
      requires_attachment === undefined
    ) {
      return res.status(400).json({
        message: "At least one field (default_entitlement, carry_forward_cap, requires_attachment) must be provided",
      });
    }

    // Verify leave type exists
    const [existing] = await pool.query("SELECT * FROM leave_type WHERE id = ?", [id]);
    if (!existing.length) {
      return res.status(404).json({ message: "Leave type not found" });
    }

    // Build dynamic UPDATE query for only provided fields
    const fields = [];
    const values = [];

    if (default_entitlement !== undefined) {
      fields.push("default_entitlement = ?");
      values.push(default_entitlement);
    }
    if (carry_forward_cap !== undefined) {
      fields.push("carry_forward_cap = ?");
      values.push(carry_forward_cap);
    }
    if (requires_attachment !== undefined) {
      fields.push("requires_attachment = ?");
      values.push(requires_attachment);
    }

    values.push(id);

    await pool.query(
      `UPDATE leave_type SET ${fields.join(", ")} WHERE id = ?`,
      values
    );

    // Fetch and return the updated record
    const [updated] = await pool.query("SELECT * FROM leave_type WHERE id = ?", [id]);
    return res.status(200).json(updated[0]);
  } catch (error) {
    console.error("updateLeaveType error:", error);
    return res.status(500).json({ message: "Failed to update leave type" });
  }
}

/**
 * POST /api/leave/carry-forward
 * Runs the year-end carry-forward process.
 * For each staff member with unused leave in eligible types,
 * carries forward min(remaining, carry_forward_cap) into next year's balance.
 * Idempotent: running multiple times produces the same result via UPSERT.
 */
async function runCarryForward(req, res) {
  try {
    const { from_year } = req.body;

    // Validate from_year
    if (!from_year || isNaN(Number(from_year))) {
      return res.status(400).json({ message: "from_year is required and must be a valid number" });
    }

    const toYear = Number(from_year) + 1;

    // Query all leave types where carry forward is allowed
    const [types] = await pool.query(
      "SELECT * FROM leave_type WHERE carry_forward_allowed = TRUE"
    );

    let processed = 0;

    for (const type of types) {
      // Get all balance records for this type in the from_year
      const [balances] = await pool.query(
        "SELECT * FROM leave_balance WHERE leave_type_id = ? AND year = ?",
        [type.id, from_year]
      );

      for (const balance of balances) {
        const remaining = balance.entitled + balance.carried_forward - balance.used;
        const carryAmount = Math.min(Math.max(remaining, 0), type.carry_forward_cap);

        if (carryAmount > 0) {
          await pool.query(
            `INSERT INTO leave_balance (staff_id, leave_type_id, year, entitled, carried_forward, used)
             VALUES (?, ?, ?, ?, ?, 0)
             ON DUPLICATE KEY UPDATE carried_forward = ?`,
            [balance.staff_id, type.id, toYear, type.default_entitlement, carryAmount, carryAmount]
          );
          processed++;
        }
      }
    }

    return res.status(200).json({ message: "Carry-forward complete", processed });
  } catch (error) {
    console.error("runCarryForward error:", error);
    return res.status(500).json({ message: "Failed to run carry-forward" });
  }
}

/**
 * Calculate salary deduction for unpaid leave days.
 * Formula: (baseSalary / workingDaysInMonth) * unpaidLeaveDays, rounded to 2 decimal places.
 * Returns 0 if unpaidLeaveDays is 0.
 */
function calculateUnpaidLeaveDeduction(baseSalary, workingDaysInMonth, unpaidLeaveDays) {
  if (unpaidLeaveDays === 0) return 0;
  const dailyRate = baseSalary / workingDaysInMonth;
  return Math.round((dailyRate * unpaidLeaveDays) * 100) / 100;
}

/**
 * Get total approved unpaid leave days for a staff member in a given month/year.
 * Returns the total unpaid days (number) or 0 if none found.
 */
async function getUnpaidLeaveDaysForMonth(staffId, month, year) {
  const [rows] = await pool.query(
    `SELECT SUM(la.total_days) as total_unpaid_days
     FROM leave_application la
     JOIN leave_type lt ON la.leave_type_id = lt.id
     WHERE la.staff_id = ?
       AND lt.is_paid = FALSE
       AND la.status = 'approved'
       AND MONTH(la.start_date) = ?
       AND YEAR(la.start_date) = ?`,
    [staffId, month, year]
  );
  return rows[0].total_unpaid_days || 0;
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
