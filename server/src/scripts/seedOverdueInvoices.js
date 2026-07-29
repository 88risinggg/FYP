/**
 * Seed Overdue Invoices
 *
 * Inserts sample overdue invoices into the database for testing
 * the reminder system. Uses existing customers (company_id = 1).
 *
 * Run: node src/scripts/seedOverdueInvoices.js
 */

const { pool } = require("../config/db");

const COMPANY_ID = 1;

// Overdue invoices — due dates in the past so they trigger reminders
const overdueInvoices = [
  {
    customerName: "Riho Sonoda",
    customerId: 23,
    amount: 1250.00,
    daysOverdue: 3,
    service: "Premium Hair Treatment Package"
  },
  {
    customerName: "Nazrina Muhamat Bakri",
    customerId: 24,
    amount: 890.50,
    daysOverdue: 7,
    service: "Full Body Spa Treatment"
  },
  {
    customerName: "Fauziah Osman",
    customerId: 25,
    amount: 2100.00,
    daysOverdue: 14,
    service: "Monthly Beauty Subscription - June 2026"
  },
  {
    customerName: "Sarah Tan",
    customerId: 26,
    amount: 560.00,
    daysOverdue: 21,
    service: "Facial & Skin Treatment"
  },
  {
    customerName: "Linda Wong",
    customerId: 27,
    amount: 3450.75,
    daysOverdue: 35,
    service: "Quarterly Wellness Package Q2 2026"
  },
  {
    customerName: "Riho Sonoda",
    customerId: 23,
    amount: 780.00,
    daysOverdue: 1,
    service: "Hair Coloring & Styling"
  },
  {
    customerName: "Nazrina Muhamat Bakri",
    customerId: 24,
    amount: 4200.00,
    daysOverdue: 45,
    service: "Annual Membership Renewal"
  },
  {
    customerName: "Sarah Tan",
    customerId: 26,
    amount: 1680.00,
    daysOverdue: 10,
    service: "Laser Hair Removal - 6 Sessions"
  }
];

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

async function seedOverdueInvoices() {
  console.log("=== Seeding Overdue Invoices for Reminder Testing ===\n");

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Get the current highest invoice number to continue the sequence
    const [lastInvoice] = await connection.query(
      "SELECT invoiceId FROM invoice WHERE invoiceId LIKE 'INV-%' ORDER BY invoice_id DESC LIMIT 1"
    );
    let nextNumber = 1;
    if (lastInvoice.length > 0) {
      const match = lastInvoice[0].invoiceId.match(/(\d+)$/);
      if (match) nextNumber = Number(match[1]) + 1;
    }

    const createdInvoices = [];

    for (const inv of overdueInvoices) {
      const now = new Date();
      const dueDate = new Date(now);
      dueDate.setDate(dueDate.getDate() - inv.daysOverdue);

      const issueDate = new Date(dueDate);
      issueDate.setDate(issueDate.getDate() - 30); // issued 30 days before due

      const invoiceId = `INV-2026-${String(nextNumber).padStart(4, "0")}`;
      nextNumber++;

      // Insert as "Overdue" status for immediate reminder testing
      const [result] = await connection.query(
        `INSERT INTO invoice
          (status, issue_date, due_date, invoiceId, total_amount, customer_id, company_id, created_at)
         VALUES ('Overdue', ?, ?, ?, ?, ?, ?, NOW())`,
        [
          formatDate(issueDate),
          formatDate(dueDate),
          invoiceId,
          inv.amount,
          inv.customerId,
          COMPANY_ID
        ]
      );

      const invoicePk = result.insertId;

      // Store line items as JSON
      const items = [
        {
          description: inv.service,
          quantity: 1,
          unit_price: inv.amount,
          amount: inv.amount
        }
      ];

      await connection.query(
        "UPDATE invoice SET items_json = ? WHERE invoice_id = ?",
        [JSON.stringify(items), invoicePk]
      );

      // Try to insert into invoice_item table too
      try {
        await connection.query(
          "INSERT INTO invoice_item (description, quantity, unit_price, amount, invoice_invoice_id) VALUES (?, 1, ?, ?, ?)",
          [inv.service, inv.amount, inv.amount, invoicePk]
        );
      } catch {
        // invoice_item table may not exist
      }

      createdInvoices.push({
        invoice_id: invoicePk,
        invoiceId,
        customer: inv.customerName,
        amount: `SGD ${inv.amount.toFixed(2)}`,
        daysOverdue: inv.daysOverdue,
        dueDate: formatDate(dueDate)
      });

      console.log(
        `  + ${invoiceId} | ${inv.customerName.padEnd(25)} | SGD ${inv.amount.toFixed(2).padStart(9)} | ${inv.daysOverdue} days overdue (due ${formatDate(dueDate)})`
      );
    }

    await connection.commit();

    console.log(`\n=== Created ${createdInvoices.length} overdue invoices ===`);
    console.log("\nThese invoices will trigger:");
    console.log("  - Finance Reminders (invoice_overdue type)");
    console.log("  - Automatic reminder emails (if reminder scheduler is running)");
    console.log("  - Overdue notifications to Finance users");
    console.log("\nTo generate Finance reminders manually, call:");
    console.log("  POST /api/finance-reminders/generate");

  } catch (error) {
    await connection.rollback();
    console.error("\nFailed to seed invoices:", error.message);
  } finally {
    connection.release();
    process.exit(0);
  }
}

seedOverdueInvoices();
