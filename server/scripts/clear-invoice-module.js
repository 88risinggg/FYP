/**
 * Clear ALL Invoice Module Data
 *
 * Deletes all data related to the Invoice/Finance module:
 * - Invoices (keeps __SETTINGS__ row intact)
 * - Payments
 * - Customers
 * - Subscriptions
 * - Fraud assessments & indicators
 * - Finance reminders
 * - Subscription reminders
 * - Reminder settings & logs
 * - Invoice GST rates
 * - Invoice-related audit logs
 * - Invoice validation summaries
 *
 * Resets auto-increment counters and the invoice sequence number.
 *
 * Usage: node scripts/clear-invoice-module.js
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { pool } = require("../src/config/db");

async function clearInvoiceModule() {
  console.log("\n========================================================");
  console.log("  PayNivo — Clear ALL Invoice Module Data");
  console.log("========================================================\n");
  console.log(`  Database: ${process.env.DB_NAME}@${process.env.DB_HOST}`);
  console.log(`  Date: ${new Date().toISOString()}\n`);

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Order matters: delete child tables first to avoid FK constraint issues
    const deletions = [
      // Fraud-related
      { sql: "DELETE FROM invoice_fraud_indicator", label: "fraud indicators" },
      { sql: "DELETE FROM invoice_fraud_assessment", label: "fraud assessments" },

      // Payment
      { sql: "DELETE FROM payment", label: "payments" },

      // Reminders
      { sql: "DELETE FROM finance_reminders", label: "finance reminders" },
      { sql: "DELETE FROM subscription_reminders", label: "subscription reminders" },
      { sql: "DELETE FROM reminder_logs", label: "reminder logs" },
      { sql: "DELETE FROM reminder_settings", label: "reminder settings" },

      // Subscriptions
      { sql: "UPDATE companies SET subscription_settings_json = NULL", label: "subscription settings" },
      { sql: "DELETE FROM subscriptions", label: "subscriptions" },

      // Invoices (keep __SETTINGS__ row)
      { sql: "DELETE FROM invoice WHERE invoiceId <> '__SETTINGS__'", label: "invoices" },

      // Invoice validation summaries
      { sql: "DELETE FROM invoice_validation_summary", label: "invoice validation summaries" },

      // GST rates
      { sql: "DELETE FROM invoice_gst_rates", label: "invoice GST rates" },

      // Customers
      { sql: "DELETE FROM customer", label: "customers" },

      // Audit logs for invoice module
      { sql: "DELETE FROM audit_logs WHERE module = 'Invoice'", label: "invoice audit logs" },

      // Notification records (if linked to invoices)
      { sql: "DELETE FROM notification", label: "notifications" },
    ];

    console.log("  Deleting data...\n");

    for (const { sql, label } of deletions) {
      try {
        const [result] = await connection.query(sql);
        console.log(`  ✓ Deleted ${result.affectedRows} ${label}`);
      } catch (e) {
        if (e.code === "ER_NO_SUCH_TABLE") {
          console.log(`  - Skipped ${label} (table does not exist)`);
        } else if (e.code === "ER_BAD_FIELD_ERROR") {
          console.log(`  - Skipped ${label} (column not found)`);
        } else {
          console.log(`  ⚠ ${label}: ${e.message}`);
        }
      }
    }

    // Reset auto-increment counters
    console.log("\n  Resetting auto-increment counters...");
    const resetTables = [
      "invoice", "payment", "customer", "subscriptions",
      "invoice_fraud_assessment", "invoice_fraud_indicator",
      "finance_reminders", "subscription_reminders",
      "reminder_logs", "reminder_settings",
      "invoice_gst_rates", "invoice_validation_summary",
      "notification",
    ];

    for (const table of resetTables) {
      try {
        await connection.query(`ALTER TABLE ${table} AUTO_INCREMENT = 1`);
      } catch {
        // Table may not exist — that's fine
      }
    }
    console.log("  ✓ Auto-increment counters reset");

    // Reset the invoice sequence counter in __SETTINGS__ row
    try {
      await connection.query(
        "UPDATE invoice SET items_json = JSON_SET(items_json, '$.nextInvoiceNumber', 1) WHERE invoiceId = '__SETTINGS__'"
      );
      console.log("  ✓ Invoice sequence counter reset to 1");
    } catch (e) {
      console.log(`  ⚠ Could not reset sequence counter: ${e.message}`);
    }

    await connection.commit();

    console.log("\n════════════════════════════════════════════════════════");
    console.log("  ✓ All invoice module data cleared successfully!");
    console.log("════════════════════════════════════════════════════════\n");
  } catch (error) {
    await connection.rollback();
    console.error("\n✗ Error — transaction rolled back:", error.message);
    throw error;
  } finally {
    connection.release();
  }

  // Verify everything is clean
  console.log("  Verification:\n");
  const checks = [
    { label: "Invoices", sql: "SELECT COUNT(*) AS cnt FROM invoice WHERE invoiceId <> '__SETTINGS__'" },
    { label: "Customers", sql: "SELECT COUNT(*) AS cnt FROM customer" },
    { label: "Subscriptions", sql: "SELECT COUNT(*) AS cnt FROM subscriptions" },
    { label: "Payments", sql: "SELECT COUNT(*) AS cnt FROM payment" },
    { label: "Fraud Assessments", sql: "SELECT COUNT(*) AS cnt FROM invoice_fraud_assessment" },
    { label: "Finance Reminders", sql: "SELECT COUNT(*) AS cnt FROM finance_reminders" },
    { label: "Subscription Reminders", sql: "SELECT COUNT(*) AS cnt FROM subscription_reminders" },
    { label: "Invoice Audit Logs", sql: "SELECT COUNT(*) AS cnt FROM audit_logs WHERE module = 'Invoice'" },
    { label: "Invoice GST Rates", sql: "SELECT COUNT(*) AS cnt FROM invoice_gst_rates" },
  ];

  for (const { label, sql } of checks) {
    try {
      const [rows] = await pool.query(sql);
      console.log(`    ${label}: ${rows[0].cnt}`);
    } catch {
      console.log(`    ${label}: (table not found)`);
    }
  }

  console.log("\n  Done. Database connection closed.\n");
  await pool.end();
}

clearInvoiceModule().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
