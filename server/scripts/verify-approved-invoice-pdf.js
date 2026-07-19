const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const puppeteer = require("puppeteer-core");

const { pool } = require("../src/config/db");
const { defaultSettings } = require("../src/models/invoiceSettingsModel");
const { buildInvoiceHtml, generateInvoicePDF } = require("../src/services/pdfService");

async function run() {
  const invoice = {
    invoiceId: "PREVIEW-0001",
    status: "Draft",
    issue_date: "2026-07-20",
    due_date: "2026-08-19",
    total_amount: 188.5,
    amount_paid: 25,
    customer_name: "Invoice Preview Customer",
    customer_email: "preview@example.com",
    customer_address: "1 Preview Street, Singapore",
    items: [
      { description: "Professional service with a longer description to verify safe wrapping", quantity: 2, unit_price: 75, amount: 150 },
      { description: "Administrative fee", quantity: 1, unit_price: 38.5, amount: 38.5 }
    ]
  };
  const settings = {
    ...defaultSettings,
    companyName: "VANIDAY SINGAPORE PTE LTD",
    companyRegistrationNumber: "201535968M",
    companyAddress: "7 Temasek Boulevard, #12-07 Suntec Tower One, Singapore 038987",
    registeredOfficeAddress: "7 Temasek Boulevard, #12-07 Suntec Tower One, Singapore 038987",
    financeEmail: "finance@vaniday.com",
    bankAccountHolderName: "Vaniday Singapore Pte Ltd",
    bankName: "Oversea-Chinese Banking Corporation Limited (OCBC)",
    bankAccountNumber: "695105460001",
    bicSwift: "OCBCSGSGXXX",
    paynowIdentifier: "201535968M"
  };
  const pdf = await generateInvoicePDF(invoice, { settings });
  const outputPath = path.join(os.tmpdir(), "approved-invoice-preview.pdf");
  const imagePath = path.join(os.tmpdir(), "approved-invoice-preview.png");
  await fs.writeFile(outputPath, pdf);
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 1 });
    await page.setContent(buildInvoiceHtml(invoice, settings), { waitUntil: "networkidle0" });
    await page.screenshot({ path: imagePath, fullPage: true });
  } finally {
    await browser.close();
  }
  console.log(JSON.stringify({
    outputPath,
    imagePath,
    bytes: pdf.length,
    signature: pdf.subarray(0, 4).toString(),
    settingsId: settings?.settingId,
    nextInvoiceId: invoice.invoiceId
  }));
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
