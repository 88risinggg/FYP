/**
 * Generate Bulk Upload Test Data Excel (Vaniday Format)
 *
 * The Invoicing "Bulk Upload" feature uses the Vaniday import service.
 * Required columns: OrderID, customerName, email, shop_title, serviceName, Total_Revenue
 * Optional: bookedDate, paymentMethod, credit_Card, status, orderStatus, subscription, etc.
 *
 * This generates 20 rows covering Payment, Customer, Fraud, and Validation scenarios.
 * Includes "Arut" test customer (arut1657@gmail.com / +6598951296) for email/WhatsApp testing.
 *
 * Run: node scripts/generate-bulk-upload-test-data.js
 * Output: uploads/templates/bulk_upload_test_all_scenarios_invoice.xlsx
 */

const ExcelJS = require("exceljs");
const path = require("path");
const fs = require("fs");

async function generate() {
  const outputDir = path.join(__dirname, "../uploads/templates");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "PayNivo Test Data Generator";
  workbook.created = new Date();

  const mainSheet = workbook.addWorksheet("Vaniday Bookings");

  mainSheet.columns = [
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
  const headerRow = mainSheet.getRow(1);
  headerRow.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1B5E20" } };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };
  headerRow.height = 22;

  const rows = [
    // ══════════════════════════════════════════════════════════════════════════
    // ROWS 1-4: PAYMENT COMPLETED (Stripe, paid online)
    // ══════════════════════════════════════════════════════════════════════════
    {
      seller_id: "1064", shop_title: "Palace Therapy - Club Street",
      OrderID: "600001", partner_type_name: "Web", paymentMethod: "stripe_payments",
      productType: "Booking", customerId: "110653", status: "complete", orderStatus: "Completed",
      email: "r.sonoda1107@gmail.com", customerName: "Riho Sonoda", contactNo: "80536703",
      qty: "1", serviceName: "Oriental Body Massage (60 min)",
      bookedDate: "15/7/2026 19:15", service_duration: "60", staffId: "", staffName: "",
      Total_Revenue: "65", credit_Card: "65", shippingAmount: "", reward_point: "",
      vanidayCommission: "20", vanidayShare: "13", cashbackFee: "", cashbackDiscount: "0",
      cashbackDate: "", salonshare: "52", subscription: "Premium Monthly",
    },
    {
      seller_id: "242", shop_title: "Geranium Skin & Hair Boutique",
      OrderID: "600002", partner_type_name: "Web", paymentMethod: "stripe_payments",
      productType: "Booking", customerId: "110274", status: "complete", orderStatus: "Completed",
      email: "naz_mistique@hotmail.com", customerName: "Nazrina Muhamat Bakri", contactNo: "87422870",
      qty: "1", serviceName: "GS + Best Gua Sha Facial Treatment",
      bookedDate: "16/7/2026 12:00", service_duration: "90", staffId: "", staffName: "",
      Total_Revenue: "98", credit_Card: "98", shippingAmount: "", reward_point: "",
      vanidayCommission: "35", vanidayShare: "34.3", cashbackFee: "", cashbackDiscount: "0",
      cashbackDate: "", salonshare: "63.7", subscription: "Standard Monthly",
    },
    {
      seller_id: "100923", shop_title: "Beethoven Hairxperts",
      OrderID: "600003", partner_type_name: "Web", paymentMethod: "stripe_payments",
      productType: "Booking", customerId: "4938", status: "complete", orderStatus: "Completed",
      email: "fauziyaya@yahoo.com", customerName: "Fauziah Osman", contactNo: "97351856",
      qty: "1", serviceName: "Fashion Colour + Highlight + Argan Treatment",
      bookedDate: "17/7/2026 10:00", service_duration: "180", staffId: "12", staffName: "Mei Ling",
      Total_Revenue: "160", credit_Card: "160", shippingAmount: "", reward_point: "",
      vanidayCommission: "20", vanidayShare: "32", cashbackFee: "", cashbackDiscount: "0",
      cashbackDate: "", salonshare: "128", subscription: "",
    },
    // Row 4: TEST CUSTOMER - Arut (for email & WhatsApp testing) - PAID
    {
      seller_id: "555", shop_title: "Luxe Hair Studio",
      OrderID: "600004", partner_type_name: "Web", paymentMethod: "stripe_payments",
      productType: "Booking", customerId: "TEST01", status: "complete", orderStatus: "Completed",
      email: "arut1657@gmail.com", customerName: "Arut", contactNo: "+6598951296",
      qty: "1", serviceName: "Keratin Smoothing Treatment",
      bookedDate: "18/7/2026 14:00", service_duration: "120", staffId: "5", staffName: "Sarah Tan",
      Total_Revenue: "350", credit_Card: "350", shippingAmount: "", reward_point: "",
      vanidayCommission: "15", vanidayShare: "52.5", cashbackFee: "", cashbackDiscount: "0",
      cashbackDate: "", salonshare: "297.5", subscription: "Premium Monthly",
    },
    // ══════════════════════════════════════════════════════════════════════════
    // ROWS 5-6: PAYMENT PENDING (cash/bank transfer - not auto-paid)
    // ══════════════════════════════════════════════════════════════════════════
    {
      seller_id: "1064", shop_title: "Palace Therapy - Club Street",
      OrderID: "600005", partner_type_name: "Walk-in", paymentMethod: "cash",
      productType: "Booking", customerId: "110653", status: "complete", orderStatus: "Completed",
      email: "r.sonoda1107@gmail.com", customerName: "Riho Sonoda", contactNo: "80536703",
      qty: "1", serviceName: "Thai Full Body Massage (90 min)",
      bookedDate: "19/7/2026 14:00", service_duration: "90", staffId: "", staffName: "",
      Total_Revenue: "85", credit_Card: "0", shippingAmount: "", reward_point: "",
      vanidayCommission: "20", vanidayShare: "17", cashbackFee: "", cashbackDiscount: "0",
      cashbackDate: "", salonshare: "68", subscription: "",
    },
    // Row 6: TEST CUSTOMER - Arut (UNPAID - for WhatsApp reminder testing)
    {
      seller_id: "555", shop_title: "Luxe Hair Studio",
      OrderID: "600006", partner_type_name: "Walk-in", paymentMethod: "cash",
      productType: "Booking", customerId: "TEST01", status: "complete", orderStatus: "Completed",
      email: "arut1657@gmail.com", customerName: "Arut", contactNo: "+6598951296",
      qty: "1", serviceName: "Digital Perm Full Head",
      bookedDate: "20/7/2026 11:30", service_duration: "180", staffId: "5", staffName: "Sarah Tan",
      Total_Revenue: "280", credit_Card: "0", shippingAmount: "", reward_point: "",
      vanidayCommission: "15", vanidayShare: "42", cashbackFee: "", cashbackDiscount: "0",
      cashbackDate: "", salonshare: "238", subscription: "",
    },

    // ══════════════════════════════════════════════════════════════════════════
    // ROWS 7-10: FRAUD DETECTION TRIGGERS (valid, but trigger fraud rules)
    // ══════════════════════════════════════════════════════════════════════════

    // Row 7: CUSTOMER_AMOUNT_OUTLIER - abnormally high amount
    {
      seller_id: "1064", shop_title: "Palace Therapy - Club Street",
      OrderID: "600007", partner_type_name: "Web", paymentMethod: "stripe_payments",
      productType: "Booking", customerId: "110653", status: "complete", orderStatus: "Completed",
      email: "r.sonoda1107@gmail.com", customerName: "Riho Sonoda", contactNo: "80536703",
      qty: "1", serviceName: "VIP Platinum Diamond Package",
      bookedDate: "21/7/2026 10:00", service_duration: "240", staffId: "", staffName: "",
      Total_Revenue: "25000", credit_Card: "25000", shippingAmount: "", reward_point: "",
      vanidayCommission: "20", vanidayShare: "5000", cashbackFee: "", cashbackDiscount: "0",
      cashbackDate: "", salonshare: "20000", subscription: "",
    },
    // Row 8: UNKNOWN_VENDOR - shop name contains "unknown"
    {
      seller_id: "9999", shop_title: "Unknown Suspicious Vendor",
      OrderID: "600008", partner_type_name: "Web", paymentMethod: "stripe_payments",
      productType: "Booking", customerId: "110274", status: "complete", orderStatus: "Completed",
      email: "naz_mistique@hotmail.com", customerName: "Nazrina Muhamat Bakri", contactNo: "87422870",
      qty: "1", serviceName: "Premium Facial Treatment",
      bookedDate: "22/7/2026 15:00", service_duration: "60", staffId: "", staffName: "",
      Total_Revenue: "750", credit_Card: "750", shippingAmount: "", reward_point: "",
      vanidayCommission: "20", vanidayShare: "150", cashbackFee: "", cashbackDiscount: "0",
      cashbackDate: "", salonshare: "600", subscription: "",
    },
    // Row 9: SUSPICIOUS_DESCRIPTION - contains "urgent refund crypto gift card"
    {
      seller_id: "1064", shop_title: "Palace Therapy - Club Street",
      OrderID: "600009", partner_type_name: "Web", paymentMethod: "stripe_payments",
      productType: "Booking", customerId: "4938", status: "complete", orderStatus: "Completed",
      email: "fauziyaya@yahoo.com", customerName: "Fauziah Osman", contactNo: "97351856",
      qty: "1", serviceName: "URGENT refund adjustment - crypto gift card payout",
      bookedDate: "23/7/2026 09:00", service_duration: "30", staffId: "", staffName: "",
      Total_Revenue: "5000", credit_Card: "5000", shippingAmount: "", reward_point: "",
      vanidayCommission: "0", vanidayShare: "0", cashbackFee: "", cashbackDiscount: "0",
      cashbackDate: "", salonshare: "5000", subscription: "",
    },
    // Row 10: SUSPICIOUS_EMAIL_DOMAIN - uses tempmail domain
    {
      seller_id: "555", shop_title: "Luxe Hair Studio",
      OrderID: "600010", partner_type_name: "Web", paymentMethod: "stripe_payments",
      productType: "Booking", customerId: "99999", status: "complete", orderStatus: "Completed",
      email: "fraud.test@tempmail.com", customerName: "Suspicious Buyer", contactNo: "90001111",
      qty: "1", serviceName: "Hair Extensions Installation Full Set",
      bookedDate: "24/7/2026 16:00", service_duration: "150", staffId: "", staffName: "",
      Total_Revenue: "1200", credit_Card: "1200", shippingAmount: "", reward_point: "",
      vanidayCommission: "20", vanidayShare: "240", cashbackFee: "", cashbackDiscount: "0",
      cashbackDate: "", salonshare: "960", subscription: "",
    },
    // ══════════════════════════════════════════════════════════════════════════
    // ROWS 11-16: VALIDATION ERRORS (1-2 specific errors each)
    // ══════════════════════════════════════════════════════════════════════════

    // Row 11: Missing OrderID only
    {
      seller_id: "1064", shop_title: "Palace Therapy - Club Street",
      OrderID: "", partner_type_name: "Web", paymentMethod: "stripe_payments",
      productType: "Booking", customerId: "110653", status: "complete", orderStatus: "Completed",
      email: "r.sonoda1107@gmail.com", customerName: "Riho Sonoda", contactNo: "80536703",
      qty: "1", serviceName: "Foot Reflexology (45 min)",
      bookedDate: "25/7/2026 18:00", service_duration: "45", staffId: "", staffName: "",
      Total_Revenue: "48", credit_Card: "48", shippingAmount: "", reward_point: "",
      vanidayCommission: "20", vanidayShare: "9.6", cashbackFee: "", cashbackDiscount: "0",
      cashbackDate: "", salonshare: "38.4", subscription: "",
    },
    // Row 12: Invalid email format only
    {
      seller_id: "242", shop_title: "Geranium Skin & Hair Boutique",
      OrderID: "600012", partner_type_name: "Web", paymentMethod: "stripe_payments",
      productType: "Booking", customerId: "110274", status: "complete", orderStatus: "Completed",
      email: "not-a-valid-email", customerName: "Nazrina Muhamat Bakri", contactNo: "87422870",
      qty: "1", serviceName: "Scalp Treatment & Analysis",
      bookedDate: "25/7/2026 10:30", service_duration: "60", staffId: "", staffName: "",
      Total_Revenue: "120", credit_Card: "120", shippingAmount: "", reward_point: "",
      vanidayCommission: "20", vanidayShare: "24", cashbackFee: "", cashbackDiscount: "0",
      cashbackDate: "", salonshare: "96", subscription: "",
    },
    // Row 13: Missing service name only
    {
      seller_id: "100923", shop_title: "Beethoven Hairxperts",
      OrderID: "600013", partner_type_name: "App", paymentMethod: "stripe_payments",
      productType: "Booking", customerId: "4938", status: "complete", orderStatus: "Completed",
      email: "fauziyaya@yahoo.com", customerName: "Fauziah Osman", contactNo: "97351856",
      qty: "1", serviceName: "",
      bookedDate: "26/7/2026 14:00", service_duration: "60", staffId: "", staffName: "",
      Total_Revenue: "80", credit_Card: "80", shippingAmount: "", reward_point: "",
      vanidayCommission: "20", vanidayShare: "16", cashbackFee: "", cashbackDiscount: "0",
      cashbackDate: "", salonshare: "64", subscription: "",
    },
    // Row 14: Cancelled order status (non-completed)
    {
      seller_id: "1064", shop_title: "Palace Therapy - Club Street",
      OrderID: "600014", partner_type_name: "Web", paymentMethod: "stripe_payments",
      productType: "Booking", customerId: "110653", status: "cancelled", orderStatus: "Cancelled",
      email: "r.sonoda1107@gmail.com", customerName: "Riho Sonoda", contactNo: "80536703",
      qty: "1", serviceName: "Hot Stone Therapy (60 min)",
      bookedDate: "26/7/2026 11:00", service_duration: "60", staffId: "", staffName: "",
      Total_Revenue: "95", credit_Card: "0", shippingAmount: "", reward_point: "",
      vanidayCommission: "20", vanidayShare: "19", cashbackFee: "", cashbackDiscount: "0",
      cashbackDate: "", salonshare: "76", subscription: "",
    },
    // Row 15: Missing Total_Revenue
    {
      seller_id: "555", shop_title: "Luxe Hair Studio",
      OrderID: "600015", partner_type_name: "Web", paymentMethod: "stripe_payments",
      productType: "Booking", customerId: "20001", status: "complete", orderStatus: "Completed",
      email: "bookings@luxehairstudio.sg", customerName: "Luxe Hair Studio", contactNo: "61234567",
      qty: "1", serviceName: "Oxygen Facial Deluxe",
      bookedDate: "27/7/2026 15:00", service_duration: "90", staffId: "", staffName: "",
      Total_Revenue: "", credit_Card: "", shippingAmount: "", reward_point: "",
      vanidayCommission: "", vanidayShare: "", cashbackFee: "", cashbackDiscount: "",
      cashbackDate: "", salonshare: "", subscription: "",
    },
    // Row 16: Missing shop_title only
    {
      seller_id: "1064", shop_title: "",
      OrderID: "600016", partner_type_name: "Web", paymentMethod: "stripe_payments",
      productType: "Booking", customerId: "110653", status: "complete", orderStatus: "Completed",
      email: "r.sonoda1107@gmail.com", customerName: "Riho Sonoda", contactNo: "80536703",
      qty: "1", serviceName: "Aromatherapy Massage (75 min)",
      bookedDate: "27/7/2026 13:00", service_duration: "75", staffId: "", staffName: "",
      Total_Revenue: "110", credit_Card: "110", shippingAmount: "", reward_point: "",
      vanidayCommission: "20", vanidayShare: "22", cashbackFee: "", cashbackDiscount: "0",
      cashbackDate: "", salonshare: "88", subscription: "",
    },
    // ══════════════════════════════════════════════════════════════════════════
    // ROWS 17-18: CUSTOMER SCENARIOS
    // ══════════════════════════════════════════════════════════════════════════

    // Row 17: New customer (email not in system yet - will be auto-created)
    {
      seller_id: "1064", shop_title: "Palace Therapy - Club Street",
      OrderID: "600017", partner_type_name: "Web", paymentMethod: "stripe_payments",
      productType: "Booking", customerId: "NEW001", status: "complete", orderStatus: "Completed",
      email: "newcustomer.july2026@gmail.com", customerName: "Jessica Lim Wei Ting", contactNo: "91234567",
      qty: "1", serviceName: "Full Body Massage (90 min)",
      bookedDate: "28/7/2026 13:00", service_duration: "90", staffId: "8", staffName: "Amy Wong",
      Total_Revenue: "130", credit_Card: "130", shippingAmount: "", reward_point: "",
      vanidayCommission: "20", vanidayShare: "26", cashbackFee: "", cashbackDiscount: "0",
      cashbackDate: "", salonshare: "104", subscription: "",
    },
    // Row 18: Existing customer with subscription link
    {
      seller_id: "242", shop_title: "Geranium Skin & Hair Boutique",
      OrderID: "600018", partner_type_name: "App", paymentMethod: "stripe_payments",
      productType: "Booking", customerId: "110274", status: "complete", orderStatus: "Completed",
      email: "naz_mistique@hotmail.com", customerName: "Nazrina Muhamat Bakri", contactNo: "87422870",
      qty: "1", serviceName: "Anti-Aging Collagen Mask Treatment",
      bookedDate: "28/7/2026 16:30", service_duration: "60", staffId: "3", staffName: "Lisa Ng",
      Total_Revenue: "145", credit_Card: "145", shippingAmount: "", reward_point: "",
      vanidayCommission: "25", vanidayShare: "36.25", cashbackFee: "", cashbackDiscount: "0",
      cashbackDate: "", salonshare: "108.75", subscription: "Standard Monthly",
    },

    // ══════════════════════════════════════════════════════════════════════════
    // ROWS 19-20: DUPLICATE & SUBSCRIPTION
    // ══════════════════════════════════════════════════════════════════════════

    // Row 19: Duplicate OrderID (same as Row 1) - auto-skipped
    {
      seller_id: "1064", shop_title: "Palace Therapy - Club Street",
      OrderID: "600001", partner_type_name: "Web", paymentMethod: "stripe_payments",
      productType: "Booking", customerId: "110653", status: "complete", orderStatus: "Completed",
      email: "r.sonoda1107@gmail.com", customerName: "Riho Sonoda", contactNo: "80536703",
      qty: "1", serviceName: "Oriental Body Massage (60 min)",
      bookedDate: "15/7/2026 19:15", service_duration: "60", staffId: "", staffName: "",
      Total_Revenue: "65", credit_Card: "65", shippingAmount: "", reward_point: "",
      vanidayCommission: "20", vanidayShare: "13", cashbackFee: "", cashbackDiscount: "0",
      cashbackDate: "", salonshare: "52", subscription: "Premium Monthly",
    },
    // Row 20: Valid with cashback/discount
    {
      seller_id: "555", shop_title: "Luxe Hair Studio",
      OrderID: "600020", partner_type_name: "Web", paymentMethod: "stripe_payments",
      productType: "Booking", customerId: "20001", status: "complete", orderStatus: "Completed",
      email: "bookings@luxehairstudio.sg", customerName: "Luxe Hair Studio", contactNo: "61234567",
      qty: "1", serviceName: "Oxygen Facial + LED Light Therapy Combo",
      bookedDate: "28/7/2026 14:00", service_duration: "90", staffId: "5", staffName: "Sarah Tan",
      Total_Revenue: "320", credit_Card: "320", shippingAmount: "", reward_point: "50",
      vanidayCommission: "15", vanidayShare: "48", cashbackFee: "10", cashbackDiscount: "30",
      cashbackDate: "28/7/2026", salonshare: "272", subscription: "",
    },
  ];

  rows.forEach((row) => mainSheet.addRow(row));

  // Color-code rows
  const colors = {
    paid: "FFE8F5E9",       // green
    pending: "FFF1F8E9",    // light green
    fraud: "FFFFF3E0",      // orange
    validation: "FFFFEBEE", // red
    customer: "FFE3F2FD",   // blue
    duplicate: "FFF3E5F5",  // purple
  };

  for (let i = 2; i <= 5; i++) mainSheet.getRow(i).fill = { type: "pattern", pattern: "solid", fgColor: { argb: colors.paid } };
  for (let i = 6; i <= 7; i++) mainSheet.getRow(i).fill = { type: "pattern", pattern: "solid", fgColor: { argb: colors.pending } };
  for (let i = 8; i <= 11; i++) mainSheet.getRow(i).fill = { type: "pattern", pattern: "solid", fgColor: { argb: colors.fraud } };
  for (let i = 12; i <= 17; i++) mainSheet.getRow(i).fill = { type: "pattern", pattern: "solid", fgColor: { argb: colors.validation } };
  for (let i = 18; i <= 19; i++) mainSheet.getRow(i).fill = { type: "pattern", pattern: "solid", fgColor: { argb: colors.customer } };
  for (let i = 20; i <= 21; i++) mainSheet.getRow(i).fill = { type: "pattern", pattern: "solid", fgColor: { argb: colors.duplicate } };

  // ═══════════════════════════════════════════════════════════════════════════
  // SHEET 2: Expected Results
  // ═══════════════════════════════════════════════════════════════════════════
  const guideSheet = workbook.addWorksheet("Expected Results");

  guideSheet.columns = [
    { header: "Row", key: "row", width: 6 },
    { header: "OrderID", key: "orderId", width: 10 },
    { header: "Category", key: "category", width: 14 },
    { header: "Validation", key: "validation", width: 12 },
    { header: "Fraud Risk", key: "fraud", width: 14 },
    { header: "Payment", key: "payment", width: 14 },
    { header: "Notes", key: "notes", width: 65 },
  ];

  const guideHeaderRow = guideSheet.getRow(1);
  guideHeaderRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  guideHeaderRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1565C0" } };

  const guide = [
    { row: 1, orderId: "600001", category: "Payment", validation: "PASS", fraud: "Low", payment: "Paid", notes: "Stripe auto-paid. Subscription linked." },
    { row: 2, orderId: "600002", category: "Payment", validation: "PASS", fraud: "Low", payment: "Paid", notes: "Stripe auto-paid. Standard Monthly sub." },
    { row: 3, orderId: "600003", category: "Payment", validation: "PASS", fraud: "Low", payment: "Paid", notes: "Stripe auto-paid. No subscription." },
    { row: 4, orderId: "600004", category: "Payment", validation: "PASS", fraud: "Low", payment: "Paid", notes: "TEST: Arut (arut1657@gmail.com / +6598951296). Email+WhatsApp test." },
    { row: 5, orderId: "600005", category: "Payment", validation: "PASS", fraud: "Low", payment: "Unpaid", notes: "Cash = not auto-paid. Invoice created as Draft." },
    { row: 6, orderId: "600006", category: "Payment", validation: "PASS", fraud: "Low", payment: "Unpaid", notes: "TEST: Arut UNPAID. For WhatsApp payment reminder testing." },
    { row: 7, orderId: "600007", category: "Fraud", validation: "PASS", fraud: "High", payment: "Paid", notes: "$25,000 triggers CUSTOMER_AMOUNT_OUTLIER." },
    { row: 8, orderId: "600008", category: "Fraud", validation: "PASS", fraud: "Medium", payment: "Paid", notes: "Shop 'Unknown Suspicious Vendor' triggers UNKNOWN_VENDOR." },
    { row: 9, orderId: "600009", category: "Fraud", validation: "PASS", fraud: "High", payment: "Paid", notes: "Description 'urgent refund crypto gift card' = SUSPICIOUS_DESCRIPTION." },
    { row: 10, orderId: "600010", category: "Fraud", validation: "PASS", fraud: "Medium", payment: "Paid", notes: "Email @tempmail.com = SUSPICIOUS_EMAIL_DOMAIN." },
    { row: 11, orderId: "(empty)", category: "Validation", validation: "FAIL", fraud: "N/A", payment: "N/A", notes: "OrderID is required." },
    { row: 12, orderId: "600012", category: "Validation", validation: "FAIL", fraud: "N/A", payment: "N/A", notes: "Invalid email format." },
    { row: 13, orderId: "600013", category: "Validation", validation: "FAIL", fraud: "N/A", payment: "N/A", notes: "Service name is required." },
    { row: 14, orderId: "600014", category: "Validation", validation: "FAIL", fraud: "N/A", payment: "N/A", notes: "Order cancelled — only completed orders allowed." },
    { row: 15, orderId: "600015", category: "Validation", validation: "FAIL", fraud: "N/A", payment: "N/A", notes: "Total revenue is required." },
    { row: 16, orderId: "600016", category: "Validation", validation: "FAIL", fraud: "N/A", payment: "N/A", notes: "Shop/service provider is required." },
    { row: 17, orderId: "600017", category: "Customer", validation: "PASS", fraud: "Low", payment: "Paid", notes: "New customer auto-created from email." },
    { row: 18, orderId: "600018", category: "Customer", validation: "PASS", fraud: "Low", payment: "Paid", notes: "Existing customer matched. Subscription linked." },
    { row: 19, orderId: "600001", category: "Duplicate", validation: "PASS*", fraud: "N/A", payment: "N/A", notes: "Exact duplicate of Row 1 — auto-skipped." },
    { row: 20, orderId: "600020", category: "Subscription", validation: "PASS", fraud: "Low", payment: "Paid", notes: "Valid with cashback/discount applied." },
  ];

  guide.forEach((row) => guideSheet.addRow(row));

  // ═══════════════════════════════════════════════════════════════════════════
  // Save
  // ═══════════════════════════════════════════════════════════════════════════
  const outputPath = path.join(outputDir, "bulk_upload_test_all_scenarios_invoice.xlsx");
  await workbook.xlsx.writeFile(outputPath);

  console.log("\n╔══════════════════════════════════════════════════════════════════╗");
  console.log("║  Bulk Upload Test Data (Vaniday Format) Generated!               ║");
  console.log("╚══════════════════════════════════════════════════════════════════╝\n");
  console.log(`  Output: ${outputPath}`);
  console.log(`  Sheets: 2`);
  console.log(`    1. Vaniday Bookings   – 20 rows (actual upload data)`);
  console.log(`    2. Expected Results   – What each row tests\n`);
  console.log("  Row Breakdown:");
  console.log("    Rows  1-4  (green)   – Payment Completed (Stripe auto-paid)");
  console.log("    Rows  5-6  (lt green) – Payment Pending (cash - not auto-paid)");
  console.log("    Rows  7-10 (orange)  – Fraud Detection triggers");
  console.log("    Rows 11-16 (red)     – Validation errors (1-2 per row)");
  console.log("    Rows 17-18 (blue)    – Customer scenarios");
  console.log("    Rows 19-20 (purple)  – Duplicate & subscription\n");
  console.log("  TEST CUSTOMER (for email & WhatsApp):");
  console.log("    Row 4  – Arut (arut1657@gmail.com / +6598951296) — PAID");
  console.log("    Row 6  – Arut (arut1657@gmail.com / +6598951296) — UNPAID\n");
  console.log("  File name contains 'invoice' to pass filename validation.\n");
}

generate().catch((err) => {
  console.error("Error generating test data:", err);
  process.exit(1);
});
