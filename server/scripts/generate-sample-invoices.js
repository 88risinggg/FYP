/**
 * Generate Sample Invoices Script
 *
 * Creates a sample_invoices.xlsx file with 30 realistic invoices,
 * then imports them into the database.
 *
 * Usage: node scripts/generate-sample-invoices.js
 */

require("dotenv").config();
const ExcelJS = require("exceljs");
const path = require("path");
const { pool } = require("../src/config/db");

// =====================================================
// Sample Data
// =====================================================

const customers = [
  { name: "Luxe Hair Studio", company: "Luxe Hair Studio Pte Ltd", email: "bookings@luxehairstudio.sg" },
  { name: "The Nail Artistry", company: "The Nail Artistry Pte Ltd", email: "hello@thenailartistry.sg" },
  { name: "Serenity Spa & Wellness", company: "Serenity Spa & Wellness Pte Ltd", email: "reservations@serenityspa.sg" },
  { name: "Glow Aesthetics Clinic", company: "Glow Aesthetics Clinic Pte Ltd", email: "appointments@glowaesthetics.sg" },
  { name: "Brow & Lash Bar", company: "Brow & Lash Bar Pte Ltd", email: "info@browlashbar.sg" },
  { name: "KBeauty Haven", company: "KBeauty Haven Pte Ltd", email: "hello@kbeautyhaven.sg" },
  { name: "Zen Reflexology Centre", company: "Zen Reflexology Centre Pte Ltd", email: "bookings@zenreflexology.sg" },
  { name: "Prestige Barbers", company: "Prestige Barbers Pte Ltd", email: "appointments@prestigebarbers.sg" },
  { name: "Skin Lab Express", company: "Skin Lab Express Pte Ltd", email: "info@skinlabexpress.sg" },
  { name: "Orchid Beauty Lounge", company: "Orchid Beauty Lounge Pte Ltd", email: "bookings@orchidbeauty.sg" },
  { name: "The Waxing Boutique", company: "The Waxing Boutique Pte Ltd", email: "hello@waxingboutique.sg" },
  { name: "Radiance Medi-Spa", company: "Radiance Medi-Spa Pte Ltd", email: "info@radiancespa.sg" },
  { name: "Arut", company: "Arut Pte Ltd", email: "arut1657@gmail.com" },
  { name: "Aura Hair & Beauty", company: "Aura Hair & Beauty Pte Ltd", email: "bookings@aurahairbeauty.sg" },
  { name: "Bliss Nail Studio", company: "Bliss Nail Studio Pte Ltd", email: "hello@blissnails.sg" },
  { name: "Rejuve Wellness Clinic", company: "Rejuve Wellness Clinic Pte Ltd", email: "appointments@rejuveclinic.sg" }
];

const serviceDescriptions = [
  "Balayage Hair Coloring",
  "Keratin Smoothing Treatment",
  "Hair Extensions Installation",
  "Gel Manicure Session",
  "Classic Pedicure & Foot Spa",
  "Nail Art Design Package",
  "Full Body Massage (90 min)",
  "Hot Stone Therapy",
  "Aromatherapy Massage",
  "Hydrafacial Treatment",
  "Chemical Peel Session",
  "Microdermabrasion",
  "Eyebrow Embroidery",
  "Lash Lift & Tint",
  "Eyelash Extensions (Full Set)",
  "Brazilian Waxing",
  "Full Leg Waxing",
  "Underarm Waxing",
  "Facial Extraction & Treatment",
  "Anti-Aging Collagen Mask",
  "LED Light Therapy",
  "Scalp Treatment & Analysis",
  "Hair Rebonding",
  "Digital Perm",
  "Men's Grooming Package"
];

const statuses = ["Draft", "Sent", "Viewed", "Paid", "Overdue"];
const statusWeights = [5, 6, 5, 10, 4]; // weighted probability

const currencies = ["SGD"];

const notes = [
  "Payment due within 30 days. Thank you for your business.",
  "Please reference the invoice number in your payment.",
  "Net 30 payment terms apply.",
  "Late payment incurs 2% monthly interest.",
  "Thank you for choosing our services.",
  "For queries, contact finance@paynivo.com.",
  "Auto-generated invoice. No signature required.",
  "Includes all applicable taxes.",
  "Volume discount applied as per contract.",
  "Recurring monthly service charge."
];

// =====================================================
// Helper Functions
// =====================================================

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min, max, decimals = 2) {
  return Number((Math.random() * (max - min) + min).toFixed(decimals));
}

function randomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function weightedRandomStatus() {
  const totalWeight = statusWeights.reduce((sum, w) => sum + w, 0);
  let random = Math.random() * totalWeight;
  for (let i = 0; i < statuses.length; i++) {
    random -= statusWeights[i];
    if (random <= 0) return statuses[i];
  }
  return statuses[0];
}

function randomDate(startDaysAgo, endDaysAgo) {
  const start = Date.now() - startDaysAgo * 24 * 60 * 60 * 1000;
  const end = Date.now() - endDaysAgo * 24 * 60 * 60 * 1000;
  const timestamp = start + Math.random() * (end - start);
  return new Date(timestamp).toISOString().split("T")[0];
}

function addDays(dateStr, days) {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return date.toISOString().split("T")[0];
}

function generateLineItems() {
  const itemCount = randomInt(1, 5);
  const items = [];
  const usedDescriptions = new Set();

  for (let i = 0; i < itemCount; i++) {
    let desc;
    do {
      desc = randomElement(serviceDescriptions);
    } while (usedDescriptions.has(desc) && usedDescriptions.size < serviceDescriptions.length);
    usedDescriptions.add(desc);

    const quantity = randomInt(1, 10);
    const unitPrice = randomFloat(50, 5000);
    const total = Number((quantity * unitPrice).toFixed(2));

    items.push({ description: desc, quantity, unitPrice, total });
  }

  return items;
}

// =====================================================
// Generate 30 Invoices
// =====================================================

function generateInvoices() {
  const invoices = [];

  for (let i = 1; i <= 30; i++) {
    const customer = randomElement(customers);
    const issueDate = randomDate(90, 5);
    const dueDays = randomInt(14, 45);
    const dueDate = addDays(issueDate, dueDays);
    const status = weightedRandomStatus();
    const items = generateLineItems();
    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const taxRate = randomElement([0, 0.07, 0.08, 0.09]);
    const tax = Number((subtotal * taxRate).toFixed(2));
    const discountRate = Math.random() < 0.3 ? randomFloat(0.02, 0.1) : 0;
    const discount = Number((subtotal * discountRate).toFixed(2));
    const total = Number((subtotal + tax - discount).toFixed(2));

    invoices.push({
      invoiceNumber: `INV-${String(i).padStart(6, "0")}`,
      customerName: customer.name,
      companyName: customer.company,
      customerEmail: customer.email,
      invoiceDate: issueDate,
      dueDate: dueDate,
      currency: "SGD",
      status: status,
      subtotal: subtotal,
      tax: tax,
      discount: discount,
      total: total,
      notes: randomElement(notes),
      items: items
    });
  }

  return invoices;
}

// =====================================================
// Create Excel File
// =====================================================

async function createExcelFile(invoices) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "PayNivo";
  workbook.created = new Date();

  // Sheet 1: Invoices
  const invoiceSheet = workbook.addWorksheet("Invoices");
  invoiceSheet.columns = [
    { header: "Invoice Number", key: "invoiceNumber", width: 18 },
    { header: "Customer Name", key: "customerName", width: 25 },
    { header: "Company Name", key: "companyName", width: 30 },
    { header: "Customer Email", key: "customerEmail", width: 30 },
    { header: "Invoice Date", key: "invoiceDate", width: 14 },
    { header: "Due Date", key: "dueDate", width: 14 },
    { header: "Currency", key: "currency", width: 10 },
    { header: "Status", key: "status", width: 12 },
    { header: "Subtotal", key: "subtotal", width: 14 },
    { header: "Tax", key: "tax", width: 12 },
    { header: "Discount", key: "discount", width: 12 },
    { header: "Total", key: "total", width: 14 },
    { header: "Notes", key: "notes", width: 45 }
  ];

  // Style header row
  invoiceSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  invoiceSheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF7B2FF7" }
  };

  invoices.forEach((inv) => {
    invoiceSheet.addRow({
      invoiceNumber: inv.invoiceNumber,
      customerName: inv.customerName,
      companyName: inv.companyName,
      customerEmail: inv.customerEmail,
      invoiceDate: inv.invoiceDate,
      dueDate: inv.dueDate,
      currency: inv.currency,
      status: inv.status,
      subtotal: inv.subtotal,
      tax: inv.tax,
      discount: inv.discount,
      total: inv.total,
      notes: inv.notes
    });
  });

  // Sheet 2: Line Items
  const itemsSheet = workbook.addWorksheet("Line Items");
  itemsSheet.columns = [
    { header: "Invoice Number", key: "invoiceNumber", width: 18 },
    { header: "Description", key: "description", width: 40 },
    { header: "Quantity", key: "quantity", width: 10 },
    { header: "Unit Price", key: "unitPrice", width: 14 },
    { header: "Total", key: "total", width: 14 }
  ];

  itemsSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  itemsSheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF7B2FF7" }
  };

  invoices.forEach((inv) => {
    inv.items.forEach((item) => {
      itemsSheet.addRow({
        invoiceNumber: inv.invoiceNumber,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.total
      });
    });
  });

  const filePath = path.join(__dirname, "..", "sample_invoices.xlsx");
  await workbook.xlsx.writeFile(filePath);
  console.log(`[GENERATE] ✓ Excel file created: ${filePath}`);
  return filePath;
}

// =====================================================
// Import Invoices into Database
// =====================================================

async function importInvoices(invoices) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Ensure customers exist in the database
    const customerMap = new Map();
    for (const inv of invoices) {
      if (!customerMap.has(inv.customerName)) {
        // Check if customer exists
        const [existing] = await connection.query(
          "SELECT customer_id FROM customer WHERE name = ? LIMIT 1",
          [inv.customerName]
        );

        if (existing.length > 0) {
          customerMap.set(inv.customerName, existing[0].customer_id);
        } else {
          // Create customer
          const [result] = await connection.query(
            "INSERT INTO customer (name, email, address, created_at) VALUES (?, ?, ?, NOW())",
            [inv.customerName, inv.customerEmail, `${inv.companyName}, Singapore`]
          );
          customerMap.set(inv.customerName, result.insertId);
        }
      }
    }

    console.log(`[IMPORT] Resolved ${customerMap.size} customers.`);

    // Import each invoice
    let imported = 0;
    for (const inv of invoices) {
      const customerId = customerMap.get(inv.customerName);

      const [invoiceResult] = await connection.query(
        `INSERT INTO invoice (status, issue_date, due_date, invoiceId, total_amount, customer_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [inv.status, inv.invoiceDate, inv.dueDate, inv.invoiceNumber, inv.total, customerId]
      );

      const invoicePk = invoiceResult.insertId;

      // Insert line items
      const itemValues = inv.items.map((item) => [
        item.description,
        item.quantity,
        item.unitPrice,
        item.total,
        invoicePk
      ]);

      await connection.query(
        "INSERT INTO invoice_item (description, quantity, unit_price, amount, invoice_invoice_id) VALUES ?",
        [itemValues]
      );

      // Write audit log
      await connection.query(
        `INSERT INTO audit_log (action, entity_type, entity_id, user_user_id) VALUES (?, 'invoice', ?, NULL)`,
        [`invoice_status:${inv.status}`, invoicePk]
      );

      imported++;
    }

    await connection.commit();
    console.log(`[IMPORT] ✓ Successfully imported ${imported} invoices.`);

    // Verify count
    const [countResult] = await pool.query("SELECT COUNT(*) AS total FROM invoice");
    console.log(`[VERIFY] ✓ Database contains ${countResult[0].total} invoices.`);

    if (countResult[0].total !== 30) {
      console.error(`[VERIFY] ✗ Expected 30 invoices, found ${countResult[0].total}`);
    }
  } catch (error) {
    await connection.rollback();
    console.error("[IMPORT] ✗ Import failed:", error.message);
    throw error;
  } finally {
    connection.release();
  }
}

// =====================================================
// Main
// =====================================================

async function main() {
  try {
    console.log("=== PayNivo Invoice Sample Data Generator ===\n");

    // Generate 30 invoices
    const invoices = generateInvoices();
    console.log(`[GENERATE] Generated ${invoices.length} invoices with line items.\n`);

    // Create Excel file
    await createExcelFile(invoices);

    // Import into database
    console.log("\n[IMPORT] Importing invoices into database...");
    await importInvoices(invoices);

    console.log("\n=== ✓ All done! ===");
  } catch (error) {
    console.error("[ERROR]", error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
