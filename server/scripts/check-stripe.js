/**
 * Quick script to verify Stripe credentials are valid.
 * Run: node scripts/check-stripe.js
 */
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

async function main() {
  console.log("\n=== Stripe Config Check ===\n");

  const secretKey = process.env.STRIPE_SECRET_KEY;
  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  console.log("Secret Key:", secretKey ? secretKey.slice(0, 12) + "..." + secretKey.slice(-4) : "(not set)");
  console.log("Publishable Key:", publishableKey ? publishableKey.slice(0, 12) + "..." + publishableKey.slice(-4) : "(not set)");
  console.log("Webhook Secret:", webhookSecret ? webhookSecret.slice(0, 10) + "..." : "(not set)");
  console.log("Mode:", secretKey?.startsWith("sk_test_") ? "TEST" : secretKey?.startsWith("sk_live_") ? "LIVE" : "UNKNOWN");
  console.log();

  try {
    const stripe = require("stripe")(secretKey);

    // Test: fetch account info
    const account = await stripe.accounts.retrieve();
    console.log("✅ Stripe connection successful!");
    console.log("  Account ID:", account.id);
    console.log("  Business Name:", account.business_profile?.name || "(not set)");
    console.log("  Country:", account.country);
    console.log("  Email:", account.email);
    console.log("  Charges Enabled:", account.charges_enabled);
    console.log("  Payouts Enabled:", account.payouts_enabled);

    // Test: list recent payment intents
    const payments = await stripe.paymentIntents.list({ limit: 3 });
    console.log("\n  Recent Payment Intents:", payments.data.length);
    for (const pi of payments.data) {
      console.log(`    - ${pi.id} | ${pi.status} | ${(pi.amount / 100).toFixed(2)} ${pi.currency.toUpperCase()}`);
    }
  } catch (err) {
    console.log("❌ Stripe connection FAILED:", err.message);
    if (err.type === "StripeAuthenticationError") {
      console.log("\n   The API key is invalid or expired.");
      console.log("   Go to https://dashboard.stripe.com/apikeys to get your current keys.");
    }
  }

  console.log("\n=== Done ===\n");
  process.exit(0);
}

main();
