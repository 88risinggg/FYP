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

    // Create notification table
    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS invoice_notification (
          notification_id INT AUTO_INCREMENT PRIMARY KEY,
          type VARCHAR(50) NOT NULL,
          title VARCHAR(255) NOT NULL,
          message TEXT NOT NULL,
          invoice_id INT NULL,
          user_id INT NOT NULL,
          is_read TINYINT(1) DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_user_id (user_id),
          INDEX idx_is_read (is_read),
          INDEX idx_created_at (created_at)
        )
      `);
      console.log("[MIGRATE] invoice_notification table ready.");
    } catch (e) {
      console.log("[MIGRATE] notification table:", e.message);
    }

    // Create view log table
    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS invoice_view_log (
          view_id INT AUTO_INCREMENT PRIMARY KEY,
          invoice_id INT NOT NULL,
          viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          ip_address VARCHAR(45) NULL,
          user_agent VARCHAR(512) NULL,
          INDEX idx_invoice_id (invoice_id)
        )
      `);
      console.log("[MIGRATE] invoice_view_log table ready.");
    } catch (e) {
      console.log("[MIGRATE] view_log table:", e.message);
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
      { query: "DELETE FROM invoice_item", label: "invoice items" },
      { query: "DELETE FROM invoice_notification", label: "notifications" },
      { query: "DELETE FROM audit_log WHERE entity_type IN ('invoice', 'payment')", label: "audit logs" }
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

    // View logs
    try {
      const [result] = await connection.query("DELETE FROM invoice_view_log");
      console.log(`[RESET] Deleted ${result.affectedRows} view logs.`);
    } catch { /* table may not exist */ }

    // Delete all invoices
    const [invoiceResult] = await connection.query("DELETE FROM invoice");
    console.log(`[RESET] Deleted ${invoiceResult.affectedRows} invoices.`);

    // Reset auto-increment
    await connection.query("ALTER TABLE invoice AUTO_INCREMENT = 1");
    await connection.query("ALTER TABLE invoice_item AUTO_INCREMENT = 1");
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
    { name: "Acme Corporation", company: "Acme Corp Pte Ltd", email: "billing@acmecorp.sg" },
    { name: "TechWave Solutions", company: "TechWave Solutions Pte Ltd", email: "accounts@techwave.sg" },
    { name: "Marina Bay Trading", company: "Marina Bay Trading Co", email: "finance@marinabay.sg" },
    { name: "Sunrise Digital", company: "Sunrise Digital Pte Ltd", email: "payment@sunrisedigital.sg" },
    { name: "Pacific Ventures", company: "Pacific Ventures Holdings", email: "ap@pacificventures.sg" },
    { name: "GreenLeaf Consulting", company: "GreenLeaf Consulting Group", email: "invoices@greenleaf.sg" },
    { name: "CloudNine Systems", company: "CloudNine Systems Pte Ltd", email: "billing@cloudnine.sg" },
    { name: "Diamond Electronics", company: "Diamond Electronics Trading", email: "accounts@diamondel.sg" },
    { name: "Golden Gate Logistics", company: "Golden Gate Logistics Pte Ltd", email: "finance@gglogistics.sg" },
    { name: "Stellar Marketing", company: "Stellar Marketing Agency", email: "payments@stellarmarketing.sg" },
    { name: "BluePeak Software", company: "BluePeak Software Pte Ltd", email: "ar@bluepeaksw.sg" },
    { name: "Orchid Healthcare", company: "Orchid Healthcare Services", email: "billing@orchidhc.sg" },
    { name: "Zenith Engineering", company: "Zenith Engineering Works", email: "accounts@zenitheng.sg" },
    { name: "Coral Bay Restaurants", company: "Coral Bay F&B Group", email: "finance@coralbay.sg" },
    { name: "Atlas Security", company: "Atlas Security Solutions", email: "invoices@atlassec.sg" }
  ];

  const serviceDescriptions = [
    "Web Development Services", "Mobile App Development", "Cloud Infrastructure Setup",
    "UI/UX Design Consultation", "Database Migration Services", "API Integration Development",
    "Security Audit & Penetration Testing", "IT Support & Maintenance (Monthly)",
    "Software License Renewal", "Data Analytics Dashboard Setup", "Email Marketing Campaign",
    "SEO Optimization Package", "Content Management System Setup", "Server Administration Services",
    "Network Configuration & Setup", "Custom Report Development", "Training & Onboarding Session",
    "Technical Documentation", "Performance Optimization", "Disaster Recovery Planning",
    "Social Media Management", "Graphic Design Package", "Video Production Services",
    "Hosting Services (Annual)", "Domain Registration & DNS Setup"
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

      // Insert line items
      const itemValues = inv.items.map((item) => [
        item.description, item.quantity, item.unitPrice, item.total, pk
      ]);
      await connection.query(
        "INSERT INTO invoice_item (description, quantity, unit_price, amount, invoice_invoice_id) VALUES ?",
        [itemValues]
      );

      // Write audit log for status
      await connection.query(
        "INSERT INTO audit_log (action, entity_type, entity_id, user_user_id) VALUES (?, 'invoice', ?, NULL)",
        [`invoice_status:${inv.status}`, pk]
      );

      // For Paid invoices, also create a payment record
      if (inv.status === "Paid" && stripe) {
        // Ensure Stripe payment method exists
        const [existingMethod] = await connection.query(
          "SELECT payment_method_id FROM payment_method WHERE name = 'Stripe' LIMIT 1"
        );
        let paymentMethodId;
        if (existingMethod.length > 0) {
          paymentMethodId = existingMethod[0].payment_method_id;
        } else {
          const [methodResult] = await connection.query(
            "INSERT INTO payment_method (name, description, is_active) VALUES ('Stripe', 'Stripe online payments', 1)"
          );
          paymentMethodId = methodResult.insertId;
        }

        await connection.query(
          `INSERT INTO payment (payment_date, amount, status, transaction_id, invoice_invoice_id, payment_method_id)
           VALUES (?, ?, 'Completed', ?, ?, ?)`,
          [stripe.paymentDate, String(inv.total), stripe.transactionId, pk, paymentMethodId]
        );

        await connection.query(
          "INSERT INTO audit_log (action, entity_type, entity_id, user_user_id) VALUES ('stripe_payment_completed', 'payment', ?, NULL)",
          [pk]
        );
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

    // Clear existing fraud data
    await connection.query("DELETE FROM invoice_fraud_indicator");
    await connection.query("DELETE FROM invoice_fraud_assessment");
    try { await connection.query("DELETE FROM fraud_alert"); } catch {}
    try { await connection.query("DELETE FROM invoice_fraud_metadata"); } catch {}

    await connection.beginTransaction();

    // High risk: indices 3, 9, 15, 27
    // Medium risk: indices 5, 11, 17, 20, 23, 29
    const highRisk = new Set([3, 9, 15, 27]);
    const mediumRisk = new Set([5, 11, 17, 20, 23, 29]);
    const vendors = ["TechSupply Co", "DigitalWorks Agency", "CloudHosting Pte Ltd", "Unknown Vendor XYZ"];

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

      const [res] = await connection.query(
        `INSERT INTO invoice_fraud_assessment (invoice_id, risk_score, risk_level, review_status, model_version, assessed_at)
         VALUES (?, ?, ?, ?, 'rules-v1', NOW())`,
        [inv.invoice_id, score, level, status]
      );
      const assessId = res.insertId;

      if (indicators.length > 0) {
        const vals = indicators.map((ind) => [assessId, ind.code, ind.label, ind.severity, JSON.stringify({})]);
        await connection.query(
          "INSERT INTO invoice_fraud_indicator (assessment_id, indicator_code, indicator_label, severity, details_json) VALUES ?",
          [vals]
        );
      }

      if (level === "High") {
        try {
          await connection.query(
            `INSERT INTO fraud_alert (assessment_id, invoice_id, alert_type, message, status, created_at)
             VALUES (?, ?, 'High Risk Invoice', ?, ?, NOW())`,
            [assessId, inv.invoice_id, `High-risk invoice ${inv.invoiceId} (score: ${score}) requires review.`, status === "Open" ? "Open" : "Resolved"]
          );
        } catch {}
      }

      // Metadata for medium/high risk invoices
      if (level !== "Low") {
        try {
          await connection.query(
            `INSERT INTO invoice_fraud_metadata (invoice_id, vendor_name, bank_account_hash, source)
             VALUES (?, ?, ?, 'sample_seed') ON DUPLICATE KEY UPDATE vendor_name = VALUES(vendor_name)`,
            [inv.invoice_id, level === "High" ? "Unknown Vendor XYZ" : randomElement(vendors), level === "High" ? "mismatch_hash_abc123" : null]
          );
        } catch {}
      }
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
