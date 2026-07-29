/**
 * Tests each leave controller DB query in isolation so we can
 * pinpoint exactly which one throws the "Failed to load leave data" error.
 */
const { pool } = require("../src/config/db");

async function run() {
  try {
    // ── 1. getLeaveTypes ───────────────────────────────────────────────────
    console.log("\n── Test 1: getLeaveTypes (role=Staff, staffId=1) ──");
    try {
      const [staffRows] = await pool.query(
        "SELECT gender FROM staff WHERE employee_id = ? LIMIT 1", [1]
      );
      console.log("  gender row:", staffRows[0]);
      console.log("  ✓ PASS");
    } catch (e) { console.error("  ✗ FAIL:", e.message); }

    // ── 2. getMyBalance ────────────────────────────────────────────────────
    console.log("\n── Test 2: getMyBalance read (staffId=1) ──");
    try {
      const [rows] = await pool.query(
        "SELECT gender FROM staff WHERE employee_id = ? LIMIT 1", [1]
      );
      console.log("  gender:", rows[0]?.gender);

      const [balRows] = await pool.query(
        "SELECT leave_balance_json FROM staff WHERE employee_id = ? LIMIT 1", [1]
      );
      const raw = balRows[0]?.leave_balance_json;
      // mysql2 returns JSON columns as already-parsed objects
      const bal = (!raw) ? {} : (typeof raw === "object" ? raw : JSON.parse(raw));
      console.log("  leave_balance_json keys:", Object.keys(bal));
      console.log("  ✓ PASS");
    } catch (e) { console.error("  ✗ FAIL:", e.message); }

    // ── 3. getMyApplications ───────────────────────────────────────────────
    console.log("\n── Test 3: getMyApplications (staffId=1) ──");
    try {
      const [rows] = await pool.query(
        `SELECT record_id AS id, leave_type_name, start_date, end_date,
                total_days, status, reason, reviewer_comments AS hr_comment,
                submitted_at AS created_at, reviewed_at AS updated_at
         FROM claims_and_loans
         WHERE type = 'leave' AND staff_employee_id = ?
         ORDER BY submitted_at DESC`,
        [1]
      );
      console.log("  rows returned:", rows.length);
      console.log("  ✓ PASS");
    } catch (e) { console.error("  ✗ FAIL:", e.message); }

    // ── 4. getPendingApplications (HR) ────────────────────────────────────
    console.log("\n── Test 4: getPendingApplications ──");
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
      console.log("  rows returned:", rows.length);
      console.log("  ✓ PASS");
    } catch (e) { console.error("  ✗ FAIL:", e.message); }

    // ── 5. getAllApplications (HR) ─────────────────────────────────────────
    console.log("\n── Test 5: getAllApplications ──");
    try {
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
         LIMIT 20 OFFSET 0`
      );
      console.log(`  total: ${total}, rows: ${rows.length}`);
      console.log("  ✓ PASS");
    } catch (e) { console.error("  ✗ FAIL:", e.message); }

    // ── 6. getAllBalances (HR) ─────────────────────────────────────────────
    console.log("\n── Test 6: getAllBalances ──");
    try {
      const [staffRows] = await pool.query(
        "SELECT employee_id, name, department_name, leave_balance_json FROM staff WHERE status = 1 ORDER BY name"
      );
      console.log("  active staff rows:", staffRows.length);
      console.log("  ✓ PASS");
    } catch (e) { console.error("  ✗ FAIL:", e.message); }

    // ── 7. publicHolidayModel (used by applyLeave) ────────────────────────
    console.log("\n── Test 7: getActiveHolidaysInRange ──");
    try {
      const [rows] = await pool.query(
        `SELECT holiday_date FROM public_holidays
         WHERE holiday_date BETWEEN ? AND ? AND status = 'Active'`,
        ["2025-01-01", "2025-12-31"]
      );
      console.log("  holiday rows:", rows.length);
      console.log("  ✓ PASS");
    } catch (e) { console.error("  ✗ FAIL:", e.message); }

  } finally {
    await pool.end();
  }
}

run().catch(console.error);
