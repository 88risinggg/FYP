require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mysql = require("mysql2/promise");
const crypto = require("crypto");
const { wrapTenantKey } = require("../src/services/tenantCryptoService");

async function tableExists(db, table) {
  const [rows] = await db.execute("SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name=?", [table]);
  return rows.length > 0;
}
async function columnExists(db, table, column) {
  const [rows] = await db.execute("SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=? AND column_name=?", [table, column]);
  return rows.length > 0;
}
async function indexExists(db, table, index) {
  const [rows] = await db.execute("SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name=? AND index_name=?", [table, index]);
  return rows.length > 0;
}
async function addColumn(db, table, column, definition) {
  if (await tableExists(db, table) && !(await columnExists(db, table, column))) await db.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
}
async function addIndex(db, table, index, columns, unique = false) {
  if (await tableExists(db, table) && !(await indexExists(db, table, index))) await db.query(`ALTER TABLE \`${table}\` ADD ${unique ? "UNIQUE " : ""}INDEX \`${index}\` (${columns})`);
}

async function run() {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined
  });
  try {
    await db.beginTransaction();
    await db.query(`CREATE TABLE IF NOT EXISTS companies (
      company_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, company_name VARCHAR(255) NOT NULL,
      owner_user_id INT NULL, status VARCHAR(20) NOT NULL DEFAULT 'active', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP
    )`);
    const companyColumns = {
      workspace_id: "CHAR(36) NULL", display_name: "VARCHAR(255) NULL", legal_name: "VARCHAR(255) NULL",
      registration_number: "VARCHAR(80) NULL", gst_number: "VARCHAR(80) NULL", company_email: "VARCHAR(255) NULL",
      company_phone: "VARCHAR(40) NULL", company_address: "TEXT NULL", company_website: "VARCHAR(500) NULL",
      timezone: "VARCHAR(80) NOT NULL DEFAULT 'Asia/Singapore'", currency: "VARCHAR(10) NOT NULL DEFAULT 'SGD'",
      logo_path: "VARCHAR(500) NULL", brand_color: "VARCHAR(20) NOT NULL DEFAULT '#F38978'",
      setup_status: "VARCHAR(30) NOT NULL DEFAULT 'pending_admin'", encrypted_data_key: "TEXT NULL",
      encryption_key_version: "INT NOT NULL DEFAULT 1", sensitive_payload: "LONGTEXT NULL"
    };
    for (const [column, definition] of Object.entries(companyColumns)) await addColumn(db, "companies", column, definition);
    await addIndex(db, "companies", "uq_companies_workspace", "workspace_id", true);
    await db.query("UPDATE companies SET workspace_id=UUID(), display_name=COALESCE(display_name,company_name), legal_name=COALESCE(legal_name,company_name), setup_status='active' WHERE workspace_id IS NULL");
    const [unkeyedCompanies] = await db.query("SELECT company_id FROM companies WHERE encrypted_data_key IS NULL");
    for (const company of unkeyedCompanies) {
      const wrapped = wrapTenantKey(company.company_id);
      await db.query("UPDATE companies SET encrypted_data_key=?,encryption_key_version=? WHERE company_id=?", [wrapped.wrappedKey, wrapped.keyVersion, company.company_id]);
    }

    const tenantTables = [
      "staff", "payroll_run", "payroll", "claims_and_loans", "payroll_configuration", "account_action_requests",
      "public_holidays", "notification", "notifications", "customer", "invoice", "invoice_item", "payment", "subscriptions",
      "subscription_reminders", "finance_reminders", "audit_logs", "reminder_settings", "invoice_upload_history",
      "invoice_upload_validation_errors", "invoice_gst_rates"
    ];
    for (const table of tenantTables) {
      await addColumn(db, table, "company_id", "INT NULL");
      await addIndex(db, table, `idx_${table.substring(0, 40)}_company`, "company_id");
    }
    await addColumn(db, "staff", "sensitive_payload", "LONGTEXT NULL");
    await addColumn(db, "payroll", "financial_payload", "LONGTEXT NULL");
    await addColumn(db, "claims_and_loans", "sensitive_payload", "LONGTEXT NULL");
    await addColumn(db, "user", "company_id", "INT NULL");

    const [[demo]] = await db.query("SELECT company_id FROM companies ORDER BY company_id LIMIT 1");
    if (!demo) throw new Error("Demo SME company is missing.");
    await db.query("UPDATE user SET company_id=? WHERE company_id IS NULL AND role_name <> 'PlatformOperator'", [demo.company_id]);
    // Infer ownership from canonical parents before applying the Demo SME legacy fallback.
    await db.query(`UPDATE payroll p JOIN payroll_run r ON r.payroll_run_id=p.payroll_run_id
      JOIN staff s ON s.employee_id=p.staff_employee_id
      SET p.company_id=r.company_id WHERE p.company_id IS NULL AND r.company_id=s.company_id`);
    await db.query(`UPDATE payroll_run r JOIN payroll p ON p.payroll_run_id=r.payroll_run_id
      SET r.company_id=p.company_id WHERE r.company_id IS NULL AND p.company_id IS NOT NULL`);
    await db.query(`UPDATE account_action_requests a JOIN user u ON u.user_id=a.user_id
      SET a.company_id=u.company_id WHERE a.company_id IS NULL AND u.company_id IS NOT NULL`);
    await db.query(`UPDATE audit_logs a JOIN user u ON u.user_id=a.user_id
      SET a.company_id=u.company_id WHERE a.company_id IS NULL AND u.company_id IS NOT NULL`);
    const [orphanSnapshots] = await db.query(`SELECT pc.configuration_id,pc.configuration_type,pc.configuration_key,pr.company_id
      FROM payroll_configuration pc JOIN payroll_run pr ON pr.configuration_id=pc.configuration_id
      WHERE pc.company_id IS NULL AND pr.company_id IS NOT NULL`);
    for (const snapshot of orphanSnapshots) {
      const [[canonical]] = await db.query(`SELECT configuration_id FROM payroll_configuration
        WHERE company_id=? AND configuration_type=? AND configuration_key=? LIMIT 1`,
      [snapshot.company_id, snapshot.configuration_type, snapshot.configuration_key]);
      if (canonical) {
        await db.query("UPDATE payroll_run SET configuration_id=? WHERE configuration_id=?", [canonical.configuration_id, snapshot.configuration_id]);
        await db.query("DELETE FROM payroll_configuration WHERE configuration_id=?", [snapshot.configuration_id]);
      } else {
        await db.query("UPDATE payroll_configuration SET company_id=? WHERE configuration_id=?", [snapshot.company_id, snapshot.configuration_id]);
      }
    }
    const fallbackTables = tenantTables.filter((table) => !["payroll", "payroll_configuration", "account_action_requests", "audit_logs"].includes(table));
    for (const table of fallbackTables) {
      if (await tableExists(db, table)) await db.query(`UPDATE \`${table}\` SET company_id=? WHERE company_id IS NULL`, [demo.company_id]);
    }
    await db.query("UPDATE payroll_configuration SET company_id=? WHERE company_id IS NULL", [demo.company_id]);
    await db.query("UPDATE account_action_requests SET company_id=? WHERE company_id IS NULL", [demo.company_id]);
    await db.query("UPDATE audit_logs SET company_id=? WHERE company_id IS NULL", [demo.company_id]);

    if (!(await indexExists(db, "payroll_run", "uq_payroll_run_company_period"))) {
      if (await indexExists(db, "payroll_run", "uq_payroll_run_period")) await db.query("ALTER TABLE payroll_run DROP INDEX uq_payroll_run_period");
      await addIndex(db, "payroll_run", "uq_payroll_run_company_period", "company_id,payroll_month,payroll_year", true);
    }
    if (!(await indexExists(db, "payroll_configuration", "uq_payroll_configuration_company_type_key"))) {
      if (await indexExists(db, "payroll_configuration", "uq_payroll_configuration_type_key")) await db.query("ALTER TABLE payroll_configuration DROP INDEX uq_payroll_configuration_type_key");
      await addIndex(db, "payroll_configuration", "uq_payroll_configuration_company_type_key", "company_id,configuration_type,configuration_key", true);
    }
    await addIndex(db, "staff", "uq_staff_company_employee_code", "company_id,employee_code", true);
    if (await tableExists(db, "invoice") && !(await indexExists(db, "invoice", "uq_invoice_company_invoiceId"))) {
      if (await indexExists(db, "invoice", "uq_invoice_invoiceId")) await db.query("ALTER TABLE invoice DROP INDEX uq_invoice_invoiceId");
      await addIndex(db, "invoice", "uq_invoice_company_invoiceId", "company_id,invoiceId", true);
    }

    await db.query(`CREATE TABLE IF NOT EXISTS support_access_grants (
      grant_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, company_id INT NOT NULL,
      operator_user_id INT NOT NULL, requested_reason VARCHAR(1000) NOT NULL,
      access_mode ENUM('read_only','read_write') NULL, duration_minutes INT NULL,
      status ENUM('pending','approved','active','rejected','revoked','expired') NOT NULL DEFAULT 'pending',
      requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, reviewed_by INT NULL, reviewed_at DATETIME NULL,
      review_reason VARCHAR(1000) NULL, activated_at DATETIME NULL, expires_at DATETIME NULL, revoked_at DATETIME NULL,
      INDEX idx_support_company_status (company_id,status), INDEX idx_support_operator_status (operator_user_id,status)
    )`);

    let [[vaniday]] = await db.query("SELECT company_id FROM companies WHERE LOWER(company_name)='vaniday' LIMIT 1");
    if (!vaniday) {
      const [created] = await db.query(
        `INSERT INTO companies (workspace_id,company_name,display_name,legal_name,status,timezone,currency,setup_status,created_at)
         VALUES (UUID(),'Vaniday','Vaniday','Vaniday','active','Asia/Singapore','SGD','pending_admin',NOW())`
      );
      vaniday = { company_id: created.insertId };
      const wrapped = wrapTenantKey(vaniday.company_id);
      await db.query("UPDATE companies SET encrypted_data_key=?, encryption_key_version=? WHERE company_id=?", [wrapped.wrappedKey, wrapped.keyVersion, vaniday.company_id]);
    }
    // Vaniday's one-time bootstrap is safe to rerun: copy configuration only when the target has none.
    if (await tableExists(db, "payroll_configuration")) {
      const [[targetConfig]] = await db.query("SELECT COUNT(*) count FROM payroll_configuration WHERE company_id=?", [vaniday.company_id]);
      if (!Number(targetConfig.count)) await db.query(`INSERT INTO payroll_configuration
        (company_id,configuration_type,configuration_key,configuration_value,description,reference_title,reference_url,effective_from,rule_category,usage_type,is_active,updated_by,created_at,updated_at)
        SELECT ?,configuration_type,configuration_key,configuration_value,description,reference_title,reference_url,effective_from,rule_category,usage_type,is_active,NULL,NOW(),NOW()
        FROM payroll_configuration WHERE company_id=?`, [vaniday.company_id, demo.company_id]);
    }
    if (await tableExists(db, "invoice_gst_rates")) {
      const [[targetGst]] = await db.query("SELECT COUNT(*) count FROM invoice_gst_rates WHERE company_id=?", [vaniday.company_id]);
      if (!Number(targetGst.count)) {
        const [columns] = await db.query("SHOW COLUMNS FROM invoice_gst_rates");
        const copy = columns.map((row) => row.Field).filter((field) => !["gst_rate_id", "company_id"].includes(field));
        if (copy.length) await db.query(`INSERT INTO invoice_gst_rates (company_id,${copy.map((c) => `\`${c}\``).join(",")}) SELECT ?,${copy.map((c) => `\`${c}\``).join(",")} FROM invoice_gst_rates WHERE company_id=?`, [vaniday.company_id, demo.company_id]);
      }
    }
    if (await tableExists(db, "invoice")) {
      const [[targetInvoiceSettings]] = await db.query("SELECT invoice_id FROM invoice WHERE company_id=? AND invoiceId='__SETTINGS__' LIMIT 1", [vaniday.company_id]);
      if (!targetInvoiceSettings) await db.query(`INSERT INTO invoice
        (company_id,invoiceId,status,issue_date,due_date,total_amount,customer_id,items_json,created_at)
        SELECT ?,'__SETTINGS__','Draft','1970-01-01','1970-01-01',0,NULL,items_json,NOW()
        FROM invoice WHERE company_id=? AND invoiceId='__SETTINGS__' LIMIT 1`, [vaniday.company_id, demo.company_id]);
    }
    await db.commit();
    console.log(JSON.stringify({ demoCompanyId: demo.company_id, vanidayCompanyId: vaniday.company_id, status: "schema-ready" }));
  } catch (error) {
    await db.rollback();
    throw error;
  } finally { await db.end(); }
}

run().catch((error) => { console.error(error.code || error.message); process.exitCode = 1; });
