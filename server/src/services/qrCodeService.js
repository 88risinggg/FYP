/**
 * QR Code Service
 *
 * Generates QR codes using the pure-JS `qrcode` npm package.
 * No Puppeteer or Chrome required — works in any environment.
 *
 * Supports:
 * - Stripe payment URLs  → base64 data URI PNG
 * - PayNow EMVCo/SGQR strings → base64 data URI PNG
 */

const QRCode = require("qrcode");

// =====================================================
// PayNow Configuration (read at call time from .env)
// =====================================================
function getPayNowUEN() { return process.env.PAYNOW_UEN || ""; }
function getPayNowMobile() { return process.env.PAYNOW_MOBILE || ""; }

/**
 * Generate a QR code as a base64 PNG data URI from any string/URL.
 *
 * @param {string} data - The data to encode in the QR code.
 * @returns {Promise<string|null>} Base64 data URI of the QR code image, or null.
 */
async function generateQRCode(data) {
  if (!data) return null;

  try {
    const dataUri = await QRCode.toDataURL(data, {
      errorCorrectionLevel: "M",
      width: 200,
      margin: 2,
      color: { dark: "#000000", light: "#ffffff" }
    });
    return dataUri;
  } catch (err) {
    console.error("[QR CODE] Generation failed:", err.message);
    return null;
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

  try {
    return await QRCode.toBuffer(data, {
      errorCorrectionLevel: "M",
      width: 200,
      margin: 2
    });
  } catch (err) {
    console.error("[QR CODE] Buffer generation failed:", err.message);
    return null;
  }
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
    merchantName = process.env.COMPANY_NAME || "Vaniday",
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
  const PAYNOW_UEN = getPayNowUEN();
  const PAYNOW_MOBILE = getPayNowMobile();
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
  const PAYNOW_UEN = getPayNowUEN();
  const PAYNOW_MOBILE = getPayNowMobile();
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
