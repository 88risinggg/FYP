/**
 * Settings Routes
 *
 * All routes require authentication. Provides REST API for
 * the complete settings module.
 */

const express = require("express");
const { authenticateToken } = require("../middleware/authMiddleware");
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

// Appearance & Language
router.get("/appearance", settingsController.getAppearance);
router.put("/appearance", settingsController.updateAppearance);

// API & Integrations
router.get("/api-keys", settingsController.getApiSettings);
router.post("/api-keys/generate", settingsController.generateApiKey);
router.put("/api-keys", settingsController.updateApiSettings);

// Danger Zone
router.post("/deactivate", settingsController.deactivateAccount);
router.post("/delete-account", settingsController.deleteAccount);

module.exports = router;
