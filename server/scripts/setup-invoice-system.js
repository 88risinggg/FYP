/**
 * Full Invoice System Setup Script
 *
 * Combines:
 * 1. Database schema migration (add Stripe payment columns)
 * 2. Invoice database reset (delete all existing records)
 * 3. Generate sample_invoices.xlsx with 30 invoices
 * 4. Import the 30 invoices into the database
 * 5. Verify count
 *
 * Usage: node scripts/setup-invoice-system.js
 */

require("dotenv").config();
const { pool } = require("../src/config/db");
const path = require("path");

// Shared helpers
function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randomFloat(min, max) { return Number((Math.random() * (max - min) + min).toFixed(2)); }
function randomElement(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

async function runMigration() {
  console.log("[MIGRATE] Running schema migration...");
  const connection = await pool.getConnection();

  try {
    // Add payment columns (IF NOT EXISTS equivalent for MySQL)
    const columns = [
      { name: "payment_url", def: "TEXT NULL" },
      { name: "qr_code_url", def: "TEXT NULL" },
      { name: "stripe_session_id", def: "VARCHAR(255) NULL" },
      { name: "payment_intent_id", def: "VARCHAR(255) NULL" },
      { name: "payment_status", def: "VARCHAR(50) NULL DEFAULT NULL" },
      { name: "payment_method", def: "VARCHAR(100) NULL DEFAULT NULL" },
      { name: "payment_date", def: "DATETIME NULL" },
      { name: "transaction_id", def: "VARCHAR(255) NULL DEFAULT NULL" }
    ];

    for (const col of columns) {
      try {
        await connection.query(`ALTER TABLE invoice ADD COLUMN ${col.name} ${col.def}`);
        console.log(`[MIGRATE] Added column: ${col.name}`);
      } catch (e) {
        if (e.code === "ER_DUP_FIELDNAME") {
          console.log(`[MIGRATE] Column already exists: ${col.name}`);
        } else {
          console.log(`[MIGRATE] Column ${col.name}: ${e.message}`);
        }
      }
    }

    // Update status ENUM
    try {
      await connection.query(`
        ALTER TABLE invoice MODIFY COLUMN status
        ENUM('Draft', 'Scheduled', 'Sent', 'Viewed', 'Paid', 'Overdue', 'Cancelled', 'Refunded', 'Failed_Payment')
        DEFAULT 'Draft'
      `);
      console.log("[MIGRATE] Updated status ENUM.");
    } catch (e) {
      console.log("[MIGRATE] Status ENUM:", e.message);
    }

    // Update payment_method.name ENUM to include Stripe
    try {
      await connection.query(`
        ALTER TABLE payment_method MODIFY COLUMN name
        ENUM('Cash', 'Credit Card', 'Bank Transfer', 'PayNow', 'Stripe', 'GrabPay', 'Apple Pay', 'Google Pay')
      `);
      console.log("[MIGRATE] Updated payment_method name ENUM.");
    } catch (e) {
      console.log("[MIGRATE] payment_method ENUM:", e.message);
    }

    console.log("[MIGRATE] ✓ Schema migration complete.\n");
  } finally {
    connection.release();
  }
}

async function resetDatabase() {
  console.log("[RESET] Resetting invoice database...");
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Delete in dependency order
    const tables = [
      { query: "DELETE FROM payment", label: "payments" },
      { query: "DELETE FROM audit_logs WHERE entity_type IN ('invoice', 'payment')", label: "audit logs" }
    ];

    for (const t of tables) {
      try {
        const [result] = await connection.query(t.query);
        console.log(`[RESET] Deleted ${result.affectedRows} ${t.label}.`);
      } catch (e) {
        console.log(`[RESET] ${t.label}: ${e.message}`);
      }
    }

    // Fraud assessment
    try {
      const [result] = await connection.query("DELETE FROM invoice_fraud_assessment");
      console.log(`[RESET] Deleted ${result.affectedRows} fraud assessments.`);
    } catch { /* table may not exist */ }

    // Delete all invoices
    const [invoiceResult] = await connection.query("DELETE FROM invoice");
    console.log(`[RESET] Deleted ${invoiceResult.affectedRows} invoices.`);

    // Delete all customers (will be re-created)
    try {
      const [custResult] = await connection.query("DELETE FROM customer");
      console.log(`[RESET] Deleted ${custResult.affectedRows} customers.`);
    } catch (e) { console.log(`[RESET] customers: ${e.message}`); }

    // Reset auto-increment
    await connection.query("ALTER TABLE invoice AUTO_INCREMENT = 1");
    try { await connection.query("ALTER TABLE invoice_item AUTO_INCREMENT = 1"); } catch { /* table may not exist */ }
    await connection.query("ALTER TABLE payment AUTO_INCREMENT = 1");
    console.log("[RESET] Auto-increment sequences reset.");

    await connection.commit();
    console.log("[RESET] ✓ Database reset complete.\n");
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function generateAndImport() {
  // Import the generation script logic inline
  const ExcelJS = require("exceljs");

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
    { name: "Aura Hair & Beauty", company: "Aura Hair & Beauty Pte Ltd", email: "bookings@aurahairbeauty.sg" },
    { name: "Bliss Nail Studio", company: "Bliss Nail Studio Pte Ltd", email: "hello@blissnails.sg" },
    { name: "Rejuve Wellness Clinic", company: "Rejuve Wellness Clinic Pte Ltd", email: "appointments@rejuveclinic.sg" }
  ];

  const serviceDescriptions = [
    "Balayage Hair Coloring", "Keratin Smoothing Treatment", "Hair Extensions Installation",
    "Gel Manicure Session", "Classic Pedicure & Foot Spa", "Nail Art Design Package",
    "Full Body Massage (90 min)", "Hot Stone Therapy", "Aromatherapy Massage",
    "Hydrafacial Treatment", "Chemical Peel Session", "Microdermabrasion",
    "Eyebrow Embroidery", "Lash Lift & Tint", "Eyelash Extensions (Full Set)",
    "Brazilian Waxing", "Full Leg Waxing", "Underarm Waxing",
    "Facial Extraction & Treatment", "Anti-Aging Collagen Mask", "LED Light Therapy",
    "Scalp Treatment & Analysis", "Hair Rebonding", "Digital Perm",
    "Men's Grooming Package"
  ];

  const paymentMethods = ["Credit Card", "Apple Pay", "Google Pay", "GrabPay", "PayNow", "Stripe"];

  const notes = [
    "Payment due within 30 days.", "Please reference invoice number in payment.",
    "Net 30 payment terms.", "Late payment incurs 2% monthly interest.",
    "Thank you for choosing our services.", "For queries, contact finance@paynivo.com.",
    "Auto-generated invoice.", "Includes all applicable taxes.",
    "Volume discount applied.", "Recurring monthly service charge."
  ];

  function daysAgo(days) {
    return new Date(Date.now() - days * 86400000).toISOString().split("T")[0];
  }

  function addDays(dateStr, days) {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return d.toISOString().split("T")[0];
  }

  function toDatetime(dateStr) {
    return new Date(dateStr + "T10:00:00").toISOString().replace("T", " ").substring(0, 19);
  }

  // ============================================================
  // Status distribution: 6 each of Draft, Sent, Viewed, Paid, Overdue
  // ============================================================
  const statusAssignments = [
    ...Array(6).fill("Draft"),
    ...Array(6).fill("Sent"),
    ...Array(6).fill("Viewed"),
    ...Array(6).fill("Paid"),
    ...Array(6).fill("Overdue")
  ];

  // Generate 30 invoices with logically consistent dates per status
  console.log("[GENERATE] Generating 30 sample invoices (6 per status)...");
  const invoices = [];

  for (let i = 0; i < 30; i++) {
    const status = statusAssignments[i];
    const customer = customers[i % customers.length];
    const invoiceNumber = `INV-${String(i + 1).padStart(6, "0")}`;

    // Generate logically consistent dates based on status
    let issueDate, dueDate, paymentDate, stripeData;

    switch (status) {
      case "Draft":
        // Recently created, due date in the future, no Stripe session
        issueDate = daysAgo(randomInt(1, 7));
        dueDate = addDays(issueDate, randomInt(14, 30));
        stripeData = null; // Not sent, no Stripe session
        break;

      case "Sent":
        // Sent recently, due date in the future, has Stripe session but not opened
        issueDate = daysAgo(randomInt(5, 15));
        dueDate = addDays(issueDate, randomInt(20, 45));
        stripeData = {
          sessionId: `cs_test_sent_${Date.now()}_${i}`,
          paymentUrl: `https://checkout.stripe.com/c/pay/cs_test_sent_${i}`,
          paymentStatus: null, // Not yet interacted
          paymentMethod: null,
          paymentDate: null,
          transactionId: null
        };
        break;

      case "Viewed":
        // Sent a while ago, customer opened it but hasn't paid, due date still in future
        issueDate = daysAgo(randomInt(10, 25));
        dueDate = addDays(issueDate, randomInt(30, 45));
        stripeData = {
          sessionId: `cs_test_viewed_${Date.now()}_${i}`,
          paymentUrl: `https://checkout.stripe.com/c/pay/cs_test_viewed_${i}`,
          paymentStatus: "pending",
          paymentMethod: null,
          paymentDate: null,
          transactionId: null
        };
        break;

      case "Paid":
        // Issued in the past, paid before due date
        issueDate = daysAgo(randomInt(20, 60));
        dueDate = addDays(issueDate, randomInt(14, 30));
        paymentDate = addDays(issueDate, randomInt(3, 14)); // Paid within 3-14 days of issue
        const method = randomElement(paymentMethods);
        const txnId = `pi_${Date.now()}_${randomInt(1000, 9999)}_${i}`;
        stripeData = {
          sessionId: `cs_test_paid_${Date.now()}_${i}`,
          paymentUrl: `https://checkout.stripe.com/c/pay/cs_test_paid_${i}`,
          paymentStatus: "paid",
          paymentMethod: method,
          paymentDate: paymentDate,
          transactionId: txnId
        };
        break;

      case "Overdue":
        // Due date is in the past, not paid. Has a Stripe link (may be expired).
        issueDate = daysAgo(randomInt(45, 90));
        dueDate = addDays(issueDate, randomInt(14, 30)); // Due date already passed
        stripeData = {
          sessionId: `cs_test_overdue_${Date.now()}_${i}`,
          paymentUrl: `https://checkout.stripe.com/c/pay/cs_test_overdue_${i}`,
          paymentStatus: "expired",
          paymentMethod: null,
          paymentDate: null,
          transactionId: null
        };
        break;
    }

    // Generate line items (1-5 per invoice)
    const itemCount = randomInt(1, 5);
    const items = [];
    const usedDescs = new Set();
    for (let j = 0; j < itemCount; j++) {
      let desc;
      do { desc = randomElement(serviceDescriptions); } while (usedDescs.has(desc));
      usedDescs.add(desc);
      const qty = randomInt(1, 10);
      const price = randomFloat(50, 5000);
      items.push({ description: desc, quantity: qty, unitPrice: price, total: Number((qty * price).toFixed(2)) });
    }

    const subtotal = items.reduce((s, item) => s + item.total, 0);
    const taxRate = randomElement([0, 0.07, 0.08, 0.09]);
    const tax = Number((subtotal * taxRate).toFixed(2));
    const discountRate = Math.random() < 0.3 ? randomFloat(0.02, 0.1) : 0;
    const discount = Number((subtotal * discountRate).toFixed(2));
    const total = Number((subtotal + tax - discount).toFixed(2));

    invoices.push({
      invoiceNumber,
      customerName: customer.name, companyName: customer.company, customerEmail: customer.email,
      invoiceDate: issueDate, dueDate, currency: "SGD", status, subtotal, tax, discount, total,
      notes: randomElement(notes), items, stripeData
    });
  }

  // Log status distribution
  const statusCounts = {};
  invoices.forEach((inv) => { statusCounts[inv.status] = (statusCounts[inv.status] || 0) + 1; });
  console.log("[GENERATE] Status distribution:", JSON.stringify(statusCounts));

  // Create Excel file
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "PayNivo";

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
  invoiceSheet.getRow(1).font = { bold: true };
  invoices.forEach((inv) => invoiceSheet.addRow(inv));

  const itemsSheet = workbook.addWorksheet("Line Items");
  itemsSheet.columns = [
    { header: "Invoice Number", key: "invoiceNumber", width: 18 },
    { header: "Description", key: "description", width: 40 },
    { header: "Quantity", key: "quantity", width: 10 },
    { header: "Unit Price", key: "unitPrice", width: 14 },
    { header: "Total", key: "total", width: 14 }
  ];
  itemsSheet.getRow(1).font = { bold: true };
  invoices.forEach((inv) => {
    inv.items.forEach((item) => {
      itemsSheet.addRow({ invoiceNumber: inv.invoiceNumber, ...item });
    });
  });

  const filePath = path.join(__dirname, "..", "sample_invoices.xlsx");
  await workbook.xlsx.writeFile(filePath);
  console.log(`[GENERATE] ✓ Excel file: ${filePath}`);

  // Import into database
  console.log("[IMPORT] Importing into database...");
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Ensure customers exist
    const customerMap = new Map();
    for (const inv of invoices) {
      if (!customerMap.has(inv.customerName)) {
        const [existing] = await connection.query(
          "SELECT customer_id FROM customer WHERE name = ? LIMIT 1",
          [inv.customerName]
        );
        if (existing.length > 0) {
          customerMap.set(inv.customerName, existing[0].customer_id);
        } else {
          const [result] = await connection.query(
            "INSERT INTO customer (name, email, address, created_at) VALUES (?, ?, ?, NOW())",
            [inv.customerName, inv.customerEmail, `${inv.companyName}, Singapore`]
          );
          customerMap.set(inv.customerName, result.insertId);
        }
      }
    }
    console.log(`[IMPORT] Resolved ${customerMap.size} customers.`);

    for (const inv of invoices) {
      const customerId = customerMap.get(inv.customerName);
      const stripe = inv.stripeData;

      // Insert invoice with Stripe payment columns
      const [result] = await connection.query(
        `INSERT INTO invoice (
          status, issue_date, due_date, invoiceId, total_amount, customer_id, created_at,
          stripe_session_id, payment_url, payment_status, payment_method, payment_date, transaction_id
        ) VALUES (?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?)`,
        [
          inv.status,
          inv.invoiceDate,
          inv.dueDate,
          inv.invoiceNumber,
          inv.total,
          customerId,
          stripe?.sessionId || null,
          stripe?.paymentUrl || null,
          stripe?.paymentStatus || null,
          stripe?.paymentMethod || null,
          stripe?.paymentDate || null,
          stripe?.transactionId || null
        ]
      );
      const pk = result.insertId;

      // Store line items as JSON in invoice table
      const itemsJson = inv.items.map((item) => ({
        description: item.description, quantity: item.quantity, unit_price: item.unitPrice, amount: item.total
      }));
      await connection.query(
        "UPDATE invoice SET items_json = ? WHERE invoice_id = ?",
        [JSON.stringify(itemsJson), pk]
      );

      // Write audit log for status
      try {
        await connection.query(
          "INSERT INTO audit_logs (action, entity_type, entity_id, user_user_id) VALUES (?, 'invoice', ?, NULL)",
          [`invoice_status:${inv.status}`, pk]
        );
      } catch { /* audit_logs table may not exist */ }

      // For Paid invoices, also create a payment record
      if (inv.status === "Paid" && stripe) {
        try {
          await connection.query(
            `INSERT INTO payment (payment_date, amount, status, transaction_id, invoice_invoice_id, payment_method_name)
             VALUES (?, ?, 'Completed', ?, ?, ?)`,
            [stripe.paymentDate, String(inv.total), stripe.transactionId, pk, stripe.paymentMethod || "Stripe"]
          );
        } catch (payErr) {
          console.log(`[IMPORT] Payment insert warning: ${payErr.message}`);
        }

        try {
          await connection.query(
            "INSERT INTO audit_logs (action, entity_type, entity_id, user_user_id) VALUES ('stripe_payment_completed', 'payment', ?, NULL)",
            [pk]
          );
        } catch { /* audit_logs may have different schema */ }
      }
    }

    await connection.commit();
    console.log(`[IMPORT] ✓ Imported ${invoices.length} invoices.`);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  // Verify
  const [countResult] = await pool.query("SELECT COUNT(*) AS total FROM invoice");
  const count = countResult[0].total;
  console.log(`\n[VERIFY] ✓ Database contains exactly ${count} invoices.`);
  if (count !== 30) {
    console.error(`[VERIFY] ✗ Expected 30, got ${count}`);
    process.exit(1);
  }

  // Verify status distribution
  const [statusResult] = await pool.query("SELECT status, COUNT(*) AS cnt FROM invoice GROUP BY status ORDER BY status");
  console.log("[VERIFY] Status distribution in DB:");
  statusResult.forEach((row) => console.log(`  ${row.status}: ${row.cnt}`));
}

async function seedFraudData() {
  console.log("[FRAUD] Seeding fraud assessment data...");
  const connection = await pool.getConnection();

  const INDICATORS = [
    { code: "DUPLICATE_INVOICE_NUMBER", label: "Duplicate invoice number detected.", severity: 35 },
    { code: "DUPLICATE_CUSTOMER_AMOUNT_DATE", label: "Same customer, amount, and invoice date already exists.", severity: 25 },
    { code: "CUSTOMER_AMOUNT_OUTLIER", label: "Amount is unusually high for this customer.", severity: 25 },
    { code: "OUTSIDE_BUSINESS_HOURS", label: "Invoice was submitted outside normal business hours.", severity: 10 },
    { code: "MISSING_OR_SUSPICIOUS_FIELDS", label: "Invoice contains missing or suspicious core fields.", severity: 20 },
    { code: "UNKNOWN_VENDOR", label: "Invoice references an unknown or unregistered vendor.", severity: 25 },
    { code: "VENDOR_AMOUNT_OUTLIER", label: "Amount is unusually high for this vendor.", severity: 25 },
    { code: "VENDOR_SUBMISSION_SPIKE", label: "Vendor has a sudden spike in invoice submissions.", severity: 20 },
    { code: "BANK_ACCOUNT_MISMATCH", label: "Bank account differs from the vendor's verified record.", severity: 35 },
    { code: "RAPID_APPROVAL_PATTERN", label: "Employee approval pattern is unusually rapid.", severity: 20 }
  ];

  function pickIndicators(count) {
    const shuffled = [...INDICATORS].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  try {
    const [invoices] = await connection.query(
      "SELECT invoice_id, invoiceId FROM invoice ORDER BY invoice_id"
    );

    await connection.beginTransaction();

    // High risk: indices 3, 9, 15, 27
    // Medium risk: indices 5, 11, 17, 20, 23, 29
    const highRisk = new Set([3, 9, 15, 27]);
    const mediumRisk = new Set([5, 11, 17, 20, 23, 29]);
    const vendors = ["BeautyPro Supplies Co", "Salon Equipment SG", "AestheticWorld Pte Ltd", "Unknown Vendor XYZ"];

    let low = 0, med = 0, high = 0;

    for (let i = 0; i < invoices.length; i++) {
      const inv = invoices[i];
      let score, level, status, indicators;

      if (highRisk.has(i)) {
        indicators = pickIndicators(randomInt(2, 4));
        score = Math.min(100, indicators.reduce((s, ind) => s + ind.severity, 0));
        if (score < 71) score = 71 + randomInt(0, 20);
        level = "High";
        status = i === 3 ? "Approved" : i === 15 ? "Rejected" : "Open";
        high++;
      } else if (mediumRisk.has(i)) {
        indicators = pickIndicators(randomInt(1, 2));
        score = Math.min(70, indicators.reduce((s, ind) => s + ind.severity, 0));
        if (score < 31) score = 31 + randomInt(0, 20);
        level = "Medium";
        status = i === 5 ? "Approved" : "Open";
        med++;
      } else {
        indicators = Math.random() < 0.3 ? pickIndicators(1) : [];
        score = indicators.reduce((s, ind) => s + ind.severity, 0);
        if (score > 30) score = randomInt(5, 25);
        level = "Low";
        status = "Open";
        low++;
      }

      // Store fraud data directly on the invoice table (inline JSON columns)
      const vendorName = level === "High" ? "Unknown Vendor XYZ" : (level === "Medium" ? randomElement(vendors) : null);
      const indicatorsJson = indicators.length > 0 ? JSON.stringify(indicators.map(ind => ({
        indicator_code: ind.code,
        indicator_label: ind.label,
        severity: ind.severity
      }))) : null;

      await connection.query(
        `UPDATE invoice SET risk_score = ?, risk_level = ?, review_status = ?, fraud_indicators_json = ?, vendor_name = ?, assessed_at = NOW()
         WHERE invoice_id = ?`,
        [score, level, status, indicatorsJson, vendorName, inv.invoice_id]
      );
    }

    await connection.commit();
    console.log(`[FRAUD] ✓ Low: ${low}, Medium: ${med}, High: ${high}`);
  } catch (error) {
    await connection.rollback();
    console.error("[FRAUD] Seed error:", error.message);
  } finally {
    connection.release();
  }
}

async function main() {
  try {
    console.log("╔══════════════════════════════════════════╗");
    console.log("║  PayNivo Invoice System Setup            ║");
    console.log("║  Reset + Migrate + Generate + Import     ║");
    console.log("╚══════════════════════════════════════════╝\n");

    await runMigration();
    await resetDatabase();
    await generateAndImport();
    await seedFraudData();

    console.log("\n╔══════════════════════════════════════════╗");
    console.log("║  ✓ Setup Complete!                       ║");
    console.log("║  • Schema migrated                       ║");
    console.log("║  • Old data cleared                      ║");
    console.log("║  • 30 invoices generated & imported      ║");
    console.log("║  • Fraud assessments seeded              ║");
    console.log("║  • sample_invoices.xlsx created          ║");
    console.log("╚══════════════════════════════════════════╝");
  } catch (error) {
    console.error("\n[ERROR]", error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
