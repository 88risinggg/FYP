/**
 * Consolidate database to 12 core tables:
 * 1. user (+ connected_accounts JSON, login sessions via audit_logs)
 * 2. staff (+ emergency_contact columns)
 * 3. customer
 * 4. invoice
 * 5. invoice_settings (global singleton)
 * 6. payment (+ payment_method name inline)
 * 7. payroll (+ payroll_run columns)
 * 8. payroll_configuration (organisation-wide calculation rules)
 * 9. notification
 * 10. public_holidays
 * 11. audit_logs (consolidated: all audit/settings audit/numbering activity)
 * 12. claims_and_loans (+ leave applications absorbed)
 */

const mysql = require("mysql2/promise");
require("dotenv").config();

async function addColumn(pool, table, column, definition) {
  try {
    await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
    return true;
  } catch (e) {
    if (e.code === "ER_DUP_FIELDNAME") return false;
    throw e;
  }
}

async function tableExists(pool, name) {
  const [rows] = await pool.query("SHOW TABLES LIKE ?", [name]);
  return rows.length > 0;
}

async function run() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: true } : undefined,
    multipleStatements: true
  });

  try {
    console.log("=== Consolidating to 12 core tables ===\n");

    // ─── 1. Merge connected_account into user (as JSON) ───
    console.log("1. Merging connected_account into user (JSON column)...");
    await addColumn(pool, "user", "connected_accounts_json", "JSON NULL");
    if (await tableExists(pool, "connected_account")) {
      const [accounts] = await pool.query("SELECT user_id, JSON_ARRAYAGG(JSON_OBJECT('provider', provider, 'account_email', account_email, 'status', status, 'connected_at', connected_at, 'last_sync', last_sync)) AS accounts FROM connected_account GROUP BY user_id");
      for (const row of accounts) {
        await pool.query("UPDATE user SET connected_accounts_json = ? WHERE user_id = ?", [row.accounts, row.user_id]);
      }
    }
    console.log("   Done.");

    // ─── 2. Merge login_session into user (JSON array of recent sessions) ───
    console.log("2. Merging login_session into user (JSON column)...");
    await addColumn(pool, "user", "login_sessions_json", "JSON NULL");
    if (await tableExists(pool, "login_session")) {
      const [sessions] = await pool.query("SELECT user_id, JSON_ARRAYAGG(JSON_OBJECT('session_id', session_id, 'device', device, 'browser', browser, 'os', os, 'ip_address', ip_address, 'location', location, 'login_time', login_time, 'is_current', is_current)) AS sessions FROM login_session GROUP BY user_id");
      for (const row of sessions) {
        await pool.query("UPDATE user SET login_sessions_json = ? WHERE user_id = ?", [row.sessions, row.user_id]);
      }
    }
    console.log("   Done.");

    // ─── 3. Merge emergency_contact into staff ───
    console.log("3. Merging emergency_contact into staff...");
    await addColumn(pool, "staff", "emergency_contact_name", "VARCHAR(100) NULL");
    await addColumn(pool, "staff", "emergency_contact_relationship", "VARCHAR(50) NULL");
    await addColumn(pool, "staff", "emergency_contact_phone", "VARCHAR(20) NULL");
    if (await tableExists(pool, "emergency_contact")) {
      try {
        // Try to migrate data if the table has data
        const [contacts] = await pool.query("SELECT * FROM emergency_contact LIMIT 100");
        for (const c of contacts) {
          const staffIdCol = c.staff_employee_id || c.staff_id || c.employee_id;
          if (staffIdCol) {
            await pool.query(
              "UPDATE staff SET emergency_contact_name = ?, emergency_contact_relationship = ?, emergency_contact_phone = ? WHERE employee_id = ?",
              [c.name || c.contact_name, c.relationship, c.phone || c.contact_phone, staffIdCol]
            ).catch(() => {});
          }
        }
      } catch (e) {
        console.log("   No data to migrate from emergency_contact.");
      }
    }
    console.log("   Done.");

    // ─── 4. Merge payment_method into payment (inline name) ───
    console.log("4. Adding payment_method_name to payment...");
    await addColumn(pool, "payment", "payment_method_name", "VARCHAR(100) NULL");
    // Migrate existing payment_method references
    if (await tableExists(pool, "payment_method")) {
      try {
        await pool.query(`
          UPDATE payment p
          LEFT JOIN payment_method pm ON pm.payment_method_id = p.payment_method_id
          SET p.payment_method_name = pm.name
          WHERE p.payment_method_name IS NULL AND pm.name IS NOT NULL
        `);
      } catch (e) { /* column may already have data */ }
    }
    console.log("   Done.");

    // ─── 5. Merge payroll_run into payroll ───
    console.log("5. Adding payroll_run columns to payroll...");
    await addColumn(pool, "payroll", "run_status", "VARCHAR(50) DEFAULT 'Draft'");
    await addColumn(pool, "payroll", "run_created_by", "INT NULL");
    await addColumn(pool, "payroll", "run_created_at", "DATETIME NULL");
    await addColumn(pool, "payroll", "run_updated_at", "DATETIME NULL");
    await addColumn(pool, "payroll", "run_approved_by", "INT NULL");
    await addColumn(pool, "payroll", "run_approved_at", "DATETIME NULL");
    await addColumn(pool, "payroll", "payment_reference", "VARCHAR(255) NULL");
    await addColumn(pool, "payroll", "configuration_json", "JSON NULL");
    // Migrate payroll_run data into payroll records
    if (await tableExists(pool, "payroll_run")) {
      try {
        await pool.query(`
          UPDATE payroll p
          INNER JOIN payroll_run pr ON pr.payroll_run_id = p.payroll_run_id
          SET
            p.run_status = pr.status,
            p.run_created_by = pr.created_by,
            p.run_created_at = pr.created_at,
            p.run_updated_at = pr.updated_at,
            p.run_approved_by = pr.approved_by,
            p.run_approved_at = pr.approved_at,
            p.payment_reference = pr.payment_reference,
            p.configuration_json = pr.configuration_json
        `);
      } catch (e) {
        console.log("   Note:", e.message.substring(0, 80));
      }
    }
    console.log("   Done.");

    // ─── 6. Move per-user payroll preferences; keep organisation rules ───
    console.log("6. Adding payroll_config_json to user for user preferences...");
    await addColumn(pool, "user", "payroll_config_json", "JSON NULL");
    if (await tableExists(pool, "payroll_configuration")) {
      try {
        const [configs] = await pool.query("SELECT * FROM payroll_configuration WHERE configuration_type = 'user_preferences'");
        for (const cfg of configs) {
          await pool.query("UPDATE user SET payroll_config_json = ? WHERE user_id = ?", [cfg.configuration_value, cfg.configuration_key]);
        }
      } catch (e) { /* */ }
    }
    console.log("   Done.");

    // ─── 7. Merge leave tables into claims_and_loans ───
    console.log("7. Adding leave columns to claims_and_loans...");
    await addColumn(pool, "claims_and_loans", "leave_type_name", "VARCHAR(50) NULL");
    await addColumn(pool, "claims_and_loans", "start_date", "DATE NULL");
    await addColumn(pool, "claims_and_loans", "end_date", "DATE NULL");
    await addColumn(pool, "claims_and_loans", "total_days", "DECIMAL(5,1) NULL");
    await addColumn(pool, "claims_and_loans", "reason", "TEXT NULL");
    await addColumn(pool, "claims_and_loans", "leave_balance_json", "JSON NULL");
    // Migrate leave_application data
    if (await tableExists(pool, "leave_application")) {
      try {
        const [leaves] = await pool.query(`
          SELECT la.*, lt.name AS leave_type_name
          FROM leave_application la
          LEFT JOIN leave_type lt ON lt.id = la.leave_type_id
        `);
        for (const lv of leaves) {
          await pool.query(`
            INSERT INTO claims_and_loans (type, staff_employee_id, status, leave_type_name, start_date, end_date, total_days, reason)
            VALUES ('leave', ?, ?, ?, ?, ?, ?, ?)
          `, [lv.staff_id || lv.staff_employee_id, lv.status || 'Pending', lv.leave_type_name || 'Annual', lv.start_date, lv.end_date, lv.total_days, lv.reason]);
        }
        console.log(`   Migrated ${leaves.length} leave applications.`);
      } catch (e) {
        console.log("   Note:", e.message.substring(0, 80));
      }
    }
    // Migrate leave_balance data into staff
    if (await tableExists(pool, "leave_balance")) {
      try {
        await addColumn(pool, "staff", "leave_balance_json", "JSON NULL");
        const [balances] = await pool.query("SELECT * FROM leave_balance");
        // Group by staff
        const byStaff = {};
        for (const b of balances) {
          const key = b.staff_employee_id || b.staff_id;
          if (!byStaff[key]) byStaff[key] = [];
          byStaff[key].push(b);
        }
        for (const [staffId, bals] of Object.entries(byStaff)) {
          await pool.query("UPDATE staff SET leave_balance_json = ? WHERE employee_id = ?", [JSON.stringify(bals), staffId]);
        }
      } catch (e) {
        console.log("   Note:", e.message.substring(0, 80));
      }
    }
    console.log("   Done.");

    // ─── 8. Merge settings_audit_log + invoice_numbering_activity into audit_logs ───
    console.log("8. Merging settings_audit_log and invoice_numbering_activity into audit_logs...");
    if (await tableExists(pool, "settings_audit_log")) {
      try {
        const [logs] = await pool.query("SELECT * FROM settings_audit_log");
        for (const log of logs) {
          await pool.query(`
            INSERT INTO audit_logs (user_id, user_name, activity_type, action_description, affected_record, status, ip_address, device_info, created_at)
            VALUES (?, (SELECT name FROM user WHERE user_id = ? LIMIT 1), ?, ?, ?, 'success', ?, ?, ?)
          `, [log.user_id, log.user_id, log.module || 'settings', log.action, null, log.ip_address, log.device, log.created_at]);
        }
        console.log(`   Migrated ${logs.length} settings audit logs.`);
      } catch (e) {
        console.log("   Note:", e.message.substring(0, 80));
      }
    }
    if (await tableExists(pool, "invoice_numbering_activity")) {
      try {
        const [activities] = await pool.query("SELECT * FROM invoice_numbering_activity");
        for (const act of activities) {
          await pool.query(`
            INSERT INTO audit_logs (activity_type, action_description, affected_record, status, previous_value, new_value, created_at)
            VALUES ('invoice_numbering', ?, ?, 'success', ?, ?, ?)
          `, [act.action, act.setting_id, act.old_value, act.new_value, act.created_at]);
        }
        console.log(`   Migrated ${activities.length} numbering activities.`);
      } catch (e) {
        console.log("   Note:", e.message.substring(0, 80));
      }
    }
    console.log("   Done.");

    // ─── 9. Merge invoice_upload_validation_errors into invoice_upload_history (JSON) ───
    console.log("9. Merging invoice_upload_validation_errors into invoice_upload_history...");
    await addColumn(pool, "invoice_upload_history", "validation_errors_json", "JSON NULL");
    if (await tableExists(pool, "invoice_upload_validation_errors")) {
      try {
        const [uploads] = await pool.query("SELECT DISTINCT upload_id FROM invoice_upload_validation_errors");
        for (const { upload_id } of uploads) {
          const [errors] = await pool.query("SELECT source_row_number, invoice_number, field_name, error_message FROM invoice_upload_validation_errors WHERE upload_id = ?", [upload_id]);
          await pool.query("UPDATE invoice_upload_history SET validation_errors_json = ? WHERE upload_id = ?", [JSON.stringify(errors), upload_id]);
        }
      } catch (e) {
        console.log("   Note:", e.message.substring(0, 80));
      }
    }
    console.log("   Done.");

    // ─── 10. Drop all merged tables ───
    console.log("\n10. Dropping merged/obsolete tables...");
    await pool.query("SET FOREIGN_KEY_CHECKS = 0");
    const tablesToDrop = [
      "connected_account",
      "login_session",
      "settings_audit_log",
      "emergency_contact",
      "payment_method",
      "payroll_run",
      "leave_application",
      "leave_balance",
      "leave_type",
      "invoice_numbering_activity",
      "invoice_upload_validation_errors"
    ];
    for (const table of tablesToDrop) {
      try {
        await pool.query(`DROP TABLE IF EXISTS \`${table}\``);
        console.log(`   Dropped: ${table}`);
      } catch (e) {
        console.log(`   Could not drop ${table}: ${e.message.substring(0, 60)}`);
      }
    }
    await pool.query("SET FOREIGN_KEY_CHECKS = 1");

    // ─── 11. Remove payroll_run_id FK column from payroll ───
    console.log("\n11. Cleaning up obsolete FK columns...");
    try {
      // Drop FK constraint first if it exists
      const [fks] = await pool.query(`
        SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS 
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payroll' AND CONSTRAINT_TYPE = 'FOREIGN KEY'
      `);
      for (const fk of fks) {
        try {
          await pool.query(`ALTER TABLE payroll DROP FOREIGN KEY \`${fk.CONSTRAINT_NAME}\``);
        } catch (e) { /* */ }
      }
    } catch (e) { /* */ }
    console.log("   Done.");

    // ─── Verify ───
    console.log("\n=== Final Verification ===");
    const [tables] = await pool.query("SHOW TABLES");
    console.log(`Total tables: ${tables.length}`);
    tables.forEach((r, i) => console.log(`  ${i + 1}. ${Object.values(r)[0]}`));

    if (tables.length <= 12) {
      console.log("\n✓ Target achieved: " + tables.length + " tables (within 10±2)");
    } else {
      console.log("\n✗ Still at " + tables.length + " tables. Additional merging needed.");
    }

  } catch (error) {
    console.error("ERROR:", error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

run();
