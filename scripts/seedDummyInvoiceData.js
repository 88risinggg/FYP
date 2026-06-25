const path = require("path");

require("../server/node_modules/dotenv").config({ path: path.join(__dirname, "..", "server", ".env") });

const mysql = require("../server/node_modules/mysql2/promise");
const XLSX = require("../client/node_modules/xlsx");

const outputPath = path.join(__dirname, "..", "dummy_invoice_upload.xlsx");

const customers = [
  {
    name: "Acme Learning Centre",
    email: "accounts@acmelearning.sg",
    address: "12 North Bridge Road, Singapore 179094"
  },
  {
    name: "BrightPath Tuition",
    email: "finance@brightpath.sg",
    address: "8 Tampines Central 1, Singapore 529543"
  },
  {
    name: "Nova Skills Academy",
    email: "billing@novaskills.sg",
    address: "3 Fusionopolis Way, Singapore 138633"
  },
  {
    name: "Summit Corporate Training",
    email: "payables@summittraining.sg",
    address: "50 Raffles Place, Singapore 048623"
  },
  {
    name: "Urban Tech Institute",
    email: "admin@urbantech.edu.sg",
    address: "21 Bukit Batok Street 22, Singapore 659589"
  }
];

const invoiceDefinitions = [
  {
    customerEmail: "accounts@acmelearning.sg",
    issue_date: "2026-05-01",
    due_date: "2026-05-15",
    status: "Sent",
    items: [
      ["Math enrichment session", 8, 45.5],
      ["Learning materials", 12, 8.9]
    ]
  },
  {
    customerEmail: "finance@brightpath.sg",
    issue_date: "2026-05-03",
    due_date: "2026-05-17",
    status: "Viewed",
    items: [
      ["Science workshop", 10, 38.75],
      ["Assessment pack", 10, 6.5]
    ]
  },
  {
    customerEmail: "billing@novaskills.sg",
    issue_date: "2026-05-05",
    due_date: "2026-05-19",
    status: "Paid",
    items: [
      ["Excel automation training", 12, 52],
      ["Trainer travel allowance", 1, 35]
    ]
  },
  {
    customerEmail: "payables@summittraining.sg",
    issue_date: "2026-04-20",
    due_date: "2026-05-04",
    status: "Overdue",
    items: [
      ["Leadership bootcamp", 15, 64],
      ["Course handbook", 15, 7.25]
    ]
  },
  {
    customerEmail: "admin@urbantech.edu.sg",
    issue_date: "2026-05-08",
    due_date: "2026-05-22",
    status: "Draft",
    items: [
      ["Coding lab support", 6, 72.5],
      ["USB learning kit", 6, 12.4]
    ]
  },
  {
    customerEmail: "accounts@acmelearning.sg",
    issue_date: "2026-05-10",
    due_date: "2026-05-24",
    status: "Paid",
    items: [
      ["Holiday programme", 20, 49.9]
    ]
  },
  {
    customerEmail: "finance@brightpath.sg",
    issue_date: "2026-05-12",
    due_date: "2026-05-26",
    status: "Sent",
    items: [
      ["English clinic", 9, 42],
      ["Worksheet bundle", 9, 5.75]
    ]
  },
  {
    customerEmail: "billing@novaskills.sg",
    issue_date: "2026-05-14",
    due_date: "2026-05-28",
    status: "Sent",
    items: [
      ["Power BI fundamentals", 14, 58],
      ["Certificate printing", 14, 3.5]
    ]
  }
];

function toMoney(value) {
  return Number(Number(value).toFixed(2));
}

function toDatabaseStatus(status) {
  return status === "Paid" ? "Paid" : "Pending";
}

function nextInvoiceId(lastInvoiceId, offset) {
  const match = String(lastInvoiceId || "").match(/^INV-(\d+)$/i);
  const base = match ? Number(match[1]) : 0;
  return `INV-${String(base + offset).padStart(4, "0")}`;
}

async function ensurePaymentMethods(connection) {
  const paymentMethods = [
    ["Cash", "Cash payment"],
    ["Credit Card", "Card payment"],
    ["Bank Transfer", "Bank transfer payment"],
    ["PayNow", "PayNow transfer"]
  ];

  const ids = {};

  for (const [name, description] of paymentMethods) {
    const [existing] = await connection.query(
      "SELECT payment_method_id FROM payment_method WHERE name = ? LIMIT 1",
      [name]
    );

    if (existing.length > 0) {
      ids[name] = existing[0].payment_method_id;
      continue;
    }

    const [result] = await connection.query(
      "INSERT INTO payment_method (name, description, is_active) VALUES (?, ?, 1)",
      [name, description]
    );
    ids[name] = result.insertId;
  }

  return ids;
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

    await connection.query(
      `
        INSERT INTO invoice_item
          (description, quantity, unit_price, amount, invoice_invoice_id)
        VALUES ?
      `,
      [itemValues]
    );

    await connection.query(
      "INSERT INTO audit_log (action, entity_type, entity_id, user_user_id) VALUES (?, 'invoice', ?, NULL)",
      [`invoice_status:${definition.status}`, invoicePrimaryId]
    );

    if (definition.status === "Paid") {
      await connection.query(
        `
          INSERT INTO payment
            (payment_date, amount, status, transaction_id, invoice_invoice_id, payment_method_id)
          VALUES (NOW(), ?, 'Completed', ?, ?, ?)
        `,
        [
          String(total),
          `DUMMY-${invoiceId}`,
          invoicePrimaryId,
          paymentMethodIds["Bank Transfer"]
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
