require("dotenv").config();
const whatsappService = require("../src/services/whatsappService");
const messageModel = require("../src/models/whatsappMessageModel");

async function run() {
  const template = await messageModel.getDefaultTemplate("invoice_sent");
  console.log("Template found:", !!template);
  console.log("Template body:", JSON.stringify(template?.message_body));

  const paymentLink = "https://checkout.stripe.com/c/pay/cs_test_example123";
  const rendered = whatsappService.renderTemplate(template.message_body, {
    customer_name: "Test Customer",
    invoice_number: "INV-2026-0042",
    invoice_amount: "61.69",
    currency: "$",
    due_date: "25 Aug 2026",
    company_name: "Vaniday",
    payment_link: paymentLink ? `Pay securely: ${paymentLink}` : ""
  });

  console.log("\n--- Rendered message ---");
  console.log(rendered);
  process.exit(0);
}

run().catch((e) => { console.error(e.message); process.exit(1); });
