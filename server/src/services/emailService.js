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
    amount_due: invoice.amountDue == null ? "" : `SGD ${Number(invoice.amountDue).toFixed(2)}`,
    due_date: invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString("en-SG") : "",
    overdue_days: invoice.overdueDays ?? "",
    company_name: process.env.COMPANY_NAME || "PayNivo",
    payment_link: invoice.paymentLink || process.env.PAYMENT_BASE_URL || "#",
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

async function sendAccountSetupEmail({ to, name, setupUrl, temporaryPassword }) {
  const transporter = createTransporter();
  return transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject: "Your PayNivo account has been approved",
    text: [
      `Hello ${name || "there"},`,
      "Your PayNivo account has been approved by an administrator.",
      temporaryPassword ? `Sign in with your email address and this one-time temporary password: ${temporaryPassword}` : null,
      temporaryPassword ? "After signing in, you must replace the temporary password before accessing the workspace." : null,
      `Use this one-time link to accept the Terms and Privacy Policy and create your password: ${setupUrl}`,
      "The link expires in 24 hours and cannot be used after your password has been created.",
      "If you were not expecting this account, contact your administrator."
    ].filter(Boolean).join("\n\n")
  });
}

async function sendPayslipEmail({ to, name, period, companyName, pdf, filename }) {
  const recipient = String(to || "").trim();
  if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
    const error = new Error("The employee does not have a valid staff email address. HR must correct the staff record before retrying.");
    error.code = "PAYSLIP_EMAIL_INVALID";
    throw error;
  }
  if (!Buffer.isBuffer(pdf) || !pdf.length) {
    const error = new Error("The payslip PDF could not be attached to the email.");
    error.code = "PAYSLIP_PDF_MISSING";
    throw error;
  }

  const transporter = createTransporter();
  const employer = String(companyName || "your employer").trim();
  const payPeriod = String(period || "the selected payroll period").trim();
  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: recipient,
    subject: `Your ${payPeriod} payslip is ready`,
    text: [
      `Hello ${name || "there"},`,
      `Your payslip for ${payPeriod} from ${employer} is attached to this email.`,
      "You can also sign in to PayNivo to view your payslip and payroll history.",
      "This document contains confidential payroll information. Do not forward it to anyone.",
      "If you believe any information is incorrect, contact your HR team."
    ].join("\n\n"),
    attachments: [{
      filename: filename || "payslip.pdf",
      content: pdf,
      contentType: "application/pdf"
    }]
  });

  return {
    messageId: info.messageId || null,
    recipient,
    accepted: Array.isArray(info.accepted) ? info.accepted : []
  };
}

module.exports = {
  sendAccountSetupEmail,
  sendAuthOtpEmail,
  sendPayslipEmail,
  sendReminderEmail,
  sendTestReminderEmail
};
