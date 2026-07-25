/**
 * Settings Routes
 *
 * All routes require authentication. Provides REST API for
 * the complete settings module.
 */

const express = require("express");
const { authenticateToken, requireRole } = require("../middleware/authMiddleware");
const settingsController = require("../controllers/settingsController");

const router = express.Router();

// All settings routes require authentication
router.use(authenticateToken);

// Profile
router.get("/profile", settingsController.getProfile);
router.put("/profile", settingsController.updateProfile);

// Password & Security
router.post("/change-password", settingsController.changePassword);
router.get("/2fa", settingsController.get2FA);
router.put("/2fa", settingsController.update2FA);
router.post("/2fa/recovery-codes", settingsController.generateRecoveryCodes);

// OTP Verification
router.post("/send-otp", settingsController.sendOtp);
router.post("/verify-otp", settingsController.verifyOtp);

// Connected Accounts
router.get("/connected-accounts", settingsController.getConnectedAccounts);
router.post("/connect/:provider", settingsController.connectAccount);
router.post("/disconnect/:provider", settingsController.disconnectAccount);

// Notification Settings
router.get("/notifications", settingsController.getNotifications);
router.put("/notifications", settingsController.updateNotifications);

// Invoice Settings
router.get("/invoice", settingsController.getInvoiceSettings);
router.put("/invoice", settingsController.updateInvoiceSettings);

// Payroll Settings
router.get("/payroll", settingsController.getPayrollSettings);
router.put("/payroll", settingsController.updatePayrollSettings);

// Company Settings
router.get("/company", settingsController.getCompanySettings);
router.put("/company", settingsController.updateCompanySettings);

// Login Sessions
router.get("/sessions", settingsController.getSessions);
router.delete("/sessions/:id", settingsController.deleteSession);
router.post("/logout-all", settingsController.logoutAll);

// Audit Logs
router.get("/audit-logs", settingsController.getAuditLogs);

// Subscription Settings
router.get("/subscription", settingsController.getSubscriptionSettings);
router.put("/subscription", settingsController.updateSubscriptionSettings);

// Payment Settings
router.get("/payment", settingsController.getPaymentSettings);
router.put("/payment", settingsController.updatePaymentSettings);

// Email Settings
router.get("/email", settingsController.getEmailSettings);
router.put("/email", settingsController.updateEmailSettings);
router.post("/email/test", settingsController.sendTestEmail);

// Appearance & Language
router.get("/appearance", settingsController.getAppearance);
router.put("/appearance", settingsController.updateAppearance);

// API & Integrations
router.get("/api-keys", settingsController.getApiSettings);
router.post("/api-keys/generate", settingsController.generateApiKey);
router.put("/api-keys", settingsController.updateApiSettings);

// Data & Privacy
router.get("/privacy", settingsController.getPrivacy);
router.put("/privacy", settingsController.updatePrivacy);
router.get("/privacy/export", settingsController.exportPersonalData);
router.post("/privacy/data-request", settingsController.requestAccountData);

// Danger Zone
router.post("/deactivate", settingsController.deactivateAccount);
router.post("/delete-account", settingsController.deleteAccount);
router.post("/reset-settings", settingsController.resetSettings);
router.get("/deletion-requests", requireRole("Admin"), settingsController.getDeletionRequests);
router.post("/deletion-requests/:id/review", requireRole("Admin"), settingsController.reviewDeletionRequest);

module.exports = router;
