require("dotenv").config();
const { pool } = require("../src/config/db");

async function verify() {
  const [rows] = await pool.query(
    "SELECT invoiceId, status, issue_date, due_date, payment_url, stripe_session_id, payment_status, payment_method, payment_date, transaction_id FROM invoice ORDER BY invoice_id"
  );

  console.log("\n=== Invoice Verification (30 invoices) ===\n");
  console.log("INV#           | Status  | PayStatus | PayMethod    | TxnID");
  console.log("---------------|---------|-----------|--------------|------------------");

  rows.forEach((row) => {
    const inv = row.invoiceId.padEnd(14);
    const status = row.status.padEnd(7);
    const pStatus = (row.payment_status || "-").padEnd(9);
    const pMethod = (row.payment_method || "-").padEnd(12);
    const txn = row.transaction_id ? row.transaction_id.substring(0, 18) : "-";
    console.log(`${inv} | ${status} | ${pStatus} | ${pMethod} | ${txn}`);
  });

  // Count by status
  const [counts] = await pool.query("SELECT status, COUNT(*) AS cnt FROM invoice GROUP BY status ORDER BY FIELD(status, 'Draft','Sent','Viewed','Paid','Overdue')");
  console.log("\n=== Status Distribution ===");
  counts.forEach((r) => console.log(`  ${r.status}: ${r.cnt}`));

  // Count payments
  const [payments] = await pool.query("SELECT COUNT(*) AS cnt FROM payment");
  console.log(`\n  Payment records: ${payments[0].cnt}`);

  // Verify Draft invoices have NO Stripe data
  const [drafts] = await pool.query("SELECT invoiceId, payment_url, stripe_session_id FROM invoice WHERE status = 'Draft'");
  const draftsClean = drafts.every((d) => !d.payment_url && !d.stripe_session_id);
  console.log(`\n  Draft invoices have no Stripe session: ${draftsClean ? "✓" : "✗"}`);

  // Verify Paid invoices have payment records
  const [paidWithTxn] = await pool.query("SELECT COUNT(*) AS cnt FROM invoice WHERE status = 'Paid' AND transaction_id IS NOT NULL");
  console.log(`  Paid invoices with transaction_id: ${paidWithTxn[0].cnt}/6`);

  // Verify Overdue invoices have due dates in the past
  const [overduePast] = await pool.query("SELECT COUNT(*) AS cnt FROM invoice WHERE status = 'Overdue' AND due_date < CURDATE()");
  console.log(`  Overdue invoices with past due date: ${overduePast[0].cnt}/6`);

  await pool.end();
}

verify().catch((e) => { console.error(e); process.exit(1); });
