/**
 * EVALUATION HEADER
 * FEATURE: SHARED / APPLICATION CORE
 * PURPOSE: Provides reusable stripe Service business or integration operations.
 * LAYER: Backend service - contains reusable business rules or external integrations.
 * FIND RELATED CODE: Use Find All References to locate controllers, workers, or services that call it.
 */
/**
 * Stripe Payment Service
 *
 * Handles Stripe Checkout Session creation, Stripe Customer management,
 * webhook verification, and session retrieval.
 *
 * Features:
 *   - Stripe Customer creation and reuse (stored as stripe_customer_id on customer table)
 *   - Dynamic currency from invoice/customer (defaults to SGD)
 *   - Idempotency keys to prevent duplicate sessions
 *   - In-memory session cache to avoid Stripe rate-limit issues
 *   - Mock/demo mode when STRIPE_SECRET_KEY is not configured
 *
 * Required environment variables:
 *   - STRIPE_SECRET_KEY
 *   - STRIPE_PUBLISHABLE_KEY (for client-side use)
 *   - STRIPE_WEBHOOK_SECRET (for webhook signature verification)
 */

const { pool } = require("../config/db");

// ─── In-Memory Session Cache ──────────────────────────────────────────────────
// Prevents creating multiple sessions for the same invoice within a short window.
const SESSION_CACHE = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCachedSession(cacheKey) {
  const entry = SESSION_CACHE.get(cacheKey);
  if (entry && entry.expiresAt > Date.now()) return entry;
  SESSION_CACHE.delete(cacheKey);
  return null;
}

function setCachedSession(cacheKey, paymentUrl, sessionId) {
  SESSION_CACHE.set(cacheKey, { paymentUrl, sessionId, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ─── Stripe Instance ──────────────────────────────────────────────────────────

let stripeInstance = null;

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  if (!stripeInstance) {
    stripeInstance = require("stripe")(process.env.STRIPE_SECRET_KEY);
  }
  return stripeInstance;
}

// ─── Stripe Customer Management ───────────────────────────────────────────────

/**
 * Get or create a Stripe Customer for a local customer record.
 * Reuses existing stripe_customer_id when available.
 *
 * @param {Object} customer - { customer_id, name, email, stripe_customer_id }
 * @returns {string|null} Stripe Customer ID, or null if Stripe not configured.
 */
async function getOrCreateStripeCustomer(customer) {
  const stripe = getStripe();
  if (!stripe) return null;

  // Reuse existing Stripe Customer ID
  if (customer.stripe_customer_id) {
    try {
      // Validate the ID is still valid on Stripe
      await stripe.customers.retrieve(customer.stripe_customer_id);
      return customer.stripe_customer_id;
    } catch (err) {
      // Customer was deleted on Stripe — create a new one
      console.log(`[STRIPE] Stored customer ID invalid (${err.message}), creating new one.`);
    }
  }

  // Create a new Stripe Customer
  const stripeCustomer = await stripe.customers.create({
    email: customer.email || undefined,
    name: customer.name || undefined,
    metadata: {
      internal_customer_id: String(customer.customer_id)
    }
  });

  // Store the Stripe Customer ID in the local database
  try {
    await pool.query(
      "UPDATE customer SET stripe_customer_id = ? WHERE customer_id = ?",
      [stripeCustomer.id, customer.customer_id]
    );
  } catch (err) {
    // Non-critical — the column might not exist yet (pre-migration)
    console.error("[STRIPE] Failed to store stripe_customer_id:", err.message);
  }

  return stripeCustomer.id;
}

// ─── Checkout Session Creation ────────────────────────────────────────────────

/**
 * Create a Stripe Checkout Session for an invoice.
 *
 * @param {Object} invoice - { invoice_id, invoiceId, total_amount, customer_email, currency }
 * @param {Object} [options] - { customer_id, customer_name, stripe_customer_id, idempotencyKey }
 * @returns {Object} { paymentUrl, sessionId, provider }
 */
async function createCheckoutSession(invoice, options = {}) {
  const amount = Math.round(Number(invoice.total_amount) * 100); // Convert to smallest unit (cents)
  const currency = (invoice.currency || "sgd").toLowerCase();
  const cacheKey = `${invoice.invoiceId || String(invoice.invoice_id)}:${amount}:${currency}`;

  // Return cached session if still valid (avoids rate limit on rapid reloads)
  const cached = getCachedSession(cacheKey);
  if (cached) {
    return { provider: "stripe", paymentUrl: cached.paymentUrl, sessionId: cached.sessionId };
  }

  const stripe = getStripe();

  if (!stripe) {
    // Mock mode — return a test URL for development without Stripe keys
    const mockUrl = `https://checkout.stripe.com/test/${Buffer.from(`${invoice.invoiceId}:${invoice.invoice_id}`).toString("base64url")}`;
    const mockSession = { provider: "mock", paymentUrl: mockUrl, sessionId: `cs_mock_${Date.now()}` };
    setCachedSession(cacheKey, mockSession.paymentUrl, mockSession.sessionId);
    return mockSession;
  }

  // Get or create Stripe Customer
  let stripeCustomerId = options.stripe_customer_id || null;
  if (!stripeCustomerId && options.customer_id) {
    try {
      stripeCustomerId = await getOrCreateStripeCustomer({
        customer_id: options.customer_id,
        name: options.customer_name,
        email: invoice.customer_email,
        stripe_customer_id: options.stripe_customer_id
      });
    } catch (err) {
      console.error("[STRIPE] Customer creation failed (non-blocking):", err.message);
    }
  }

  // Build session parameters
  const successUrl = process.env.STRIPE_SUCCESS_URL ||
    `${process.env.CLIENT_URL || "http://localhost:5173"}/payment/success?invoice=${invoice.invoiceId}&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = process.env.STRIPE_CANCEL_URL ||
    `${process.env.CLIENT_URL || "http://localhost:5173"}/payment/cancelled?invoice=${invoice.invoiceId}`;

  const sessionParams = {
    payment_method_types: ["card"],
    line_items: [{
      price_data: {
        currency,
        product_data: {
          name: `Invoice ${invoice.invoiceId}`,
          description: `Payment for invoice ${invoice.invoiceId}`
        },
        unit_amount: amount
      },
      quantity: 1
    }],
    mode: "payment",
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      invoice_id: String(invoice.invoice_id),
      invoiceId: invoice.invoiceId,
      customer_id: options.customer_id ? String(options.customer_id) : undefined,
      currency,
      expected_amount: String(amount)
    },
    expires_at: Math.floor(Date.now() / 1000) + 23 * 60 * 60 // 23 hours
  };

  // Attach Stripe Customer (allows reuse and shows in Stripe Dashboard)
  if (stripeCustomerId) {
    sessionParams.customer = stripeCustomerId;
  } else if (invoice.customer_email) {
    sessionParams.customer_email = invoice.customer_email;
  }

  // Use idempotency key to prevent duplicate sessions from rapid clicks
  const createOptions = {};
  const idempotencyKey = options.idempotencyKey || `checkout_${invoice.invoice_id}_${amount}_${Date.now()}`;
  createOptions.idempotencyKey = idempotencyKey;

  const session = await stripe.checkout.sessions.create(sessionParams, createOptions);

  setCachedSession(cacheKey, session.url, session.id);

  return { provider: "stripe", paymentUrl: session.url, sessionId: session.id };
}

// ─── Session Retrieval ────────────────────────────────────────────────────────

/**
 * Retrieve a Stripe Checkout Session to check its status.
 *
 * @param {string} sessionId - Stripe session ID.
 * @returns {Object|null} Session object or null.
 */
async function retrieveSession(sessionId) {
  const stripe = getStripe();
  if (!stripe || !sessionId) return null;

  try {
    return await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["payment_intent"]
    });
  } catch (err) {
    console.error("[STRIPE] Failed to retrieve session:", err.message);
    return null;
  }
}

// ─── Webhook Verification ─────────────────────────────────────────────────────

/**
 * Verify a Stripe webhook signature and parse the event.
 *
 * @param {Buffer|string} rawBody - Raw request body.
 * @param {string} signature - Stripe-Signature header value.
 * @returns {Object|null} Parsed Stripe event, or null if verification fails.
 */
function verifyWebhookEvent(rawBody, signature) {
  const stripe = getStripe();

  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
    // Demo mode — parse without verification (development only)
    try {
      return JSON.parse(typeof rawBody === "string" ? rawBody : rawBody.toString());
    } catch {
      return null;
    }
  }

  return stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
}

// ─── Webhook Event Idempotency ────────────────────────────────────────────────

/**
 * Check if a Stripe webhook event has already been processed.
 *
 * @param {string} eventId - Stripe event ID (evt_xxxx).
 * @returns {Object|null} Existing event record, or null if not yet processed.
 */
async function findProcessedWebhookEvent(eventId) {
  try {
    const [rows] = await pool.query(
      "SELECT id, processing_status, related_invoice_id FROM webhook_events WHERE provider = 'stripe' AND external_event_id = ? LIMIT 1",
      [eventId]
    );
    return rows[0] || null;
  } catch {
    // Table may not exist yet (pre-migration)
    return null;
  }
}

/**
 * Record a webhook event as received.
 *
 * @param {Object} event - Stripe event object.
 * @returns {number|null} Insert ID, or null on failure.
 */
async function recordWebhookEvent(event) {
  try {
    const [result] = await pool.query(
      `INSERT INTO webhook_events (provider, external_event_id, event_type, processing_status, received_at)
       VALUES ('stripe', ?, ?, 'received', NOW())
       ON DUPLICATE KEY UPDATE id = id`,
      [event.id, event.type]
    );
    return result.insertId || null;
  } catch {
    return null;
  }
}

/**
 * Mark a webhook event as processed.
 *
 * @param {string} eventId - Stripe event ID.
 * @param {string} status - 'processed' | 'failed' | 'skipped'
 * @param {Object} [extra] - { relatedPaymentId, relatedInvoiceId, errorMessage }
 */
async function updateWebhookEventStatus(eventId, status, extra = {}) {
  try {
    await pool.query(
      `UPDATE webhook_events SET processing_status = ?, processed_at = NOW(),
       related_payment_id = COALESCE(?, related_payment_id),
       related_invoice_id = COALESCE(?, related_invoice_id),
       error_message = COALESCE(?, error_message)
       WHERE provider = 'stripe' AND external_event_id = ?`,
      [status, extra.relatedPaymentId || null, extra.relatedInvoiceId || null, extra.errorMessage || null, eventId]
    );
  } catch {
    // Non-critical
  }
}

// ─── Configuration Check ──────────────────────────────────────────────────────

/**
 * Check if Stripe is properly configured.
 *
 * @returns {Object} { configured, testMode, webhookConfigured }
 */
function getStripeStatus() {
  const secretKey = process.env.STRIPE_SECRET_KEY || "";
  const configured = secretKey.length > 0;
  const testMode = secretKey.startsWith("sk_test_");
  const liveMode = secretKey.startsWith("sk_live_");
  const webhookConfigured = Boolean(process.env.STRIPE_WEBHOOK_SECRET);

  return {
    configured,
    testMode,
    liveMode,
    webhookConfigured,
    publishableKeySet: Boolean(process.env.STRIPE_PUBLISHABLE_KEY)
  };
}

module.exports = {
  createCheckoutSession,
  findProcessedWebhookEvent,
  getOrCreateStripeCustomer,
  getStripeStatus,
  recordWebhookEvent,
  retrieveSession,
  updateWebhookEventStatus,
  verifyWebhookEvent
};
