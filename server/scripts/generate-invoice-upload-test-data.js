/**
 * Generate Invoice Upload Test Data (.xlsx) — 30 Invoices
 *
 * Creates a multi-sheet Excel workbook using the Vaniday import format
 * for demonstrating the Finance Invoice Upload & Validation feature.
 *
 * - 27 invoices pass validation and are imported successfully
 * - 3 invoices fail validation:
 *   1. Duplicate OrderID (INV already exists)
 *   2. Missing required field (serviceName)
 *   3. Missing required field (Total_Revenue)
 *
 * Worksheets:
 *   1. Vaniday Bookings (main data — 30 rows)
 *   2. Customers (reference)
 *   3. Customer Subscriptions (reference)
 *   4. Expected Results (validation guide)
 *
 * Usage: node scripts/generate-invoice-upload-test-data.js
 */

const ExcelJS = require("exceljs");
const path = require("path");
const fs = require("fs");

// ─── Reference Data ───────────────────────────────────────────────────────────

const SHOPS = [
  { seller_id: "1064", shop_title: "Palace Therapy - Club Street" },
  { seller_id: "242", shop_title: "Geranium Skin & Hair Boutique" },
  { seller_id: "100923", shop_title: "Beethoven Hairxperts" },
  { seller_id: "555", shop_title: "Luxe Hair Studio" },
  { seller_id: "801", shop_title: "Serenity Spa & Wellness" },
  { seller_id: "902", shop_title: "Glow Aesthetics Clinic" },
  { seller_id: "445", shop_title: "Brow & Lash Bar" },
  { seller_id: "667", shop_title: "KBeauty Haven" },
  { seller_id: "778", shop_title: "Zen Reflexology Centre" },
  { seller_id: "334", shop_title: "Prestige Barbers" },
];

const CUSTOMERS = [
  { customerId: "110653", customerName: "Riho Sonoda", email: "r.sonoda1107@gmail.com", contactNo: "80536703" },
  { customerId: "110274", customerName: "Nazrina Muhamat Bakri", email: "naz_mistique@hotmail.com", contactNo: "87422870" },
  { customerId: "4938", customerName: "Fauziah Osman", email: "fauziyaya@yahoo.com", contactNo: "97351856" },
  { customerId: "TEST01", customerName: "Arut", email: "arut1657@gmail.com", contactNo: "+6598951296" },
  { customerId: "20001", customerName: "Sarah Tan", email: "sarah.tan.beauty@gmail.com", contactNo: "91234567" },
  { customerId: "20002", customerName: "Michelle Lim", email: "michelle.lim@outlook.com", contactNo: "92345678" },
  { customerId: "20003", customerName: "David Wong", email: "david.wong88@gmail.com", contactNo: "93456789" },
  { customerId: "20004", customerName: "Amanda Lee", email: "amanda.lee.sg@yahoo.com", contactNo: "94567890" },
  { customerId: "20005", customerName: "Jessica Ng", email: "jess.ng.wellness@gmail.com", contactNo: "95678901" },
  { customerId: "20006", customerName: "Kim Soo-yeon", email: "sooyeon.kim@hotmail.com", contactNo: "96789012" },
  { customerId: "20007", customerName: "Thomas Loh", email: "thomas.loh.sg@gmail.com", contactNo: "97890123" },
  { customerId: "20008", customerName: "Marcus Teo", email: "marcus.teo@live.com", contactNo: "98901234" },
  { customerId: "20009", customerName: "Rachel Ong", email: "rachel.ong.beauty@gmail.com", contactNo: "89012345" },
  { customerId: "20010", customerName: "Priya Sharma", email: "priya.sharma.sg@gmail.com", contactNo: "81234567" },
  { customerId: "20011", customerName: "Emma Koh", email: "emma.koh@outlook.sg", contactNo: "82345678" },
  { customerId: "20012", customerName: "James Chen", email: "dr.james.chen@clinic.sg", contactNo: "83456789" },
  { customerId: "20013", customerName: "Linda Phua", email: "linda.phua@gmail.com", contactNo: "84567890" },
  { customerId: "20014", customerName: "Vanessa Chua", email: "vanessa.chua@yahoo.sg", contactNo: "85678901" },
];

const SERVICES = [
  { name: "Oriental Body Massage (60 min)", duration: "60", revenue: "65" },
  { name: "GS + Best Gua Sha Facial Treatment", duration: "90", revenue: "98" },
  { name: "Fashion Colour + Highlight + Argan Treatment", duration: "180", revenue: "160" },
  { name: "Keratin Smoothing Treatment", duration: "120", revenue: "350" },
  { name: "Thai Full Body Massage (90 min)", duration: "90", revenue: "85" },
  { name: "Digital Perm Full Head", duration: "180", revenue: "280" },
  { name: "Hydrafacial Treatment Deluxe", duration: "75", revenue: "220" },
  { name: "Eyebrow Embroidery Premium", duration: "90", revenue: "188" },
  { name: "Lash Lift & Tint Package", duration: "60", revenue: "95" },
  { name: "Full Body Scrub & Wrap", duration: "120", revenue: "175" },
  { name: "Anti-Aging Collagen Mask Treatment", duration: "60", revenue: "145" },
  { name: "LED Light Therapy Session", duration: "45", revenue: "120" },
  { name: "Scalp Treatment & Analysis", duration: "60", revenue: "130" },
  { name: "Brazilian Waxing Full", duration: "45", revenue: "68" },
  { name: "Oxygen Facial + LED Combo", duration: "90", revenue: "320" },
  { name: "Men's Grooming Premium Package", duration: "75", revenue: "150" },
  { name: "Hot Stone Therapy (90 min)", duration: "90", revenue: "110" },
  { name: "Aromatherapy Massage (75 min)", duration: "75", revenue: "95" },
  { name: "Chemical Peel Treatment", duration: "45", revenue: "250" },
  { name: "Hair Extensions Installation Full Set", duration: "150", revenue: "450" },
  { name: "Gel Manicure + Pedicure Combo", duration: "90", revenue: "88" },
  { name: "Foot Reflexology (45 min)", duration: "45", revenue: "48" },
  { name: "Balayage Hair Coloring", duration: "120", revenue: "380" },
  { name: "Microdermabrasion Facial", duration: "60", revenue: "195" },
  { name: "VIP Platinum Spa Package", duration: "240", revenue: "580" },
  { name: "Nail Art Design Full Set", duration: "90", revenue: "75" },
  { name: "Deep Tissue Massage (60 min)", duration: "60", revenue: "90" },
  { name: "Hair Rebonding Treatment", duration: "180", revenue: "320" },
  { name: "Underarm + Full Leg Waxing", duration: "60", revenue: "98" },
  { name: "Premium Facial Extraction", duration: "75", revenue: "135" },
];

const SUBSCRIPTIONS = [
  { customer: "Riho Sonoda", plan: "Premium Monthly", billing: "Monthly" },
  { customer: "Nazrina Muhamat Bakri", plan: "Standard Monthly", billing: "Monthly" },
  { customer: "Arut", plan: "Premium Monthly", billing: "Monthly" },
  { customer: "Sarah Tan", plan: "Business Monthly", billing: "Monthly" },
  { customer: "David Wong", plan: "Professional Yearly", billing: "Yearly" },
  { customer: "Amanda Lee", plan: "Starter Monthly", billing: "Monthly" },
  { customer: "Kim Soo-yeon", plan: "Professional Monthly", billing: "Monthly" },
  { customer: "Marcus Teo", plan: "Starter Yearly", billing: "Yearly" },
  { customer: "Rachel Ong", plan: "Business Yearly", billing: "Yearly" },
  { customer: "James Chen", plan: "Business Monthly", billing: "Monthly" },
];

// ─── Build 30 booking rows ────────────────────────────────────────────────────

function generateRows() {
  const rows = [];
  let orderSeq = 700001;

  // Helper to create a valid row
  function makeRow(custIdx, shopIdx, svcIdx, dateStr, payMethod, paid, sub) {
    const cust = CUSTOMERS[custIdx];
    const shop = SHOPS[shopIdx];
    const svc = SERVICES[svcIdx];
    const revenue = svc.revenue;
    const creditCard = paid ? revenue : "0";

    return {
      seller_id: shop.seller_id,
      shop_title: shop.shop_title,
      OrderID: String(orderSeq++),
      partner_type_name: paid ? "Web" : "Walk-in",
      paymentMethod: paid ? "stripe_payments" : "cash",
      productType: "Booking",
      customerId: cust.customerId,
      status: "complete",
      orderStatus: "Completed",
      email: cust.email,
      customerName: cust.customerName,
      contactNo: cust.contactNo,
      qty: "1",
      serviceName: svc.name,
      bookedDate: dateStr,
      service_duration: svc.duration,
      staffId: "",
      staffName: "",
      Total_Revenue: revenue,
      credit_Card: creditCard,
      shippingAmount: "",
      reward_point: "",
      vanidayCommission: "20",
      vanidayShare: String((parseFloat(revenue) * 0.2).toFixed(2)),
      cashbackFee: "",
      cashbackDiscount: "0",
      cashbackDate: "",
      salonshare: String((parseFloat(revenue) * 0.8).toFixed(2)),
      subscription: sub || "",
    };
  }

  // ── ROWS 1-27: Valid invoices ───────────────────────────────────────────────

  // Row 1-5: Paid online (Stripe) with subscriptions
  rows.push(makeRow(0, 0, 0, "1/7/2026 19:15", "stripe", true, "Premium Monthly"));
  rows.push(makeRow(1, 1, 1, "2/7/2026 12:00", "stripe", true, "Standard Monthly"));
  rows.push(makeRow(2, 2, 2, "3/7/2026 10:00", "stripe", true, ""));
  rows.push(makeRow(3, 3, 3, "4/7/2026 14:00", "stripe", true, "Premium Monthly"));
  rows.push(makeRow(4, 4, 4, "5/7/2026 11:30", "stripe", true, "Business Monthly"));

  // Row 6-10: Paid online (Stripe) no subscription
  rows.push(makeRow(5, 5, 5, "6/7/2026 15:00", "stripe", true, ""));
  rows.push(makeRow(6, 6, 6, "7/7/2026 10:30", "stripe", true, ""));
  rows.push(makeRow(7, 7, 7, "8/7/2026 16:00", "stripe", true, ""));
  rows.push(makeRow(8, 8, 8, "9/7/2026 14:30", "stripe", true, "Professional Monthly"));
  rows.push(makeRow(9, 9, 9, "10/7/2026 11:00", "stripe", true, ""));

  // Row 11-15: Paid online various services
  rows.push(makeRow(10, 0, 10, "11/7/2026 13:00", "stripe", true, ""));
  rows.push(makeRow(11, 1, 11, "12/7/2026 09:30", "stripe", true, ""));
  rows.push(makeRow(12, 2, 12, "13/7/2026 15:00", "stripe", true, ""));
  rows.push(makeRow(13, 3, 13, "14/7/2026 10:00", "stripe", true, ""));
  rows.push(makeRow(14, 4, 14, "15/7/2026 14:00", "stripe", true, "Business Monthly"));

  // Row 16-20: Unpaid (cash/walk-in)
  rows.push(makeRow(15, 5, 15, "16/7/2026 11:00", "cash", false, ""));
  rows.push(makeRow(16, 6, 16, "17/7/2026 13:30", "cash", false, ""));
  rows.push(makeRow(17, 7, 17, "18/7/2026 15:00", "cash", false, ""));
  rows.push(makeRow(0, 8, 18, "19/7/2026 10:00", "cash", false, "Premium Monthly"));
  rows.push(makeRow(1, 9, 19, "20/7/2026 16:30", "cash", false, "Standard Monthly"));

  // Row 21-25: Mixed payment, some with subscriptions
  rows.push(makeRow(2, 0, 20, "21/7/2026 12:00", "stripe", true, ""));
  rows.push(makeRow(3, 1, 21, "22/7/2026 14:30", "stripe", true, "Premium Monthly"));
  rows.push(makeRow(4, 2, 22, "23/7/2026 11:00", "stripe", true, ""));
  rows.push(makeRow(5, 3, 23, "24/7/2026 09:00", "cash", false, ""));
  rows.push(makeRow(6, 4, 24, "25/7/2026 15:30", "stripe", true, ""));

  // Row 26-27: Additional valid rows
  rows.push(makeRow(7, 5, 25, "26/7/2026 13:00", "stripe", true, "Starter Yearly"));
  rows.push(makeRow(8, 6, 26, "27/7/2026 10:00", "stripe", true, ""));

  // ── ROWS 28-30: VALIDATION FAILURES ─────────────────────────────────────────

  // Row 28: DUPLICATE OrderID (same as Row 1 — OrderID 700001)
  const dupRow = { ...rows[0] };
  dupRow.OrderID = "700001"; // Same OrderID as row 1
  dupRow.bookedDate = "28/7/2026 10:00";
  rows.push(dupRow);

  // Row 29: MISSING SERVICE NAME
  const noServiceRow = makeRow(9, 8, 27, "28/7/2026 14:00", "stripe", true, "");
  noServiceRow.serviceName = ""; // Empty — will trigger "Service name is required"
  noServiceRow.OrderID = String(orderSeq++);
  rows.push(noServiceRow);

  // Row 30: MISSING TOTAL REVENUE
  const noRevenueRow = makeRow(10, 9, 28, "28/7/2026 16:00", "stripe", true, "");
  noRevenueRow.Total_Revenue = ""; // Empty — will trigger "Total revenue is required"
  noRevenueRow.credit_Card = "";
  noRevenueRow.vanidayShare = "";
  noRevenueRow.salonshare = "";
  noRevenueRow.OrderID = String(orderSeq++);
  rows.push(noRevenueRow);

  return rows;
}

// ─── Build Excel Workbook ─────────────────────────────────────────────────────

async function buildWorkbook() {
  console.log("\n════════════════════════════════════════════════════════");
  console.log("  PayNivo — Invoice Upload Test Data (30 Invoices)");
  console.log("════════════════════════════════════════════════════════\n");

  const outputDir = path.join(__dirname, "../uploads/templates");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "PayNivo Test Data Generator";
  workbook.created = new Date();

  const rows = generateRows();

  // ── Sheet 1: Vaniday Bookings (Main Upload Data) ────────────────────────────
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

  // Add data rows
  rows.forEach(row => mainSheet.addRow(row));

  // Color-code: valid rows green, invalid rows red
  for (let i = 2; i <= 28; i++) {
    mainSheet.getRow(i).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8F5E9" } };
  }
  for (let i = 29; i <= 31; i++) {
    mainSheet.getRow(i).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFEBEE" } };
  }

  console.log(`  ✓ Vaniday Bookings sheet: ${rows.length} records (27 valid, 3 invalid)`);

  // ── Sheet 2: Customers (Reference) ──────────────────────────────────────────
  const custSheet = workbook.addWorksheet("Customers");
  custSheet.columns = [
    { header: "customer_id", key: "customerId", width: 12 },
    { header: "customer_name", key: "customerName", width: 26 },
    { header: "email", key: "email", width: 32 },
    { header: "contact_no", key: "contactNo", width: 16 },
    { header: "customer_type", key: "type", width: 14 },
    { header: "status", key: "status", width: 10 },
  ];
  CUSTOMERS.forEach((c, idx) => {
    custSheet.addRow({
      ...c,
      type: idx < 4 ? "Existing" : "New",
      status: "Active",
    });
  });
  const custHeaderRow = custSheet.getRow(1);
  custHeaderRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  custHeaderRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1565C0" } };
  console.log(`  ✓ Customers sheet: ${CUSTOMERS.length} records`);

  // ── Sheet 3: Customer Subscriptions (Reference) ─────────────────────────────
  const subSheet = workbook.addWorksheet("Customer Subscriptions");
  subSheet.columns = [
    { header: "subscription_id", key: "id", width: 16 },
    { header: "customer_name", key: "customer", width: 26 },
    { header: "plan_name", key: "plan", width: 22 },
    { header: "billing_cycle", key: "billing", width: 14 },
    { header: "start_date", key: "start", width: 14 },
    { header: "next_billing_date", key: "next", width: 18 },
    { header: "auto_renew", key: "renew", width: 12 },
    { header: "status", key: "status", width: 12 },
  ];
  SUBSCRIPTIONS.forEach((s, idx) => {
    subSheet.addRow({
      id: `SUB-${String(idx + 1).padStart(3, "0")}`,
      customer: s.customer,
      plan: s.plan,
      billing: s.billing,
      start: "2026-01-15",
      next: "2026-08-15",
      renew: "Yes",
      status: "Active",
    });
  });
  const subHeaderRow = subSheet.getRow(1);
  subHeaderRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  subHeaderRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF6A1B9A" } };
  console.log(`  ✓ Customer Subscriptions sheet: ${SUBSCRIPTIONS.length} records`);

  // ── Sheet 4: Expected Results ───────────────────────────────────────────────
  const guideSheet = workbook.addWorksheet("Expected Results");
  guideSheet.columns = [
    { header: "Row", key: "row", width: 6 },
    { header: "OrderID", key: "orderId", width: 10 },
    { header: "Validation", key: "validation", width: 12 },
    { header: "Payment", key: "payment", width: 12 },
    { header: "Notes", key: "notes", width: 65 },
  ];

  const guideHeaderRow = guideSheet.getRow(1);
  guideHeaderRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  guideHeaderRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1565C0" } };

  // Valid rows summary
  for (let i = 1; i <= 27; i++) {
    const r = rows[i - 1];
    const isPaid = r.credit_Card && parseFloat(r.credit_Card) > 0;
    guideSheet.addRow({
      row: i,
      orderId: r.OrderID,
      validation: "PASS",
      payment: isPaid ? "Paid" : "Unpaid",
      notes: r.subscription ? `Subscription: ${r.subscription}` : "No subscription",
    });
  }

  // Invalid rows
  guideSheet.addRow({ row: 28, orderId: "700001", validation: "FAIL", payment: "N/A", notes: "Duplicate OrderID — same as Row 1. Auto-skipped." });
  guideSheet.addRow({ row: 29, orderId: rows[28].OrderID, validation: "FAIL", payment: "N/A", notes: "Service name is required." });
  guideSheet.addRow({ row: 30, orderId: rows[29].OrderID, validation: "FAIL", payment: "N/A", notes: "Total revenue is required." });

  // Color the fail rows
  for (let i = 29; i <= 31; i++) {
    guideSheet.getRow(i).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFEBEE" } };
  }

  console.log(`  ✓ Expected Results sheet: 30 records`);

  // ── Save workbook ───────────────────────────────────────────────────────────
  const outputPath = path.join(outputDir, "demo_invoice_upload_validation.xlsx");
  await workbook.xlsx.writeFile(outputPath);

  console.log(`\n  ✓ File saved: ${outputPath}`);
  printSummary();
}

// ─── Print summary ───────────────────────────────────────────────────────────

function printSummary() {
  console.log("\n════════════════════════════════════════════════════════");
  console.log("  EXPECTED UPLOAD VALIDATION SUMMARY");
  console.log("════════════════════════════════════════════════════════\n");
  console.log("  Total Records:            30");
  console.log("  Successfully Imported:    27");
  console.log("  Failed Validation:         3");
  console.log("");
  console.log("  ─── Validation Errors ───");
  console.log("");
  console.log("  1. Row 28 — OrderID 700001");
  console.log("     Error: Duplicate OrderID (same as Row 1)");
  console.log("");
  console.log("  2. Row 29 — Missing serviceName");
  console.log("     Error: Service name is required");
  console.log("");
  console.log("  3. Row 30 — Missing Total_Revenue");
  console.log("     Error: Total revenue is required");
  console.log("");
  console.log("════════════════════════════════════════════════════════\n");
}

// ─── Run ──────────────────────────────────────────────────────────────────────

buildWorkbook()
  .then(() => {
    console.log("  Done. Excel file ready for FYP demonstration.\n");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Error generating Excel file:", err);
    process.exit(1);
  });
