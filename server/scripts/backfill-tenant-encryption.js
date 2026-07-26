require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mysql = require("mysql2/promise");
const { encryptTenantPayload } = require("../src/services/tenantCryptoService");

const config = () => ({
  host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER,
  password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined
});

async function columns(db, table) {
  const [rows] = await db.query(`SHOW COLUMNS FROM \`${table}\``);
  return new Set(rows.map((row) => row.Field));
}

async function backfill(db, company, definition) {
  const available = await columns(db, definition.table);
  const fields = definition.fields.filter((field) => available.has(field));
  const [rows] = await db.query(
    `SELECT \`${definition.id}\`,${fields.map((field) => `\`${field}\``).join(",")} FROM \`${definition.table}\` WHERE company_id=? AND \`${definition.payload}\` IS NULL`,
    [company.company_id]
  );
  let updated = 0;
  for (const row of rows) {
    const value = Object.fromEntries(fields.map((field) => [field, row[field]]));
    const encrypted = encryptTenantPayload(company, definition.table, row[definition.id], definition.payload, value);
    await db.query(`UPDATE \`${definition.table}\` SET \`${definition.payload}\`=? WHERE \`${definition.id}\`=? AND company_id=? AND \`${definition.payload}\` IS NULL`, [encrypted, row[definition.id], company.company_id]);
    updated += 1;
  }
  return updated;
}

async function run() {
  const db = await mysql.createConnection(config());
  try {
    const [companies] = await db.query("SELECT company_id,encrypted_data_key,encryption_key_version FROM companies WHERE encrypted_data_key IS NOT NULL");
    const result = {};
    for (const company of companies) {
      result[company.company_id] = {
        staff: await backfill(db, company, { table: "staff", id: "employee_id", payload: "sensitive_payload", fields: ["name","email","phone_number","date_of_birth","race","religion","bank","account_no","base_salary","address","emergency_contact_name","emergency_contact_phone"] }),
        payroll: await backfill(db, company, { table: "payroll", id: "payroll_id", payload: "financial_payload", fields: ["basic_salary","gross_salary","total_allowances","total_deductions","employee_cpf","employer_cpf","mbmf_amount","net_salary","deduction_breakdown"] }),
        requests: await backfill(db, company, { table: "claims_and_loans", id: "record_id", payload: "sensitive_payload", fields: ["amount","description","claim_category","monthly_installment","outstanding_balance","request_metadata","evidence_payload"] })
      };
    }
    console.log(JSON.stringify({ status: "complete", updated: result }));
  } finally { await db.end(); }
}

run().catch((error) => { console.error(error.code || error.message); process.exitCode = 1; });
