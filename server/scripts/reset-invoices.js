/**
 * Reset Invoice Database Script
 *
 * Deletes all existing invoice records and related data, then resets
 * auto-increment sequences. Ensures no orphaned records remain.
 *
 * Usage: node scripts/reset-invoices.js
 */

require("dotenv").config();
const { pool } = require("../src/config/db");

async function resetInvoiceDatabase() {
  const connection = await pool.getConnection();

  try {
    console.log("[RESET] Starting invoice database reset...\n");
    await connection.beginTransaction();

    // 1. Delete payment records
    const [paymentResult] = await connection.query("DELETE FROM payment");
    console.log(`[RESET] Deleted ${paymentResult.affectedRows} payment records.`);

    // 2. Delete invoice items
    const [itemResult] = await connection.query("DELETE FROM invoice_item");
    console.log(`[RESET] Deleted ${itemResult.affectedRows} invoice items.`);

    // 3. Delete fraud assessments
    try {
      const [fraudResult] = await connection.query("DELETE FROM invoice_fraud_assessment");
      console.log(`[RESET] Deleted ${fraudResult.affectedRows} fraud assessments.`);
    } catch (e) {
      console.log("[RESET] No fraud assessment table or already empty.");
    }

    // 4. Delete invoice notifications
    try {
      const [notifResult] = await connection.query("DELETE FROM invoice_notification");
      console.log(`[RESET] Deleted ${notifResult.affectedRows} notifications.`);
    } catch (e) {
      console.log("[RESET] No notification table or already empty.");
    }

    // 5. Delete invoice view logs
    try {
      const [viewResult] = await connection.query("DELETE FROM invoice_view_log");
      console.log(`[RESET] Deleted ${viewResult.affectedRows} view logs.`);
    } catch (e) {
      console.log("[RESET] No view log table or already empty.");
    }

    // 6. Delete audit logs for invoices and payments
    const [auditResult] = await connection.query(
      "DELETE FROM audit_log WHERE entity_type IN ('invoice', 'payment')"
    );
    console.log(`[RESET] Deleted ${auditResult.affectedRows} audit log entries.`);

    // 7. Delete all invoices
    const [invoiceResult] = await connection.query("DELETE FROM invoice");
    console.log(`[RESET] Deleted ${invoiceResult.affectedRows} invoices.`);

    // 8. Reset auto-increment sequences
    await connection.query("ALTER TABLE invoice AUTO_INCREMENT = 1");
    await connection.query("ALTER TABLE invoice_item AUTO_INCREMENT = 1");
    await connection.query("ALTER TABLE payment AUTO_INCREMENT = 1");
    console.log("[RESET] Auto-increment sequences reset.");

    await connection.commit();
    console.log("\n[RESET] ✓ Invoice database reset complete. No orphaned records remain.");
  } catch (error) {
    await connection.rollback();
    console.error("[RESET] ✗ Reset failed:", error.message);
    process.exit(1);
  } finally {
    connection.release();
    await pool.end();
  }
}

resetInvoiceDatabase();
