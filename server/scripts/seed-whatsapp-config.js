/**
 * Seed WhatsApp Config
 *
 * Inserts Twilio credentials from .env into the whatsapp_config table
 * (encrypted) if no config row exists yet.
 *
 * Usage: node scripts/seed-whatsapp-config.js
 */

require("dotenv").config();
const { pool, waitForDatabase } = require("../src/config/db");
const configModel = require("../src/models/whatsappConfigModel");

async function seed() {
  console.log("[SEED] Checking whatsapp_config...");

  await waitForDatabase();

  const [rows] = await pool.query("SELECT id FROM whatsapp_config LIMIT 1");
  if (rows.length > 0) {
    console.log("[SEED] Config already exists (id=" + rows[0].id + "). Skipping.");
    process.exit(0);
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const whatsappNumber = process.env.TWILIO_WHATSAPP_FROM || process.env.TWILIO_WHATSAPP_NUMBER;

  if (!accountSid || !authToken || !whatsappNumber) {
    console.error("[SEED] Missing TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, or TWILIO_WHATSAPP_FROM in .env");
    process.exit(1);
  }

  await configModel.saveConfig({
    account_sid: accountSid,
    auth_token: authToken,
    whatsapp_number: whatsappNumber,
    webhook_url: process.env.TWILIO_STATUS_CALLBACK_URL || null,
    is_enabled: true,
    updated_by: null
  });

  console.log("[SEED] ✓ WhatsApp config seeded with Twilio credentials from .env (enabled=true).");
  process.exit(0);
}

seed().catch((err) => {
  console.error("[SEED] Failed:", err.message);
  process.exit(1);
});
