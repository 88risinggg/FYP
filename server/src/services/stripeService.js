/**
 * Stripe Payment Service
 *
 * Handles Stripe Checkout Session creation and webhook verification.
 * Supports Credit/Debit Card, Apple Pay, Google Pay, and other Stripe methods.
 * Falls back to mock URLs if STRIPE_SECRET_KEY is not configured.
 *
 * Required environment variables:
 * - STRIPE_SECRET_KEY
 * - STRIPE_PUBLISHABLE_KEY (for client-side use)
 * - STRIPE_WEBHOOK_SECRET (for webhook signature verification)
 */

// In-memory throttle: prevent creating multiple sessions for the same invoice
// within a short window (avoids Stripe rate-limit errors during rapid reloads)
const SESSION_CACHE = new Map(); // invoiceId -> { paymentUrl, sessionId, expiresAt }
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCachedSession(invoiceId) {
  const entry = SESSION_CACHE.get(String(invoiceId));
  if (entry && entry.expiresAt > Date.now()) return entry;
  SESSION_CACHE.delete(String(invoiceId));
  return null;
}

function setCachedSession(invoiceId, paymentUrl, sessionId) {
  SESSION_CACHE.set(String(invoiceId), {
    paymentUrl,
    sessionId,
    expiresAt: Date.now() + CACHE_TTL_MS
  });
}

/**
 * Create a Stripe Checkout Session for an invoice.
 * Supports multiple payment methods: Card, Apple Pay, Google Pay, etc.
 *
 * @param {Object} invoice - { invoice_id, invoiceId, total_amount, customer_email }
 * @returns {Object} { paymentUrl, sessionId, provider } or mock URL if Stripe not configured.
 */
async function createCheckoutSession(invoice) {
  const amount = Math.round(Number(invoice.total_amount) * 100); // cents
  const cacheKey = `${invoice.invoiceId || String(invoice.invoice_id)}:${amount}`;

  // Return cached session if still valid (avoids rate limit on rapid reloads)
  const cached = getCachedSession(cacheKey);
  if (cached) {
    console.log(`[STRIPE] Reusing cached session for ${cacheKey}`);
    return { provider: "stripe", paymentUrl: cached.paymentUrl, sessionId: cached.sessionId };
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    // Mock mode — return a test URL
    const mockUrl = `https://checkout.stripe.com/test/${Buffer.from(`${invoice.invoiceId}:${invoice.invoice_id}`).toString("base64url")}`;
    console.log(`[STRIPE] (Demo) Checkout for ${invoice.invoiceId}: ${mockUrl}`);
    const mockSession = { provider: "mock", paymentUrl: mockUrl, sessionId: `cs_test_${Date.now()}` };
    setCachedSession(cacheKey, mockSession.paymentUrl, mockSession.sessionId);
    return mockSession;
  }

  // Real Stripe
  const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: [{
      price_data: {
        currency: "sgd",
        product_data: {
          name: `Invoice ${invoice.invoiceId}`,
          description: `Payment for invoice ${invoice.invoiceId}`
        },
        unit_amount: amount
      },
      quantity: 1
    }],
    mode: "payment",
    success_url: `${process.env.CLIENT_URL || "http://localhost:5173"}/payment/success?invoice=${invoice.invoiceId}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.CLIENT_URL || "http://localhost:5173"}/payment/cancelled?invoice=${invoice.invoiceId}`,
    customer_email: invoice.customer_email || undefined,
    metadata: {
      invoice_id: String(invoice.invoice_id),
      invoiceId: invoice.invoiceId
    },
    expires_at: Math.floor(Date.now() / 1000) + 23 * 60 * 60
  });

  console.log(`[STRIPE] Checkout session created for ${invoice.invoiceId}: ${session.id}`);
  setCachedSession(cacheKey, session.url, session.id);

  return { provider: "stripe", paymentUrl: session.url, sessionId: session.id };
}

/**
 * Retrieve a Stripe Checkout Session to check its status.
 *
 * @param {string} sessionId - Stripe session ID.
 * @returns {Object|null} Session object or null.
 */
async function retrieveSession(sessionId) {
  if (!process.env.STRIPE_SECRET_KEY || !sessionId) return null;

  const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
  try {
    return await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["payment_intent"]
    });
  } catch (err) {
    console.error("[STRIPE] Failed to retrieve session:", err.message);
    return null;
  }
}

/**
 * Verify a Stripe webhook signature and parse the event.
 *
 * @param {Buffer|string} rawBody - Raw request body.
 * @param {string} signature - Stripe-Signature header value.
 * @returns {Object|null} Parsed Stripe event, or null if verification fails.
 */
function verifyWebhookEvent(rawBody, signature) {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    // Demo mode — parse without verification
    try {
      return JSON.parse(typeof rawBody === "string" ? rawBody : rawBody.toString());
    } catch {
      return null;
    }
  }

  const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
  return stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
}

module.exports = {
  createCheckoutSession,
  retrieveSession,
  verifyWebhookEvent
};
