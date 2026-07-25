/**
 * Generate Sample Excel/CSV Templates
 *
 * Creates sample files for testing the bulk invoice upload and
 * subscription import features. No database connection required.
 *
 * Files generated:
 * - sample_bulk_invoice_success.xlsx     (10 valid invoice rows)
 * - sample_bulk_invoice_errors.xlsx      (8 rows with validation errors)
 * - sample_subscription_import.xlsx      (5 valid subscription rows)
 * - sample_bulk_invoice_validation.csv   (5 rows for CSV validation)
 * - sample_invoice_upload_template.xlsx  (empty template with headers)
 *
 * Usage: node scripts/generate-sample-templates.js
 */

const path = require("path");
const fs = require("fs");

async function main() {
  const ExcelJS = require("exceljs");

  const templateDir = path.join(__dirname, "../uploads/templates");
  if (!fs.existsSync(templateDir)) {
    fs.mkdirSync(templateDir, { recursive: true });
  }

  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║   Sample Template File Generator         ║");
  console.log("╚══════════════════════════════════════════╝\n");
  console.log(`  Output directory: ${templateDir}\n`);

  // ══════════════════════════════════════════════════════════════════════════
  // 1. Successful Bulk Invoice Upload Template
  // ══════════════════════════════════════════════════════════════════════════
  const successWorkbook = new ExcelJS.Workbook();
  successWorkbook.creator = "PayNivo Finance";
  successWorkbook.created = new Date();
  const successSheet = successWorkbook.addWorksheet("Invoices");

  successSheet.columns = [
    { header: "Customer Name", key: "customer_name", width: 25 },
    { header: "Customer Email", key: "customer_email", width: 30 },
    { header: "Company Name", key: "company_name", width: 25 },
    { header: "Invoice Number", key: "invoice_number", width: 18 },
    { header: "Invoice Date", key: "invoice_date", width: 15 },
    { header: "Due Date", key: "due_date", width: 15 },
    { header: "Invoice Description", key: "description", width: 35 },
    { header: "Quantity", key: "quantity", width: 10 },
    { header: "Unit Price", key: "unit_price", width: 12 },
    { header: "Total Amount", key: "total_amount", width: 14 },
    { header: "Currency", key: "currency", width: 10 },
    { header: "Payment Method", key: "payment_method", width: 16 },
  ];

  const successRows = [
    { customer_name: "Luxe Hair Studio", customer_email: "bookings@luxehairstudio.sg", company_name: "Vaniday Pte Ltd", invoice_number: "", invoice_date: "2026-07-01", due_date: "2026-07-31", description: "Balayage Hair Coloring", quantity: 2, unit_price: 350.00, total_amount: 700.00, currency: "SGD", payment_method: "Stripe" },
    { customer_name: "The Nail Artistry", customer_email: "hello@thenailartistry.sg", company_name: "Vaniday Pte Ltd", invoice_number: "", invoice_date: "2026-07-02", due_date: "2026-08-01", description: "Gel Manicure Session", quantity: 5, unit_price: 85.00, total_amount: 425.00, currency: "SGD", payment_method: "PayNow" },
    { customer_name: "Serenity Spa & Wellness", customer_email: "reservations@serenityspa.sg", company_name: "Vaniday Pte Ltd", invoice_number: "", invoice_date: "2026-07-03", due_date: "2026-08-02", description: "Full Body Massage (90 min)", quantity: 3, unit_price: 180.00, total_amount: 540.00, currency: "SGD", payment_method: "Bank Transfer" },
    { customer_name: "Glow Aesthetics Clinic", customer_email: "appointments@glowaesthetics.sg", company_name: "Vaniday Pte Ltd", invoice_number: "", invoice_date: "2026-07-04", due_date: "2026-08-03", description: "Hydrafacial Treatment", quantity: 1, unit_price: 299.00, total_amount: 299.00, currency: "SGD", payment_method: "Credit Card" },
    { customer_name: "Brow & Lash Bar", customer_email: "info@browlashbar.sg", company_name: "Vaniday Pte Ltd", invoice_number: "", invoice_date: "2026-07-05", due_date: "2026-08-04", description: "Eyelash Extensions (Full Set)", quantity: 2, unit_price: 120.00, total_amount: 240.00, currency: "SGD", payment_method: "Stripe" },
    { customer_name: "KBeauty Haven", customer_email: "hello@kbeautyhaven.sg", company_name: "Vaniday Pte Ltd", invoice_number: "", invoice_date: "2026-07-06", due_date: "2026-08-05", description: "LED Light Therapy", quantity: 4, unit_price: 150.00, total_amount: 600.00, currency: "SGD", payment_method: "PayNow" },
    { customer_name: "Zen Reflexology Centre", customer_email: "bookings@zenreflexology.sg", company_name: "Vaniday Pte Ltd", invoice_number: "", invoice_date: "2026-07-07", due_date: "2026-08-06", description: "Hot Stone Therapy", quantity: 2, unit_price: 200.00, total_amount: 400.00, currency: "SGD", payment_method: "Bank Transfer" },
    { customer_name: "Prestige Barbers", customer_email: "appointments@prestigebarbers.sg", company_name: "Vaniday Pte Ltd", invoice_number: "", invoice_date: "2026-07-08", due_date: "2026-08-07", description: "Men's Grooming Package", quantity: 3, unit_price: 95.00, total_amount: 285.00, currency: "SGD", payment_method: "Stripe" },
    { customer_name: "Skin Lab Express", customer_email: "info@skinlabexpress.sg", company_name: "Vaniday Pte Ltd", invoice_number: "", invoice_date: "2026-07-09", due_date: "2026-08-08", description: "Chemical Peel Session", quantity: 1, unit_price: 450.00, total_amount: 450.00, currency: "SGD", payment_method: "Credit Card" },
    { customer_name: "Orchid Beauty Lounge", customer_email: "bookings@orchidbeauty.sg", company_name: "Vaniday Pte Ltd", invoice_number: "", invoice_date: "2026-07-10", due_date: "2026-08-09", description: "Oxygen Facial", quantity: 2, unit_price: 175.00, total_amount: 350.00, currency: "SGD", payment_method: "PayNow" },
  ];

  successRows.forEach((row) => successSheet.addRow(row));
  successSheet.getRow(1).font = { bold: true };
  successSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8F5E9" } };

  await successWorkbook.xlsx.writeFile(path.join(templateDir, "sample_bulk_invoice_success.xlsx"));
  console.log("  ✓ sample_bulk_invoice_success.xlsx");

  // ══════════════════════════════════════════════════════════════════════════
  // 2. Failed Bulk Invoice Upload (Validation Errors)
  // ══════════════════════════════════════════════════════════════════════════
  const failWorkbook = new ExcelJS.Workbook();
  failWorkbook.creator = "PayNivo Finance";
  const failSheet = failWorkbook.addWorksheet("Invoices");
  failSheet.columns = successSheet.columns;

  const failRows = [
    { customer_name: "", customer_email: "bookings@luxehairstudio.sg", company_name: "Vaniday Pte Ltd", invoice_number: "", invoice_date: "2026-07-01", due_date: "2026-07-31", description: "Balayage Hair Coloring", quantity: 2, unit_price: 350.00, total_amount: 700.00, currency: "SGD", payment_method: "Stripe" },
    { customer_name: "The Nail Artistry", customer_email: "invalid-email-format", company_name: "Vaniday Pte Ltd", invoice_number: "", invoice_date: "2026-07-02", due_date: "2026-08-01", description: "Gel Manicure Session", quantity: 5, unit_price: 85.00, total_amount: 425.00, currency: "SGD", payment_method: "PayNow" },
    { customer_name: "Serenity Spa & Wellness", customer_email: "reservations@serenityspa.sg", company_name: "Vaniday Pte Ltd", invoice_number: "", invoice_date: "invalid-date", due_date: "2026-08-02", description: "Full Body Massage (90 min)", quantity: 3, unit_price: 180.00, total_amount: 540.00, currency: "SGD", payment_method: "Bank Transfer" },
    { customer_name: "Glow Aesthetics Clinic", customer_email: "appointments@glowaesthetics.sg", company_name: "Vaniday Pte Ltd", invoice_number: "", invoice_date: "2026-07-04", due_date: "2026-08-03", description: "", quantity: 1, unit_price: 299.00, total_amount: 299.00, currency: "SGD", payment_method: "Credit Card" },
    { customer_name: "Brow & Lash Bar", customer_email: "info@browlashbar.sg", company_name: "Vaniday Pte Ltd", invoice_number: "", invoice_date: "2026-07-05", due_date: "2026-08-04", description: "Eyelash Extensions (Full Set)", quantity: -1, unit_price: 120.00, total_amount: 240.00, currency: "SGD", payment_method: "Stripe" },
    { customer_name: "KBeauty Haven", customer_email: "hello@kbeautyhaven.sg", company_name: "Vaniday Pte Ltd", invoice_number: "", invoice_date: "2026-07-06", due_date: "2026-08-05", description: "LED Light Therapy", quantity: 4, unit_price: -50.00, total_amount: 600.00, currency: "SGD", payment_method: "PayNow" },
    { customer_name: "Zen Reflexology Centre", customer_email: "bookings@zenreflexology.sg", company_name: "Vaniday Pte Ltd", invoice_number: "", invoice_date: "2026-07-07", due_date: "2026-06-01", description: "Hot Stone Therapy", quantity: 2, unit_price: 200.00, total_amount: 400.00, currency: "SGD", payment_method: "Bank Transfer" },
    { customer_name: "Prestige Barbers", customer_email: "appointments@prestigebarbers.sg", company_name: "Vaniday Pte Ltd", invoice_number: "", invoice_date: "2026-07-08", due_date: "2026-08-07", description: "Men's Grooming Package", quantity: 3, unit_price: 95.00, total_amount: 0.00, currency: "INVALID", payment_method: "Unknown" },
  ];

  failRows.forEach((row) => failSheet.addRow(row));
  failSheet.getRow(1).font = { bold: true };
  failSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFEBEE" } };

  // Add a "Known Errors" sheet explaining what's wrong
  const errorsSheet = failWorkbook.addWorksheet("Expected Errors");
  errorsSheet.columns = [
    { header: "Row", key: "row", width: 8 },
    { header: "Error Description", key: "error", width: 60 },
  ];
  errorsSheet.addRow({ row: 1, error: "Missing Customer Name (required field)" });
  errorsSheet.addRow({ row: 2, error: "Invalid email format (not a valid email address)" });
  errorsSheet.addRow({ row: 3, error: "Invalid Invoice Date (not a parseable date)" });
  errorsSheet.addRow({ row: 4, error: "Missing Invoice Description (required field)" });
  errorsSheet.addRow({ row: 5, error: "Negative Quantity (-1 is not allowed)" });
  errorsSheet.addRow({ row: 6, error: "Negative Unit Price (-50.00 is not allowed)" });
  errorsSheet.addRow({ row: 7, error: "Due Date before Invoice Date (2026-06-01 < 2026-07-07)" });
  errorsSheet.addRow({ row: 8, error: "Invalid Currency (INVALID) and zero Total Amount" });
  errorsSheet.getRow(1).font = { bold: true };
  errorsSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFCDD2" } };

  await failWorkbook.xlsx.writeFile(path.join(templateDir, "sample_bulk_invoice_errors.xlsx"));
  console.log("  ✓ sample_bulk_invoice_errors.xlsx");

  // ══════════════════════════════════════════════════════════════════════════
  // 3. Subscription Import Template
  // ══════════════════════════════════════════════════════════════════════════
  const subWorkbook = new ExcelJS.Workbook();
  subWorkbook.creator = "PayNivo Finance";
  const subSheet = subWorkbook.addWorksheet("Subscriptions");

  subSheet.columns = [
    { header: "Customer Name", key: "customer_name", width: 25 },
    { header: "Customer Email", key: "customer_email", width: 30 },
    { header: "Plan Name", key: "plan_name", width: 25 },
    { header: "Description", key: "description", width: 40 },
    { header: "Amount", key: "amount", width: 12 },
    { header: "Billing Frequency", key: "billing_frequency", width: 18 },
    { header: "Start Date", key: "start_date", width: 15 },
    { header: "Next Billing Date", key: "next_billing_date", width: 18 },
    { header: "End Date", key: "end_date", width: 15 },
    { header: "Auto Renew", key: "auto_renew", width: 12 },
    { header: "Auto Send", key: "auto_send", width: 12 },
  ];

  const subRows = [
    { customer_name: "Luxe Hair Studio", customer_email: "bookings@luxehairstudio.sg", plan_name: "Premium Platform", description: "Premium platform subscription with priority support", amount: 549.00, billing_frequency: "Monthly", start_date: "2026-01-01", next_billing_date: "2026-08-01", end_date: "", auto_renew: "Yes", auto_send: "Yes" },
    { customer_name: "The Nail Artistry", customer_email: "hello@thenailartistry.sg", plan_name: "Standard Platform", description: "Standard platform subscription", amount: 249.00, billing_frequency: "Monthly", start_date: "2026-02-01", next_billing_date: "2026-08-01", end_date: "", auto_renew: "Yes", auto_send: "Yes" },
    { customer_name: "Serenity Spa & Wellness", customer_email: "reservations@serenityspa.sg", plan_name: "Enterprise Suite", description: "Enterprise suite with dedicated account manager", amount: 2400.00, billing_frequency: "Quarterly", start_date: "2026-01-15", next_billing_date: "2026-10-15", end_date: "2027-01-15", auto_renew: "No", auto_send: "Yes" },
    { customer_name: "Glow Aesthetics Clinic", customer_email: "appointments@glowaesthetics.sg", plan_name: "Cloud Backup", description: "Daily automated cloud backup and disaster recovery", amount: 89.00, billing_frequency: "Monthly", start_date: "2026-03-01", next_billing_date: "2026-08-01", end_date: "", auto_renew: "Yes", auto_send: "No" },
    { customer_name: "Brow & Lash Bar", customer_email: "info@browlashbar.sg", plan_name: "IT Maintenance", description: "System monitoring, updates, and technical support", amount: 450.00, billing_frequency: "Monthly", start_date: "2026-04-01", next_billing_date: "2026-08-01", end_date: "", auto_renew: "Yes", auto_send: "Yes" },
  ];

  subRows.forEach((row) => subSheet.addRow(row));
  subSheet.getRow(1).font = { bold: true };
  subSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE3F2FD" } };

  await subWorkbook.xlsx.writeFile(path.join(templateDir, "sample_subscription_import.xlsx"));
  console.log("  ✓ sample_subscription_import.xlsx");

  // ══════════════════════════════════════════════════════════════════════════
  // 4. CSV Validation Test File
  // ══════════════════════════════════════════════════════════════════════════
  const csvContent = [
    "Customer Name,Customer Email,Company Name,Invoice Number,Invoice Date,Due Date,Invoice Description,Quantity,Unit Price,Total Amount,Currency,Payment Method",
    "Luxe Hair Studio,bookings@luxehairstudio.sg,Vaniday Pte Ltd,,2026-07-15,2026-08-14,Hair Treatment Package,1,500.00,500.00,SGD,Stripe",
    "The Nail Artistry,hello@thenailartistry.sg,Vaniday Pte Ltd,,2026-07-15,2026-08-14,Nail Art Full Set,3,120.00,360.00,SGD,PayNow",
    "Serenity Spa & Wellness,reservations@serenityspa.sg,Vaniday Pte Ltd,,2026-07-15,2026-08-14,Spa Day Package,2,250.00,500.00,SGD,Bank Transfer",
    "Glow Aesthetics Clinic,appointments@glowaesthetics.sg,Vaniday Pte Ltd,,2026-07-15,2026-08-14,Facial Treatment Series,4,175.00,700.00,SGD,Credit Card",
    "Brow & Lash Bar,info@browlashbar.sg,Vaniday Pte Ltd,,2026-07-15,2026-08-14,Lash Lift & Tint,5,80.00,400.00,SGD,PayNow",
  ].join("\n");

  fs.writeFileSync(path.join(templateDir, "sample_bulk_invoice_validation.csv"), csvContent, "utf-8");
  console.log("  ✓ sample_bulk_invoice_validation.csv");

  // ══════════════════════════════════════════════════════════════════════════
  // 5. Empty Invoice Upload Template (blank template for users)
  // ══════════════════════════════════════════════════════════════════════════
  const templateWorkbook = new ExcelJS.Workbook();
  templateWorkbook.creator = "PayNivo Finance";
  const templateSheet = templateWorkbook.addWorksheet("Invoice Template");

  templateSheet.columns = [
    { header: "Customer Name", key: "customer_name", width: 25 },
    { header: "Customer Email", key: "customer_email", width: 30 },
    { header: "Company Name", key: "company_name", width: 25 },
    { header: "Invoice Number", key: "invoice_number", width: 18 },
    { header: "Invoice Date", key: "invoice_date", width: 15 },
    { header: "Due Date", key: "due_date", width: 15 },
    { header: "Invoice Description", key: "description", width: 35 },
    { header: "Quantity", key: "quantity", width: 10 },
    { header: "Unit Price", key: "unit_price", width: 12 },
    { header: "Total Amount", key: "total_amount", width: 14 },
    { header: "Currency", key: "currency", width: 10 },
    { header: "Payment Method", key: "payment_method", width: 16 },
  ];

  templateSheet.getRow(1).font = { bold: true };
  templateSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3E5F5" } };

  // Add instruction row
  templateSheet.addRow({
    customer_name: "(Required)",
    customer_email: "(Required - valid email)",
    company_name: "(Optional)",
    invoice_number: "(Leave blank for auto)",
    invoice_date: "(YYYY-MM-DD)",
    due_date: "(YYYY-MM-DD, after invoice date)",
    description: "(Required)",
    quantity: "(Positive integer)",
    unit_price: "(Positive number)",
    total_amount: "(Auto-calculated if blank)",
    currency: "(SGD, USD, etc.)",
    payment_method: "(Stripe/PayNow/Bank Transfer/Credit Card)",
  });
  templateSheet.getRow(2).font = { italic: true, color: { argb: "FF7B6660" } };

  // Add instructions sheet
  const instructSheet = templateWorkbook.addWorksheet("Instructions");
  instructSheet.columns = [
    { header: "Field", key: "field", width: 20 },
    { header: "Required", key: "required", width: 10 },
    { header: "Format", key: "format", width: 30 },
    { header: "Notes", key: "notes", width: 50 },
  ];
  const instructions = [
    { field: "Customer Name", required: "Yes", format: "Text", notes: "Name of the customer to bill" },
    { field: "Customer Email", required: "Yes", format: "Valid email", notes: "Email address for invoice delivery" },
    { field: "Company Name", required: "No", format: "Text", notes: "Your company name (defaults to settings)" },
    { field: "Invoice Number", required: "No", format: "Text", notes: "Leave blank for auto-generation (INV-XXXX)" },
    { field: "Invoice Date", required: "Yes", format: "YYYY-MM-DD", notes: "Date the invoice is issued" },
    { field: "Due Date", required: "Yes", format: "YYYY-MM-DD", notes: "Must be on or after invoice date" },
    { field: "Invoice Description", required: "Yes", format: "Text", notes: "Service or product description" },
    { field: "Quantity", required: "Yes", format: "Positive integer", notes: "Number of units (1 or more)" },
    { field: "Unit Price", required: "Yes", format: "Positive number", notes: "Price per unit in the specified currency" },
    { field: "Total Amount", required: "No", format: "Number", notes: "Auto-calculated as Quantity × Unit Price if blank" },
    { field: "Currency", required: "No", format: "ISO code", notes: "Defaults to SGD. Supported: SGD, USD, MYR, EUR" },
    { field: "Payment Method", required: "No", format: "Text", notes: "Stripe, PayNow, Bank Transfer, or Credit Card" },
  ];
  instructions.forEach((row) => instructSheet.addRow(row));
  instructSheet.getRow(1).font = { bold: true };
  instructSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEDE7F6" } };

  await templateWorkbook.xlsx.writeFile(path.join(templateDir, "sample_invoice_upload_template.xlsx"));
  console.log("  ✓ sample_invoice_upload_template.xlsx (with Instructions sheet)");

  console.log("\n═══════════════════════════════════════════════════════");
  console.log("  ✓ All sample template files generated successfully!");
  console.log("═══════════════════════════════════════════════════════\n");
}

main().catch((err) => {
  console.error("Failed to generate templates:", err);
  process.exit(1);
});
