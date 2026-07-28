/**
 * Setup WhatsApp Config
 *
 * Inserts or updates Twilio credentials in the whatsapp_config table
 * using values from the .env file.
 *
 * Usage: node scripts/setup-whatsapp-config.js
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

const configModel = require("../src/models/whatsappConfigModel");
const { pool } = require("../src/config/db");

async function main() {
  console.log("Setting up WhatsApp (Twilio) configuration from .env...\n");

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const whatsappNumber = process.env.TWILIO_WHATSAPP_FROM || process.env.TWILIO_WHATSAPP_NUMBER;

  if (!accountSid || !authToken || !whatsappNumber) {
    console.error("ERROR: Missing TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, or TWILIO_WHATSAPP_FROM/TWILIO_WHATSAPP_NUMBER in .env");
    process.exit(1);
  }

  const config = {
    account_sid: accountSid,
    auth_token: authToken,
    whatsapp_number: whatsappNumber,
    webhook_url: (process.env.TWILIO_STATUS_CALLBACK_URL || "").trim() || null,
    is_enabled: true,
    updated_by: null
  };

  try {
    const result = await configModel.saveConfig(config);
    console.log("WhatsApp configuration saved successfully!");
    console.log("  Account SID (masked):", result.account_sid_masked);
    console.log("  WhatsApp Number:", config.whatsapp_number);
    console.log("  Enabled:", config.is_enabled);
    console.log("\nYou can now test the connection from the Finance Settings page.");
  } catch (err) {
    console.error("Failed to save config:", err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
