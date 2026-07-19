/**
 * Generate Invoice Dataset for Fraud Detection
 *
 * Produces dummy_invoice_dataset.xlsx matching the bulk upload format:
 *   Invoice Number | Customer Name | Invoice Date | Due Date | Amount
 *
 * 320 invoices: 80% legitimate, 20% fraudulent
 *
 * Usage: node scripts/generateFraudDataset.js
 */

const ExcelJS = require("exceljs");
const path = require("path");

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

// Must match customer names in database
const customers = [
  "Luxe Hair Studio",
  "The Nail Artistry",
  "Serenity Spa & Wellness",
  "Glow Aesthetics Clinic",
  "Brow & Lash Bar"
];

let counter = 1;

function generateLegitimate() {
  const invoiceDate = randomDate(new Date("2025-06-01"), new Date("2026-06-30"));
  const dueDate = addDays(invoiceDate, randomInt(14, 45));
  return {
    "Invoice Number": `INV-${String(counter++).padStart(4, "0")}`,
    "Customer Name": pick(customers),
    "Invoice Date": invoiceDate,
    "Due Date": dueDate,
    "Amount": randomFloat(100, 12000)
  };
}

function generateFraudulent(scenario) {
  const inv = generateLegitimate();

  switch (scenario) {
    case "Duplicate Invoice":
      // Reuse same invoice number as previous
      counter--;
      inv["Invoice Number"] = `INV-${String(counter++).padStart(4, "0")}`;
      break;
    case "Missing Invoice Number":
      inv["Invoice Number"] = "";
      break;
    case "Unusual High Amount":
      inv["Amount"] = randomFloat(50000, 250000);
      break;
    case "Invoice Splitting":
      inv["Amount"] = randomFloat(4800, 4999);
      break;
    case "Invalid Customer":
      inv["Customer Name"] = "Phantom Beauty Pte Ltd";
      break;
    case "Future Dated Invoice":
      inv["Invoice Date"] = "2027-12-01";
      inv["Due Date"] = "2028-01-01";
      break;
    case "Due Before Issue":
      inv["Invoice Date"] = "2026-06-15";
      inv["Due Date"] = "2026-05-01";
      break;
    case "Zero Amount":
      inv["Amount"] = 0;
      break;
    case "Negative Amount":
      inv["Amount"] = -500;
      break;
    case "Duplicate Payment":
      counter--;
      inv["Invoice Number"] = `INV-${String(counter++).padStart(4, "0")}`;
      inv["Amount"] = randomFloat(5000, 15000);
      break;
    case "Altered Invoice Number":
      inv["Invoice Number"] = `INV-${randomInt(90000, 99999)}-ALT`;
      break;
    case "Weekend Submission":
      inv["Invoice Date"] = "2026-03-07"; // Saturday
      inv["Due Date"] = "2026-03-21";
      break;
    case "Missing Date":
      inv["Invoice Date"] = "";
      break;
  }

  return { ...inv, _fraud: scenario };
}

async function generate() {
  const total = 320;
  const fraudCount = Math.round(total * 0.2);
  const legitCount = total - fraudCount;

  const scenarios = [
    "Duplicate Invoice", "Missing Invoice Number", "Unusual High Amount",
    "Invoice Splitting", "Invalid Customer", "Future Dated Invoice",
    "Due Before Issue", "Zero Amount", "Negative Amount",
    "Duplicate Payment", "Altered Invoice Number", "Weekend Submission",
    "Missing Date"
  ];

  const rows = [];
  for (let i = 0; i < legitCount; i++) rows.push({ ...generateLegitimate(), _fraud: "" });
  for (let i = 0; i < fraudCount; i++) rows.push(generateFraudulent(scenarios[i % scenarios.length]));

  // Shuffle
  for (let i = rows.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rows[i], rows[j]] = [rows[j], rows[i]];
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "FYP Invoice Finance";
  wb.created = new Date();

  const ws = wb.addWorksheet("Invoice Dataset");
  ws.columns = [
    { header: "Invoice Number", key: "Invoice Number", width: 18 },
    { header: "Customer Name", key: "Customer Name", width: 28 },
    { header: "Invoice Date", key: "Invoice Date", width: 14 },
    { header: "Due Date", key: "Due Date", width: 14 },
    { header: "Amount", key: "Amount", width: 14 },
    { header: "Fraud Type", key: "Fraud Type", width: 28 }
  ];

  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1A237E" } };

  for (const row of rows) {
    const added = ws.addRow({
      "Invoice Number": row["Invoice Number"],
      "Customer Name": row["Customer Name"],
      "Invoice Date": row["Invoice Date"],
      "Due Date": row["Due Date"],
      "Amount": row["Amount"],
      "Fraud Type": row._fraud
    });
    if (row._fraud) {
      added.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFCE4EC" } };
    }
  }

  ws.autoFilter = { from: "A1", to: `F${rows.length + 1}` };

  const outputPath = path.join(__dirname, "..", "dummy_invoice_dataset.xlsx");
  await wb.xlsx.writeFile(outputPath);

  const fraudRows = rows.filter(r => r._fraud);
  console.log("✅ dummy_invoice_dataset.xlsx generated!");
  console.log(`   Total: ${rows.length} | Legit: ${legitCount} | Fraud: ${fraudRows.length}`);
  console.log(`   Columns: Invoice Number, Customer Name, Invoice Date, Due Date, Amount, Fraud Type`);
  console.log("\n   Fraud scenarios:");
  scenarios.forEach(s => {
    const count = fraudRows.filter(r => r._fraud === s).length;
    console.log(`     • ${s}: ${count}`);
  });
}

generate().catch(err => { console.error("❌", err); process.exit(1); });
