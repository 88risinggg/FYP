/**
 * EVALUATION HEADER
 * FEATURE: SHARED / APPLICATION CORE
 * PURPOSE: Provides reusable email Transport Service business or integration operations.
 * LAYER: Backend service - contains reusable business rules or external integrations.
 * FIND RELATED CODE: Use Find All References to locate controllers, workers, or services that call it.
 */
const nodemailer = require("nodemailer");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function smtpConfiguration() {
  const host = String(process.env.SMTP_HOST || "").trim();
  const user = String(process.env.SMTP_USER || "").trim();
  const pass = String(process.env.SMTP_PASS || "").trim();
  const from = String(process.env.SMTP_FROM || user).trim();
  const port = Number(process.env.SMTP_PORT || 587);
  return { host, user, pass, from, port };
}

function smtpConfigurationError(config = smtpConfiguration()) {
  const missing = [];
  if (!config.host) missing.push("SMTP_HOST");
  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) missing.push("SMTP_PORT");
  if (!config.user) missing.push("SMTP_USER");
  if (!config.pass) missing.push("SMTP_PASS");
  if (!config.from) missing.push("SMTP_FROM");
  if (!missing.length) return null;
  const error = new Error(`Email delivery is not configured. Add ${missing.join(", ")} to the live server environment and restart the app.`);
  error.code = "SMTP_NOT_CONFIGURED";
  error.missing = missing;
  return error;
}

function createEmailTransport({ required = true } = {}) {
  const config = smtpConfiguration();
  const error = smtpConfigurationError(config);
  if (error) {
    if (required) throw error;
    return null;
  }
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: { user: config.user, pass: config.pass },
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 30000
  });
}

function emailFrom() {
  const config = smtpConfiguration();
  const error = smtpConfigurationError(config);
  if (error) throw error;
  return config.from;
}

function validEmail(value) {
  return EMAIL_PATTERN.test(String(value || "").trim());
}

function publicClientUrl() {
  return String(process.env.CLIENT_URL || process.env.APP_BASE_URL || "http://localhost:5173")
    .trim()
    .replace(/\/+$/, "");
}

async function sendEmail(message) {
  const recipient = String(message?.to || "").trim();
  if (!validEmail(recipient)) {
    const error = new Error("A valid recipient email address is required.");
    error.code = "EMAIL_RECIPIENT_INVALID";
    throw error;
  }
  const transporter = createEmailTransport();
  return transporter.sendMail({ ...message, from: message.from || emailFrom(), to: recipient });
}

async function verifyEmailTransport() {
  const transporter = createEmailTransport();
  if (typeof transporter.verify === "function") await transporter.verify();
  return true;
}

module.exports = {
  createEmailTransport,
  emailFrom,
  publicClientUrl,
  sendEmail,
  smtpConfiguration,
  smtpConfigurationError,
  validEmail,
  verifyEmailTransport
};
