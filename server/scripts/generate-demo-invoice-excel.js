/**
 * Generate Demo Invoice Excel for FYP Presentation
 *
 * 20 rows covering:
 * - Statuses: Draft (unpaid), Paid (Stripe), Overdue (past due, unpaid), Viewed
 * - Fraud levels: Low, Medium, High
 * - Invalid rows: validation errors caught during bulk upload
 *
 * Run: node scripts/generate-demo-invoice-excel.js
 * Output: uploads/templates/demo_all_scenarios_invoice.xlsx
 */

const ExcelJS = require("exceljs");
const path = require("path");
const fs = require("fs");

async function generate() {
  const outputDir = path.join(__dirname, "../uploads/templates");
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "PayNivo Demo";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Vaniday Bookings");

  sheet.columns = [
    { header: "seller_id", key: "seller_id", width: 10 },
    { header: "shop_title", key: "shop_title", width: 32 },
    { header: "OrderID", key: "OrderID", width: 10 },
    { header: "partner_type_name", key: "partner_type_name", width: 14 },
    { header: "paymentMethod", key: "paymentMethod", width: 18 },
    { header: "productType", key: "productType", width: 12 },
    { header: "customerId", key: "customerId", width: 12 },
    { header: "status", key: "status", width: 12 },
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

  // Style header
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1B5E20" } };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };
  headerRow.height = 22;

  const rows = [
    // ═══════════════════════════════════════════════════════════════════════
    // ROWS 1-4: PAID invoices (Stripe online payment, credit_Card = Total_Revenue)
    // LOW FRAUD RISK - normal amounts, legitimate vendors, valid emails
    // ═══════════════════════════════════════════════════════════════════════
    {
      seller_id: "1064", shop_title: "Palace Therapy - Club Street",
      OrderID: "700001", partner_type_name: "Web", paymentMethod: "stripe_payments",
      productType: "Booking", customerId: "110653", status: "complete", orderStatus: "Completed",
      email: "riho.sonoda@gmail.com", customerName: "Riho Sonoda", contactNo: "80536703",
      qty: "1", serviceName: "Oriental Body Massage (60 min)",
      bookedDate: "10/7/2026 19:15", service_duration: "60", staffId: "", staffName: "",
      Total_Revenue: "65", credit_Card: "65", shippingAmount: "", reward_point: "",
      vanidayCommission: "20", vanidayShare: "13", cashbackFee: "", cashbackDiscount: "0",
      cashbackDate: "", salonshare: "52", subscription: "Premium Monthly",
    },
    {
      seller_id: "242", shop_title: "Geranium Skin & Hair Boutique",
      OrderID: "700002", partner_type_name: "Web", paymentMethod: "stripe_payments",
      productType: "Booking", customerId: "110274", status: "complete", orderStatus: "Completed",
      email: "nazrina.bakri@hotmail.com", customerName: "Nazrina Muhamat Bakri", contactNo: "87422870",
      qty: "1", serviceName: "Gua Sha Facial Treatment (90 min)",
      bookedDate: "12/7/2026 12:00", service_duration: "90", staffId: "", staffName: "",
      Total_Revenue: "98", credit_Card: "98", shippingAmount: "", reward_point: "",
      vanidayCommission: "35", vanidayShare: "34.3", cashbackFee: "", cashbackDiscount: "0",
      cashbackDate: "", salonshare: "63.7", subscription: "Standard Monthly",
    },
    {
      seller_id: "100923", shop_title: "Beethoven Hairxperts",
      OrderID: "700003", partner_type_name: "App", paymentMethod: "stripe_payments",
      productType: "Booking", customerId: "4938", status: "complete", orderStatus: "Completed",
      email: "fauziah.osman@yahoo.com", customerName: "Fauziah Osman", contactNo: "97351856",
      qty: "1", serviceName: "Fashion Colour + Highlight + Argan Treatment",
      bookedDate: "14/7/2026 14:00", service_duration: "180", staffId: "", staffName: "",
      Total_Revenue: "160", credit_Card: "160", shippingAmount: "", reward_point: "",
      vanidayCommission: "20", vanidayShare: "32", cashbackFee: "", cashbackDiscount: "0",
      cashbackDate: "", salonshare: "128", subscription: "",
    },
    {
      seller_id: "555", shop_title: "Luxe Hair Studio",
      OrderID: "700004", partner_type_name: "Web", paymentMethod: "stripe_payments",
      productType: "Booking", customerId: "20100", status: "complete", orderStatus: "Completed",
      email: "sarah.tan@outlook.com", customerName: "Sarah Tan", contactNo: "91234567",
      qty: "1", serviceName: "Keratin Smoothing Treatment",
      bookedDate: "15/7/2026 10:30", service_duration: "120", staffId: "", staffName: "",
      Total_Revenue: "280", credit_Card: "280", shippingAmount: "", reward_point: "",
      vanidayCommission: "20", vanidayShare: "56", cashbackFee: "", cashbackDiscount: "0",
      cashbackDate: "", salonshare: "224", subscription: "Premium Monthly",
    },
    // ═══════════════════════════════════════════════════════════════════════
    // ROWS 5-7: DRAFT invoices (not paid online, cash/bank transfer)
    // LOW FRAUD RISK
    // ═══════════════════════════════════════════════════════════════════════
    {
      seller_id: "1064", shop_title: "Palace Therapy - Club Street",
      OrderID: "700005", partner_type_name: "Web", paymentMethod: "cash",
      productType: "Booking", customerId: "30200", status: "complete", orderStatus: "Completed",
      email: "linda.wong@gmail.com", customerName: "Linda Wong", contactNo: "82345678",
      qty: "1", serviceName: "Thai Full Body Massage (90 min)",
      bookedDate: "20/7/2026 15:00", service_duration: "90", staffId: "", staffName: "",
      Total_Revenue: "85", credit_Card: "0", shippingAmount: "", reward_point: "",
      vanidayCommission: "20", vanidayShare: "17", cashbackFee: "", cashbackDiscount: "0",
      cashbackDate: "", salonshare: "68", subscription: "",
    },
    {
      seller_id: "242", shop_title: "Geranium Skin & Hair Boutique",
      OrderID: "700006", partner_type_name: "App", paymentMethod: "bank_transfer",
      productType: "Booking", customerId: "30201", status: "complete", orderStatus: "Completed",
      email: "david.lim@gmail.com", customerName: "David Lim", contactNo: "93456789",
      qty: "1", serviceName: "Men's Premium Haircut & Styling",
      bookedDate: "22/7/2026 11:00", service_duration: "45", staffId: "", staffName: "",
      Total_Revenue: "55", credit_Card: "0", shippingAmount: "", reward_point: "",
      vanidayCommission: "20", vanidayShare: "11", cashbackFee: "", cashbackDiscount: "0",
      cashbackDate: "", salonshare: "44", subscription: "",
    },
    {
      seller_id: "100923", shop_title: "Beethoven Hairxperts",
      OrderID: "700007", partner_type_name: "Web", paymentMethod: "cash",
      productType: "Booking", customerId: "30202", status: "complete", orderStatus: "Completed",
      email: "michelle.lee@yahoo.com", customerName: "Michelle Lee", contactNo: "84567890",
      qty: "1", serviceName: "Scalp Treatment & Deep Conditioning",
      bookedDate: "23/7/2026 16:30", service_duration: "60", staffId: "", staffName: "",
      Total_Revenue: "120", credit_Card: "0", shippingAmount: "", reward_point: "",
      vanidayCommission: "20", vanidayShare: "24", cashbackFee: "", cashbackDiscount: "0",
      cashbackDate: "", salonshare: "96", subscription: "Standard Monthly",
    },
    // ═══════════════════════════════════════════════════════════════════════
    // ROWS 8-9: OVERDUE invoices (past due date, not paid - use old dates)
    // LOW FRAUD RISK
    // ═══════════════════════════════════════════════════════════════════════
    {
      seller_id: "555", shop_title: "Luxe Hair Studio",
      OrderID: "700008", partner_type_name: "Web", paymentMethod: "bank_transfer",
      productType: "Booking", customerId: "30203", status: "complete", orderStatus: "Completed",
      email: "james.chen@hotmail.com", customerName: "James Chen", contactNo: "95678901",
      qty: "1", serviceName: "Full Head Balayage Colouring",
      bookedDate: "1/5/2026 13:00", service_duration: "150", staffId: "", staffName: "",
      Total_Revenue: "350", credit_Card: "0", shippingAmount: "", reward_point: "",
      vanidayCommission: "20", vanidayShare: "70", cashbackFee: "", cashbackDiscount: "0",
      cashbackDate: "", salonshare: "280", subscription: "",
    },
    {
      seller_id: "1064", shop_title: "Palace Therapy - Club Street",
      OrderID: "700009", partner_type_name: "App", paymentMethod: "cash",
      productType: "Booking", customerId: "30204", status: "complete", orderStatus: "Completed",
      email: "amy.koh@gmail.com", customerName: "Amy Koh", contactNo: "86789012",
      qty: "1", serviceName: "Aromatherapy Full Body Massage (120 min)",
      bookedDate: "15/4/2026 10:00", service_duration: "120", staffId: "", staffName: "",
      Total_Revenue: "150", credit_Card: "0", shippingAmount: "", reward_point: "",
      vanidayCommission: "20", vanidayShare: "30", cashbackFee: "", cashbackDiscount: "0",
      cashbackDate: "", salonshare: "120", subscription: "",
    },
    // ═══════════════════════════════════════════════════════════════════════
    // ROWS 10-11: VIEWED status invoices (paid online but marked viewed)
    // LOW FRAUD RISK
    // ═══════════════════════════════════════════════════════════════════════
    {
      seller_id: "242", shop_title: "Geranium Skin & Hair Boutique",
      OrderID: "700010", partner_type_name: "Web", paymentMethod: "stripe_payments",
      productType: "Booking", customerId: "30205", status: "complete", orderStatus: "Completed",
      email: "rachel.ng@gmail.com", customerName: "Rachel Ng", contactNo: "97890123",
      qty: "1", serviceName: "Anti-Aging Collagen Facial (75 min)",
      bookedDate: "18/7/2026 14:30", service_duration: "75", staffId: "", staffName: "",
      Total_Revenue: "188", credit_Card: "188", shippingAmount: "", reward_point: "",
      vanidayCommission: "25", vanidayShare: "47", cashbackFee: "", cashbackDiscount: "0",
      cashbackDate: "", salonshare: "141", subscription: "",
    },
    {
      seller_id: "555", shop_title: "Luxe Hair Studio",
      OrderID: "700011", partner_type_name: "App", paymentMethod: "stripe_payments",
      productType: "Booking", customerId: "30206", status: "complete", orderStatus: "Completed",
      email: "kevin.teo@outlook.com", customerName: "Kevin Teo", contactNo: "88901234",
      qty: "1", serviceName: "Gentleman's Premium Grooming Package",
      bookedDate: "19/7/2026 09:00", service_duration: "90", staffId: "", staffName: "",
      Total_Revenue: "135", credit_Card: "135", shippingAmount: "", reward_point: "",
      vanidayCommission: "20", vanidayShare: "27", cashbackFee: "", cashbackDiscount: "0",
      cashbackDate: "", salonshare: "108", subscription: "",
    },
    // ═══════════════════════════════════════════════════════════════════════
    // ROW 12: MEDIUM FRAUD - Suspicious email domain (tempmail) = 15 pts
    //         + Unusual payment terms (due date > 60 days from issue) = 20 pts
    //         Total: 35 (Medium >= 31)
    // ═══════════════════════════════════════════════════════════════════════
    {
      seller_id: "1064", shop_title: "Palace Therapy - Club Street",
      OrderID: "700012", partner_type_name: "Web", paymentMethod: "stripe_payments",
      productType: "Booking", customerId: "40100", status: "complete", orderStatus: "Completed",
      email: "buyer123@tempmail.com", customerName: "Temp Buyer", contactNo: "90001111",
      qty: "1", serviceName: "Deep Tissue Sports Massage (90 min)",
      bookedDate: "20/7/2026 11:00", service_duration: "90", staffId: "", staffName: "",
      Total_Revenue: "120", credit_Card: "120", shippingAmount: "", reward_point: "",
      vanidayCommission: "20", vanidayShare: "24", cashbackFee: "", cashbackDiscount: "0",
      cashbackDate: "", salonshare: "96", subscription: "",
    },
    // ═══════════════════════════════════════════════════════════════════════
    // ROW 13: MEDIUM FRAUD - Unknown vendor (shop_title contains "unknown") = 25 pts
    //         + Invalid phone format = 15 pts
    //         Total: 40 (Medium)
    // ═══════════════════════════════════════════════════════════════════════
    {
      seller_id: "9999", shop_title: "Unknown Suspicious Vendor",
      OrderID: "700013", partner_type_name: "Web", paymentMethod: "stripe_payments",
      productType: "Booking", customerId: "40101", status: "complete", orderStatus: "Completed",
      email: "mark.williams@gmail.com", customerName: "Mark Williams", contactNo: "ABC-INVALID",
      qty: "1", serviceName: "Premium Facial Treatment Package",
      bookedDate: "21/7/2026 15:00", service_duration: "60", staffId: "", staffName: "",
      Total_Revenue: "250", credit_Card: "250", shippingAmount: "", reward_point: "",
      vanidayCommission: "20", vanidayShare: "50", cashbackFee: "", cashbackDiscount: "0",
      cashbackDate: "", salonshare: "200", subscription: "",
    },
    // ═══════════════════════════════════════════════════════════════════════
    // ROW 14: HIGH FRAUD - Suspicious description (crypto gift card) = 20 pts
    //         + Unknown vendor = 25 pts + Suspicious email domain = 15 pts
    //         + Unusual payment terms = 20 pts
    //         Total: 80 (High >= 71)
    // ═══════════════════════════════════════════════════════════════════════
    {
      seller_id: "8888", shop_title: "Unregistered Services Ltd",
      OrderID: "700014", partner_type_name: "Web", paymentMethod: "cash",
      productType: "Booking", customerId: "50100", status: "complete", orderStatus: "Completed",
      email: "scammer@mailinator.com", customerName: "Fake Business Corp", contactNo: "00000000",
      qty: "1", serviceName: "URGENT refund adjustment - crypto gift card payout required",
      bookedDate: "1/3/2026 09:00", service_duration: "30", staffId: "", staffName: "",
      Total_Revenue: "9999", credit_Card: "0", shippingAmount: "", reward_point: "",
      vanidayCommission: "0", vanidayShare: "0", cashbackFee: "", cashbackDiscount: "0",
      cashbackDate: "", salonshare: "9999", subscription: "",
    },
    // ═══════════════════════════════════════════════════════════════════════
    // ROW 15: HIGH FRAUD - Unknown vendor = 25 + Suspicious description = 20
    //         + Suspicious email = 15 + Amount outlier (very high) = 25
    //         Total: 85 (High)
    // ═══════════════════════════════════════════════════════════════════════
    {
      seller_id: "7777", shop_title: "Suspicious Unregistered Spa",
      OrderID: "700015", partner_type_name: "Web", paymentMethod: "stripe_payments",
      productType: "Booking", customerId: "50101", status: "complete", orderStatus: "Completed",
      email: "anon.user@fake.tempmail.com", customerName: "Anonymous User", contactNo: "99999999",
      qty: "1", serviceName: "Cash payout - urgent confidential transfer required immediately",
      bookedDate: "22/7/2026 08:00", service_duration: "15", staffId: "", staffName: "",
      Total_Revenue: "50000", credit_Card: "50000", shippingAmount: "", reward_point: "",
      vanidayCommission: "0", vanidayShare: "0", cashbackFee: "", cashbackDiscount: "0",
      cashbackDate: "", salonshare: "50000", subscription: "",
    },
    // ═══════════════════════════════════════════════════════════════════════
    // ROWS 16-20: INVALID ROWS (validation errors caught during upload)
    // ═══════════════════════════════════════════════════════════════════════

    // Row 16: Missing OrderID (required field)
    {
      seller_id: "1064", shop_title: "Palace Therapy - Club Street",
      OrderID: "", partner_type_name: "Web", paymentMethod: "stripe_payments",
      productType: "Booking", customerId: "110653", status: "complete", orderStatus: "Completed",
      email: "riho.sonoda@gmail.com", customerName: "Riho Sonoda", contactNo: "80536703",
      qty: "1", serviceName: "Foot Reflexology (45 min)",
      bookedDate: "25/7/2026 18:00", service_duration: "45", staffId: "", staffName: "",
      Total_Revenue: "48", credit_Card: "48", shippingAmount: "", reward_point: "",
      vanidayCommission: "20", vanidayShare: "9.6", cashbackFee: "", cashbackDiscount: "0",
      cashbackDate: "", salonshare: "38.4", subscription: "",
    },
    // Row 17: Invalid email format
    {
      seller_id: "242", shop_title: "Geranium Skin & Hair Boutique",
      OrderID: "700017", partner_type_name: "Web", paymentMethod: "stripe_payments",
      productType: "Booking", customerId: "110274", status: "complete", orderStatus: "Completed",
      email: "not-a-valid-email", customerName: "Invalid Email Customer", contactNo: "87422870",
      qty: "1", serviceName: "Scalp Treatment & Analysis",
      bookedDate: "25/7/2026 10:30", service_duration: "60", staffId: "", staffName: "",
      Total_Revenue: "120", credit_Card: "120", shippingAmount: "", reward_point: "",
      vanidayCommission: "20", vanidayShare: "24", cashbackFee: "", cashbackDiscount: "0",
      cashbackDate: "", salonshare: "96", subscription: "",
    },
    // Row 18: Missing service name (required field)
    {
      seller_id: "100923", shop_title: "Beethoven Hairxperts",
      OrderID: "700018", partner_type_name: "App", paymentMethod: "stripe_payments",
      productType: "Booking", customerId: "4938", status: "complete", orderStatus: "Completed",
      email: "fauziah.osman@yahoo.com", customerName: "Fauziah Osman", contactNo: "97351856",
      qty: "1", serviceName: "",
      bookedDate: "26/7/2026 14:00", service_duration: "60", staffId: "", staffName: "",
      Total_Revenue: "80", credit_Card: "80", shippingAmount: "", reward_point: "",
      vanidayCommission: "20", vanidayShare: "16", cashbackFee: "", cashbackDiscount: "0",
      cashbackDate: "", salonshare: "64", subscription: "",
    },
    // Row 19: Cancelled order (non-completed status - rejected during validation)
    {
      seller_id: "1064", shop_title: "Palace Therapy - Club Street",
      OrderID: "700019", partner_type_name: "Web", paymentMethod: "stripe_payments",
      productType: "Booking", customerId: "110653", status: "cancelled", orderStatus: "Cancelled",
      email: "riho.sonoda@gmail.com", customerName: "Riho Sonoda", contactNo: "80536703",
      qty: "1", serviceName: "Hot Stone Therapy (60 min)",
      bookedDate: "26/7/2026 11:00", service_duration: "60", staffId: "", staffName: "",
      Total_Revenue: "95", credit_Card: "0", shippingAmount: "", reward_point: "",
      vanidayCommission: "20", vanidayShare: "19", cashbackFee: "", cashbackDiscount: "0",
      cashbackDate: "", salonshare: "76", subscription: "",
    },
    // Row 20: Missing customer name AND missing email (multiple errors)
    {
      seller_id: "555", shop_title: "Luxe Hair Studio",
      OrderID: "700020", partner_type_name: "Web", paymentMethod: "cash",
      productType: "Booking", customerId: "99999", status: "complete", orderStatus: "Completed",
      email: "", customerName: "", contactNo: "90001234",
      qty: "1", serviceName: "Hair Extensions Full Set",
      bookedDate: "26/7/2026 10:00", service_duration: "150", staffId: "", staffName: "",
      Total_Revenue: "450", credit_Card: "0", shippingAmount: "", reward_point: "",
      vanidayCommission: "20", vanidayShare: "90", cashbackFee: "", cashbackDiscount: "0",
      cashbackDate: "", salonshare: "360", subscription: "",
    },
  ];

  rows.forEach((row) => sheet.addRow(row));

  // ── Add a Scenario Guide sheet ──────────────────────────────────────────────
  const guideSheet = workbook.addWorksheet("Scenario Guide");
  guideSheet.columns = [
    { header: "Row", key: "row", width: 6 },
    { header: "Scenario", key: "scenario", width: 22 },
    { header: "Expected Status", key: "status", width: 16 },
    { header: "Fraud Risk", key: "fraud", width: 14 },
    { header: "Notes", key: "notes", width: 60 },
  ];
  const guideHeaderRow = guideSheet.getRow(1);
  guideHeaderRow.font = { bold: true };
  guideHeaderRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE3F2FD" } };

  const guide = [
    { row: 1, scenario: "Paid (Stripe)", status: "Paid", fraud: "Low", notes: "Normal massage booking, paid online via Stripe" },
    { row: 2, scenario: "Paid (Stripe)", status: "Paid", fraud: "Low", notes: "Facial treatment, paid online, linked to Standard Monthly sub" },
    { row: 3, scenario: "Paid (Stripe)", status: "Paid", fraud: "Low", notes: "Hair colouring, paid online" },
    { row: 4, scenario: "Paid (Stripe)", status: "Paid", fraud: "Low", notes: "Keratin treatment, paid online, linked to Premium Monthly sub" },
    { row: 5, scenario: "Draft (Unpaid)", status: "Draft", fraud: "Low", notes: "Cash payment method - invoice sent but not paid online" },
    { row: 6, scenario: "Draft (Unpaid)", status: "Draft", fraud: "Low", notes: "Bank transfer - awaiting payment" },
    { row: 7, scenario: "Draft (Unpaid)", status: "Draft", fraud: "Low", notes: "Cash, linked to Standard Monthly subscription" },
    { row: 8, scenario: "Overdue", status: "Overdue", fraud: "Low", notes: "Old date (May 2026), bank transfer never paid - will be overdue" },
    { row: 9, scenario: "Overdue", status: "Overdue", fraud: "Low", notes: "Old date (Apr 2026), cash payment never received - will be overdue" },
    { row: 10, scenario: "Viewed", status: "Paid", fraud: "Low", notes: "Facial, paid online - can be manually set to Viewed for demo" },
    { row: 11, scenario: "Viewed", status: "Paid", fraud: "Low", notes: "Grooming package, paid online - can be manually set to Viewed" },
    { row: 12, scenario: "Medium Fraud", status: "Paid", fraud: "Medium", notes: "Suspicious email domain (tempmail.com) = 15pts + will trigger more on assessment" },
    { row: 13, scenario: "Medium Fraud", status: "Paid", fraud: "Medium", notes: "Unknown vendor name = 25pts + invalid phone = 15pts = 40 total" },
    { row: 14, scenario: "High Fraud", status: "Draft", fraud: "High", notes: "Unregistered vendor + crypto/gift card description + mailinator email" },
    { row: 15, scenario: "High Fraud", status: "Paid", fraud: "High", notes: "Suspicious vendor + confidential description + fake email + $50k amount" },
    { row: 16, scenario: "INVALID", status: "Rejected", fraud: "N/A", notes: "Missing OrderID - will fail validation" },
    { row: 17, scenario: "INVALID", status: "Rejected", fraud: "N/A", notes: "Invalid email format - will fail validation" },
    { row: 18, scenario: "INVALID", status: "Rejected", fraud: "N/A", notes: "Missing service name - will fail validation" },
    { row: 19, scenario: "INVALID", status: "Rejected", fraud: "N/A", notes: "Cancelled order status - only completed orders allowed" },
    { row: 20, scenario: "INVALID", status: "Rejected", fraud: "N/A", notes: "Missing customer name AND email - multiple validation errors" },
  ];
  guide.forEach((row) => guideSheet.addRow(row));

  const outputPath = path.join(outputDir, "demo_all_scenarios_invoice.xlsx");
  await workbook.xlsx.writeFile(outputPath);
  console.log(`\nDemo Excel generated: ${outputPath}`);
  console.log(`\nScenario breakdown:`);
  console.log(`  Rows 1-4:   PAID (Stripe) - Low fraud`);
  console.log(`  Rows 5-7:   DRAFT (unpaid) - Low fraud`);
  console.log(`  Rows 8-9:   OVERDUE (old dates, unpaid) - Low fraud`);
  console.log(`  Rows 10-11: VIEWED (paid, can set Viewed) - Low fraud`);
  console.log(`  Row 12:     MEDIUM fraud (suspicious email domain)`);
  console.log(`  Row 13:     MEDIUM fraud (unknown vendor + invalid phone)`);
  console.log(`  Row 14:     HIGH fraud (crypto desc + unregistered + mailinator)`);
  console.log(`  Row 15:     HIGH fraud (suspicious vendor + confidential desc + fake email + $50k)`);
  console.log(`  Rows 16-20: INVALID (caught during validation)`);
}

generate().catch(console.error);
