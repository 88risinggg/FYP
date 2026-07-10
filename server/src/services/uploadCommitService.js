/**
 * Upload Commit Service
 *
 * Persists user-selected validated rows to the staff table within a single
 * database transaction. Handles session validation, concurrent duplicate
 * detection, and atomic commit with rollback on failure.
 */

const uploadSessionStore = require("./uploadSessionStore");
const { pool } = require("../config/db");

/**
 * Maximum number of row IDs allowed in a single commit request.
 */
const MAX_SELECTED_ROWS = 5000;

/**
 * Commits selected rows from a validated upload session to the staff table.
 *
 * @param {string} sessionId - The upload session identifier
 * @param {string[]} selectedRowIds - Array of row UUIDs to commit
 * @param {string} userId - The requesting user's ID/email
 * @returns {Promise<Object>} CommitResult with created, skipped, conflicts arrays
 * @throws {Error} With message containing 'expired' (410), 'forbidden' (403), or validation errors (400)
 */
async function commitUpload(sessionId, selectedRowIds, userId) {
  // Step 1: Validate selectedRowIds is non-empty and within limit
  if (!Array.isArray(selectedRowIds) || selectedRowIds.length === 0) {
    throw new Error("selectedRowIds must be a non-empty array");
  }

  if (selectedRowIds.length > MAX_SELECTED_ROWS) {
    throw new Error(
      `Selection exceeds maximum allowed count of ${MAX_SELECTED_ROWS}`
    );
  }

  // Step 2: Retrieve session and validate ownership
  // First try to get with userId (normal path)
  const sessionData = uploadSessionStore.get(sessionId, userId);

  if (!sessionData) {
    // Distinguish between expired/missing (410) and wrong user (403)
    // Access the internal sessions Map directly to check ownership
    const rawSession = uploadSessionStore.sessions.get(sessionId);

    if (!rawSession) {
      // Session does not exist (never existed or already cleaned up)
      throw new Error("Upload session expired or not found");
    }

    // Check if session has expired by TTL
    if (Date.now() - rawSession.createdAt > uploadSessionStore.ttlMs) {
      // Expired — clean it up and throw 410
      uploadSessionStore.sessions.delete(sessionId);
      throw new Error("Upload session expired or not found");
    }

    // Session exists and is not expired, but userId doesn't match → 403
    throw new Error("Session belongs to another user — access forbidden");
  }

  // Step 3: Filter selected rows from session
  const created = [];
  const skipped = [];
  const conflicts = [];

  // Build a map of session rows by ID for quick lookup
  const sessionRowMap = new Map();
  for (const row of sessionData.rows) {
    sessionRowMap.set(row.id, row);
  }

  // Identify rows to insert vs rows to skip
  const rowsToInsert = [];

  for (const rowId of selectedRowIds) {
    const row = sessionRowMap.get(rowId);

    if (!row) {
      // Row ID does not exist in session — skip it
      skipped.push({ id: rowId, reason: "row_not_found" });
    } else if (row.status === "error") {
      // Row has validation errors — skip it
      skipped.push({
        id: row.id,
        employee_id: row.data.employee_id,
        reason: "validation_error",
      });
    } else {
      rowsToInsert.push(row);
    }
  }

  // Step 4: Execute INSERT within a database transaction
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    for (const row of rowsToInsert) {
      // Step 5: Optimistic concurrency check — detect concurrent duplicates
      const [existing] = await connection.query(
        "SELECT employee_id FROM staff WHERE employee_id = ? OR email = ? LIMIT 1",
        [row.data.employee_id || "", row.data.email || ""]
      );

      if (existing.length > 0) {
        // Concurrent duplicate detected — another user inserted this record
        conflicts.push({
          id: row.id,
          employee_id: row.data.employee_id,
          email: row.data.email,
          name: row.data.name,
          reason: "concurrent_duplicate",
        });
        continue;
      }

      // Step 6: Insert the record into staff table
      await connection.query(
        `INSERT INTO staff (employee_id, name, email, phone, hire_date, base_salary,
         status, department_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          row.data.employee_id,
          row.data.name,
          row.data.email || null,
          row.data.phone || null,
          row.data.hire_date,
          row.data.base_salary || 0,
          row.data.status || "Active",
          row.data.department_id || null,
        ]
      );

      created.push({
        employee_id: row.data.employee_id,
        name: row.data.name,
      });
    }

    // Step 7: Commit transaction on success
    await connection.commit();
  } catch (err) {
    // Step 8: Rollback on database error
    if (connection) {
      try {
        await connection.rollback();
      } catch (_rollbackErr) {
        // Rollback failed — original error is more important
      }
    }
    throw err;
  } finally {
    // Step 9: Release connection and delete session from store
    if (connection) {
      connection.release();
    }
    uploadSessionStore.delete(sessionId);
  }

  // Step 10: Return CommitResult
  return {
    created,
    skipped,
    conflicts,
    totalCreated: created.length,
    totalSkipped: skipped.length + conflicts.length,
  };
}

module.exports = { commitUpload };
