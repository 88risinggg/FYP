const crypto = require("crypto");

const VERSION = 1;

function masterKey() {
  const encoded = String(process.env.TENANT_MASTER_KEY || "").trim();
  if (!encoded) {
    if (process.env.NODE_ENV !== "production" && process.env.JWT_SECRET) {
      return crypto.createHash("sha256").update(`paynivo-development-tenant-key:${process.env.JWT_SECRET}`).digest();
    }
    const error = new Error("TENANT_MASTER_KEY is required for tenant encryption and provisioning.");
    error.code = "TENANT_MASTER_KEY_REQUIRED";
    throw error;
  }
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32) {
    if (process.env.NODE_ENV !== "production" && process.env.JWT_SECRET) {
      return crypto.createHash("sha256").update(`paynivo-development-tenant-key:${process.env.JWT_SECRET}`).digest();
    }
    const error = new Error("TENANT_MASTER_KEY must be a base64-encoded 32-byte key.");
    error.code = "TENANT_MASTER_KEY_INVALID";
    throw error;
  }
  return key;
}

function aad(parts) {
  return Buffer.from(parts.map((part) => String(part ?? "")).join(":"), "utf8");
}

function seal(value, key, context) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(aad(context));
  const ciphertext = Buffer.concat([cipher.update(Buffer.from(JSON.stringify(value), "utf8")), cipher.final()]);
  return JSON.stringify({ v: VERSION, iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), data: ciphertext.toString("base64") });
}

function open(payload, key, context) {
  const envelope = typeof payload === "string" ? JSON.parse(payload) : payload;
  if (!envelope || envelope.v !== VERSION) throw Object.assign(new Error("Unsupported encrypted payload version."), { code: "TENANT_CIPHERTEXT_VERSION" });
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(envelope.iv, "base64"));
  decipher.setAAD(aad(context));
  decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(envelope.data, "base64")), decipher.final()]).toString("utf8"));
}

function wrapTenantKey(companyId, tenantKey = crypto.randomBytes(32), keyVersion = VERSION) {
  return { wrappedKey: seal(tenantKey.toString("base64"), masterKey(), ["tenant-key", companyId, keyVersion]), keyVersion };
}

function unwrapTenantKey(company) {
  if (!company?.encrypted_data_key) throw Object.assign(new Error("Company encryption key is not configured."), { code: "TENANT_KEY_MISSING" });
  const version = Number(company.encryption_key_version || VERSION);
  const encoded = open(company.encrypted_data_key, masterKey(), ["tenant-key", company.company_id, version]);
  return Buffer.from(encoded, "base64");
}

function encryptTenantPayload(company, table, rowId, field, value) {
  return seal(value, unwrapTenantKey(company), [company.company_id, table, rowId, field, company.encryption_key_version || VERSION]);
}

function decryptTenantPayload(company, table, rowId, field, payload) {
  if (!payload) return null;
  return open(payload, unwrapTenantKey(company), [company.company_id, table, rowId, field, company.encryption_key_version || VERSION]);
}

module.exports = { decryptTenantPayload, encryptTenantPayload, masterKey, unwrapTenantKey, wrapTenantKey, _test: { open, seal } };
