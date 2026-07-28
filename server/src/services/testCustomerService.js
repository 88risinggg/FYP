/**
 * Test Customer Service
 *
 * Provides a reusable method for retrieving the "Test Customer" from the database.
 * Used for development/test integration testing of Stripe, SMTP, and WhatsApp.
 *
 * Lookup priority:
 *   1. Environment variable TEST_CUSTOMER_ID (if set)
 *   2. Exact name match "Test Customer" (development/test only)
 *   3. Returns clear configuration error if not found
 *
 * NEVER:
 *   - Falls back to the first available customer
 *   - Silently replaces a missing test customer with a real customer
 *   - Automatically selects Test Customer in production
 */

const { pool } = require("../config/db");

const TEST_CUSTOMER_NAME = "Test Customer";

/**
 * Retrieve the Test Customer from the database.
 *
 * @returns {Object} Test customer with all integration-relevant fields.
 * @throws {Error} If Test Customer cannot be found or environment is production.
 */
async function getTestCustomer() {
  const env = (process.env.NODE_ENV || "development").toLowerCase();

  if (env === "production") {
    throw new Error("Test Customer is not available in production mode. Select an actual customer and invoice.");
  }

  let customerId = null;

  // Priority 1: Configured TEST_CUSTOMER_ID
  if (process.env.TEST_CUSTOMER_ID) {
    customerId = Number(process.env.TEST_CUSTOMER_ID);
    if (!customerId || customerId <= 0) {
      throw new Error("TEST_CUSTOMER_ID environment variable is set but invalid.");
    }
  }

  let customer = null;

  if (customerId) {
    const [rows] = await pool.query(
      `SELECT customer_id, name, email, address, phone, whatsapp_number,
              stripe_customer_id, company_id, created_at
       FROM customer WHERE customer_id = ? LIMIT 1`,
      [customerId]
    );
    customer = rows[0] || null;

    if (!customer) {
      throw new Error(`Test Customer with ID ${customerId} not found in the database. Check TEST_CUSTOMER_ID.`);
    }
  } else {
    // Priority 2: Exact name match (development/test only)
    if (!["development", "test"].includes(env)) {
      throw new Error("Test Customer name-based lookup is only available in development or test environments.");
    }

    const [rows] = await pool.query(
      `SELECT customer_id, name, email, address, phone, whatsapp_number,
              stripe_customer_id, company_id, created_at
       FROM customer WHERE name = ? LIMIT 1`,
      [TEST_CUSTOMER_NAME]
    );
    customer = rows[0] || null;

    if (!customer) {
      throw new Error(
        `Test Customer "${TEST_CUSTOMER_NAME}" not found in the database. ` +
        "Run: node scripts/add-test-customer.js"
      );
    }
  }

  return {
    customerId: customer.customer_id,
    name: customer.name,
    email: customer.email,
    phone: customer.phone || customer.whatsapp_number || null,
    whatsappNumber: customer.whatsapp_number || customer.phone || null,
    address: customer.address,
    stripeCustomerId: customer.stripe_customer_id || null,
    companyId: customer.company_id,
    createdAt: customer.created_at
  };
}

/**
 * Check if a given customer_id is the Test Customer.
 * Useful for guard checks in production.
 *
 * @param {number} customerId
 * @returns {boolean}
 */
async function isTestCustomer(customerId) {
  if (process.env.TEST_CUSTOMER_ID) {
    return Number(customerId) === Number(process.env.TEST_CUSTOMER_ID);
  }
  const [rows] = await pool.query(
    "SELECT customer_id FROM customer WHERE customer_id = ? AND name = ? LIMIT 1",
    [customerId, TEST_CUSTOMER_NAME]
  );
  return rows.length > 0;
}

module.exports = {
  getTestCustomer,
  isTestCustomer,
  TEST_CUSTOMER_NAME
};
