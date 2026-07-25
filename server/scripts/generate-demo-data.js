/**
 * Demo Data Reset & Generation Script
 *
 * Deletes all invoice-related data and generates realistic demo data for:
 * - 30 invoices (distributed across statuses)
 * - Subscriptions with recurring invoices
 * - Fraud detection records (Low/Medium/High risk)
 * - Payment records (Completed/Pending/Failed)
 * - Audit log entries
 *
 * Does NOT delete: customers, users, subscription definitions, payroll records.
 *
 * Usage: node scripts/generate-demo-data.js
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { pool } = require("../src/config/db");

// ─── Utility helpers ──────────────────────────────────────────────────────────

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randomFloat(min, max) {
  return Number((Math.random() * (max - min) + min).toFixed(2));
}
function randomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function daysAgo(days) {
  const d = new Date(Date.now() - days * 86400000);
  return d.toISOString().split("T")[0];
}
function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}
function subtractMonths(dateStr, months) {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() - months);
  return d.toISOString().split("T")[0];
}
function formatDatetime(dateStr) {
  return `${dateStr} ${String(randomInt(8, 17)).padStart(2, "0")}:${String(randomInt(0, 59)).padStart(2, "0")}:${String(randomInt(0, 59)).padStart(2, "0")}`;
}

// ─── Reference Data ───────────────────────────────────────────────────────────

const CUSTOMERS = [
  { name: "Luxe Hair Studio", email: "bookings@luxehairstudio.sg", address: "12 Orchard Road #03-01, Singapore 238828" },
  { name: "The Nail Artistry", email: "hello@thenailartistry.sg", address: "88 Telok Ayer Street, Singapore 048468" },
  { name: "Serenity Spa & Wellness", email: "reservations@serenityspa.sg", address: "1 Fullerton Road #02-08, Singapore 049213" },
  { name: "Glow Aesthetics Clinic", email: "appointments@glowaesthetics.sg", address: "391B Orchard Road #15-01, Singapore 238874" },
  { name: "Brow & Lash Bar", email: "info@browlashbar.sg", address: "68 Boat Quay, Singapore 049858" },
  { name: "KBeauty Haven", email: "hello@kbeautyhaven.sg", address: "252 North Bridge Road #02-15, Singapore 179103" },
  { name: "Zen Reflexology Centre", email: "bookings@zenreflexology.sg", address: "5 Koek Road #03-05, Singapore 228796" },
  { name: "Prestige Barbers", email: "appointments@prestigebarbers.sg", address: "3 Temasek Boulevard #02-301, Singapore 038983" },
  { name: "Skin Lab Express", email: "info@skinlabexpress.sg", address: "313 Orchard Road #B3-12, Singapore 238895" },
  { name: "Orchid Beauty Lounge", email: "bookings@orchidbeauty.sg", address: "176 Orchard Road #04-01, Singapore 238843" },
  { name: "The Waxing Boutique", email: "hello@waxingboutique.sg", address: "290 Orchard Road #09-12, Singapore 238859" },
  { name: "Radiance Medi-Spa", email: "info@radiancespa.sg", address: "1 Harbourfront Walk #02-131, Singapore 098585" },
  { name: "Aura Hair & Beauty", email: "bookings@aurahairbeauty.sg", address: "23 Serangoon Central #04-01, Singapore 556083" },
  { name: "Bliss Nail Studio", email: "hello@blissnails.sg", address: "930 Yishun Avenue 2 #02-56, Singapore 769098" },
  { name: "Rejuve Wellness Clinic", email: "appointments@rejuveclinic.sg", address: "1 Kim Seng Promenade #02-105, Singapore 237994" },
  { name: "Palace Therapy", email: "bookings@palacetherapy.sg", address: "50 Club Street, Singapore 069426" },
];

const SERVICE_DESCRIPTIONS = [
  "Balayage Hair Coloring", "Keratin Smoothing Treatment", "Hair Extensions Installation",
  "Gel Manicure Session", "Classic Pedicure & Foot Spa", "Nail Art Design Package",
  "Full Body Massage (90 min)", "Hot Stone Therapy", "Aromatherapy Massage",
  "Hydrafacial Treatment", "Chemical Peel Session", "Microdermabrasion",
  "Eyebrow Embroidery", "Lash Lift & Tint", "Eyelash Extensions (Full Set)",
  "Brazilian Waxing", "Full Leg Waxing", "Underarm Waxing",
  "Facial Extraction & Treatment", "Anti-Aging Collagen Mask", "LED Light Therapy",
  "Scalp Treatment & Analysis", "Hair Rebonding", "Digital Perm",
  "Men's Grooming Package", "Body Scrub & Wrap", "Oxygen Facial",
];

const SUBSCRIPTION_PLANS = [
  { plan_name: "Payroll Service", description: "Monthly payroll processing and CPF submission", amount: 299.00, billing_frequency: "Monthly" },
  { plan_name: "HR Management", description: "Staff management, leave tracking, and performance reviews", amount: 199.00, billing_frequency: "Monthly" },
  { plan_name: "IT Maintenance", description: "System monitoring, updates, and technical support", amount: 450.00, billing_frequency: "Monthly" },
  { plan_name: "Software Licensing", description: "Annual software license renewal and upgrades", amount: 1200.00, billing_frequency: "Yearly" },
  { plan_name: "Cloud Backup", description: "Daily automated cloud backup and disaster recovery", amount: 89.00, billing_frequency: "Monthly" },
  { plan_name: "Premium Monthly", description: "Premium platform subscription with priority support", amount: 549.00, billing_frequency: "Monthly" },
  { plan_name: "Standard Monthly", description: "Standard platform subscription", amount: 249.00, billing_frequency: "Monthly" },
  { plan_name: "Enterprise Quarterly", description: "Enterprise suite with dedicated account manager", amount: 2400.00, billing_frequency: "Quarterly" },
];

const FRAUD_INDICATORS = [
  { code: "DUPLICATE_INVOICE_NUMBER", label: "Duplicate invoice number detected in recent submissions.", severity: 35 },
  { code: "CUSTOMER_AMOUNT_OUTLIER", label: "Invoice amount significantly exceeds customer's historical average.", severity: 25 },
  { code: "OUTSIDE_BUSINESS_HOURS", label: "Invoice submitted outside normal business hours.", severity: 10 },
  { code: "UNKNOWN_VENDOR", label: "Vendor not found in verified supplier registry.", severity: 25 },
  { code: "BANK_ACCOUNT_MISMATCH", label: "Payment bank account differs from verified record.", severity: 35 },
  { code: "VENDOR_SUBMISSION_SPIKE", label: "Sudden spike in invoice submissions from this vendor.", severity: 20 },
  { code: "ROUND_NUMBER_AMOUNT", label: "Invoice total is a suspiciously round number.", severity: 15 },
  { code: "SHORT_PAYMENT_WINDOW", label: "Multiple invoices generated within unusually short timeframe.", severity: 30 },
  { code: "DESCRIPTION_MISMATCH", label: "Invoice description does not match typical services from this vendor.", severity: 20 },
];

const PAYMENT_METHODS = ["Stripe", "Credit Card", "Bank Transfer", "PayNow"];

// ─── Phase 1: Reset invoice-related data ──────────────────────────────────────

async function resetInvoiceData(connection) {
  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║   PHASE 1: Resetting Invoice Data        ║");
  console.log("╚══════════════════════════════════════════╝\n");

  const deletions = [
    { sql: "DELETE FROM payment", label: "payment records" },
    { sql: "DELETE FROM invoice_fraud_indicator", label: "fraud indicators" },
    { sql: "DELETE FROM invoice_fraud_assessment", label: "fraud assessments" },
    { sql: "DELETE FROM audit_logs WHERE module = 'Invoice'", label: "invoice audit logs" },
    { sql: "DELETE FROM invoice WHERE invoiceId <> '__SETTINGS__'", label: "invoices" },
  ];

  for (const { sql, label } of deletions) {
    try {
      const [result] = await connection.query(sql);
      console.log(`  ✓ Deleted ${result.affectedRows} ${label}`);
    } catch (e) {
      if (e.code === "ER_NO_SUCH_TABLE") {
        console.log(`  - Skipped ${label} (table does not exist)`);
      } else {
        console.log(`  ⚠ ${label}: ${e.message}`);
      }
    }
  }

  // Reset auto-increment (keep __SETTINGS__ row intact)
  try { await connection.query("ALTER TABLE invoice AUTO_INCREMENT = 1"); } catch {}
  try { await connection.query("ALTER TABLE payment AUTO_INCREMENT = 1"); } catch {}
  try { await connection.query("ALTER TABLE invoice_fraud_assessment AUTO_INCREMENT = 1"); } catch {}
  try { await connection.query("ALTER TABLE invoice_fraud_indicator AUTO_INCREMENT = 1"); } catch {}

  console.log("  ✓ Auto-increment values reset\n");
}

// ─── Phase 2: Ensure customers exist ─────────────────────────────────────────

async function ensureCustomers(connection) {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║   PHASE 2: Ensuring Customers Exist      ║");
  console.log("╚══════════════════════════════════════════╝\n");

  const customerMap = new Map();

  for (const c of CUSTOMERS) {
    const [existing] = await connection.query(
      "SELECT customer_id FROM customer WHERE name = ? LIMIT 1", [c.name]
    );
    if (existing.length > 0) {
      customerMap.set(c.name, existing[0].customer_id);
    } else {
      const [result] = await connection.query(
        "INSERT INTO customer (name, email, address, created_at) VALUES (?, ?, ?, NOW())",
        [c.name, c.email, c.address]
      );
      customerMap.set(c.name, result.insertId);
    }
  }

  console.log(`  ✓ ${customerMap.size} customers ready\n`);
  return customerMap;
}

// ─── Phase 3: Create subscriptions ───────────────────────────────────────────

async function createSubscriptions(connection, customerMap, companyId = null) {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║   PHASE 3: Creating Subscriptions        ║");
  console.log("╚══════════════════════════════════════════╝\n");

  // Clear existing subscriptions first
  await connection.query("DELETE FROM subscriptions");
  await connection.query("ALTER TABLE subscriptions AUTO_INCREMENT = 1");

  const subscriptionMap = new Map(); // "customerId:planName" -> subscription_id
  const customerNames = Array.from(customerMap.keys());
  const today = new Date().toISOString().split("T")[0];
  let count = 0;

  // Assign subscriptions to specific customers for realism
  const assignments = [
    { customerIdx: 0, planIdx: 0 }, // Luxe Hair Studio -> Payroll Service
    { customerIdx: 0, planIdx: 5 }, // Luxe Hair Studio -> Premium Monthly
    { customerIdx: 1, planIdx: 1 }, // The Nail Artistry -> HR Management
    { customerIdx: 1, planIdx: 6 }, // The Nail Artistry -> Standard Monthly
    { customerIdx: 2, planIdx: 2 }, // Serenity Spa -> IT Maintenance
    { customerIdx: 2, planIdx: 4 }, // Serenity Spa -> Cloud Backup
    { customerIdx: 3, planIdx: 5 }, // Glow Aesthetics -> Premium Monthly
    { customerIdx: 4, planIdx: 6 }, // Brow & Lash Bar -> Standard Monthly
    { customerIdx: 5, planIdx: 7 }, // KBeauty Haven -> Enterprise Quarterly
    { customerIdx: 6, planIdx: 0 }, // Zen Reflexology -> Payroll Service
    { customerIdx: 7, planIdx: 3 }, // Prestige Barbers -> Software Licensing
    { customerIdx: 8, planIdx: 2 }, // Skin Lab -> IT Maintenance
    { customerIdx: 9, planIdx: 4 }, // Orchid Beauty -> Cloud Backup
    { customerIdx: 10, planIdx: 1 }, // The Waxing Boutique -> HR Management
    { customerIdx: 11, planIdx: 5 }, // Radiance Medi-Spa -> Premium Monthly
  ];

  for (const { customerIdx, planIdx } of assignments) {
    const customerName = customerNames[customerIdx];
    const customerId = customerMap.get(customerName);
    const plan = SUBSCRIPTION_PLANS[planIdx];

    // Start date 3-8 months ago
    const startDate = subtractMonths(today, randomInt(3, 8));
    const nextBilling = addDays(today, randomInt(1, 28));

    const [result] = await connection.query(
      `INSERT INTO subscriptions
        (customer_id, company_id, plan_name, description, amount,
         billing_frequency, start_date, next_billing_date, end_date,
         auto_renew, auto_send, status, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 1, 1, 'Active', NULL, ?)`,
      [customerId, companyId || null, plan.plan_name, plan.description, plan.amount,
       plan.billing_frequency, startDate, nextBilling, formatDatetime(startDate)]
    );

    const key = `${customerId}:${plan.plan_name}`;
    subscriptionMap.set(key, { subscription_id: result.insertId, plan, customerId, customerName });
    count++;
  }

  console.log(`  ✓ ${count} subscriptions created\n`);
  return subscriptionMap;
}

// ─── Phase 4: Generate invoices ──────────────────────────────────────────────

async function generateInvoices(connection, customerMap, subscriptionMap, companyId = null) {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║   PHASE 4: Generating 30 Invoices        ║");
  console.log("╚══════════════════════════════════════════╝\n");

  const customerNames = Array.from(customerMap.keys());
  const invoices = [];
  let invoiceSeq = 1;

  // Status distribution: 8 Paid, 5 Sent, 4 Viewed, 4 Draft, 5 Overdue, 4 Cancelled
  const statusPool = [
    ...Array(8).fill("Paid"),
    ...Array(5).fill("Sent"),
    ...Array(4).fill("Viewed"),
    ...Array(4).fill("Draft"),
    ...Array(5).fill("Overdue"),
    ...Array(4).fill("Cancelled"),
  ];

  // Generate 12 subscription-linked invoices first (from different billing periods)
  const subEntries = Array.from(subscriptionMap.values()).slice(0, 8);
  for (const sub of subEntries) {
    const { subscription_id, plan, customerId, customerName } = sub;
    const periodsBack = plan.billing_frequency === "Yearly" ? 1 : randomInt(1, 2);

    for (let p = 0; p < periodsBack; p++) {
      const status = statusPool.shift() || "Paid";
      const monthsBack = plan.billing_frequency === "Monthly" ? (p + 1) * 1
        : plan.billing_frequency === "Quarterly" ? (p + 1) * 3
        : (p + 1) * 12;

      const issueDate = subtractMonths(new Date().toISOString().split("T")[0], monthsBack);
      const dueDate = addDays(issueDate, 30);
      const invoiceNumber = `INV-2026-${String(invoiceSeq++).padStart(4, "0")}`;

      const items = [{ description: plan.description, quantity: 1, unit_price: plan.amount, amount: plan.amount }];
      const total = plan.amount;

      invoices.push({
        invoiceNumber, status, issueDate, dueDate, total,
        customerId, customerName, items, subscription_id,
        email: CUSTOMERS.find(c => c.name === customerName)?.email || "demo@paynivo.com",
      });
    }
  }

  // Fill remaining invoices (non-subscription, ad-hoc invoices)
  while (invoices.length < 30) {
    const status = statusPool.shift() || randomElement(["Paid", "Sent", "Viewed", "Draft", "Overdue"]);
    const customerName = randomElement(customerNames);
    const customerId = customerMap.get(customerName);
    const invoiceNumber = `INV-2026-${String(invoiceSeq++).padStart(4, "0")}`;

    // Generate dates based on status
    let issueDate, dueDate;
    switch (status) {
      case "Draft":
        issueDate = daysAgo(randomInt(1, 5));
        dueDate = addDays(issueDate, 30);
        break;
      case "Sent":
        issueDate = daysAgo(randomInt(5, 20));
        dueDate = addDays(issueDate, 30);
        break;
      case "Viewed":
        issueDate = daysAgo(randomInt(10, 25));
        dueDate = addDays(issueDate, 30);
        break;
      case "Paid":
        issueDate = daysAgo(randomInt(25, 90));
        dueDate = addDays(issueDate, 30);
        break;
      case "Overdue":
        issueDate = daysAgo(randomInt(40, 100));
        dueDate = addDays(issueDate, 20); // Short due date = already overdue
        break;
      case "Cancelled":
        issueDate = daysAgo(randomInt(10, 60));
        dueDate = addDays(issueDate, 30);
        break;
    }

    // Generate 1-4 line items
    const itemCount = randomInt(1, 4);
    const items = [];
    const usedDescs = new Set();
    for (let j = 0; j < itemCount; j++) {
      let desc;
      do { desc = randomElement(SERVICE_DESCRIPTIONS); } while (usedDescs.has(desc));
      usedDescs.add(desc);
      const qty = randomInt(1, 5);
      const unitPrice = randomFloat(80, 2500);
      items.push({ description: desc, quantity: qty, unit_price: unitPrice, amount: Number((qty * unitPrice).toFixed(2)) });
    }
    const total = Number(items.reduce((s, it) => s + it.amount, 0).toFixed(2));

    invoices.push({
      invoiceNumber, status, issueDate, dueDate, total,
      customerId, customerName, items, subscription_id: null,
      email: CUSTOMERS.find(c => c.name === customerName)?.email || "demo@paynivo.com",
    });
  }

  // Insert all invoices into the database
  const invoiceRecords = []; // track inserted records for later phases

  for (const inv of invoices) {
    const [result] = await connection.query(
      `INSERT INTO invoice
        (invoiceId, status, issue_date, due_date, total_amount, customer_id,
         company_id, subscription_id, items_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        inv.invoiceNumber, inv.status, inv.issueDate, inv.dueDate, inv.total,
        inv.customerId, companyId || null, inv.subscription_id || null,
        JSON.stringify(inv.items),
        formatDatetime(inv.issueDate),
      ]
    );

    invoiceRecords.push({
      invoice_id: result.insertId,
      ...inv,
    });
  }

  // Log distribution
  const dist = {};
  invoiceRecords.forEach(r => { dist[r.status] = (dist[r.status] || 0) + 1; });
  console.log(`  ✓ ${invoiceRecords.length} invoices created`);
  console.log(`    Status distribution: ${JSON.stringify(dist)}\n`);

  return invoiceRecords;
}

// ─── Phase 5: Generate fraud detection records ───────────────────────────────

async function generateFraudRecords(connection, invoiceRecords) {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║   PHASE 5: Fraud Detection Records       ║");
  console.log("╚══════════════════════════════════════════╝\n");

  // Assign risk levels: 4 High, 6 Medium, rest Low
  const highRiskIndices = new Set([2, 8, 14, 22]);
  const medRiskIndices = new Set([4, 10, 16, 20, 25, 28]);

  let lowCount = 0, medCount = 0, highCount = 0;

  for (let i = 0; i < invoiceRecords.length; i++) {
    const inv = invoiceRecords[i];
    let riskScore, riskLevel, reviewStatus, picks;

    if (highRiskIndices.has(i)) {
      riskScore = randomInt(72, 95);
      riskLevel = "High";
      reviewStatus = i === 2 ? "Approved" : i === 14 ? "Rejected" : "Open";
      picks = [...FRAUD_INDICATORS].sort(() => Math.random() - 0.5).slice(0, randomInt(2, 4));
      highCount++;
    } else if (medRiskIndices.has(i)) {
      riskScore = randomInt(36, 65);
      riskLevel = "Medium";
      reviewStatus = i === 4 ? "Approved" : "Open";
      picks = [...FRAUD_INDICATORS].sort(() => Math.random() - 0.5).slice(0, randomInt(1, 2));
      medCount++;
    } else {
      riskScore = randomInt(0, 28);
      riskLevel = "Low";
      reviewStatus = "Open";
      picks = riskScore > 12 ? [...FRAUD_INDICATORS].sort(() => Math.random() - 0.5).slice(0, 1) : [];
      lowCount++;
    }

    const assessedAt = formatDatetime(inv.issueDate);

    // Update inline fraud columns on invoice table
    await connection.query(
      `UPDATE invoice SET risk_score = ?, risk_level = ?, review_status = ?,
       fraud_indicators_json = ?, assessed_at = ?
       WHERE invoice_id = ?`,
      [riskScore, riskLevel, reviewStatus, JSON.stringify(picks.map(p => ({
        indicator_code: p.code, indicator_label: p.label, severity: p.severity
      }))), assessedAt, inv.invoice_id]
    );

    // Also insert into separate fraud tables if they exist
    try {
      const [aRes] = await connection.query(
        `INSERT INTO invoice_fraud_assessment
          (invoice_id, risk_score, risk_level, review_status, model_version, assessed_at)
         VALUES (?, ?, ?, ?, 'rules-v2', ?)`,
        [inv.invoice_id, riskScore, riskLevel, reviewStatus, assessedAt]
      );

      if (picks.length > 0) {
        const vals = picks.map(ind => [aRes.insertId, ind.code, ind.label, ind.severity, "{}"]);
        await connection.query(
          "INSERT INTO invoice_fraud_indicator (assessment_id, indicator_code, indicator_label, severity, details_json) VALUES ?",
          [vals]
        );
      }
    } catch (e) {
      // Separate fraud tables may not exist — inline columns are sufficient
      if (e.code !== "ER_NO_SUCH_TABLE") throw e;
    }
  }

  console.log(`  ✓ Fraud assessments generated`);
  console.log(`    Low: ${lowCount} | Medium: ${medCount} | High: ${highCount}\n`);
}

// ─── Phase 6: Generate payment records ───────────────────────────────────────

async function generatePayments(connection, invoiceRecords) {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║   PHASE 6: Payment Records               ║");
  console.log("╚══════════════════════════════════════════╝\n");

  let completedCount = 0, pendingCount = 0, failedCount = 0;

  for (const inv of invoiceRecords) {
    if (inv.status === "Paid") {
      // Successful payment
      const payDate = addDays(inv.issueDate, randomInt(3, 14));
      const txnId = `pi_${Date.now()}_${randomInt(10000, 99999)}`;
      const method = randomElement(PAYMENT_METHODS);

      await connection.query(
        `INSERT INTO payment (payment_date, amount, status, transaction_id, invoice_invoice_id, payment_method_name)
         VALUES (?, ?, 'Completed', ?, ?, ?)`,
        [payDate, String(inv.total), txnId, inv.invoice_id, method]
      );

      // Update invoice payment columns
      await connection.query(
        `UPDATE invoice SET payment_status = 'paid', payment_method = ?, payment_date = ?,
         transaction_id = ? WHERE invoice_id = ?`,
        [method, payDate, txnId, inv.invoice_id]
      );
      completedCount++;
    } else if (inv.status === "Overdue") {
      // Failed payment attempt for some overdue invoices
      if (Math.random() < 0.5) {
        const attemptDate = addDays(inv.dueDate, randomInt(1, 5));
        const txnId = `pi_failed_${Date.now()}_${randomInt(10000, 99999)}`;
        await connection.query(
          `INSERT INTO payment (payment_date, amount, status, transaction_id, invoice_invoice_id, payment_method_name)
           VALUES (?, ?, 'Failed', ?, ?, ?)`,
          [attemptDate, String(inv.total), txnId, inv.invoice_id, randomElement(PAYMENT_METHODS)]
        );
        failedCount++;
      }
    } else if (inv.status === "Viewed") {
      // Pending payment for some viewed invoices
      if (Math.random() < 0.4) {
        const txnId = `pi_pending_${Date.now()}_${randomInt(10000, 99999)}`;
        await connection.query(
          `INSERT INTO payment (payment_date, amount, status, transaction_id, invoice_invoice_id, payment_method_name)
           VALUES (?, ?, 'Pending', ?, ?, ?)`,
          [daysAgo(randomInt(1, 3)), String(inv.total), txnId, inv.invoice_id, "Stripe"]
        );
        pendingCount++;
      }
    }
  }

  // Add Stripe session URLs for Sent/Viewed/Overdue invoices
  const unpaidInvoices = invoiceRecords.filter(i => ["Sent", "Viewed", "Overdue"].includes(i.status));
  for (const inv of unpaidInvoices) {
    const sessionId = `cs_test_demo_${inv.invoice_id}_${Date.now()}`;
    const paymentUrl = `https://checkout.stripe.com/c/pay/${sessionId}`;
    await connection.query(
      `UPDATE invoice SET stripe_session_id = ?, payment_url = ? WHERE invoice_id = ?`,
      [sessionId, paymentUrl, inv.invoice_id]
    );
  }

  console.log(`  ✓ Payment records created`);
  console.log(`    Completed: ${completedCount} | Pending: ${pendingCount} | Failed: ${failedCount}`);
  console.log(`    Stripe payment links: ${unpaidInvoices.length}\n`);
}

// ─── Phase 7: Generate audit log entries ─────────────────────────────────────

async function generateAuditLogs(connection, invoiceRecords, subscriptionMap) {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║   PHASE 7: Audit Log Entries             ║");
  console.log("╚══════════════════════════════════════════╝\n");

  let auditCount = 0;

  // Find a valid admin user_id for audit logs
  let auditUserId = null;
  let auditUserName = "System";
  try {
    const [users] = await connection.query(
      "SELECT user_id, name FROM user WHERE role_name = 'Admin' AND status = 1 LIMIT 1"
    );
    if (users.length > 0) {
      auditUserId = users[0].user_id;
      auditUserName = users[0].name;
    }
  } catch {}

  const insertAudit = async (activityType, actionDesc, affectedRecord, entityType, createdAt, status = "Success") => {
    await connection.query(
      `INSERT INTO audit_logs
        (user_id, user_name, module, activity_type, action_description,
         affected_record, entity_type, status, created_at)
       VALUES (?, ?, 'Invoice', ?, ?, ?, ?, ?, ?)`,
      [auditUserId, auditUserName, activityType, actionDesc, affectedRecord, entityType, status, createdAt]
    );
    auditCount++;
  };

  // Audit logs for each invoice lifecycle
  for (const inv of invoiceRecords) {
    const createdAt = formatDatetime(inv.issueDate);

    // Invoice Created
    await insertAudit(
      "Invoice Created",
      `Invoice ${inv.invoiceNumber} created for ${inv.customerName} — SGD ${inv.total.toFixed(2)}`,
      String(inv.invoice_id), "invoice", createdAt
    );

    // Subscription Invoice Generated (for subscription-linked invoices)
    if (inv.subscription_id) {
      await insertAudit(
        "Subscription Invoice Generated",
        `Recurring invoice ${inv.invoiceNumber} generated from subscription #${inv.subscription_id}`,
        String(inv.subscription_id), "subscription", createdAt
      );
    }

    // Invoice Sent (for Sent, Viewed, Paid, Overdue)
    if (["Sent", "Viewed", "Paid", "Overdue"].includes(inv.status)) {
      const sentAt = formatDatetime(addDays(inv.issueDate, randomInt(0, 2)));
      await insertAudit(
        "Invoice Sent",
        `Invoice ${inv.invoiceNumber} sent to ${inv.email}`,
        String(inv.invoice_id), "invoice", sentAt
      );
    }

    // Invoice Viewed
    if (["Viewed", "Paid"].includes(inv.status)) {
      const viewedAt = formatDatetime(addDays(inv.issueDate, randomInt(1, 5)));
      await insertAudit(
        "Invoice Viewed",
        `Invoice ${inv.invoiceNumber} viewed by ${inv.customerName}`,
        String(inv.invoice_id), "invoice", viewedAt
      );
    }

    // Invoice Paid
    if (inv.status === "Paid") {
      const paidAt = formatDatetime(addDays(inv.issueDate, randomInt(3, 14)));
      await insertAudit(
        "Invoice Paid",
        `Payment received for ${inv.invoiceNumber} — SGD ${inv.total.toFixed(2)}`,
        String(inv.invoice_id), "invoice", paidAt
      );

      await insertAudit(
        "Payment Processed",
        `Stripe payment completed for ${inv.invoiceNumber}`,
        String(inv.invoice_id), "payment", paidAt
      );
    }

    // Invoice Overdue
    if (inv.status === "Overdue") {
      const overdueAt = formatDatetime(addDays(inv.dueDate, 1));
      await insertAudit(
        "Invoice Overdue",
        `Invoice ${inv.invoiceNumber} is past due date (${inv.dueDate})`,
        String(inv.invoice_id), "invoice", overdueAt, "Warning"
      );
    }

    // Invoice Cancelled
    if (inv.status === "Cancelled") {
      const cancelledAt = formatDatetime(addDays(inv.issueDate, randomInt(2, 10)));
      await insertAudit(
        "Invoice Cancelled",
        `Invoice ${inv.invoiceNumber} cancelled by Finance user`,
        String(inv.invoice_id), "invoice", cancelledAt
      );
    }

    // Fraud Analysis Completed
    await insertAudit(
      "Fraud Analysis Completed",
      `Fraud analysis completed for ${inv.invoiceNumber}`,
      String(inv.invoice_id), "fraud", formatDatetime(inv.issueDate)
    );
  }

  // Subscription Updated logs
  for (const [, sub] of subscriptionMap) {
    await insertAudit(
      "Subscription Updated",
      `Subscription "${sub.plan.plan_name}" for ${sub.customerName} is active`,
      String(sub.subscription_id), "subscription",
      formatDatetime(subtractMonths(new Date().toISOString().split("T")[0], randomInt(1, 3)))
    );
    auditCount++;
  }

  console.log(`  ✓ ${auditCount} audit log entries created\n`);
}

// ─── Phase 8: Generate finance reminders ─────────────────────────────────────

async function generateFinanceReminders(connection, invoiceRecords) {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║   PHASE 8: Finance Reminders             ║");
  console.log("╚══════════════════════════════════════════╝\n");

  let count = 0;

  // Ensure finance_reminders table exists
  try {
    await connection.query("SELECT 1 FROM finance_reminders LIMIT 1");
  } catch (e) {
    if (e.code === "ER_NO_SUCH_TABLE") {
      console.log("  - finance_reminders table not found. Run: npm run db:finance-reminders\n");
      return;
    }
    throw e;
  }

  // Clear existing reminders
  await connection.query("DELETE FROM finance_reminders");
  try { await connection.query("ALTER TABLE finance_reminders AUTO_INCREMENT = 1"); } catch {}

  const today = new Date().toISOString().split("T")[0];

  for (const inv of invoiceRecords) {
    // Overdue invoices get an overdue reminder
    if (inv.status === "Overdue") {
      await connection.query(
        `INSERT INTO finance_reminders
          (reminder_type, priority, title, message, invoice_id, customer_id, company_id,
           customer_name, invoice_number, amount, due_date, status, created_at)
         VALUES ('invoice_overdue', 'High', ?, ?, ?, ?, NULL, ?, ?, ?, ?, 'Active', ?)`,
        [
          `Invoice ${inv.invoiceNumber} overdue`,
          `Invoice ${inv.invoiceNumber} for ${inv.customerName} (SGD ${inv.total.toFixed(2)}) is overdue since ${inv.dueDate}`,
          inv.invoice_id,
          inv.customerId,
          inv.customerName,
          inv.invoiceNumber,
          inv.total,
          inv.dueDate,
          formatDatetime(addDays(inv.dueDate, 1)),
        ]
      );
      count++;
    }

    // Sent/Viewed invoices due within 7 days get a due-soon reminder
    if (["Sent", "Viewed"].includes(inv.status)) {
      const dueDate = new Date(inv.dueDate);
      const todayDate = new Date(today);
      const daysUntilDue = Math.round((dueDate - todayDate) / 86400000);

      if (daysUntilDue >= 0 && daysUntilDue <= 7) {
        await connection.query(
          `INSERT INTO finance_reminders
            (reminder_type, priority, title, message, invoice_id, customer_id, company_id,
             customer_name, invoice_number, amount, due_date, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, 'Active', ?)`,
          [
            daysUntilDue === 0 ? "invoice_due_today" : "invoice_due_7_days",
            daysUntilDue === 0 ? "Medium" : "Low",
            daysUntilDue === 0
              ? `Invoice ${inv.invoiceNumber} due today`
              : `Invoice ${inv.invoiceNumber} due in ${daysUntilDue} days`,
            `Invoice ${inv.invoiceNumber} for ${inv.customerName} (SGD ${inv.total.toFixed(2)}) is due on ${inv.dueDate}`,
            inv.invoice_id,
            inv.customerId,
            inv.customerName,
            inv.invoiceNumber,
            inv.total,
            inv.dueDate,
            formatDatetime(daysAgo(1)),
          ]
        );
        count++;
      }
    }
  }

  // Add a failed payment reminder for one overdue invoice
  const overdueWithFailed = invoiceRecords.find(i => i.status === "Overdue");
  if (overdueWithFailed) {
    await connection.query(
      `INSERT INTO finance_reminders
        (reminder_type, priority, title, message, invoice_id, customer_id, company_id,
         customer_name, invoice_number, amount, due_date, status, created_at)
       VALUES ('payment_failed', 'High', ?, ?, ?, ?, NULL, ?, ?, ?, ?, 'Active', ?)`,
      [
        `Payment failed for ${overdueWithFailed.invoiceNumber}`,
        `Stripe payment attempt failed for ${overdueWithFailed.invoiceNumber} — ${overdueWithFailed.customerName}`,
        overdueWithFailed.invoice_id,
        overdueWithFailed.customerId,
        overdueWithFailed.customerName,
        overdueWithFailed.invoiceNumber,
        overdueWithFailed.total,
        overdueWithFailed.dueDate,
        formatDatetime(daysAgo(2)),
      ]
    );
    count++;
  }

  // Add a subscription renewal due reminder
  await connection.query(
    `INSERT INTO finance_reminders
      (reminder_type, priority, title, message, subscription_id, customer_id, company_id,
       customer_name, status, created_at)
     VALUES ('subscription_renewal_due', 'Medium', 'Subscription renewal approaching',
             'Premium Monthly subscription for Luxe Hair Studio is due for renewal within 7 days',
             1, NULL, NULL, 'Luxe Hair Studio', 'Active', ?)`,
    [formatDatetime(daysAgo(1))]
  );
  count++;

  // Add a completed reminder (for history)
  await connection.query(
    `INSERT INTO finance_reminders
      (reminder_type, priority, title, message, invoice_id, customer_id, company_id,
       customer_name, invoice_number, amount, status, resolved_at, notes, created_at)
     VALUES ('payment_succeeded', 'Low', 'Payment received', 'Payment received for INV-2026-0001',
             NULL, NULL, NULL, 'Luxe Hair Studio', 'INV-2026-0001', 299.00,
             'Completed', NOW(), 'Auto-resolved: payment confirmed', ?)`,
    [formatDatetime(daysAgo(5))]
  );
  count++;

  // Add a dismissed reminder (for history)
  await connection.query(
    `INSERT INTO finance_reminders
      (reminder_type, priority, title, message, invoice_id, customer_id, company_id,
       customer_name, invoice_number, status, resolved_at, notes, created_at)
     VALUES ('bulk_upload_validation_error', 'Medium', 'Bulk upload validation errors',
             'Last bulk upload contained 3 validation errors — records were skipped',
             NULL, NULL, NULL, NULL, NULL,
             'Dismissed', NOW(), 'Reviewed and re-uploaded corrected file', ?)`,
    [formatDatetime(daysAgo(10))]
  );
  count++;

  console.log(`  ✓ ${count} finance reminders created\n`);
}

// ─── Phase 9: Generate sample Excel files ────────────────────────────────────

async function generateSampleExcelFiles() {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║   PHASE 9: Sample Excel Files            ║");
  console.log("╚══════════════════════════════════════════╝\n");

  const ExcelJS = require("exceljs");
  const path = require("path");
  const fs = require("fs");

  const templateDir = path.join(__dirname, "../uploads/templates");
  if (!fs.existsSync(templateDir)) {
    fs.mkdirSync(templateDir, { recursive: true });
  }

  // ── 1. Successful bulk invoice upload ──────────────────────────────────────
  const successWorkbook = new ExcelJS.Workbook();
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

  // Style the header row
  successSheet.getRow(1).font = { bold: true };
  successSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8F5E9" } };

  await successWorkbook.xlsx.writeFile(path.join(templateDir, "sample_bulk_invoice_success.xlsx"));
  console.log("  ✓ sample_bulk_invoice_success.xlsx created");

  // ── 2. Failed bulk invoice upload (contains validation errors) ─────────────
  const failWorkbook = new ExcelJS.Workbook();
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

  await failWorkbook.xlsx.writeFile(path.join(templateDir, "sample_bulk_invoice_errors.xlsx"));
  console.log("  ✓ sample_bulk_invoice_errors.xlsx created");

  // ── 3. CSV version for validation testing ──────────────────────────────────
  const csvContent = [
    "Customer Name,Customer Email,Company Name,Invoice Number,Invoice Date,Due Date,Invoice Description,Quantity,Unit Price,Total Amount,Currency,Payment Method",
    'Luxe Hair Studio,bookings@luxehairstudio.sg,Vaniday Pte Ltd,,2026-07-15,2026-08-14,Hair Treatment Package,1,500.00,500.00,SGD,Stripe',
    'The Nail Artistry,hello@thenailartistry.sg,Vaniday Pte Ltd,,2026-07-15,2026-08-14,Nail Art Full Set,3,120.00,360.00,SGD,PayNow',
    'Serenity Spa & Wellness,reservations@serenityspa.sg,Vaniday Pte Ltd,,2026-07-15,2026-08-14,Spa Day Package,2,250.00,500.00,SGD,Bank Transfer',
    'Glow Aesthetics Clinic,appointments@glowaesthetics.sg,Vaniday Pte Ltd,,2026-07-15,2026-08-14,Facial Treatment Series,4,175.00,700.00,SGD,Credit Card',
    'Brow & Lash Bar,info@browlashbar.sg,Vaniday Pte Ltd,,2026-07-15,2026-08-14,Lash Lift & Tint,5,80.00,400.00,SGD,PayNow',
  ].join("\n");

  fs.writeFileSync(path.join(templateDir, "sample_bulk_invoice_validation.csv"), csvContent, "utf-8");
  console.log("  ✓ sample_bulk_invoice_validation.csv created");

  console.log("");
}

// ─── Phase 10: Verification ──────────────────────────────────────────────────

async function verify() {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║   VERIFICATION                           ║");
  console.log("╚══════════════════════════════════════════╝\n");

  const queries = [
    { label: "Invoices", sql: "SELECT COUNT(*) AS cnt FROM invoice WHERE invoiceId <> '__SETTINGS__'" },
    { label: "Customers", sql: "SELECT COUNT(*) AS cnt FROM customer" },
    { label: "Subscriptions", sql: "SELECT COUNT(*) AS cnt FROM subscriptions" },
    { label: "Payments", sql: "SELECT COUNT(*) AS cnt FROM payment" },
    { label: "Fraud Assessments", sql: "SELECT COUNT(*) AS cnt FROM invoice_fraud_assessment" },
    { label: "Fraud Indicators", sql: "SELECT COUNT(*) AS cnt FROM invoice_fraud_indicator" },
    { label: "Invoice Audit Logs", sql: "SELECT COUNT(*) AS cnt FROM audit_logs WHERE module = 'Invoice'" },
    { label: "Finance Reminders", sql: "SELECT COUNT(*) AS cnt FROM finance_reminders" },
  ];

  for (const { label, sql } of queries) {
    try {
      const [rows] = await pool.query(sql);
      console.log(`  ${label}: ${rows[0].cnt}`);
    } catch {
      console.log(`  ${label}: (table not found)`);
    }
  }

  // Status breakdown
  const [statusRows] = await pool.query(
    "SELECT status, COUNT(*) as cnt FROM invoice WHERE invoiceId <> '__SETTINGS__' GROUP BY status ORDER BY cnt DESC"
  );
  console.log("\n  Invoice Status Breakdown:");
  statusRows.forEach(r => console.log(`    ${r.status}: ${r.cnt}`));

  // Fraud risk breakdown
  try {
    const [fraudRows] = await pool.query(
      "SELECT risk_level, COUNT(*) as cnt FROM invoice_fraud_assessment GROUP BY risk_level"
    );
    console.log("\n  Fraud Risk Breakdown:");
    fraudRows.forEach(r => console.log(`    ${r.risk_level}: ${r.cnt}`));
  } catch {}

  // Payment status breakdown
  const [payRows] = await pool.query("SELECT status, COUNT(*) as cnt FROM payment GROUP BY status");
  console.log("\n  Payment Status Breakdown:");
  payRows.forEach(r => console.log(`    ${r.status}: ${r.cnt}`));

  console.log("");
}

// ─── Main entry point ────────────────────────────────────────────────────────

async function main() {
  console.log("\n========================================================");
  console.log("  PayNivo Finance Module — Demo Data Generation");
  console.log("========================================================\n");
  console.log(`  Database: ${process.env.DB_NAME}@${process.env.DB_HOST}`);
  console.log(`  Date: ${new Date().toISOString()}\n`);

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Detect the Finance/Admin user's company_id for data scoping
    let companyId = null;
    try {
      const [companyRows] = await connection.query(
        "SELECT company_id FROM user WHERE role_name IN ('Finance','Admin') AND company_id IS NOT NULL AND status = 1 LIMIT 1"
      );
      if (companyRows.length > 0) {
        companyId = companyRows[0].company_id;
      }
    } catch {}
    console.log(`  Company ID for demo data: ${companyId || "NULL (no company scoping)"}\n`);

    // Phase 1: Reset
    await resetInvoiceData(connection);

    // Phase 2: Customers
    const customerMap = await ensureCustomers(connection);

    // Phase 3: Subscriptions
    const subscriptionMap = await createSubscriptions(connection, customerMap, companyId);

    // Phase 4: Invoices
    const invoiceRecords = await generateInvoices(connection, customerMap, subscriptionMap, companyId);

    // Phase 5: Fraud
    await generateFraudRecords(connection, invoiceRecords);

    // Phase 6: Payments
    await generatePayments(connection, invoiceRecords);

    // Phase 7: Audit Logs
    await generateAuditLogs(connection, invoiceRecords, subscriptionMap);

    // Phase 8: Finance Reminders
    await generateFinanceReminders(connection, invoiceRecords);

    await connection.commit();
    console.log("═══════════════════════════════════════════════════════");
    console.log("  ✓ All data committed successfully!");
    console.log("═══════════════════════════════════════════════════════\n");
  } catch (error) {
    await connection.rollback();
    console.error("\n✗ Error — transaction rolled back:", error.message);
    throw error;
  } finally {
    connection.release();
  }

  // Phase 9: Sample Excel files (no DB transaction needed)
  try {
    await generateSampleExcelFiles();
  } catch (err) {
    console.error("  ⚠ Sample Excel generation failed:", err.message);
    console.error("    (this is non-fatal — ensure exceljs is installed)");
  }

  // Verify outside transaction
  await verify();

  await pool.end();
  console.log("Done. Database connection closed.\n");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
