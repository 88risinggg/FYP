/**
 * Generate Compliance Invoice Excel
 *
 * Produces an Excel file matching the invoice table structure that the
 * bulk upload system expects, with fraud indicators for detection.
 *
 * The file includes:
 *   - Required columns: Invoice Number, Customer Name, Invoice Date, Due Date, Amount
 *   - Extra columns for fraud detection metadata
 *   - Mix of legitimate and fraudulent invoices for testing
 *
 * Usage: node scripts/generateComplianceInvoice.js
 */

const ExcelJS = require("exceljs");
const path = require("path");

// ─── Helpers ────────────────────────────────────────────────────────────────

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min, max) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(2));
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDate(start, end) {
  const d = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  return d.toISOString().split("T")[0];
}

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

// ─── Data matching the existing database ────────────────────────────────────

// These must match customer names in the database (from seedDummyData.js)
const customers = [
  "Luxe Hair Studio",
  "The Nail Artistry",
  "Serenity Spa & Wellness",
  "Glow Aesthetics Clinic",
  "Brow & Lash Bar"
];

const vendors = [
  "BeautyPro Supplies Pte Ltd",
  "Salon Equipment SG Pte Ltd",
  "AestheticWorld Trading Pte Ltd",
  "OrganicGlow Products Pte Ltd",
  "HairCare Wholesale Pte Ltd",
  "NailTech Supplies Pte Ltd"
];

const fakeVendors = [
  "XYZ Global Enterprises LLC",
  "Phantom Beauty Pte Ltd",
  "QuickPay Solutions BVI",
  "Offshore Billing Corp"
];

const bankAccounts = ["DBS-XXXX1234", "OCBC-XXXX5678", "UOB-XXXX9012"];
const suspiciousBanks = ["HSBC-XXXX3456", "SCB-XXXX7890", "OFFSHORE-XXXX9999"];

// ─── Invoice Generation ─────────────────────────────────────────────────────

let invoiceCounter = 1;

function nextInvoiceNumber() {
  return `INV-${String(invoiceCounter++).padStart(4, "0")}`;
}

function generateLegitimate() {
  const invoiceDate = randomDate(new Date("2025-06-01"), new Date("2026-06-30"));
  const dueDate = addDays(invoiceDate, randomInt(14, 45));
  const amount = randomFloat(100, 12000);

  return {
    "Invoice Number": nextInvoiceNumber(),
    "Customer Name": pick(customers),
    "Invoice Date": invoiceDate,
    "Due Date": dueDate,
    "Amount": amount,
    "Vendor Name": pick(vendors),
    "Bank Account": pick(bankAccounts),
    "Fraud_Type": "",
    "Fraud_Label": 0
  };
}

function generateFraudulent(scenario) {
  const inv = generateLegitimate();
  inv.Fraud_Label = 1;

  switch (scenario) {
    case "duplicate_invoice":
      // Use a duplicate invoice number (same as previous)
      invoiceCounter--;
      inv["Invoice Number"] = `INV-${String(invoiceCounter++).padStart(4, "0")}`;
      inv.Fraud_Type = "Duplicate Invoice";
      break;

    case "missing_invoice_number":
      inv["Invoice Number"] = "";
      inv.Fraud_Type = "Missing Invoice Number";
      break;

    case "fake_vendor":
      inv["Vendor Name"] = pick(fakeVendors);
      inv.Fraud_Type = "Fake/Unverified Vendor";
      break;

    case "unusual_amount":
      inv["Amount"] = randomFloat(50000, 200000);
      inv.Fraud_Type = "Unusual High Amount";
      break;

    case "split_invoice":
      inv["Amount"] = randomFloat(4800, 4999);
      inv.Fraud_Type = "Invoice Splitting (just under limit)";
      break;

    case "multiple_bank_changes":
      inv["Bank Account"] = pick(suspiciousBanks);
      inv.Fraud_Type = "Suspicious Bank Account";
      break;

    case "weekend_submission":
      // Set to a Saturday
      inv["Invoice Date"] = "2026-03-07";
      inv["Due Date"] = "2026-03-21";
      inv.Fraud_Type = "Weekend Submission";
      break;

    case "after_hours":
      inv.Fraud_Type = "After Hours Submission";
      break;

    case "high_risk_country":
      inv["Vendor Name"] = pick(fakeVendors);
      inv["Bank Account"] = "OFFSHORE-XXXX9999";
      inv.Fraud_Type = "High Risk Country Vendor";
      break;

    case "missing_po":
      inv.Fraud_Type = "Missing Purchase Order";
      break;

    case "missing_approval":
      inv.Fraud_Type = "Missing Approval";
      break;

    case "duplicate_payment":
      invoiceCounter--;
      inv["Invoice Number"] = `INV-${String(invoiceCounter++).padStart(4, "0")}`;
      inv.Fraud_Type = "Duplicate Payment Request";
      break;

    case "altered_invoice_number":
      inv["Invoice Number"] = `INV-${randomInt(90000, 99999)}-ALT`;
      inv.Fraud_Type = "Altered Invoice Number";
      break;
  }

  return inv;
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function generate() {
  const total = 320;
  const fraudCount = Math.round(total * 0.2); // 64
  const legitCount = total - fraudCount; // 256

  const fraudScenarios = [
    "duplicate_invoice", "missing_invoice_number", "fake_vendor",
    "unusual_amount", "split_invoice", "multiple_bank_changes",
    "weekend_submission", "after_hours", "high_risk_country",
    "missing_po", "missing_approval", "duplicate_payment", "altered_invoice_number"
  ];

  const rows = [];

  // Generate legitimate invoices
  for (let i = 0; i < legitCount; i++) {
    rows.push(generateLegitimate());
  }

  // Generate fraudulent invoices
  for (let i = 0; i < fraudCount; i++) {
    rows.push(generateFraudulent(fraudScenarios[i % fraudScenarios.length]));
  }

  // Shuffle
  for (let i = rows.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rows[i], rows[j]] = [rows[j], rows[i]];
  }

  // ─── Write Excel ────────────────────────────────────────────────────────────
  const wb = new ExcelJS.Workbook();
  wb.creator = "FYP Invoice Finance Module";
  wb.created = new Date();

  // Sheet 1: Invoice Data (matches bulk upload format)
  const ws = wb.addWorksheet("Invoices");
  ws.columns = [
    { header: "Invoice Number", key: "Invoice Number", width: 18 },
    { header: "Customer Name", key: "Customer Name", width: 28 },
    { header: "Invoice Date", key: "Invoice Date", width: 14 },
    { header: "Due Date", key: "Due Date", width: 14 },
    { header: "Amount", key: "Amount", width: 14 },
    { header: "Vendor Name", key: "Vendor Name", width: 32 },
    { header: "Bank Account", key: "Bank Account", width: 20 },
    { header: "Fraud_Type", key: "Fraud_Type", width: 32 },
    { header: "Fraud_Label", key: "Fraud_Label", width: 12 }
  ];

  // Header style
  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1A237E" } };

  for (const row of rows) {
    const addedRow = ws.addRow(row);
    // Highlight fraudulent rows in light red
    if (row.Fraud_Label === 1) {
      addedRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFCE4EC" } };
    }
  }

  ws.autoFilter = { from: "A1", to: `I${rows.length + 1}` };

  // Sheet 2: Compliance Checklist
  const cs = wb.addWorksheet("Compliance Checklist");
  cs.columns = [
    { header: "Check_ID", key: "id", width: 12 },
    { header: "Check Name", key: "name", width: 42 },
    { header: "Severity", key: "severity", width: 12 },
    { header: "Pass Condition", key: "condition", width: 55 },
    { header: "Maps To Column", key: "column", width: 20 }
  ];

  const csHeader = cs.getRow(1);
  csHeader.font = { bold: true, color: { argb: "FFFFFFFF" } };
  csHeader.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE65100" } };

  const checks = [
    { id: "CHK-001", name: "Invoice Number Exists", severity: "Critical", condition: "Invoice Number is not blank", column: "Invoice Number" },
    { id: "CHK-002", name: "No Duplicate Invoice Numbers", severity: "Critical", condition: "Invoice Number is unique across all rows", column: "Invoice Number" },
    { id: "CHK-003", name: "Customer Name Valid", severity: "High", condition: "Customer Name matches a registered customer", column: "Customer Name" },
    { id: "CHK-004", name: "Invoice Date Valid", severity: "Medium", condition: "Invoice Date is not future, not on weekend", column: "Invoice Date" },
    { id: "CHK-005", name: "Due Date After Invoice Date", severity: "Medium", condition: "Due Date > Invoice Date", column: "Due Date" },
    { id: "CHK-006", name: "Amount Within Approval Limit", severity: "High", condition: "Amount <= 50,000", column: "Amount" },
    { id: "CHK-007", name: "Amount Is Positive", severity: "Critical", condition: "Amount > 0", column: "Amount" },
    { id: "CHK-008", name: "Vendor is Approved", severity: "High", condition: "Vendor Name not in fake vendor list", column: "Vendor Name" },
    { id: "CHK-009", name: "Bank Account Verified", severity: "High", condition: "Bank Account matches vendor records", column: "Bank Account" },
    { id: "CHK-010", name: "No Invoice Splitting", severity: "High", condition: "No cluster of amounts just under $5,000", column: "Amount" },
    { id: "CHK-011", name: "Vendor Not Blacklisted", severity: "Critical", condition: "Vendor not on blacklist/sanctions list", column: "Vendor Name" },
    { id: "CHK-012", name: "No High-Risk Country", severity: "Critical", condition: "Vendor country not in sanctioned list", column: "Vendor Name" },
    { id: "CHK-013", name: "AML Screening Passed", severity: "Critical", condition: "No money laundering indicators", column: "Vendor Name" },
    { id: "CHK-014", name: "No Duplicate Payment Requests", severity: "Critical", condition: "Same Invoice Number not paid twice", column: "Invoice Number" },
    { id: "CHK-015", name: "Invoice Number Format Valid", severity: "Medium", condition: "Matches pattern INV-XXXX (no ALT suffix)", column: "Invoice Number" }
  ];

  for (const check of checks) {
    const addedRow = cs.addRow(check);
    const sevCell = addedRow.getCell("severity");
    if (sevCell.value === "Critical") sevCell.font = { bold: true, color: { argb: "FFFF1744" } };
    else if (sevCell.value === "High") sevCell.font = { bold: true, color: { argb: "FFFF6D00" } };
    else sevCell.font = { bold: true, color: { argb: "FF1565C0" } };
  }

  // Sheet 3: Summary
  const ss = wb.addWorksheet("Summary");
  ss.columns = [
    { header: "Metric", key: "metric", width: 35 },
    { header: "Value", key: "value", width: 20 }
  ];
  const ssHeader = ss.getRow(1);
  ssHeader.font = { bold: true, color: { argb: "FFFFFFFF" } };
  ssHeader.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2E7D32" } };

  const fraudByType = {};
  rows.filter(r => r.Fraud_Label === 1).forEach(r => {
    const type = r.Fraud_Type || "Unknown";
    fraudByType[type] = (fraudByType[type] || 0) + 1;
  });

  ss.addRows([
    { metric: "Total Invoices", value: rows.length },
    { metric: "Legitimate (Fraud_Label = 0)", value: rows.filter(r => r.Fraud_Label === 0).length },
    { metric: "Fraudulent (Fraud_Label = 1)", value: rows.filter(r => r.Fraud_Label === 1).length },
    { metric: "", value: "" },
    { metric: "FRAUD TYPE BREAKDOWN", value: "" },
    ...Object.entries(fraudByType).map(([type, count]) => ({ metric: `  ${type}`, value: count })),
    { metric: "", value: "" },
    { metric: "WORKFLOW", value: "" },
    { metric: "1. Upload this file via Bulk Upload", value: "" },
    { metric: "2. System runs compliance checks", value: "" },
    { metric: "3. Failed checks flag invoices as risky", value: "" },
    { metric: "4. Fraud report Excel exported", value: "" },
    { metric: "5. Notification sent to Finance team", value: "" }
  ]);

  // Write file
  const outputPath = path.join(__dirname, "..", "compliance_invoice.xlsx");
  await wb.xlsx.writeFile(outputPath);

  console.log("✅ compliance_invoice.xlsx generated!");
  console.log(`📁 Location: ${outputPath}`);
  console.log(`📊 Total: ${rows.length} invoices`);
  console.log(`   Legitimate: ${rows.filter(r => r.Fraud_Label === 0).length}`);
  console.log(`   Fraudulent: ${rows.filter(r => r.Fraud_Label === 1).length}`);
  console.log("\n📋 Sheets:");
  console.log("   1. Invoices — data matching the invoice table format");
  console.log("   2. Compliance Checklist — 15 fraud detection rules");
  console.log("   3. Summary — breakdown of fraud types & workflow");
  console.log("\n🔔 Upload via Finance > Bulk Upload to trigger fraud detection & notifications");
}

generate().catch(err => {
  console.error("❌ Error:", err);
  process.exit(1);
});
