/**
 * Subscription Routes
 *
 * RESTful endpoints for subscription management.
 * All routes require authentication (JWT) and are available to Admin/Finance roles.
 *
 * Finance users create subscriptions manually via the Create Subscription form.
 */

const express = require("express");
const { authenticateToken } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/rolesMiddleware");
const {
  createSubscriptionHandler,
  getSubscriptions,
  getSubscriptionById,
  getSubscriptionDashboard,
  getSubscriptionInvoices,
  getSubscriptionPayments,
  updateSubscriptionHandler,
  pauseSubscriptionHandler,
  resumeSubscriptionHandler,
  cancelSubscriptionHandler,
  deleteSubscriptionHandler,
  generateInvoiceNowHandler,
} = require("../controllers/subscriptionController");

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// ─── Dashboard ────────────────────────────────────────────────────────────────
router.get("/dashboard", allowRoles("Admin", "Finance"), getSubscriptionDashboard);

// ─── Create ───────────────────────────────────────────────────────────────────
router.post("/", allowRoles("Admin", "Finance"), createSubscriptionHandler);

// ─── Read ─────────────────────────────────────────────────────────────────────
router.get("/",    allowRoles("Admin", "Finance"), getSubscriptions);
router.get("/:id", allowRoles("Admin", "Finance"), getSubscriptionById);

// ─── Update ───────────────────────────────────────────────────────────────────
router.put("/:id", allowRoles("Admin", "Finance"), updateSubscriptionHandler);
router.delete("/:id", allowRoles("Admin", "Finance"), deleteSubscriptionHandler);

// ─── Status transitions ──────────────────────────────────────────────────────
router.patch("/:id/pause",  allowRoles("Admin", "Finance"), pauseSubscriptionHandler);
router.patch("/:id/resume", allowRoles("Admin", "Finance"), resumeSubscriptionHandler);
router.patch("/:id/cancel", allowRoles("Admin", "Finance"), cancelSubscriptionHandler);

// ─── Manual invoice generation override ──────────────────────────────────────
router.post("/:id/generate-invoice", allowRoles("Admin", "Finance"), generateInvoiceNowHandler);

// ─── Related data ────────────────────────────────────────────────────────────
router.get("/:id/invoices", allowRoles("Admin", "Finance"), getSubscriptionInvoices);
router.get("/:id/payments", allowRoles("Admin", "Finance"), getSubscriptionPayments);

module.exports = router;
