require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const { pool } = require("../src/config/db");
const { getInvoiceSettings, defaultSettings } = require("../src/models/invoiceSettingsModel");

async function main() {
  try {
    const settings = await getInvoiceSettings(null);
    if (settings) {
      console.log("attachPdfInvoice:", settings.attachPdfInvoice);
      console.log("companyName:", settings.companyName);
    } else {
      console.log("No settings found, using defaults");
      console.log("attachPdfInvoice (default):", defaultSettings.attachPdfInvoice);
    }
  } catch (e) {
    console.error("Error:", e.message);
  }
  process.exit(0);
}
main();
