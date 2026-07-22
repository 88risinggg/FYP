/**
 * consolidate-tables.js
 *
 * Consolidates the database from 13 tables to 10 tables by:
 * 1. Adding reminder/view tracking columns to audit_logs (replaces invoice_reminder_log, invoice_view_log)
 * 2. Adding payment proof/review columns to payment (replaces manual_payment_submission)
 * 3. Dropping the now-redundant empty tables
 *
 * Safe to run multiple times (idempotent).
 */

const { pool } = require("../src/config/db");

async function run() {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // ── 1. Add columns to audit_logs for reminder & view tracking ──────────────
    // These replace invoice_reminder_log and invoice_view_log
    const auditCols = [
      ["invoice_id",       "INT NULL"],
      ["reminder_type",    "VARCHAR(50) NULL"],
      ["delivery_status",  "VARCHAR(20) NULL"],
      ["customer_email",   "VARCHAR(255) NULL"],
      ["view_ip_address",  "VARCHAR(100) NULL"],
      ["view_user_agent",  "TEXT NULL"],
    ];
    for (const [col, def] of auditCols) {
      try {
        await conn.query(`ALTER TABLE audit_logs ADD COLUMN ${col} ${def}`);
        console.log(`  audit_logs: added ${col}`);
      } catch (e) {
        if (e.code === "ER_DUP_FIELDNAME") {
          console.log(`  audit_logs: ${col} already exists — skipping`);
        } else throw e;
      }
    }

    // ── 2. Add payment proof/review columns to payment ──────────────────────
    // These replace manual_payment_submission
    const paymentCols = [
      ["payment_date_input",  "DATE NULL"],
      ["reference_number",    "VARCHAR(255) NULL"],
      ["proof_file_url",      "VARCHAR(500) NULL"],
      ["proof_file_name",     "VARCHAR(255) NULL"],
      ["customer_notes",      "TEXT NULL"],
      ["review_status",       "ENUM('Pending Review','Approved','Rejected') NULL"],
      ["reviewed_by",         "INT NULL"],
      ["reviewed_at",         "DATETIME NULL"],
      ["review_notes",        "TEXT NULL"],
      ["submitted_at",        "DATETIME NULL"],
    ];
    for (const [col, def] of paymentCols) {
      try {
        await conn.query(`ALTER TABLE payment ADD COLUMN ${col} ${def}`);
        console.log(`  payment: added ${col}`);
      } catch (e) {
        if (e.code === "ER_DUP_FIELDNAME") {
          console.log(`  payment: ${col} already exists — skipping`);
        } else throw e;
      }
    }

    // ── 3. Migrate any existing data before dropping ─────────────────────────

    // Migrate invoice_reminder_log → audit_logs
    const [reminderRows] = await conn.query("SELECT * FROM invoice_reminder_log");
    if (reminderRows.length > 0) {
      for (const r of reminderRows) {
        await conn.query(
          `INSERT INTO audit_logs (activity_type, action_description, affected_record, status,
            invoice_id, reminder_type, delivery_status, customer_email, created_at)
           VALUES ('invoice_reminder', ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            `Reminder sent: ${r.reminder_type}`,
            String(r.invoice_id),
            r.delivery_status === "sent" ? "Success" : "Failed",
            r.invoice_id,
            r.reminder_type,
            r.delivery_status,
            r.customer_email,
            r.sent_at || new Date()
          ]
        );
      }
      console.log(`  Migrated ${reminderRows.length} reminder log rows → audit_logs`);
    }

    // Migrate invoice_view_log → audit_logs
    const [viewRows] = await conn.query("SELECT * FROM invoice_view_log");
    if (viewRows.length > 0) {
      for (const r of viewRows) {
        await conn.query(
          `INSERT INTO audit_logs (activity_type, action_description, affected_record, status,
            invoice_id, view_ip_address, view_user_agent, created_at)
           VALUES ('invoice_view', 'Invoice viewed', ?, 'Success', ?, ?, ?, ?)`,
          [String(r.invoice_id), r.invoice_id, r.ip_address, r.user_agent, r.view_date || new Date()]
        );
      }
      console.log(`  Migrated ${viewRows.length} view log rows → audit_logs`);
    }

    // Migrate manual_payment_submission → payment
    const [submissionRows] = await conn.query("SELECT * FROM manual_payment_submission");
    if (submissionRows.length > 0) {
      for (const r of submissionRows) {
        // Check if a payment record already exists for this invoice
        const [existing] = await conn.query(
          "SELECT payment_id FROM payment WHERE invoice_invoice_id = ? AND review_status IS NOT NULL LIMIT 1",
          [r.invoice_id]
        );
        if (existing.length === 0) {
          await conn.query(
            `INSERT INTO payment (invoice_invoice_id, amount, status, payment_date_input,
              reference_number, proof_file_url, proof_file_name, customer_notes,
              review_status, reviewed_by, reviewed_at, review_notes, submitted_at, created_at)
             VALUES (?, ?, 'Pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [
              r.invoice_id, r.amount, r.payment_date,
              r.reference_number, r.proof_file_url, r.proof_file_name,
              r.customer_notes, r.status, r.reviewed_by, r.reviewed_at,
              r.review_notes, r.submitted_at
            ]
          );
        }
      }
      console.log(`  Migrated ${submissionRows.length} manual payment submissions → payment`);
    }

    // ── 4. Drop the now-redundant tables ────────────────────────────────────
    const tablesToDrop = [
      "invoice_reminder_log",
      "invoice_view_log",
      "manual_payment_submission",
    ];
    for (const t of tablesToDrop) {
      try {
        await conn.query(`DROP TABLE IF EXISTS ${t}`);
        console.log(`  Dropped table: ${t}`);
      } catch (e) {
        console.warn(`  Could not drop ${t}: ${e.message}`);
      }
    }

    await conn.commit();

    // ── 5. Final table count ─────────────────────────────────────────────────
    const [tables] = await pool.query("SHOW TABLES");
    console.log(`\nFinal table count: ${tables.length}`);
    console.log("Tables:", tables.map(r => Object.values(r)[0]).join(", "));

  } catch (err) {
    await conn.rollback();
    console.error("Migration failed:", err.message);
    throw err;
  } finally {
    conn.release();
    pool.end();
  }
}

run().then(() => {
  console.log("\nConsolidation complete.");
}).catch(e => {
  console.error("Fatal:", e.message);
  process.exit(1);
});
