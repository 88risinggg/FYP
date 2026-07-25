/**
 * Enable PDF attachment in invoice email settings.
 * Run: node scripts/enable-pdf-attachment.js
 */
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const { pool } = require("../src/config/db");
const { getInvoiceSettings, saveInvoiceSettings } = require("../src/models/invoiceSettingsModel");

async function main() {
  try {
    const settings = await getInvoiceSettings(null);
    if (!settings) {
      console.log("No settings found. Creating with attachPdfInvoice = true");
      await saveInvoiceSettings({ attachPdfInvoice: true }, null);
    } else {
      console.log("Current attachPdfInvoice:", settings.attachPdfInvoice);
      settings.attachPdfInvoice = true;
      await saveInvoiceSettings(settings, null);
      console.log("✓ attachPdfInvoice set to true");
    }
  } catch (e) {
    console.error("Error:", e.message);
  }
  process.exit(0);
}
main();
