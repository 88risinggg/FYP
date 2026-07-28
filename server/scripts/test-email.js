/**
 * Quick script to test SMTP email sending to the test customers.
 * Run: node scripts/test-email.js
 */
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

const nodemailer = require("nodemailer");

async function main() {
  const recipients = [
    { name: "Test Customer", email: "aroot16257@gmail.com" },
    { name: "Arut", email: "arut1657@gmail.com" },
  ];

  console.log("\n=== SMTP Email Test ===\n");
  console.log("SMTP Host:", process.env.SMTP_HOST);
  console.log("SMTP Port:", process.env.SMTP_PORT);
  console.log("SMTP User:", process.env.SMTP_USER);
  console.log("SMTP From:", process.env.SMTP_FROM);
  console.log();

  let transporter;
  try {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // Verify connection
    await transporter.verify();
    console.log("✅ SMTP connection verified successfully!\n");
  } catch (err) {
    console.log("❌ SMTP connection FAILED:", err.message);
    console.log("\n   Possible causes:");
    console.log("   - App password revoked or expired");
    console.log("   - 2FA disabled on the Gmail account");
    console.log("   - Wrong SMTP credentials");
    console.log("   - Network/firewall blocking port 587");
    process.exit(1);
  }

  // Send test email to each recipient
  for (const { name, email } of recipients) {
    try {
      const info = await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: email,
        subject: "[Test] PayNivo Email Integration Check",
        text: [
          `Hello ${name},`,
          "",
          "This is a test email from PayNivo to verify that email delivery is working.",
          "",
          `Sent at: ${new Date().toLocaleString("en-SG", { timeZone: "Asia/Singapore" })}`,
          "",
          "— PayNivo",
        ].join("\n"),
      });
      console.log(`✅ Email sent to ${name} (${email}) — Message ID: ${info.messageId}`);
    } catch (err) {
      console.log(`❌ Failed to send to ${name} (${email}): ${err.message}`);
    }
  }

  console.log("\n=== Done ===\n");
  process.exit(0);
}

main();
