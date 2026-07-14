/**
 * QR Code Service
 *
 * Generates QR codes for:
 * - Stripe payment URLs (clickable link to Stripe Checkout)
 * - PayNow QR codes (Singapore SGQR/EMVCo standard for direct bank transfers)
 *
 * Returns QR codes as base64 data URIs for embedding in PDFs and emails.
 */

const QRCode = require("qrcode");

// =====================================================
// PayNow Configuration (set in .env or defaults)
// =====================================================
const PAYNOW_UEN = process.env.PAYNOW_UEN || ""; // Company UEN for PayNow
const PAYNOW_MOBILE = process.env.PAYNOW_MOBILE || ""; // Or mobile number

/**
 * Generate a QR code as a base64 data URI from any string/URL.
 *
 * @param {string} paymentUrl - The URL or data to encode.
 * @returns {Promise<string>} Base64 data URI of the QR code image.
 */
async function generateQRCode(paymentUrl) {
  if (!paymentUrl) {
    return null;
  }

  const dataUri = await QRCode.toDataURL(paymentUrl, {
    width: 200,
    margin: 2,
    color: {
      dark: "#1a1a2e",
      light: "#ffffff"
    },
    errorCorrectionLevel: "M"
  });

  return dataUri;
}

/**
 * Generate a QR code as a PNG buffer.
 *
 * @param {string} paymentUrl - The URL or data to encode.
 * @returns {Promise<Buffer>} PNG buffer of the QR code.
 */
async function generateQRCodeBuffer(paymentUrl) {
  if (!paymentUrl) {
    return null;
  }

  const buffer = await QRCode.toBuffer(paymentUrl, {
    width: 200,
    margin: 2,
    color: {
      dark: "#1a1a2e",
      light: "#ffffff"
    },
    errorCorrectionLevel: "M"
  });

  return buffer;
}

/**
 * Build a PayNow QR code string following the EMVCo/SGQR specification.
 *
 * PayNow QR format (simplified EMVCo):
 * - Payload Format Indicator: "01"
 * - Point of Initiation: "12" (dynamic) for amount-specific
 * - Merchant Account (PayNow): Tag 26
 *   - "0000" = reverse domain (com.dbs or sg.com.nets)
 *   - "01" = proxy type (0=mobile, 2=UEN)
 *   - "02" = proxy value (phone/UEN)
 *   - "03" = editable (0=no, 1=yes)
 *   - "04" = expiry (optional)
 * - Transaction Currency: "702" (SGD)
 * - Transaction Amount
 * - Country Code: "SG"
 * - Merchant Name
 * - Reference Number (invoice ID)
 * - CRC16 checksum
 *
 * @param {Object} options
 * @param {string} options.proxyType - "MOBILE" or "UEN"
 * @param {string} options.proxyValue - Phone number (with +65) or UEN
 * @param {number} options.amount - Payment amount in SGD
 * @param {string} options.referenceNumber - Invoice reference (e.g. INV-000001)
 * @param {string} [options.merchantName] - Business name
 * @param {boolean} [options.editable] - Whether amount is editable (default: false)
 * @param {string} [options.expiryDate] - Expiry in YYYYMMDD format
 * @returns {string} EMVCo-compliant QR string
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

  // Helper: build a TLV (Tag-Length-Value) field
  function tlv(tag, value) {
    const len = String(value.length).padStart(2, "0");
    return `${tag}${len}${value}`;
  }

  // PayNow merchant account info (Tag 26)
  const proxyTypeCode = proxyType === "MOBILE" ? "0" : "2";
  const payNowData = [
    tlv("00", "SG.PAYNOW"),           // Globally Unique Identifier
    tlv("01", proxyTypeCode),          // Proxy Type: 0=Mobile, 2=UEN
    tlv("02", proxyValue),             // Proxy Value
    tlv("03", editable ? "1" : "0"),   // Amount editable flag
    expiryDate ? tlv("04", expiryDate) : ""  // Expiry date (optional)
  ].filter(Boolean).join("");

  // Build full EMVCo payload
  const fields = [
    tlv("00", "01"),                           // Payload Format Indicator
    tlv("01", amount ? "12" : "11"),           // Point of Initiation (12=dynamic/amount-specific, 11=static)
    tlv("26", payNowData),                     // Merchant Account - PayNow
    tlv("52", "0000"),                         // Merchant Category Code (not applicable)
    tlv("53", "702"),                          // Transaction Currency (SGD = 702)
    amount ? tlv("54", amount.toFixed(2)) : "", // Transaction Amount
    tlv("58", "SG"),                           // Country Code
    tlv("59", merchantName.substring(0, 25)),  // Merchant Name (max 25 chars)
    tlv("60", "Singapore"),                    // Merchant City
    referenceNumber ? tlv("62", tlv("01", referenceNumber)) : "" // Additional Data - Bill Number
  ].filter(Boolean).join("");

  // Add CRC placeholder and calculate CRC-16/CCITT-FALSE
  const crcInput = fields + "6304";
  const crc = calculateCRC16(crcInput);

  return crcInput + crc;
}

/**
 * Calculate CRC-16/CCITT-FALSE checksum (used by EMVCo QR).
 *
 * @param {string} str - Input string.
 * @returns {string} 4-character uppercase hex CRC.
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
 *
 * @param {Object} invoice - { invoiceId, total_amount }
 * @param {Object} [overrides] - Override proxy type/value
 * @returns {Promise<string|null>} Base64 data URI or null if PayNow not configured.
 */
async function generatePayNowQRCode(invoice, overrides = {}) {
  const proxyValue = overrides.proxyValue || PAYNOW_UEN || PAYNOW_MOBILE;
  const proxyType = overrides.proxyType || (PAYNOW_UEN ? "UEN" : "MOBILE");

  if (!proxyValue) {
    return null; // PayNow not configured
  }

  const qrString = buildPayNowQRString({
    proxyType,
    proxyValue,
    amount: Number(invoice.total_amount || 0),
    referenceNumber: invoice.invoiceId || "",
    editable: false
  });

  if (!qrString) return null;

  const dataUri = await QRCode.toDataURL(qrString, {
    width: 200,
    margin: 2,
    color: {
      dark: "#1a1a2e",
      light: "#ffffff"
    },
    errorCorrectionLevel: "L" // PayNow uses L for maximum data capacity
  });

  return dataUri;
}

/**
 * Generate a PayNow QR code as a PNG buffer.
 *
 * @param {Object} invoice - { invoiceId, total_amount }
 * @param {Object} [overrides] - Override proxy type/value
 * @returns {Promise<Buffer|null>} PNG buffer or null.
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

  return QRCode.toBuffer(qrString, {
    width: 200,
    margin: 2,
    color: {
      dark: "#1a1a2e",
      light: "#ffffff"
    },
    errorCorrectionLevel: "L"
  });
}

module.exports = {
  buildPayNowQRString,
  calculateCRC16,
  generatePayNowQRCode,
  generatePayNowQRCodeBuffer,
  generateQRCode,
  generateQRCodeBuffer
};
