/**
 * Creates a deterministic, non-destructive fraud testing dataset.
 *
 * Prerequisite: npm run db:migrate-workflow
 * Usage:        npm run seed:fraud-test
 */
require("dotenv").config();
const { pool } = require("../src/config/db");
const { assessInvoiceRisk } = require("../src/services/fraudDetectionService");

const PREFIX = "FDT-";
const today = new Date();
const iso = (date) => date.toISOString().slice(0, 10);
const addDays = (date, days) => new Date(date.getTime() + days * 86400000);

async function customer(connection, name, email, phone) {
  const [found] = await connection.query("SELECT customer_id FROM customer WHERE email = ? LIMIT 1", [email]);
  if (found.length) return found[0].customer_id;
  const [result] = await connection.query(
    "INSERT INTO customer (name, email, address, phone, created_at) VALUES (?, ?, ?, ?, NOW())",
    [name, email, "21 Orchard Road, Singapore 238841", phone]
  );
  return result.insertId;
}

async function insertInvoice(connection, data) {
  const [result] = await connection.query(
    `INSERT INTO invoice
      (status, issue_date, due_date, invoiceId, total_amount, customer_id, created_at, items_json, vendor_name, shop_title)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [data.status, data.issueDate, data.dueDate, data.invoiceId, data.amount, data.customerId,
      data.createdAt, JSON.stringify([{ description: data.description, quantity: 1, unit_price: data.amount, amount: data.amount }]),
      data.vendor, data.vendor]
  );
  try {
    await connection.query(
      "INSERT INTO invoice_item (description, quantity, unit_price, amount, invoice_invoice_id) VALUES (?, 1, ?, ?, ?)",
      [data.description, data.amount, data.amount, result.insertId]
    );
  } catch { /* items_json is the canonical fallback */ }
  if (data.status === "Paid") {
    try {
      await connection.query(
        `INSERT INTO payment (payment_date, amount, status, transaction_id, invoice_invoice_id, payment_method_name)
         VALUES (?, ?, 'Completed', ?, ?, 'PayNow')`,
        [data.issueDate, data.amount, `FDT-PAY-${data.invoiceId}`, result.insertId]
      );
    } catch { /* payment support is optional in minimal deployments */ }
  }
  return result.insertId;
}

async function main() {
  const connection = await pool.getConnection();
  try {
    const [existing] = await connection.query("SELECT COUNT(*) AS count FROM invoice WHERE invoiceId LIKE ?", [`${PREFIX}%`]);
    if (Number(existing[0].count)) {
      console.log("Fraud test dataset already exists; no records were changed.");
      return;
    }
    await connection.beginTransaction();
    const ids = { low: [], medium: [], high: [] };
    const regularCustomers = [];
    for (let c = 1; c <= 4; c += 1) {
      regularCustomers.push(await customer(connection, `Harbour Wellness Client ${c}`, `fraud.low${c}@example.com`, `+65910000${c}`));
    }

    // 20 normal invoices: established customers, normal terms and amounts.
    for (let i = 0; i < 20; i += 1) {
      const issue = addDays(today, -90 + i * 3);
      ids.low.push(await insertInvoice(connection, {
        invoiceId: `${PREFIX}LOW-${String(i + 1).padStart(3, "0")}`,
        customerId: regularCustomers[i % regularCustomers.length], amount: 125 + (i % 5) * 17.5,
        issueDate: iso(issue), dueDate: iso(addDays(issue, 30)), createdAt: addDays(issue, 0),
        status: i % 3 === 0 ? "Paid" : "Sent", vendor: "Harbour Wellness", description: "Monthly wellness treatment service"
      }));
    }

    // The first is a control; the following 15 are duplicate customer/date/total
    // invoices with unusually long terms, reliably scoring Medium.
    const mediumCustomer = await customer(connection, "New Seasonal Client", "fraud.medium@example.com", "+6592000001");
    const mediumIssue = addDays(today, -8);
    for (let i = 0; i < 16; i += 1) {
      ids.medium.push(await insertInvoice(connection, {
        invoiceId: `${PREFIX}MED-${String(i + 1).padStart(3, "0")}`, customerId: mediumCustomer,
        amount: 740, issueDate: iso(mediumIssue), dueDate: iso(addDays(mediumIssue, 75)),
        createdAt: new Date(mediumIssue.getTime() + i * 3600000), status: "Sent",
        vendor: "Seasonal Beauty Services", description: "Repeated seasonal facial service"
      }));
    }

    // 15 high-risk invoices: extreme repeated rounded amounts, rapid creation,
    // abnormal terms and suspicious descriptions for an existing customer.
    const highStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 2, 0, 0);
    for (let i = 0; i < 15; i += 1) {
      ids.high.push(await insertInvoice(connection, {
        invoiceId: `${PREFIX}HIGH-${String(i + 1).padStart(3, "0")}`, customerId: regularCustomers[0],
        amount: 50000, issueDate: iso(today), dueDate: iso(addDays(today, 120)),
        createdAt: new Date(highStart.getTime() + i * 60000), status: "Draft",
        vendor: "Harbour Wellness", description: "Urgent confidential refund adjustment cash payout"
      }));
    }

    // Assess after all comparison records exist.  Exclude the medium control;
    // this leaves at least 20 Low, 15 Medium and 15 High invoices.
    for (const invoiceId of [...ids.low, ...ids.medium.slice(1), ...ids.high]) {
      await assessInvoiceRisk(connection, invoiceId, { source: "fraud_test_dataset" });
    }
    await connection.commit();
    console.log("Created fraud test dataset: 20 Low, 15 Medium, 15 High risk invoices (plus one Medium control record).");
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}

main().catch((error) => { console.error("Fraud dataset seed failed:", error.message); process.exitCode = 1; });
