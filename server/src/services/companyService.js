const bcrypt = require("bcrypt");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { pool } = require("../config/db");
const { wrapTenantKey } = require("./tenantCryptoService");
const { sendAccountSetupEmail } = require("./emailService");

function generateTemporaryPassword() {
  return `Pn!${crypto.randomBytes(9).toString("base64url")}9aA`;
}

const safeCompany = (row) => row && ({
  workspaceId: row.workspace_id, name: row.display_name || row.company_name, legalName: row.legal_name,
  registrationNumber: row.registration_number, gstNumber: row.gst_number, email: row.company_email,
  phone: row.company_phone, address: row.company_address, website: row.company_website,
  timezone: row.timezone || "Asia/Singapore", currency: row.currency || "SGD", logoUrl: row.logo_path && row.workspace_id ? `/api/company/branding/${row.workspace_id}/logo?v=${new Date(row.updated_at || 0).getTime()}` : null,
  brandColor: row.brand_color || "#F38978", status: row.status, setupStatus: row.setup_status
});

async function getCompany(companyId, connection = pool) {
  const [rows] = await connection.execute("SELECT * FROM companies WHERE company_id=? LIMIT 1", [companyId]);
  return rows[0] || null;
}

async function updateCompany(companyId, input, userId) {
  const fields = {
    displayName: "display_name", legalName: "legal_name", registrationNumber: "registration_number", gstNumber: "gst_number",
    email: "company_email", phone: "company_phone", address: "company_address", website: "company_website",
    timezone: "timezone", currency: "currency", brandColor: "brand_color"
  };
  const entries = Object.entries(fields).filter(([key]) => input[key] !== undefined);
  if (!entries.length) return safeCompany(await getCompany(companyId));
  const values = entries.map(([key]) => input[key] || null);
  await pool.execute(`UPDATE companies SET ${entries.map(([, column]) => `\`${column}\`=?`).join(",")}, updated_at=NOW() WHERE company_id=?`, [...values, companyId]);
  await pool.execute(`INSERT INTO audit_logs (user_id,company_id,module,activity_type,action_description,affected_record,status,created_at)
    VALUES (?,?,'Company','Profile Update','Updated company business profile',?,'Success',NOW())`, [userId || null, companyId, String(companyId)]).catch(() => {});
  return safeCompany(await getCompany(companyId));
}

async function cloneGovernmentDefaults(connection, sourceCompanyId, targetCompanyId, fullClone) {
  if (fullClone) {
    await connection.execute(`INSERT INTO payroll_configuration
      (company_id,configuration_type,configuration_key,configuration_value,description,reference_title,reference_url,effective_from,rule_category,usage_type,is_active,created_at,updated_at)
      SELECT ?,configuration_type,configuration_key,configuration_value,description,reference_title,reference_url,effective_from,rule_category,usage_type,is_active,NOW(),NOW()
      FROM payroll_configuration WHERE company_id=?`, [targetCompanyId, sourceCompanyId]);
    return;
  }
  await connection.execute(`INSERT INTO payroll_configuration
    (company_id,configuration_type,configuration_key,configuration_value,description,reference_title,reference_url,effective_from,rule_category,usage_type,is_active,created_at,updated_at)
    SELECT ?,configuration_type,configuration_key,configuration_value,description,reference_title,reference_url,effective_from,rule_category,usage_type,is_active,NOW(),NOW()
    FROM payroll_configuration WHERE company_id=? AND
      (LOWER(COALESCE(rule_category,'')) REGEXP 'cpf|sdl|mbmf|shg|iras|statutory|government|tax' OR reference_url LIKE 'https://%.gov.sg/%')`,
  [targetCompanyId, sourceCompanyId]);
}

async function provisionCompany({ company, admin, sourceCompanyId = 1, fullClone = false, operatorUserId }) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [duplicates] = await connection.execute("SELECT workspace_id,setup_status FROM companies WHERE LOWER(company_name)=LOWER(?) OR LOWER(display_name)=LOWER(?) LIMIT 1", [company.name, company.name]);
    if (duplicates.length) throw Object.assign(new Error("A company workspace with this name already exists. Complete its onboarding from the company card instead."), { code: "COMPANY_ALREADY_EXISTS" });
    const workspaceId = crypto.randomUUID();
    const [result] = await connection.execute(`INSERT INTO companies
      (workspace_id,company_name,display_name,legal_name,status,timezone,currency,brand_color,setup_status,created_at)
      VALUES (?,?,?,?, 'active',?,?,?,'pending_admin',NOW())`,
    [workspaceId, company.name, company.name, company.legalName || company.name, company.timezone || "Asia/Singapore", company.currency || "SGD", company.brandColor || "#F38978"]);
    const companyId = result.insertId;
    const wrapped = wrapTenantKey(companyId);
    await connection.execute("UPDATE companies SET encrypted_data_key=?,encryption_key_version=? WHERE company_id=?", [wrapped.wrappedKey, wrapped.keyVersion, companyId]);
    await cloneGovernmentDefaults(connection, sourceCompanyId, companyId, fullClone);
    let setupEmail = { status: "not_requested" };
    if (admin?.email) {
      const temporaryPassword = generateTemporaryPassword();
      const randomPassword = await bcrypt.hash(temporaryPassword, 12);
      const [createdUser] = await connection.execute(`INSERT INTO user
        (email,name,password,status,must_change_password,role_name,company_id,created_at,updated_at)
        VALUES (?,?,?,1,1,'Admin',?,NOW(),NOW())`, [String(admin.email).trim().toLowerCase(), admin.name || "Company Admin", randomPassword, companyId]);
      await connection.execute("UPDATE companies SET owner_user_id=?,setup_status='admin_invited' WHERE company_id=?", [createdUser.insertId, companyId]);
      const setupToken = jwt.sign({ userId: createdUser.insertId, purpose: "first_login_password" }, process.env.JWT_SECRET, { expiresIn: "24h" });
      const setupUrl = `${process.env.CLIENT_URL || "http://localhost:5173"}/login?setupToken=${encodeURIComponent(setupToken)}`;
      setupEmail = { status: "pending", recipient: admin.email, setupUrl, name: admin.name, temporaryPassword };
    }
    await connection.execute(`INSERT INTO audit_logs (user_id,company_id,module,activity_type,action_description,affected_record,status,created_at)
      VALUES (?,?,'Platform','Company Provisioning','Provisioned company workspace',?,'Success',NOW())`, [operatorUserId || null, companyId, workspaceId]).catch(() => {});
    await connection.commit();
    if (setupEmail.status === "pending") {
      const oneTimeTemporaryPassword = setupEmail.temporaryPassword;
      try { await sendAccountSetupEmail({ to: setupEmail.recipient, name: setupEmail.name, setupUrl: setupEmail.setupUrl, temporaryPassword: oneTimeTemporaryPassword }); setupEmail = { status: "sent", recipient: setupEmail.recipient, oneTimeTemporaryPassword }; }
      catch (error) { setupEmail = { status: "failed", recipient: setupEmail.recipient, error: error.code || "EMAIL_DELIVERY_FAILED", oneTimeTemporaryPassword }; }
    }
    return { company: safeCompany(await getCompany(companyId)), setupEmail };
  } catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
}

async function onboardExistingCompany({ workspaceId, company, admin, operatorUserId }) {
  const connection = await pool.getConnection();
  let setupEmail;
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute("SELECT * FROM companies WHERE workspace_id=? FOR UPDATE", [workspaceId]);
    const existing = rows[0];
    if (!existing) throw Object.assign(new Error("Company workspace not found."), { code: "COMPANY_NOT_FOUND" });
    const [[adminCount]] = await connection.execute("SELECT COUNT(*) total FROM user WHERE company_id=? AND role_name='Admin'", [existing.company_id]);
    if (Number(adminCount.total) || existing.owner_user_id) throw Object.assign(new Error("This workspace already has a tenant Admin."), { code: "COMPANY_ALREADY_ONBOARDED" });
    const email = String(admin?.email || "").trim().toLowerCase();
    const name = String(admin?.name || "").trim();
    if (!email || !name) throw new Error("First Admin name and email are required.");
    await connection.execute(`UPDATE companies SET display_name=?,legal_name=?,registration_number=?,gst_number=?,company_email=?,company_phone=?,company_address=?,company_website=?,timezone=?,currency=?,updated_at=NOW() WHERE company_id=?`,
      [company.name || existing.display_name, company.legalName || company.name || existing.legal_name, company.registrationNumber || null, company.gstNumber || null, company.email || null, company.phone || null, company.address || null, company.website || null, company.timezone || "Asia/Singapore", company.currency || "SGD", existing.company_id]);
    const temporaryPassword = generateTemporaryPassword();
    const randomPassword = await bcrypt.hash(temporaryPassword, 12);
    const [createdUser] = await connection.execute(`INSERT INTO user (email,name,password,status,must_change_password,role_name,company_id,created_at,updated_at) VALUES (?,?,?,1,1,'Admin',?,NOW(),NOW())`, [email, name, randomPassword, existing.company_id]);
    await connection.execute("UPDATE companies SET owner_user_id=?,setup_status='admin_invited' WHERE company_id=?", [createdUser.insertId, existing.company_id]);
    const setupToken = jwt.sign({ userId: createdUser.insertId, purpose: "first_login_password" }, process.env.JWT_SECRET, { expiresIn: "24h" });
    setupEmail = { status: "pending", recipient: email, name, temporaryPassword, setupUrl: `${process.env.CLIENT_URL || "http://localhost:5173"}/login?setupToken=${encodeURIComponent(setupToken)}` };
    await connection.execute(`INSERT INTO audit_logs (user_id,company_id,module,activity_type,action_description,affected_record,status,created_at) VALUES (?,?,'Platform','Company Onboarding','Completed initial company registration and invited tenant Admin',?,'Success',NOW())`, [operatorUserId || null, existing.company_id, workspaceId]).catch(() => {});
    await connection.commit();
    const oneTimeTemporaryPassword = setupEmail.temporaryPassword;
    try { await sendAccountSetupEmail({ to: setupEmail.recipient, name: setupEmail.name, setupUrl: setupEmail.setupUrl, temporaryPassword: oneTimeTemporaryPassword }); setupEmail = { status: "sent", recipient: setupEmail.recipient, oneTimeTemporaryPassword }; }
    catch (error) { setupEmail = { status: "failed", recipient: setupEmail.recipient, error: error.code || "EMAIL_DELIVERY_FAILED", oneTimeTemporaryPassword }; }
    return { company: safeCompany(await getCompany(existing.company_id)), setupEmail };
  } catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
}

async function resendCompanyAdminSetup({ workspaceId, operatorUserId }) {
  const connection = await pool.getConnection();
  let delivery;
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(`SELECT c.company_id,c.owner_user_id,u.email,u.name,u.must_change_password,u.status FROM companies c JOIN user u ON u.user_id=c.owner_user_id WHERE c.workspace_id=? FOR UPDATE`, [workspaceId]);
    const account = rows[0];
    if (!account) throw Object.assign(new Error("This workspace has no linked tenant Admin."), { code: "TENANT_ADMIN_MISSING" });
    if (Number(account.must_change_password) !== 1) throw Object.assign(new Error("The tenant Admin has already completed account setup."), { code: "TENANT_ADMIN_ALREADY_ACTIVE" });
    const temporaryPassword = generateTemporaryPassword();
    const hash = await bcrypt.hash(temporaryPassword, 12);
    await connection.execute("UPDATE user SET password=?,status=1,must_change_password=1,updated_at=NOW() WHERE user_id=? AND company_id=?", [hash, account.owner_user_id, account.company_id]);
    await connection.execute(`INSERT INTO audit_logs (user_id,company_id,module,activity_type,action_description,affected_record,status,created_at) VALUES (?,?,'Platform','Admin Setup Retry','Rotated first tenant Admin temporary credential',?,'Success',NOW())`, [operatorUserId || null, account.company_id, String(account.owner_user_id)]).catch(() => {});
    await connection.commit();
    const setupToken = jwt.sign({ userId: account.owner_user_id, purpose: "first_login_password" }, process.env.JWT_SECRET, { expiresIn: "24h" });
    const setupUrl = `${process.env.CLIENT_URL || "http://localhost:5173"}/login?setupToken=${encodeURIComponent(setupToken)}`;
    try { await sendAccountSetupEmail({ to: account.email, name: account.name, setupUrl, temporaryPassword }); delivery = { status: "sent", recipient: account.email, oneTimeTemporaryPassword: temporaryPassword }; }
    catch (error) { delivery = { status: "failed", recipient: account.email, error: error.code || "EMAIL_DELIVERY_FAILED", oneTimeTemporaryPassword: temporaryPassword }; }
    return { setupEmail: delivery };
  } catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
}

async function listCompanies() {
  const [rows] = await pool.execute(`SELECT c.*, COUNT(u.user_id) user_count FROM companies c LEFT JOIN user u ON u.company_id=c.company_id GROUP BY c.company_id ORDER BY c.company_name`);
  return rows.map((row) => ({ companyId: row.company_id, ...safeCompany(row), userCount: Number(row.user_count || 0) }));
}

module.exports = { getCompany, listCompanies, onboardExistingCompany, provisionCompany, resendCompanyAdminSetup, safeCompany, updateCompany, _test: { generateTemporaryPassword } };
