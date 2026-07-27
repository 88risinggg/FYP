/**
 * Quick script to check the WhatsApp credentials stored in the database.
 * Run: node scripts/check-whatsapp-config.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const configModel = require("../src/models/whatsappConfigModel");
const { pool } = require("../src/config/db");

async function main() {
  try {
    console.log("\n=== WhatsApp Config Check ===\n");

    // 1. Raw row from DB
    const [rows] = await pool.query("SELECT * FROM whatsapp_config LIMIT 1");
    if (!rows[0]) {
      console.log("❌ No whatsapp_config row found in database!");
      console.log("   You need to configure WhatsApp in the Admin panel first.");
      process.exit(0);
    }

    const row = rows[0];
    console.log("Row found:");
    console.log("  ID:", row.id);
    console.log("  WhatsApp Number:", row.whatsapp_number);
    console.log("  Webhook URL:", row.webhook_url || "(none)");
    console.log("  Is Enabled:", Boolean(row.is_enabled));
    console.log("  Connection Status:", row.connection_status);
    console.log("  Last Tested:", row.last_tested_at);
    console.log("  Account Name:", row.account_name);
    console.log("  Has Encrypted SID:", !!row.account_sid_encrypted);
    console.log("  Has Encrypted Token:", !!row.auth_token_encrypted);
    console.log("  Has IV:", !!row.encryption_iv);
    console.log();

    // 2. Try decrypting
    console.log("=== Decryption Test ===\n");
    const config = await configModel.getConfig({ decryptCredentials: true });
    if (!config) {
      console.log("❌ getConfig returned null");
      process.exit(1);
    }

    const sid = config.account_sid;
    const token = config.auth_token;

    if (!sid) {
      console.log("❌ Account SID could not be decrypted (empty string)");
      console.log("   This means WHATSAPP_ENCRYPTION_KEY may have changed.");
    } else {
      console.log("✅ Account SID decrypted:", sid.slice(0, 6) + "..." + sid.slice(-4));
    }

    if (!token) {
      console.log("❌ Auth Token could not be decrypted (empty string)");
      console.log("   This means WHATSAPP_ENCRYPTION_KEY may have changed.");
    } else {
      console.log("✅ Auth Token decrypted:", token.slice(0, 4) + "..." + token.slice(-4));
    }

    console.log("\n  WhatsApp Number:", config.whatsapp_number);
    console.log("  Enabled:", config.is_enabled);
    console.log("  Connection Status:", config.connection_status);

    // 3. Compare with .env values
    console.log("\n=== .env Comparison ===\n");
    console.log("  .env TWILIO_ACCOUNT_SID:", process.env.TWILIO_ACCOUNT_SID || "(not set)");
    console.log("  DB Account SID:", sid || "(decryption failed)");
    if (sid && process.env.TWILIO_ACCOUNT_SID) {
      console.log("  Match:", sid === process.env.TWILIO_ACCOUNT_SID ? "✅ Yes" : "❌ No — DB has different credentials");
    }

    console.log("\n  .env TWILIO_AUTH_TOKEN:", process.env.TWILIO_AUTH_TOKEN ? process.env.TWILIO_AUTH_TOKEN.slice(0, 4) + "..." : "(not set)");
    console.log("  DB Auth Token:", token ? token.slice(0, 4) + "..." : "(decryption failed)");
    if (token && process.env.TWILIO_AUTH_TOKEN) {
      console.log("  Match:", token === process.env.TWILIO_AUTH_TOKEN ? "✅ Yes" : "❌ No — DB has different credentials");
    }

    console.log("\n  .env TWILIO_WHATSAPP_FROM:", process.env.TWILIO_WHATSAPP_FROM || "(not set)");
    console.log("  DB WhatsApp Number:", config.whatsapp_number || "(not set)");

    console.log("\n=== Done ===\n");
  } catch (err) {
    console.error("Error:", err.message);
    console.error(err.stack);
  } finally {
    await pool.end();
  }
}

main();
