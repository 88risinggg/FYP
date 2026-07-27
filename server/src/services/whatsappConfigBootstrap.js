/**
 * WhatsApp Config Bootstrap
 *
 * Auto-seeds WhatsApp credentials from environment variables into the
 * encrypted whatsapp_config table if the table exists but has no rows.
 *
 * This bridges the gap between having TWILIO_* env vars configured and
 * the whatsappService which exclusively reads credentials from the DB.
 *
 * Called once during server startup. Does nothing if:
 *   - Twilio env vars are not set
 *   - Config row already exists in the database
 *   - The whatsapp_config table does not exist (migration not run)
 */

const { pool } = require("../config/db");

async function ensureWhatsAppConfig() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const whatsappNumber = process.env.TWILIO_WHATSAPP_FROM || process.env.TWILIO_WHATSAPP_NUMBER;

  // Nothing to seed if env vars are not configured
  if (!accountSid || !authToken || !whatsappNumber) return;

  // Check if table exists
  try {
    const [tables] = await pool.query(
      "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'whatsapp_config'"
    );
    if (tables.length === 0) return; // Migration not run yet
  } catch {
    return;
  }

  // Check if config already exists
  const [rows] = await pool.query("SELECT id FROM whatsapp_config LIMIT 1");
  if (rows.length > 0) return; // Already configured

  // Seed from env vars
  const configModel = require("../models/whatsappConfigModel");
  const webhookUrl = (process.env.TWILIO_STATUS_CALLBACK_URL || "").trim() || null;

  await configModel.saveConfig({
    account_sid: accountSid,
    auth_token: authToken,
    whatsapp_number: whatsappNumber,
    webhook_url: webhookUrl,
    is_enabled: true,
    updated_by: null
  });

  console.log("[BOOTSTRAP] WhatsApp config auto-seeded from environment variables (enabled=true).");
}

module.exports = { ensureWhatsAppConfig };
