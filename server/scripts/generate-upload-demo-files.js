/**
 * Generate Bulk Upload Demo Files
 *
 * Creates sample CSV and XLSX files that demonstrate both successful
 * and failed uploads with intentional validation errors.
 *
 * Output:
 *   uploads/templates/demo_bulk_upload_valid.csv
 *   uploads/templates/demo_bulk_upload_mixed.csv
 *   uploads/templates/demo_bulk_upload_mixed.xlsx
 *
 * Usage: node scripts/generate-upload-demo-files.js
 */

const ExcelJS = require("exceljs");
const path = require("path");
const fs = require("fs");

const OUTPUT_DIR = path.join(__dirname, "..", "uploads", "templates");

// ─── Valid records (will pass validation) ────────────────────────────────────

const VALID_RECORDS = [
  { invoice_number: "INV-2026-0101", customer_name: "Luxe Hair Studio", invoice_date: "2026-08-01", due_date: "2026-08-31", amount: 4850.00, subscription: "Premium Monthly" },
  { invoice_number: "INV-2026-0102", customer_name: "The Nail Artistry", invoice_date: "2026-08-01", due_date: "2026-08-31", amount: 3760.00, subscription: "Standard Monthly" },
  { invoice_number: "INV-2026-0103", customer_name: "Serenity Spa & Wellness", invoice_date: "2026-08-05", due_date: "2026-09-04", amount: 8920.00, subscription: "Enterprise Quarterly" },
  { invoice_number: "INV-2026-0104", customer_name: "Glow Aesthetics Clinic", invoice_date: "2026-08-10", due_date: "2026-09-09", amount: 1268.50, subscription: "" },
  { invoice_number: "INV-2026-0105", customer_name: "Brow & Lash Bar", invoice_date: "2026-08-12", due_date: "2026-09-11", amount: 654.00, subscription: "Standard Monthly" },
  { invoice_number: "INV-2026-0106", customer_name: "KBeauty Haven", invoice_date: "2026-08-15", due_date: "2026-09-14", amount: 2400.00, subscription: "Enterprise Quarterly" },
  { invoice_number: "INV-2026-0107", customer_name: "Zen Reflexology Centre", invoice_date: "2026-08-18", due_date: "2026-09-17", amount: 299.00, subscription: "Payroll Service" },
  { invoice_number: "INV-2026-0108", customer_name: "Prestige Barbers", invoice_date: "2026-08-20", due_date: "2026-09-19", amount: 1200.00, subscription: "Software Licensing" },
];

// ─── Invalid records (will trigger specific validation errors) ───────────────

const INVALID_RECORDS = [
  {
    invoice_number: "INV-2026-0109",
    customer_name: "",  // ERROR: Missing Customer Name
    invoice_date: "2026-08-01",
    due_date: "2026-08-31",
    amount: 5500.00,
    subscription: "",
    expected_error: "Missing Customer Name",
  },
  {
    invoice_number: "INV-2026-0110",
    customer_name: "Nonexistent Salon ABC",  // ERROR: Customer not found in system
    invoice_date: "2026-08-01",
    due_date: "2026-08-31",
    amount: 3200.00,
    subscription: "",
    expected_error: "Customer not found",
  },
  {
    invoice_number: "",  // ERROR: Missing Invoice Number
    customer_name: "Luxe Hair Studio",
    invoice_date: "2026-08-05",
    due_date: "2026-09-04",
    amount: 1250.00,
    subscription: "",
    expected_error: "Missing Invoice Number",
  },
  {
    invoice_number: "INV-2026-0111",
    customer_name: "The Nail Artistry",
    invoice_date: "2026-08-01",
    due_date: "2026-08-31",
    amount: "",  // ERROR: Missing Amount
    subscription: "",
    expected_error: "Missing Amount",
  },
  {
    invoice_number: "INV-2026-0112",
    customer_name: "Skin Lab Express",
    invoice_date: "2026-08-10",
    due_date: "2026-09-09",
    amount: -450.00,  // ERROR: Negative Amount
    subscription: "",
    expected_error: "Negative Amount",
  },
  {
    invoice_number: "INV-2026-0113",
    customer_name: "Orchid Beauty Lounge",
    invoice_date: "08/25/2026",  // ERROR: Invalid Date Format (should be YYYY-MM-DD)
    due_date: "2026-09-24",
    amount: 780.00,
    subscription: "",
    expected_error: "Invalid Date Format",
  },
  {
    invoice_number: "INV-2026-0114",
    customer_name: "Radiance Medi-Spa",
    invoice_date: "2026-08-01",
    due_date: "2026-08-31",
    amount: 549.00,
    subscription: "Nonexistent Plan XYZ",  // ERROR: Invalid subscription plan
    expected_error: "Invalid Subscription Plan",
  },
  {
    invoice_number: "INV-2026-0101",  // ERROR: Duplicate Invoice Number (same as first valid record)
    customer_name: "Aura Hair & Beauty",
    invoice_date: "2026-08-20",
    due_date: "2026-09-19",
    amount: 2100.00,
    subscription: "",
    expected_error: "Duplicate Invoice Number",
  },
  {
    invoice_number: "INV-2026-0115",
    customer_name: "Bliss Nail Studio",
    invoice_date: "2026-08-15",
    due_date: "2026-09-14",
    amount: 199.00,
    subscription: "Premium Monthly",  // ERROR: Duplicate Subscription (customer already has this plan)
    expected_error: "Duplicate Subscription",
  },
  {
    invoice_number: "INV-2026-0116",
    customer_name: "The Waxing Boutique",
    invoice_date: "",  // ERROR: Missing Invoice Date
    due_date: "2026-09-30",
    amount: 1500.00,
    subscription: "",
    expected_error: "Missing Required Fields (Invoice Date)",
  },
];

// ─── CSV Generation ──────────────────────────────────────────────────────────

function generateCSV(records, filename) {
  const headers = "Invoice Number,Customer Name,Invoice Date,Due Date,Amount,Subscription";
  const rows = records.map(r =>
    `${r.invoice_number},${r.customer_name},${r.invoice_date},${r.due_date},${r.amount},${r.subscription || ""}`
  );
  const content = [headers, ...rows].join("\n");
  const filePath = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(filePath, content, "utf8");
  console.log(`  ✓ CSV: ${filePath}`);
}

// ─── XLSX Generation ─────────────────────────────────────────────────────────

async function generateXLSX(validRecords, invalidRecords, filename) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "PayNivo Demo";
  workbook.created = new Date();

  // Sheet 1: Mixed data (valid + invalid for demo)
  const sheet = workbook.addWorksheet("Invoice Upload");
  sheet.columns = [
    { header: "Invoice Number", key: "invoice_number", width: 18 },
    { header: "Customer Name", key: "customer_name", width: 30 },
    { header: "Invoice Date", key: "invoice_date", width: 14 },
    { header: "Due Date", key: "due_date", width: 14 },
    { header: "Amount", key: "amount", width: 14 },
    { header: "Subscription", key: "subscription", width: 22 },
  ];

  // Style header
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, size: 11 };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0D2CA" } };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };
  headerRow.height = 22;

  // Add valid records
  for (const r of validRecords) {
    sheet.addRow(r);
  }
  // Add invalid records (without the expected_error field)
  for (const r of invalidRecords) {
    const { expected_error, ...row } = r;
    sheet.addRow(row);
  }

  // Format amount column
  sheet.getColumn("amount").numFmt = "#,##0.00";

  // Sheet 2: Error Reference (documents expected errors)
  const errSheet = workbook.addWorksheet("Expected Errors");
  errSheet.columns = [
    { header: "Row #", key: "row", width: 8 },
    { header: "Invoice Number", key: "invoice_number", width: 18 },
    { header: "Expected Validation Error", key: "expected_error", width: 40 },
    { header: "Field with Issue", key: "field", width: 25 },
  ];

  const errHeaderRow = errSheet.getRow(1);
  errHeaderRow.font = { bold: true };
  errHeaderRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFCCCC" } };

  const errorDetails = [
    { row: 9, invoice_number: "INV-2026-0109", expected_error: "Missing Customer Name", field: "Customer Name (empty)" },
    { row: 10, invoice_number: "INV-2026-0110", expected_error: "Customer not found in system", field: "Customer Name" },
    { row: 11, invoice_number: "(empty)", expected_error: "Missing Invoice Number", field: "Invoice Number (empty)" },
    { row: 12, invoice_number: "INV-2026-0111", expected_error: "Missing Amount", field: "Amount (empty)" },
    { row: 13, invoice_number: "INV-2026-0112", expected_error: "Negative Amount", field: "Amount (-450)" },
    { row: 14, invoice_number: "INV-2026-0113", expected_error: "Invalid Date Format", field: "Invoice Date (MM/DD/YYYY)" },
    { row: 15, invoice_number: "INV-2026-0114", expected_error: "Invalid Subscription Plan", field: "Subscription" },
    { row: 16, invoice_number: "INV-2026-0101", expected_error: "Duplicate Invoice Number", field: "Invoice Number" },
    { row: 17, invoice_number: "INV-2026-0115", expected_error: "Duplicate Subscription", field: "Subscription" },
    { row: 18, invoice_number: "INV-2026-0116", expected_error: "Missing Required Fields", field: "Invoice Date (empty)" },
  ];
  errorDetails.forEach(r => errSheet.addRow(r));

  const filePath = path.join(OUTPUT_DIR, filename);
  await workbook.xlsx.writeFile(filePath);
  console.log(`  ✓ XLSX: ${filePath}`);
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n══════════════════════════════════════════════════");
  console.log("  Generating Bulk Upload Demo Files");
  console.log("══════════════════════════════════════════════════\n");

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // 1. CSV with only valid records (for successful upload demo)
  generateCSV(VALID_RECORDS, "demo_bulk_upload_valid.csv");

  // 2. CSV with mixed valid + invalid records (for validation error demo)
  const allRecords = [...VALID_RECORDS, ...INVALID_RECORDS.map(({ expected_error, ...r }) => r)];
  generateCSV(allRecords, "demo_bulk_upload_mixed.csv");

  // 3. XLSX with mixed data + error reference sheet
  await generateXLSX(VALID_RECORDS, INVALID_RECORDS, "demo_bulk_upload_mixed.xlsx");

  console.log("\n  Files generated in: " + OUTPUT_DIR);
  console.log("\n  Validation errors demonstrated:");
  console.log("    • Missing Customer Name");
  console.log("    • Customer not found in system");
  console.log("    • Missing Invoice Number");
  console.log("    • Missing Amount");
  console.log("    • Negative Amount");
  console.log("    • Invalid Date Format");
  console.log("    • Invalid Subscription Plan");
  console.log("    • Duplicate Invoice Number");
  console.log("    • Duplicate Subscription");
  console.log("    • Missing Required Fields (Invoice Date)");
  console.log("\nDone.\n");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
