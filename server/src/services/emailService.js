const nodemailer = require("nodemailer");

function createTransporter() {
  const host = String(process.env.SMTP_HOST || "").trim();
  const user = String(process.env.SMTP_USER || "").trim();
  const pass = String(process.env.SMTP_PASS || "").trim();

  if (!host || !user || !pass) {
    const error = new Error("Email delivery is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and SMTP_FROM on the server, then retry the setup email.");
    error.code = "SMTP_NOT_CONFIGURED";
    throw error;
  }

  const port = Number(process.env.SMTP_PORT || 587);
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  });
}

function renderTemplate(template, values) {
  return String(template || "").replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_match, key) => {
    return values[key] ?? "";
  });
}

function buildReminderValues(invoice, override = {}) {
  return {
    client_name: invoice.clientName || "Client",
    invoice_number: invoice.invoiceNumber || "Invoice",
    amount_due: invoice.amountDue ?? "",
    due_date: invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString("en-SG") : "",
    overdue_days: invoice.overdueDays ?? "",
    company_name: process.env.COMPANY_NAME || "Vaniday",
    payment_link: process.env.PAYMENT_BASE_URL || "#",
    ...override
  };
}

async function sendReminderEmail({ rule, invoice }) {
  const transporter = createTransporter();
  const values = buildReminderValues(invoice);

  return transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: invoice.clientEmail,
    subject: renderTemplate(rule.emailSubject, values),
    text: renderTemplate(rule.emailBody, values)
  });
}

async function sendTestReminderEmail({ to, rule }) {
  const transporter = createTransporter();
  const values = buildReminderValues(
    {
      clientName: "Demo Client",
      invoiceNumber: "INV-TEST-001",
      amountDue: "1280.00",
      dueDate: new Date(),
      overdueDays: 7
    },
    { payment_link: "https://example.com/pay/INV-TEST-001" }
  );

  return transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject: renderTemplate(rule.emailSubject, values),
    text: renderTemplate(rule.emailBody, values)
  });
}

async function sendAuthOtpEmail({ to, otp, purpose }) {
  const transporter = createTransporter();
  const isLogin = purpose === "login";
  return transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject: isLogin ? "Your PayNivo login code" : "Verify your PayNivo email",
    text: [
      `Your six-digit verification code is: ${otp}`,
      "This code expires in one minute and can only be used once.",
      "If you did not request this code, you can ignore this email."
    ].join("\n\n")
  });
}

async function sendAccountSetupEmail({ to, name, setupUrl }) {
  const transporter = createTransporter();
  return transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject: "Your PayNivo account has been approved",
    text: [
      `Hello ${name || "there"},`,
      "Your PayNivo account has been approved by an administrator.",
      `Use this one-time link to accept the Terms and Privacy Policy and create your password: ${setupUrl}`,
      "The link expires in 24 hours and cannot be used after your password has been created.",
      "If you were not expecting this account, contact your administrator."
    ].join("\n\n")
  });
}

module.exports = {
  sendAccountSetupEmail,
  sendAuthOtpEmail,
  sendReminderEmail,
  sendTestReminderEmail
};
