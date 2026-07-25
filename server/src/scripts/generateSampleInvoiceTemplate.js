/**
 * Generate Sample Invoice Upload Templates (with Subscription column)
 *
 * Run: node src/scripts/generateSampleInvoiceTemplate.js
 * Output:
 *   uploads/templates/sample_invoice_upload_template.xlsx  (Bulk Invoice format)
 *   uploads/templates/vaniday_invoice_sample_with_subscription.xlsx (Vaniday format)
 */

const ExcelJS = require("exceljs");
const path = require("path");
const fs = require("fs");

async function generateTemplate() {
  const outputDir = path.join(__dirname, "..", "..", "uploads", "templates");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // ── Template 1: Bulk Invoice Upload ─────────────────────────────────────────
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "PayNivo";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Invoice Upload");

  // Define columns with header styling
  sheet.columns = [
    { header: "Invoice Number", key: "invoice_number", width: 18 },
    { header: "Customer Name", key: "customer_name", width: 28 },
    { header: "Invoice Date", key: "invoice_date", width: 14 },
    { header: "Due Date", key: "due_date", width: 14 },
    { header: "Amount", key: "amount", width: 14 },
    { header: "Subscription", key: "subscription", width: 22 },
  ];

  // Style the header row
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, size: 11 };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF0D2CA" },
  };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };
  headerRow.height = 22;

  // Add sample rows
  const sampleData = [
    { invoice_number: "INV-2026-0050", customer_name: "Luxe Hair Studio", invoice_date: "2026-08-01", due_date: "2026-08-31", amount: 4850.00, subscription: "Premium Monthly" },
    { invoice_number: "INV-2026-0051", customer_name: "The Nail Artistry", invoice_date: "2026-08-01", due_date: "2026-08-31", amount: 3760.00, subscription: "Standard Monthly" },
    { invoice_number: "INV-2026-0052", customer_name: "Serenity Spa & Wellness", invoice_date: "2026-08-01", due_date: "2026-08-31", amount: 8920.00, subscription: "Enterprise Quarterly" },
    { invoice_number: "INV-2026-0053", customer_name: "Glow Aesthetics Clinic", invoice_date: "2026-08-01", due_date: "2026-08-31", amount: 12680.00, subscription: "" },
    { invoice_number: "INV-2026-0054", customer_name: "Brow & Lash Bar", invoice_date: "2026-08-01", due_date: "2026-08-31", amount: 6540.50, subscription: "Premium Monthly" },
    { invoice_number: "INV-2026-0055", customer_name: "KBeauty Haven", invoice_date: "2026-08-01", due_date: "2026-08-31", amount: 4280.00, subscription: "" },
    { invoice_number: "INV-2026-0056", customer_name: "Zen Reflexology Centre", invoice_date: "2026-08-01", due_date: "2026-08-31", amount: 2950.00, subscription: "Standard Monthly" },
    { invoice_number: "INV-2026-0057", customer_name: "Prestige Barbers", invoice_date: "2026-08-01", due_date: "2026-08-31", amount: 5120.00, subscription: "Premium Monthly" },
    { invoice_number: "INV-2026-0058", customer_name: "Skin Lab Express", invoice_date: "2026-08-01", due_date: "2026-08-31", amount: 9450.00, subscription: "Enterprise Quarterly" },
    { invoice_number: "INV-2026-0059", customer_name: "Orchid Beauty Lounge", invoice_date: "2026-08-01", due_date: "2026-08-31", amount: 7380.00, subscription: "" },
  ];

  sampleData.forEach((row) => {
    sheet.addRow(row);
  });

  // Format amount column as currency
  sheet.getColumn("amount").numFmt = "#,##0.00";

  // Add a "Notes" sheet with instructions
  const notesSheet = workbook.addWorksheet("Instructions");
  notesSheet.columns = [
    { header: "Column", key: "column", width: 20 },
    { header: "Required", key: "required", width: 10 },
    { header: "Description", key: "description", width: 60 },
  ];

  const notesHeaderRow = notesSheet.getRow(1);
  notesHeaderRow.font = { bold: true };
  notesHeaderRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE7F7F5" },
  };

  const instructions = [
    { column: "Invoice Number", required: "Yes", description: "Unique invoice identifier (e.g. INV-2026-0050). Must not already exist in the system." },
    { column: "Customer Name", required: "Yes", description: "Must match an existing customer name in the system exactly." },
    { column: "Invoice Date", required: "Yes", description: "Issue date in YYYY-MM-DD format." },
    { column: "Due Date", required: "Yes", description: "Payment due date in YYYY-MM-DD format." },
    { column: "Amount", required: "Yes", description: "Invoice total amount (positive number, e.g. 4850.00)." },
    { column: "Subscription", required: "No", description: "Plan name of an active subscription for this customer. If provided, the invoice will be linked to the subscription. Leave empty for non-subscription invoices." },
  ];

  instructions.forEach((row) => notesSheet.addRow(row));

  // Save bulk invoice template
  const outputPath = path.join(outputDir, "sample_invoice_upload_template.xlsx");
  await workbook.xlsx.writeFile(outputPath);
  console.log(`Template generated: ${outputPath}`);

  // ── Template 2: Vaniday Import Sample (with Subscription column) ────────────
  const vanidayWb = new ExcelJS.Workbook();
  vanidayWb.creator = "PayNivo";
  vanidayWb.created = new Date();

  const vanidaySheet = vanidayWb.addWorksheet("Vaniday Bookings");

  vanidaySheet.columns = [
    { header: "seller_id", key: "seller_id", width: 10 },
    { header: "shop_title", key: "shop_title", width: 32 },
    { header: "OrderID", key: "OrderID", width: 10 },
    { header: "partner_type_name", key: "partner_type_name", width: 14 },
    { header: "paymentMethod", key: "paymentMethod", width: 18 },
    { header: "productType", key: "productType", width: 12 },
    { header: "customerId", key: "customerId", width: 12 },
    { header: "status", key: "status", width: 10 },
    { header: "orderStatus", key: "orderStatus", width: 12 },
    { header: "email", key: "email", width: 30 },
    { header: "customerName", key: "customerName", width: 26 },
    { header: "contactNo", key: "contactNo", width: 14 },
    { header: "qty", key: "qty", width: 6 },
    { header: "serviceName", key: "serviceName", width: 50 },
    { header: "bookedDate", key: "bookedDate", width: 18 },
    { header: "service_duration", key: "service_duration", width: 14 },
    { header: "staffId", key: "staffId", width: 8 },
    { header: "staffName", key: "staffName", width: 18 },
    { header: "Total_Revenue", key: "Total_Revenue", width: 14 },
    { header: "credit_Card", key: "credit_Card", width: 12 },
    { header: "shippingAmount", key: "shippingAmount", width: 14 },
    { header: "reward_point", key: "reward_point", width: 12 },
    { header: "vanidayCommission", key: "vanidayCommission", width: 18 },
    { header: "vanidayShare", key: "vanidayShare", width: 14 },
    { header: "cashbackFee", key: "cashbackFee", width: 12 },
    { header: "cashbackDiscount", key: "cashbackDiscount", width: 16 },
    { header: "cashbackDate", key: "cashbackDate", width: 12 },
    { header: "salonshare", key: "salonshare", width: 12 },
    { header: "subscription", key: "subscription", width: 22 },
  ];

  // Style the header row
  const vanidayHeaderRow = vanidaySheet.getRow(1);
  vanidayHeaderRow.font = { bold: true, size: 10 };
  vanidayHeaderRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE7F7F5" },
  };

  // Add sample Vaniday data
  const vanidaySampleData = [
    { seller_id: "1064", shop_title: "Palace Therapy - Club Street", OrderID: "539751", partner_type_name: "Web", paymentMethod: "stripe_payments", productType: "Booking", customerId: "110653", status: "complete", orderStatus: "Completed", email: "r.sonoda1107@gmail.com", customerName: "Riho Sonoda", contactNo: "80536703", qty: "", serviceName: "Oriental Body Massage", bookedDate: "9/1/2025 19:15", service_duration: "60", staffId: "", staffName: "", Total_Revenue: "65", credit_Card: "65", shippingAmount: "", reward_point: "", vanidayCommission: "20", vanidayShare: "13", cashbackFee: "", cashbackDiscount: "0", cashbackDate: "", salonshare: "52", subscription: "Premium Monthly" },
    { seller_id: "242", shop_title: "Geranium Skin & Hair Boutique", OrderID: "539755", partner_type_name: "Web", paymentMethod: "stripe_payments", productType: "Booking", customerId: "110274", status: "complete", orderStatus: "Completed", email: "naz_mistique@hotmail.com", customerName: "NAZRINA MUHAMAT BAKRI", contactNo: "87422870", qty: "", serviceName: "GS + Best Gua Sha Facial - Readers' Choice Award 2023", bookedDate: "3/9/2025 12:00", service_duration: "90", staffId: "", staffName: "", Total_Revenue: "98", credit_Card: "98", shippingAmount: "", reward_point: "", vanidayCommission: "35", vanidayShare: "34.3", cashbackFee: "", cashbackDiscount: "0", cashbackDate: "", salonshare: "63.7", subscription: "Standard Monthly" },
    { seller_id: "1064", shop_title: "Palace Therapy - Club Street", OrderID: "539756", partner_type_name: "Web", paymentMethod: "stripe_payments", productType: "Booking", customerId: "110653", status: "complete", orderStatus: "Completed", email: "r.sonoda1107@gmail.com", customerName: "Riho Sonoda", contactNo: "80536703", qty: "", serviceName: "Oriental Body Massage 3", bookedDate: "1/9/2025 19:15", service_duration: "60", staffId: "", staffName: "", Total_Revenue: "65", credit_Card: "65", shippingAmount: "", reward_point: "", vanidayCommission: "20", vanidayShare: "13", cashbackFee: "", cashbackDiscount: "0", cashbackDate: "", salonshare: "52", subscription: "Premium Monthly" },
    { seller_id: "100923", shop_title: "Beethoven Hairxperts 2", OrderID: "539753", partner_type_name: "Web", paymentMethod: "stripe_payments", productType: "Booking", customerId: "4938", status: "complete", orderStatus: "Completed", email: "fauziyaya@yahoo.com", customerName: "fauziah osman", contactNo: "97351856", qty: "", serviceName: "Fashion Colour + Highlight + Argan Treatment - 1 pax (with Haircut)", bookedDate: "2/9/2025 19:15", service_duration: "180", staffId: "", staffName: "", Total_Revenue: "160", credit_Card: "160", shippingAmount: "", reward_point: "", vanidayCommission: "20", vanidayShare: "32", cashbackFee: "", cashbackDiscount: "0", cashbackDate: "", salonshare: "128", subscription: "" },
    { seller_id: "1064", shop_title: "Palace Therapy - Club Street", OrderID: "539760", partner_type_name: "Web", paymentMethod: "stripe_payments", productType: "Booking", customerId: "110653", status: "complete", orderStatus: "Completed", email: "r.sonoda1107@gmail.com", customerName: "Riho Sonoda", contactNo: "80536703", qty: "", serviceName: "Thai Full Body Massage", bookedDate: "5/9/2025 14:00", service_duration: "90", staffId: "", staffName: "", Total_Revenue: "85", credit_Card: "85", shippingAmount: "", reward_point: "", vanidayCommission: "20", vanidayShare: "17", cashbackFee: "", cashbackDiscount: "0", cashbackDate: "", salonshare: "68", subscription: "Premium Monthly" },
  ];

  vanidaySampleData.forEach((row) => vanidaySheet.addRow(row));

  // Add instructions sheet
  const vanidayNotesSheet = vanidayWb.addWorksheet("Instructions");
  vanidayNotesSheet.columns = [
    { header: "Column", key: "column", width: 20 },
    { header: "Required", key: "required", width: 10 },
    { header: "Description", key: "description", width: 70 },
  ];
  vanidayNotesSheet.getRow(1).font = { bold: true };

  const vanidayInstructions = [
    { column: "OrderID", required: "Yes", description: "Unique booking order identifier from Vaniday." },
    { column: "customerName", required: "Yes", description: "Customer full name." },
    { column: "email", required: "Yes", description: "Customer email address (used to match/create customers)." },
    { column: "shop_title", required: "Yes", description: "Service provider / merchant name." },
    { column: "serviceName", required: "Yes", description: "Name of the booked service (used as invoice line item description)." },
    { column: "Total_Revenue", required: "Yes", description: "Total revenue / invoice amount for the booking." },
    { column: "bookedDate", required: "No", description: "Booking date (DD/MM/YYYY). Used as invoice issue date." },
    { column: "paymentMethod", required: "No", description: "Payment method (e.g. stripe_payments). Determines if invoice is auto-marked Paid." },
    { column: "credit_Card", required: "No", description: "Amount paid via card. If matches total, invoice is marked Paid." },
    { column: "subscription", required: "No", description: "Subscription plan name. If provided and matches an active subscription for the customer, the invoice will be linked to that subscription. Leave empty for non-subscription bookings." },
  ];
  vanidayInstructions.forEach((row) => vanidayNotesSheet.addRow(row));

  const vanidayOutputPath = path.join(outputDir, "vaniday_invoice_sample_with_subscription.xlsx");
  await vanidayWb.xlsx.writeFile(vanidayOutputPath);
  console.log(`Vaniday template generated: ${vanidayOutputPath}`);
}

generateTemplate().catch(console.error);
