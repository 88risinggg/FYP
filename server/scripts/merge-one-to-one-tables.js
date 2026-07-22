/**
 * Database Refactoring: Merge 1:1 tables into parent (user) table
 *
 * Tables being merged into `user`:
 * 1. user_profile
 * 2. security_settings
 * 3. notification_settings
 * 4. appearance_settings
 * 5. api_settings
 * 6. company_settings
 */

const mysql = require("mysql2/promise");
require("dotenv").config();

async function addColumn(pool, table, column, definition) {
  try {
    await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
  } catch (e) {
    if (e.code === "ER_DUP_FIELDNAME") {
      // Column already exists, skip
    } else {
      throw e;
    }
  }
}

async function run() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: true } : undefined,
    multipleStatements: true
  });

  console.log("Starting 1:1 table merge into user table...\n");

  try {
    // Step 1: Add columns from user_profile
    console.log("1. Adding user_profile columns to user table...");
    await addColumn(pool, "user", "display_name", "VARCHAR(100) NULL");
    await addColumn(pool, "user", "mobile", "VARCHAR(20) NULL");
    await addColumn(pool, "user", "job_title", "VARCHAR(100) NULL");
    await addColumn(pool, "user", "department", "VARCHAR(100) NULL");
    await addColumn(pool, "user", "preferred_language", "VARCHAR(10) DEFAULT 'en'");
    await addColumn(pool, "user", "timezone", "VARCHAR(50) DEFAULT 'Asia/Singapore'");
    await addColumn(pool, "user", "date_format", "VARCHAR(20) DEFAULT 'DD/MM/YYYY'");
    await addColumn(pool, "user", "currency", "VARCHAR(10) DEFAULT 'SGD'");
    await addColumn(pool, "user", "profile_picture", "TEXT NULL");
    await addColumn(pool, "user", "profile_employee_id", "VARCHAR(50) NULL");
    await addColumn(pool, "user", "profile_company_name", "VARCHAR(200) NULL");
    await addColumn(pool, "user", "phone_verified", "TINYINT(1) DEFAULT 0");
    await addColumn(pool, "user", "email_verified", "TINYINT(1) DEFAULT 0");
    console.log("   Done.");

    // Step 2: Add columns from security_settings
    console.log("2. Adding security_settings columns to user table...");
    await addColumn(pool, "user", "two_fa_enabled", "TINYINT(1) DEFAULT 0");
    await addColumn(pool, "user", "two_fa_method", "VARCHAR(30) NULL");
    await addColumn(pool, "user", "recovery_codes", "TEXT NULL");
    console.log("   Done.");

    // Step 3: Add columns from notification_settings
    console.log("3. Adding notification_settings columns to user table...");
    await addColumn(pool, "user", "notification_preferences", "JSON NULL");
    console.log("   Done.");

    // Step 4: Add columns from appearance_settings
    console.log("4. Adding appearance_settings columns to user table...");
    await addColumn(pool, "user", "theme", "VARCHAR(20) DEFAULT 'system'");
    await addColumn(pool, "user", "accent_color", "VARCHAR(20) DEFAULT '#7B2FF7'");
    await addColumn(pool, "user", "compact_mode", "TINYINT(1) DEFAULT 0");
    await addColumn(pool, "user", "font_size", "VARCHAR(20) DEFAULT 'medium'");
    await addColumn(pool, "user", "ui_language", "VARCHAR(10) DEFAULT 'en'");
    console.log("   Done.");

    // Step 5: Add columns from api_settings
    console.log("5. Adding api_settings columns to user table...");
    await addColumn(pool, "user", "api_key", "VARCHAR(255) NULL");
    await addColumn(pool, "user", "webhook_url", "VARCHAR(500) NULL");
    await addColumn(pool, "user", "webhook_secret", "VARCHAR(255) NULL");
    await addColumn(pool, "user", "webhooks_enabled", "TINYINT(1) DEFAULT 0");
    console.log("   Done.");

    // Step 6: Add columns from company_settings
    console.log("6. Adding company_settings columns to user table...");
    await addColumn(pool, "user", "company_logo", "TEXT NULL");
    await addColumn(pool, "user", "setting_company_name", "VARCHAR(200) NULL");
    await addColumn(pool, "user", "registration_number", "VARCHAR(50) NULL");
    await addColumn(pool, "user", "gst_number", "VARCHAR(50) NULL");
    await addColumn(pool, "user", "company_address", "TEXT NULL");
    await addColumn(pool, "user", "company_phone", "VARCHAR(20) NULL");
    await addColumn(pool, "user", "company_email", "VARCHAR(255) NULL");
    await addColumn(pool, "user", "company_website", "VARCHAR(255) NULL");
    await addColumn(pool, "user", "setting_default_currency", "VARCHAR(10) DEFAULT 'SGD'");
    await addColumn(pool, "user", "financial_year", "VARCHAR(20) NULL");
    await addColumn(pool, "user", "fiscal_start_date", "DATE NULL");
    console.log("   Done.");

    // Step 7: Migrate existing data
    console.log("\n7. Migrating data from user_profile...");
    try {
      await pool.query(`
        UPDATE user u
        INNER JOIN user_profile up ON up.user_id = u.user_id
        SET
          u.display_name = up.display_name,
          u.mobile = up.mobile,
          u.job_title = up.job_title,
          u.department = up.department,
          u.preferred_language = up.preferred_language,
          u.timezone = up.timezone,
          u.date_format = up.date_format,
          u.currency = up.currency,
          u.profile_picture = up.profile_picture,
          u.profile_employee_id = up.employee_id,
          u.profile_company_name = up.company_name,
          u.phone_verified = up.phone_verified,
          u.email_verified = up.email_verified
      `);
      console.log("   Done.");
    } catch (e) {
      console.log("   Skipped:", e.message.substring(0, 80));
    }

    console.log("8. Migrating data from security_settings...");
    try {
      await pool.query(`
        UPDATE user u
        INNER JOIN security_settings ss ON ss.user_id = u.user_id
        SET
          u.two_fa_enabled = ss.two_fa_enabled,
          u.two_fa_method = ss.two_fa_method,
          u.recovery_codes = ss.recovery_codes
      `);
      console.log("   Done.");
    } catch (e) {
      console.log("   Skipped:", e.message.substring(0, 80));
    }

    console.log("9. Migrating data from notification_settings...");
    try {
      await pool.query(`
        UPDATE user u
        INNER JOIN notification_settings ns ON ns.user_id = u.user_id
        SET u.notification_preferences = ns.preferences
      `);
      console.log("   Done.");
    } catch (e) {
      console.log("   Skipped:", e.message.substring(0, 80));
    }

    console.log("10. Migrating data from appearance_settings...");
    try {
      await pool.query(`
        UPDATE user u
        INNER JOIN appearance_settings aps ON aps.user_id = u.user_id
        SET
          u.theme = aps.theme,
          u.accent_color = aps.accent_color,
          u.compact_mode = aps.compact_mode,
          u.font_size = aps.font_size,
          u.ui_language = aps.language
      `);
      console.log("   Done.");
    } catch (e) {
      console.log("   Skipped:", e.message.substring(0, 80));
    }

    console.log("11. Migrating data from api_settings...");
    try {
      await pool.query(`
        UPDATE user u
        INNER JOIN api_settings apis ON apis.user_id = u.user_id
        SET
          u.api_key = apis.api_key,
          u.webhook_url = apis.webhook_url,
          u.webhook_secret = apis.webhook_secret,
          u.webhooks_enabled = apis.webhooks_enabled
      `);
      console.log("   Done.");
    } catch (e) {
      console.log("   Skipped:", e.message.substring(0, 80));
    }

    console.log("12. Migrating data from company_settings...");
    try {
      await pool.query(`
        UPDATE user u
        INNER JOIN company_settings cs ON cs.user_id = u.user_id
        SET
          u.company_logo = cs.company_logo,
          u.setting_company_name = cs.company_name,
          u.registration_number = cs.registration_number,
          u.gst_number = cs.gst_number,
          u.company_address = cs.address,
          u.company_phone = cs.phone,
          u.company_email = cs.email,
          u.company_website = cs.website,
          u.setting_default_currency = cs.default_currency,
          u.financial_year = cs.financial_year,
          u.fiscal_start_date = cs.fiscal_start_date
      `);
      console.log("   Done.");
    } catch (e) {
      console.log("   Skipped:", e.message.substring(0, 80));
    }

    // Step 13: Drop old 1:1 tables
    console.log("\n13. Dropping merged 1:1 tables...");
    await pool.query("SET FOREIGN_KEY_CHECKS = 0");
    const tablesToDrop = [
      "user_profile",
      "security_settings",
      "notification_settings",
      "appearance_settings",
      "api_settings",
      "company_settings"
    ];
    for (const table of tablesToDrop) {
      try {
        await pool.query(`DROP TABLE IF EXISTS \`${table}\``);
        console.log(`   Dropped: ${table}`);
      } catch (e) {
        console.log(`   Could not drop ${table}: ${e.message}`);
      }
    }
    await pool.query("SET FOREIGN_KEY_CHECKS = 1");

    // Step 14: Clear invoice data for fresh start
    console.log("\n14. Clearing invoice development data...");
    await pool.query("SET FOREIGN_KEY_CHECKS = 0");
    try { await pool.query("DELETE FROM invoice_upload_validation_errors"); } catch (e) { /* */ }
    try { await pool.query("DELETE FROM invoice_upload_history"); } catch (e) { /* */ }
    try { await pool.query("DELETE FROM invoice_fraud_assessment"); } catch (e) { /* */ }
    try { await pool.query("DELETE FROM invoice_fraud_indicator"); } catch (e) { /* */ }
    try { await pool.query("DELETE FROM invoice_fraud_metadata"); } catch (e) { /* */ }
    try { await pool.query("DELETE FROM invoice_view_log"); } catch (e) { /* */ }
    try { await pool.query("DELETE FROM invoice_reminder_log"); } catch (e) { /* */ }
    try { await pool.query("DELETE FROM invoice_notification"); } catch (e) { /* */ }
    try { await pool.query("DELETE FROM manual_payment_submission"); } catch (e) { /* */ }
    try { await pool.query("DELETE FROM reminder_logs"); } catch (e) { /* */ }
    try { await pool.query("DELETE FROM payment"); } catch (e) { /* */ }
    try { await pool.query("DELETE FROM invoice_numbering_activity"); } catch (e) { /* */ }
    try { await pool.query("DELETE FROM invoice"); } catch (e) { /* */ }
    try { await pool.query("UPDATE invoice_settings SET next_invoice_number = 1, running_number = 1"); } catch (e) { /* */ }
    await pool.query("SET FOREIGN_KEY_CHECKS = 1");
    console.log("   Invoice data cleared.");

    // Step 15: Seed sample invoice data
    console.log("\n15. Seeding fresh sample invoices...");
    const [customers] = await pool.query("SELECT customer_id, name, email FROM customer LIMIT 10");
    if (customers.length > 0) {
      const [settingsRows] = await pool.query("SELECT * FROM invoice_settings LIMIT 1").catch(() => [[]]);
      let nextNum = settingsRows[0]?.next_invoice_number || 1;
      const prefix = settingsRows[0]?.invoice_prefix || "INV";
      const year = new Date().getFullYear();

      const statuses = ["Draft", "Sent", "Viewed", "Paid", "Overdue"];
      const sampleItems = [
        [{ description: "Hair Treatment - Keratin", quantity: 1, unit_price: 250, amount: 250 }],
        [{ description: "Full Body Massage - 90min", quantity: 1, unit_price: 180, amount: 180 }, { description: "Aromatherapy Add-on", quantity: 1, unit_price: 50, amount: 50 }],
        [{ description: "Manicure & Pedicure Combo", quantity: 1, unit_price: 85, amount: 85 }],
        [{ description: "Facial - Deep Cleansing", quantity: 1, unit_price: 120, amount: 120 }, { description: "Eye Treatment", quantity: 1, unit_price: 60, amount: 60 }],
        [{ description: "Hair Coloring - Full Head", quantity: 1, unit_price: 300, amount: 300 }],
        [{ description: "Spa Package - Premium", quantity: 1, unit_price: 450, amount: 450 }],
        [{ description: "Eyelash Extensions - Classic", quantity: 1, unit_price: 150, amount: 150 }],
        [{ description: "Waxing - Brazilian", quantity: 1, unit_price: 75, amount: 75 }],
        [{ description: "Consultation Fee", quantity: 1, unit_price: 50, amount: 50 }, { description: "Skin Analysis Report", quantity: 1, unit_price: 30, amount: 30 }],
        [{ description: "Monthly Membership - Gold", quantity: 1, unit_price: 500, amount: 500 }]
      ];

      for (let i = 0; i < Math.min(10, customers.length); i++) {
        const cust = customers[i % customers.length];
        const items = sampleItems[i % sampleItems.length];
        const total = items.reduce((sum, item) => sum + item.amount, 0);
        const invoiceNumber = `${prefix}-${year}-${String(nextNum).padStart(4, "0")}`;
        const status = statuses[i % statuses.length];
        const issueDate = new Date();
        issueDate.setDate(issueDate.getDate() - (i * 3));
        const dueDate = new Date(issueDate);
        dueDate.setDate(dueDate.getDate() + 30);

        await pool.query(
          `INSERT INTO invoice (invoiceId, status, issue_date, due_date, total_amount, customer_id, items_json, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
          [invoiceNumber, status, issueDate.toISOString().slice(0, 10), dueDate.toISOString().slice(0, 10), total, cust.customer_id, JSON.stringify(items)]
        );
        nextNum++;
      }

      // Update the next_invoice_number in settings
      try {
        await pool.query("UPDATE invoice_settings SET next_invoice_number = ?, running_number = ?", [nextNum, nextNum]);
      } catch (e) { /* */ }
      console.log(`   Seeded ${Math.min(10, customers.length)} sample invoices.`);
    } else {
      console.log("   No customers found, skipping invoice seeding.");
    }

    // Verify final state
    console.log("\n--- Verification ---");
    const [tables] = await pool.query("SHOW TABLES");
    console.log(`Total tables: ${tables.length}`);
    tables.forEach((r, i) => console.log(`  ${i + 1}. ${Object.values(r)[0]}`));

    const [userCols] = await pool.query("SHOW COLUMNS FROM user");
    console.log(`\nUser table columns: ${userCols.length}`);
    userCols.forEach((col) => console.log(`  - ${col.Field} (${col.Type})`));

    console.log("\nMigration completed successfully!");

  } catch (error) {
    console.error("Migration failed:", error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
