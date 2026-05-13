import nodemailer from "nodemailer";

export async function sendPrototypeEmail({ to, subject, html }) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.ethereal.email",
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined
  });

  if (!process.env.SMTP_USER || process.env.SMTP_USER === "demo@example.com") {
    return { previewOnly: true, to, subject, html };
  }

  return transporter.sendMail({
    from: process.env.SMTP_FROM || "PayNivo Prototype <no-reply@paynivo.com>",
    to,
    subject,
    html
  });
}
