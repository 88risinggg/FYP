const path = require("path");

require("../server/node_modules/dotenv").config({ path: path.join(__dirname, "..", "server", ".env") });

const mysql = require("../server/node_modules/mysql2/promise");
const XLSX = require("../client/node_modules/xlsx");

const outputPath = path.join(__dirname, "..", "dummy_invoice_upload.xlsx");

const customers = [
  {
    name: "Luxe Hair Studio",
    email: "bookings@luxehairstudio.sg",
    address: "391B Orchard Road, #03-12, Ngee Ann City, Singapore 238874"
  },
  {
    name: "The Nail Artistry",
    email: "hello@thenailartistry.sg",
    address: "68 Orchard Road, #04-58, Plaza Singapura, Singapore 238839"
  },
  {
    name: "Serenity Spa & Wellness",
    email: "reservations@serenityspa.sg",
    address: "2 Bayfront Avenue, #B1-05, Marina Bay Sands, Singapore 018972"
  },
  {
    name: "Glow Aesthetics Clinic",
    email: "appointments@glowaesthetics.sg",
    address: "1 Raffles Place, #05-19, One Raffles Place, Singapore 048616"
  },
  {
    name: "Brow & Lash Bar",
    email: "info@browlashbar.sg",
    address: "313 Orchard Road, #02-28, 313@Somerset, Singapore 238895"
  }
];

const invoiceDefinitions = [
  {
    customerEmail: "bookings@luxehairstudio.sg",
    issue_date: "2026-05-01",
    due_date: "2026-05-15",
    status: "Sent",
    items: [
      ["Balayage hair coloring", 3, 185.00],
      ["Olaplex hair treatment", 3, 65.00]
    ]
  },
  {
    customerEmail: "hello@thenailartistry.sg",
    issue_date: "2026-05-03",
    due_date: "2026-05-17",
    status: "Viewed",
    items: [
      ["Gel manicure session", 12, 48.00],
      ["Nail art add-on", 8, 25.00]
    ]
  },
  {
    customerEmail: "reservations@serenityspa.sg",
    issue_date: "2026-05-05",
    due_date: "2026-05-19",
    status: "Paid",
    items: [
      ["Full body massage (90 min)", 5, 158.00],
      ["Aromatherapy upgrade", 5, 30.00]
    ]
  },
  {
    customerEmail: "appointments@glowaesthetics.sg",
    issue_date: "2026-04-20",
    due_date: "2026-05-04",
    status: "Overdue",
    items: [
      ["Hydrafacial treatment", 4, 280.00],
      ["LED light therapy add-on", 4, 85.00]
    ]
  },
  {
    customerEmail: "info@browlashbar.sg",
    issue_date: "2026-05-08",
    due_date: "2026-05-22",
    status: "Draft",
    items: [
      ["Eyebrow embroidery", 2, 388.00],
      ["Lash lift & tint", 4, 78.00]
    ]
  },
  {
    customerEmail: "bookings@luxehairstudio.sg",
    issue_date: "2026-05-10",
    due_date: "2026-05-24",
    status: "Paid",
    items: [
      ["Keratin smoothing treatment", 6, 220.00]
    ]
  },
  {
    customerEmail: "hello@thenailartistry.sg",
    issue_date: "2026-05-12",
    due_date: "2026-05-26",
    status: "Sent",
    items: [
      ["Classic pedicure", 9, 58.00],
      ["Paraffin wax treatment", 9, 22.00]
    ]
  },
  {
    customerEmail: "reservations@serenityspa.sg",
    issue_date: "2026-05-14",
    due_date: "2026-05-28",
    status: "Sent",
    items: [
      ["Hot stone massage", 7, 188.00],
      ["Complimentary herbal tea set", 7, 12.00]
    ]
  }
];

function toMoney(value) {
  return Number(Number(value).toFixed(2));
}

function toDatabaseStatus(status) {
  // Use the status directly — invoice table uses ENUM with these values
  return status;
}

function nextInvoiceId(lastInvoiceId, offset) {
  const match = String(lastInvoiceId || "").match(/^INV-(\d+)$/i);
  const base = match ? Number(match[1]) : 0;
  return `INV-${String(base + offset).padStart(4, "0")}`;
}

async function ensurePaymentMethods(connection) {
  // payment_method table doesn't exist in this schema
  // payments use payment_method_name column directly
  return {};
}

async function ensureCustomers(connection) {
  const idsByEmail = {};

  for (const customer of customers) {
    const [existing] = await connection.query(
      "SELECT customer_id FROM customer WHERE email = ? LIMIT 1",
      [customer.email]
    );

    if (existing.length > 0) {
      idsByEmail[customer.email] = existing[0].customer_id;
      await connection.query(
        "UPDATE customer SET name = ?, address = ? WHERE customer_id = ?",
        [customer.name, customer.address, existing[0].customer_id]
      );
      continue;
    }

    const [result] = await connection.query(
      "INSERT INTO customer (name, email, address) VALUES (?, ?, ?)",
      [customer.name, customer.email, customer.address]
    );
    idsByEmail[customer.email] = result.insertId;
  }

  return idsByEmail;
}

async function seedInvoices(connection, customerIdsByEmail, paymentMethodIds) {
  const [lastRows] = await connection.query(`
    SELECT invoiceId
    FROM invoice
    WHERE invoiceId LIKE 'INV-%'
    ORDER BY invoice_id DESC
    LIMIT 1
    FOR UPDATE
  `);

  const insertedInvoices = [];
  let createdCount = 0;

  for (const definition of invoiceDefinitions) {
    const customerId = customerIdsByEmail[definition.customerEmail];
    const total = toMoney(
      definition.items.reduce((sum, [, quantity, unitPrice]) => sum + quantity * unitPrice, 0)
    );

    const [existingInvoices] = await connection.query(
      `
        SELECT invoice_id, invoiceId
        FROM invoice
        WHERE customer_id = ?
          AND issue_date = ?
          AND due_date = ?
          AND total_amount = ?
        LIMIT 1
      `,
      [customerId, definition.issue_date, definition.due_date, total]
    );

    if (existingInvoices.length > 0) {
      insertedInvoices.push({
        invoice_id: existingInvoices[0].invoice_id,
        invoiceId: existingInvoices[0].invoiceId,
        status: definition.status,
        total_amount: total,
        skipped: true
      });
      continue;
    }

    const invoiceId = nextInvoiceId(lastRows[0]?.invoiceId, createdCount + 1);

    const [result] = await connection.query(
      `
        INSERT INTO invoice
          (status, issue_date, due_date, invoiceId, total_amount, customer_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, NOW())
      `,
      [
        toDatabaseStatus(definition.status),
        definition.issue_date,
        definition.due_date,
        invoiceId,
        total,
        customerId
      ]
    );

    const invoicePrimaryId = result.insertId;
    const itemValues = definition.items.map(([description, quantity, unitPrice]) => [
      description,
      quantity,
      toMoney(unitPrice),
      toMoney(quantity * unitPrice),
      invoicePrimaryId
    ]);

    // Store items as JSON on invoice table
    const itemsJson = definition.items.map(([description, quantity, unitPrice]) => ({
      description,
      quantity,
      unit_price: toMoney(unitPrice),
      amount: toMoney(quantity * unitPrice)
    }));
    await connection.query(
      "UPDATE invoice SET items_json = ? WHERE invoice_id = ?",
      [JSON.stringify(itemsJson), invoicePrimaryId]
    );

    try {
      await connection.query(
        "INSERT INTO audit_logs (action, entity_type, entity_id, user_user_id) VALUES (?, 'invoice', ?, NULL)",
        [`invoice_status:${definition.status}`, invoicePrimaryId]
      );
    } catch { /* audit_logs table may have different schema */ }

    if (definition.status === "Paid") {
      await connection.query(
        `
          INSERT INTO payment
            (payment_date, amount, status, transaction_id, invoice_invoice_id, payment_method_name)
          VALUES (NOW(), ?, 'Completed', ?, ?, 'Bank Transfer')
        `,
        [
          String(total),
          `DUMMY-${invoiceId}`,
          invoicePrimaryId
        ]
      );
    }

    insertedInvoices.push({
      invoice_id: invoicePrimaryId,
      invoiceId,
      status: definition.status,
      total_amount: total
    });
    createdCount += 1;
  }

  return insertedInvoices;
}

function writeWorkbook(customerIdsByEmail) {
  const customerByEmail = Object.fromEntries(customers.map((customer) => [customer.email, customer]));
  const importRows = invoiceDefinitions.flatMap((invoice) => {
    const customer = customerByEmail[invoice.customerEmail];

    return invoice.items.map(([description, quantity, unitPrice]) => ({
      customer_id: customerIdsByEmail[invoice.customerEmail],
      customer_name: customer.name,
      customer_email: customer.email,
      issue_date: invoice.issue_date,
      due_date: invoice.due_date,
      description,
      quantity,
      unit_price: toMoney(unitPrice),
      status: invoice.status
    }));
  });

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(importRows);
  worksheet["!cols"] = [
    { wch: 12 },
    { wch: 28 },
    { wch: 30 },
    { wch: 12 },
    { wch: 12 },
    { wch: 28 },
    { wch: 10 },
    { wch: 12 },
    { wch: 10 }
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, "Bulk Invoice Rows");
  XLSX.writeFile(workbook, outputPath);

  return { outputPath, rowCount: importRows.length };
}

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: true } : undefined
  });

  try {
    await connection.beginTransaction();
    const customerIdsByEmail = await ensureCustomers(connection);
    const paymentMethodIds = await ensurePaymentMethods(connection);
    const insertedInvoices = await seedInvoices(connection, customerIdsByEmail, paymentMethodIds);
    await connection.commit();

    const workbook = writeWorkbook(customerIdsByEmail);

    console.log(`Customers available: ${Object.keys(customerIdsByEmail).length}`);
    const skippedCount = insertedInvoices.filter((invoice) => invoice.skipped).length;
    console.log(`Invoices inserted: ${insertedInvoices.length - skippedCount}`);
    console.log(`Invoices skipped: ${skippedCount}`);
    console.log(`Excel rows written: ${workbook.rowCount}`);
    console.log(`Excel file: ${workbook.outputPath}`);
    console.log(`Invoice IDs: ${insertedInvoices.map((invoice) => invoice.invoiceId).join(", ")}`);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
