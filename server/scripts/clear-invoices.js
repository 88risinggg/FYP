const { pool } = require("../src/config/db");

async function run() {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [ids] = await conn.query(
      "SELECT invoice_id FROM invoice WHERE invoiceId != '__SETTINGS__'"
    );
    const invoiceIds = ids.map(r => r.invoice_id);
    console.log("Invoice IDs to delete:", invoiceIds.length);

    if (invoiceIds.length > 0) {
      const [p] = await conn.query(
        "DELETE FROM payment WHERE invoice_invoice_id IN (?)",
        [invoiceIds]
      );
      console.log("Payments deleted:", p.affectedRows);

      const [n] = await conn.query(
        "DELETE FROM notification WHERE invoice_id IN (?)",
        [invoiceIds]
      );
      console.log("Notifications deleted:", n.affectedRows);

      const [inv] = await conn.query(
        "DELETE FROM invoice WHERE invoice_id IN (?)",
        [invoiceIds]
      );
      console.log("Invoices deleted:", inv.affectedRows);
    }

    // Reset the invoice sequence counter so next invoice starts at INV-2026-0001
    await conn.query(
      "UPDATE invoice SET items_json = JSON_SET(items_json, '$.nextInvoiceNumber', 1) WHERE invoiceId = '__SETTINGS__'"
    );
    console.log("Sequence counter reset to 1.");

    await conn.commit();
    console.log("All invoices cleared successfully.");
  } catch (e) {
    await conn.rollback();
    console.error("FAILED:", e.message);
  } finally {
    conn.release();
    pool.end();
  }
}

run();
