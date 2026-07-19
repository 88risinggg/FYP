/**
 * Seed 30 invoices with Stripe payment data and fraud assessments.
 * Skips table deletion that triggers FK errors.
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { pool } = require("../src/config/db");
const { createCheckoutSession } = require("../src/services/stripeService");

function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randomFloat(min, max) { return Number((Math.random() * (max - min) + min).toFixed(2)); }
function randomElement(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function daysAgo(days) { return new Date(Date.now() - days * 86400000).toISOString().split("T")[0]; }
function addDays(dateStr, days) { const d = new Date(dateStr); d.setDate(d.getDate() + days); return d.toISOString().split("T")[0]; }

const customers = [
  { name: "Luxe Hair Studio", email: "bookings@luxehairstudio.sg" },
  { name: "The Nail Artistry", email: "hello@thenailartistry.sg" },
  { name: "Serenity Spa & Wellness", email: "reservations@serenityspa.sg" },
  { name: "Glow Aesthetics Clinic", email: "appointments@glowaesthetics.sg" },
  { name: "Brow & Lash Bar", email: "info@browlashbar.sg" },
  { name: "KBeauty Haven", email: "hello@kbeautyhaven.sg" },
  { name: "Zen Reflexology Centre", email: "bookings@zenreflexology.sg" },
  { name: "Prestige Barbers", email: "appointments@prestigebarbers.sg" },
  { name: "Skin Lab Express", email: "info@skinlabexpress.sg" },
  { name: "Orchid Beauty Lounge", email: "bookings@orchidbeauty.sg" },
  { name: "The Waxing Boutique", email: "hello@waxingboutique.sg" },
  { name: "Radiance Medi-Spa", email: "info@radiancespa.sg" },
  { name: "Aura Hair & Beauty", email: "bookings@aurahairbeauty.sg" },
  { name: "Bliss Nail Studio", email: "hello@blissnails.sg" },
  { name: "Rejuve Wellness Clinic", email: "appointments@rejuveclinic.sg" }
];

const services = [
  "Balayage Hair Coloring", "Keratin Smoothing Treatment", "Hair Extensions Installation",
  "Gel Manicure Session", "Full Body Massage (90 min)", "Hydrafacial Treatment",
  "Eyebrow Embroidery", "Lash Lift & Tint", "Brazilian Waxing",
  "Hot Stone Therapy", "Nail Art Design Package", "Chemical Peel Session",
  "Scalp Treatment", "Digital Perm", "Men's Grooming Package"
];

const statusDist = [
  ...Array(6).fill("Draft"), ...Array(6).fill("Sent"),
  ...Array(6).fill("Viewed"), ...Array(6).fill("Paid"), ...Array(6).fill("Overdue")
];

async function main() {
  console.log("=== Seeding 30 Invoices + Payments + Fraud ===\n");
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Ensure customers exist
    const customerMap = new Map();
    for (const c of customers) {
      const [existing] = await connection.query("SELECT customer_id FROM customer WHERE name = ? LIMIT 1", [c.name]);
      if (existing.length > 0) {
        customerMap.set(c.name, existing[0].customer_id);
      } else {
        const [result] = await connection.query(
          "INSERT INTO customer (name, email, address, created_at) VALUES (?, ?, ?, NOW())",
          [c.name, c.email, `${c.name}, Singapore`]
        );
        customerMap.set(c.name, result.insertId);
      }
    }
    console.log(`Customers: ${customerMap.size}`);

    // Ensure Stripe payment method
    let stripeMethodId;
    const [methods] = await connection.query("SELECT payment_method_id FROM payment_method WHERE name = 'Stripe' LIMIT 1");
    if (methods.length > 0) {
      stripeMethodId = methods[0].payment_method_id;
    } else {
      const [r] = await connection.query("INSERT INTO payment_method (name, description, is_active) VALUES ('Stripe', 'Stripe payments', 1)");
      stripeMethodId = r.insertId;
    }

    // Generate invoices
    const invoiceIds = [];
    for (let i = 0; i < 30; i++) {
      const status = statusDist[i];
      const customer = customers[i % customers.length];
      const customerId = customerMap.get(customer.name);
      const invoiceNumber = `INV-${String(i + 1).padStart(6, "0")}`;

      let issueDate, dueDate;
      switch (status) {
        case "Draft": issueDate = daysAgo(randomInt(1, 5)); dueDate = addDays(issueDate, 30); break;
        case "Sent": issueDate = daysAgo(randomInt(5, 15)); dueDate = addDays(issueDate, 30); break;
        case "Viewed": issueDate = daysAgo(randomInt(10, 20)); dueDate = addDays(issueDate, 30); break;
        case "Paid": issueDate = daysAgo(randomInt(20, 50)); dueDate = addDays(issueDate, 30); break;
        case "Overdue": issueDate = daysAgo(randomInt(40, 80)); dueDate = addDays(issueDate, 20); break;
      }

      const total = randomFloat(500, 25000);

      const [result] = await connection.query(
        `INSERT INTO invoice (status, issue_date, due_date, invoiceId, total_amount, customer_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [status, issueDate, dueDate, invoiceNumber, total, customerId]
      );
      const pk = result.insertId;
      invoiceIds.push({ pk, invoiceNumber, total, status, email: customer.email });

      // For Paid invoices, create a payment record
      if (status === "Paid") {
        const payDate = addDays(issueDate, randomInt(3, 15));
        const txnId = `pi_${Date.now()}_${randomInt(1000, 9999)}`;
        await connection.query(
          `INSERT INTO payment (payment_date, amount, status, transaction_id, invoice_invoice_id, payment_method_name)
           VALUES (?, ?, 'Completed', ?, ?, 'Stripe')`,
          [payDate, String(total), txnId, pk]
        );
      }
    }
    console.log(`Invoices: ${invoiceIds.length}`);

    // Generate fraud assessments
    const highRisk = new Set([3, 9, 15, 27]);
    const medRisk = new Set([5, 11, 17, 20, 23, 29]);
    const indicators = [
      { code: "DUPLICATE_INVOICE_NUMBER", label: "Duplicate invoice number detected.", severity: 35 },
      { code: "CUSTOMER_AMOUNT_OUTLIER", label: "Amount is unusually high for this customer.", severity: 25 },
      { code: "OUTSIDE_BUSINESS_HOURS", label: "Invoice submitted outside business hours.", severity: 10 },
      { code: "UNKNOWN_VENDOR", label: "Unknown or unregistered vendor.", severity: 25 },
      { code: "BANK_ACCOUNT_MISMATCH", label: "Bank account differs from verified record.", severity: 35 },
      { code: "VENDOR_SUBMISSION_SPIKE", label: "Sudden spike in vendor submissions.", severity: 20 }
    ];

    // Clear old fraud data
    await connection.query("DELETE FROM invoice_fraud_indicator");
    await connection.query("DELETE FROM invoice_fraud_assessment");

    let lowC = 0, medC = 0, highC = 0;
    for (let i = 0; i < invoiceIds.length; i++) {
      const inv = invoiceIds[i];
      let score, level, reviewStatus, picks;

      if (highRisk.has(i)) {
        score = randomInt(71, 95); level = "High";
        reviewStatus = i === 3 ? "Approved" : i === 15 ? "Rejected" : "Open";
        picks = indicators.sort(() => Math.random() - 0.5).slice(0, randomInt(2, 4));
        highC++;
      } else if (medRisk.has(i)) {
        score = randomInt(35, 65); level = "Medium";
        reviewStatus = i === 5 ? "Approved" : "Open";
        picks = indicators.sort(() => Math.random() - 0.5).slice(0, randomInt(1, 2));
        medC++;
      } else {
        score = randomInt(0, 25); level = "Low"; reviewStatus = "Open";
        picks = score > 10 ? indicators.sort(() => Math.random() - 0.5).slice(0, 1) : [];
        lowC++;
      }

      const [aRes] = await connection.query(
        `INSERT INTO invoice_fraud_assessment (invoice_id, risk_score, risk_level, review_status, model_version, assessed_at)
         VALUES (?, ?, ?, ?, 'rules-v1', NOW())`,
        [inv.pk, score, level, reviewStatus]
      );

      if (picks.length > 0) {
        const vals = picks.map(ind => [aRes.insertId, ind.code, ind.label, ind.severity, "{}"]);
        await connection.query(
          "INSERT INTO invoice_fraud_indicator (assessment_id, indicator_code, indicator_label, severity, details_json) VALUES ?",
          [vals]
        );
      }
    }
    console.log(`Fraud: Low=${lowC}, Medium=${medC}, High=${highC}`);

    await connection.commit();

    // Now generate real Stripe URLs for Sent/Viewed/Overdue invoices (outside transaction)
    console.log("\nGenerating Stripe checkout sessions for unpaid invoices...");
    let stripeCount = 0;
    for (const inv of invoiceIds) {
      if (["Sent", "Viewed", "Overdue"].includes(inv.status)) {
        try {
          const result = await createCheckoutSession({
            invoice_id: inv.pk,
            invoiceId: inv.invoiceNumber,
            total_amount: inv.total,
            customer_email: inv.email
          });
          await pool.query(
            "UPDATE invoice SET stripe_session_id = ?, payment_url = ? WHERE invoice_id = ?",
            [result.sessionId, result.paymentUrl, inv.pk]
          );
          stripeCount++;
        } catch (e) {
          console.log(`  Stripe error for ${inv.invoiceNumber}: ${e.message}`);
        }
      }
    }
    console.log(`Stripe sessions: ${stripeCount}`);

    // Verify
    const [countRes] = await pool.query("SELECT COUNT(*) as cnt FROM invoice");
    const [paidRes] = await pool.query("SELECT COUNT(*) as cnt FROM payment");
    const [fraudRes] = await pool.query("SELECT COUNT(*) as cnt FROM invoice_fraud_assessment");
    console.log(`\n=== Done! ===`);
    console.log(`Invoices: ${countRes[0].cnt}`);
    console.log(`Payments: ${paidRes[0].cnt}`);
    console.log(`Fraud assessments: ${fraudRes[0].cnt}`);
  } catch (e) {
    await connection.rollback();
    console.error("Error:", e.message);
  } finally {
    connection.release();
    await pool.end();
  }
}

main();
