/**
 * QR Code Service
 *
 * Generates QR codes for:
 * - Stripe payment URLs (clickable link to Stripe Checkout)
 * - PayNow QR codes (Singapore SGQR/EMVCo standard for direct bank transfers)
 *
 * Uses Puppeteer to render QR codes via a lightweight HTML page with inline
 * QR generation logic (no external library needed).
 */

const puppeteer = require("puppeteer-core");

// =====================================================
// PayNow Configuration (set in .env or defaults)
// =====================================================
const PAYNOW_UEN = process.env.PAYNOW_UEN || "";
const PAYNOW_MOBILE = process.env.PAYNOW_MOBILE || "";

/**
 * Get Puppeteer executable path.
 */
function getExecutablePath() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  if (process.platform === "win32") {
    return "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  }
  if (process.platform === "darwin") {
    return "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  }
  return "/usr/bin/google-chrome";
}

/**
 * Generate a QR code as a base64 data URI from any string/URL.
 * Uses Google Charts API rendered via Puppeteer.
 *
 * @param {string} data - The data to encode in the QR code.
 * @returns {Promise<string|null>} Base64 data URI of the QR code image.
 */
async function generateQRCode(data) {
  if (!data) return null;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
    <img id="qr" src="https://chart.googleapis.com/chart?chs=200x200&cht=qr&chl=${encodeURIComponent(data)}&choe=UTF-8" />
    <script>
      document.getElementById('qr').onload = () => { window._qrReady = true; };
      document.getElementById('qr').onerror = () => { window._qrReady = true; };
    </script>
  </body></html>`;

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: getExecutablePath(),
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    // Wait for image to load
    await page.waitForFunction(() => window._qrReady === true, { timeout: 10000 }).catch(() => {});

    const imgElement = await page.$("#qr");
    const screenshot = await imgElement.screenshot({ encoding: "base64", type: "png" });
    return `data:image/png;base64,${screenshot}`;
  } finally {
    await browser.close();
  }
}

/**
 * Generate a QR code as a PNG buffer.
 *
 * @param {string} data - The data to encode.
 * @returns {Promise<Buffer|null>} PNG buffer of the QR code.
 */
async function generateQRCodeBuffer(data) {
  if (!data) return null;

  const dataUri = await generateQRCode(data);
  if (!dataUri) return null;

  const base64 = dataUri.replace(/^data:image\/png;base64,/, "");
  return Buffer.from(base64, "base64");
}

/**
 * Build a PayNow QR code string following the EMVCo/SGQR specification.
 */
function buildPayNowQRString(options) {
  const {
    proxyType = "UEN",
    proxyValue,
    amount,
    referenceNumber = "",
    merchantName = process.env.COMPANY_NAME || "PayNivo",
    editable = false,
    expiryDate = ""
  } = options;

  if (!proxyValue) return null;

  function tlv(tag, value) {
    const len = String(value.length).padStart(2, "0");
    return `${tag}${len}${value}`;
  }

  const proxyTypeCode = proxyType === "MOBILE" ? "0" : "2";
  const payNowData = [
    tlv("00", "SG.PAYNOW"),
    tlv("01", proxyTypeCode),
    tlv("02", proxyValue),
    tlv("03", editable ? "1" : "0"),
    expiryDate ? tlv("04", expiryDate) : ""
  ].filter(Boolean).join("");

  const fields = [
    tlv("00", "01"),
    tlv("01", amount ? "12" : "11"),
    tlv("26", payNowData),
    tlv("52", "0000"),
    tlv("53", "702"),
    amount ? tlv("54", amount.toFixed(2)) : "",
    tlv("58", "SG"),
    tlv("59", merchantName.substring(0, 25)),
    tlv("60", "Singapore"),
    referenceNumber ? tlv("62", tlv("01", referenceNumber)) : ""
  ].filter(Boolean).join("");

  const crcInput = fields + "6304";
  const crc = calculateCRC16(crcInput);

  return crcInput + crc;
}

/**
 * Calculate CRC-16/CCITT-FALSE checksum.
 */
function calculateCRC16(str) {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc = crc << 1;
      }
      crc &= 0xFFFF;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/**
 * Generate a PayNow QR code as a base64 data URI.
 */
async function generatePayNowQRCode(invoice, overrides = {}) {
  const proxyValue = overrides.proxyValue || PAYNOW_UEN || PAYNOW_MOBILE;
  const proxyType = overrides.proxyType || (PAYNOW_UEN ? "UEN" : "MOBILE");

  if (!proxyValue) return null;

  const qrString = buildPayNowQRString({
    proxyType,
    proxyValue,
    amount: Number(invoice.total_amount || 0),
    referenceNumber: invoice.invoiceId || "",
    editable: false
  });

  if (!qrString) return null;

  return generateQRCode(qrString);
}

/**
 * Generate a PayNow QR code as a PNG buffer.
 */
async function generatePayNowQRCodeBuffer(invoice, overrides = {}) {
  const proxyValue = overrides.proxyValue || PAYNOW_UEN || PAYNOW_MOBILE;
  const proxyType = overrides.proxyType || (PAYNOW_UEN ? "UEN" : "MOBILE");

  if (!proxyValue) return null;

  const qrString = buildPayNowQRString({
    proxyType,
    proxyValue,
    amount: Number(invoice.total_amount || 0),
    referenceNumber: invoice.invoiceId || "",
    editable: false
  });

  if (!qrString) return null;

  return generateQRCodeBuffer(qrString);
}

module.exports = {
  buildPayNowQRString,
  calculateCRC16,
  generatePayNowQRCode,
  generatePayNowQRCodeBuffer,
  generateQRCode,
  generateQRCodeBuffer
};
