const express = require("express");
const {
  createStripePaymentLink,
  getPaymentsWorkspace,
  recordManualPayment,
  stripeWebhook
} = require("../controllers/paymentController");
const { authenticateToken } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/stripe/webhook", stripeWebhook);

router.use(authenticateToken);
router.get("/", getPaymentsWorkspace);
router.post("/manual", recordManualPayment);
router.post("/stripe-link", createStripePaymentLink);

module.exports = router;
