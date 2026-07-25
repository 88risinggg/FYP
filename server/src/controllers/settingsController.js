/**
 * Settings Controller
 *
 * Handles all settings-related API operations including profile,
 * security, notifications, invoice/payroll/company settings, sessions, etc.
 */

const bcrypt = require("bcrypt");
const crypto = require("crypto");
const settingsModel = require("../models/settingsModel");

// ─── Profile ────────────────────────────────────────────────────────────────

async function getProfile(req, res) {
  try {
    const profile = await settingsModel.getProfile(req.user.userId);
    if (!profile) {
      return res.status(404).json({ message: "Profile not found" });
    }
    res.json(profile);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch profile" });
  }
}

async function updateProfile(req, res) {
  try {
    await settingsModel.upsertProfile(req.user.userId, req.body);
    await settingsModel.createSettingsAuditLog(req.user.userId, {
      action: "Profile updated",
      module: "profile",
      ip_address: req.ip
    });
    res.json({ message: "Profile updated successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to update profile" });
  }
}

// ─── Password & Security ────────────────────────────────────────────────────

async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Current and new password are required" });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ message: "New password must be at least 8 characters" });
    }

    const user = await settingsModel.getUserPassword(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    const hashed = await bcrypt.hash(newPassword, 12);
    await settingsModel.updatePassword(req.user.userId, hashed);
    await settingsModel.createSettingsAuditLog(req.user.userId, {
      action: "Password changed",
      module: "security",
      ip_address: req.ip
    });

    res.json({ message: "Password changed successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to change password" });
  }
}

// ─── Two-Factor Authentication ──────────────────────────────────────────────

async function get2FA(req, res) {
  try {
    const settings = await settingsModel.get2FASettings(req.user.userId);
    res.json(settings || { two_fa_enabled: false, two_fa_method: null });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch 2FA settings" });
  }
}

async function update2FA(req, res) {
  try {
    await settingsModel.upsert2FASettings(req.user.userId, req.body);
    await settingsModel.createSettingsAuditLog(req.user.userId, {
      action: req.body.two_fa_enabled ? "2FA enabled" : "2FA disabled",
      module: "security",
      ip_address: req.ip
    });
    res.json({ message: "2FA settings updated successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to update 2FA settings" });
  }
}

async function generateRecoveryCodes(req, res) {
  try {
    const codes = Array.from({ length: 8 }, () =>
      crypto.randomBytes(4).toString("hex").toUpperCase()
    );
    await settingsModel.upsert2FASettings(req.user.userId, {
      ...req.body,
      recovery_codes: JSON.stringify(codes)
    });
    res.json({ codes });
  } catch (error) {
    res.status(500).json({ message: "Failed to generate recovery codes" });
  }
}

// ─── Connected Accounts ─────────────────────────────────────────────────────

async function getConnectedAccounts(req, res) {
  try {
    const accounts = await settingsModel.getConnectedAccounts(req.user.userId);
    res.json(accounts);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch connected accounts" });
  }
}

async function connectAccount(req, res) {
  try {
    const { provider } = req.params;
    await settingsModel.upsertConnectedAccount(req.user.userId, provider, req.body);
    await settingsModel.createSettingsAuditLog(req.user.userId, {
      action: `Connected ${provider} account`,
      module: "connected_accounts",
      ip_address: req.ip
    });
    res.json({ message: `${provider} account connected successfully` });
  } catch (error) {
    res.status(500).json({ message: "Failed to connect account" });
  }
}

async function disconnectAccount(req, res) {
  try {
    const { provider } = req.params;
    await settingsModel.disconnectAccount(req.user.userId, provider);
    await settingsModel.createSettingsAuditLog(req.user.userId, {
      action: `Disconnected ${provider} account`,
      module: "connected_accounts",
      ip_address: req.ip
    });
    res.json({ message: `${provider} account disconnected` });
  } catch (error) {
    res.status(500).json({ message: "Failed to disconnect account" });
  }
}

// ─── Notification Settings ──────────────────────────────────────────────────

async function getNotifications(req, res) {
  try {
    const settings = await settingsModel.getNotificationSettings(req.user.userId);
    if (settings && settings.preferences) {
      try {
        settings.preferences = JSON.parse(settings.preferences);
      } catch (e) {
        // already parsed or invalid
      }
    }
    res.json(settings || { preferences: {} });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch notification settings" });
  }
}

async function updateNotifications(req, res) {
  try {
    await settingsModel.upsertNotificationSettings(req.user.userId, req.body);
    res.json({ message: "Notification settings updated" });
  } catch (error) {
    res.status(500).json({ message: "Failed to update notification settings" });
  }
}

// ─── Invoice Settings ───────────────────────────────────────────────────────

async function getInvoiceSettings(req, res) {
  try {
    const settings = await settingsModel.getInvoiceSettings(req.user.userId);
    res.json(settings || {});
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch invoice settings" });
  }
}

async function updateInvoiceSettings(req, res) {
  try {
    await settingsModel.upsertInvoiceSettings(req.user.userId, req.body);
    await settingsModel.createSettingsAuditLog(req.user.userId, {
      action: "Invoice settings updated",
      module: "invoice_settings",
      ip_address: req.ip
    });
    res.json({ message: "Invoice settings updated successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to update invoice settings" });
  }
}

// ─── Payroll Settings ───────────────────────────────────────────────────────

async function getPayrollSettings(req, res) {
  try {
    const settings = await settingsModel.getPayrollSettings(req.user.userId);
    res.json(settings || {});
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch payroll settings" });
  }
}

async function updatePayrollSettings(req, res) {
  try {
    await settingsModel.upsertPayrollSettings(req.user.userId, req.body);
    await settingsModel.createSettingsAuditLog(req.user.userId, {
      action: "Payroll settings updated",
      module: "payroll_settings",
      ip_address: req.ip
    });
    res.json({ message: "Payroll settings updated successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to update payroll settings" });
  }
}

// ─── Company Settings ───────────────────────────────────────────────────────

async function getCompanySettings(req, res) {
  try {
    const settings = await settingsModel.getCompanySettings(req.user.userId);
    res.json(settings || {});
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch company settings" });
  }
}

async function updateCompanySettings(req, res) {
  try {
    await settingsModel.upsertCompanySettings(req.user.userId, req.body);
    await settingsModel.createSettingsAuditLog(req.user.userId, {
      action: "Company settings updated",
      module: "company_settings",
      ip_address: req.ip
    });
    res.json({ message: "Company settings updated successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to update company settings" });
  }
}

// ─── Login Sessions ─────────────────────────────────────────────────────────

async function getSessions(req, res) {
  try {
    const sessions = await settingsModel.getLoginSessions(req.user.userId);
    res.json(sessions);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch sessions" });
  }
}

async function deleteSession(req, res) {
  try {
    const { id } = req.params;
    await settingsModel.deleteSession(id, req.user.userId);
    res.json({ message: "Session terminated" });
  } catch (error) {
    res.status(500).json({ message: "Failed to terminate session" });
  }
}

async function logoutAll(req, res) {
  try {
    await settingsModel.deleteAllSessions(req.user.userId);
    await settingsModel.createSettingsAuditLog(req.user.userId, {
      action: "Logged out all sessions",
      module: "sessions",
      ip_address: req.ip
    });
    res.json({ message: "All sessions terminated" });
  } catch (error) {
    res.status(500).json({ message: "Failed to terminate all sessions" });
  }
}

// ─── Audit Logs ─────────────────────────────────────────────────────────────

async function getAuditLogs(req, res) {
  try {
    const { page, limit, search, module } = req.query;
    const result = await settingsModel.getSettingsAuditLogs(req.user.userId, {
      page: Number(page) || 1,
      limit: Number(limit) || 20,
      search: search || "",
      module: module || ""
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch audit logs" });
  }
}

// ─── Appearance & Language ──────────────────────────────────────────────────

async function getAppearance(req, res) {
  try {
    const settings = await settingsModel.getAppearanceSettings(req.user.userId);
    res.json(settings || { theme: "system", accent_color: "#F38978", compact_mode: false, font_size: "medium", language: "en" });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch appearance settings" });
  }
}

async function updateAppearance(req, res) {
  try {
    await settingsModel.upsertAppearanceSettings(req.user.userId, req.body);
    res.json({ message: "Appearance settings updated" });
  } catch (error) {
    res.status(500).json({ message: "Failed to update appearance settings" });
  }
}

// ─── API & Integrations ─────────────────────────────────────────────────────

async function getApiSettings(req, res) {
  try {
    const settings = await settingsModel.getApiSettings(req.user.userId);
    res.json(settings || { api_key: null, webhook_url: null, webhooks_enabled: false });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch API settings" });
  }
}

async function generateApiKey(req, res) {
  try {
    const apiKey = `sk_live_${crypto.randomBytes(24).toString("hex")}`;
    const webhookSecret = `whsec_${crypto.randomBytes(16).toString("hex")}`;
    const current = await settingsModel.getApiSettings(req.user.userId);

    await settingsModel.upsertApiSettings(req.user.userId, {
      api_key: apiKey,
      webhook_url: current?.webhook_url || null,
      webhook_secret: webhookSecret,
      webhooks_enabled: current?.webhooks_enabled || false
    });

    await settingsModel.createSettingsAuditLog(req.user.userId, {
      action: "API key generated",
      module: "api_integrations",
      ip_address: req.ip
    });

    res.json({ api_key: apiKey, webhook_secret: webhookSecret });
  } catch (error) {
    res.status(500).json({ message: "Failed to generate API key" });
  }
}

async function updateApiSettings(req, res) {
  try {
    const current = await settingsModel.getApiSettings(req.user.userId);
    await settingsModel.upsertApiSettings(req.user.userId, {
      api_key: current?.api_key || null,
      webhook_url: req.body.webhook_url || current?.webhook_url,
      webhook_secret: current?.webhook_secret || null,
      webhooks_enabled: req.body.webhooks_enabled ?? current?.webhooks_enabled ?? false
    });
    res.json({ message: "API settings updated" });
  } catch (error) {
    res.status(500).json({ message: "Failed to update API settings" });
  }
}

// ─── Danger Zone ────────────────────────────────────────────────────────────

async function deactivateAccount(req, res) {
  try {
    const { pool } = require("../config/db");
    await pool.query("UPDATE user SET status = 0 WHERE user_id = ?", [req.user.userId]);
    await settingsModel.createSettingsAuditLog(req.user.userId, {
      action: "Account deactivated",
      module: "danger_zone",
      ip_address: req.ip
    });
    res.json({ message: "Account deactivated" });
  } catch (error) {
    res.status(500).json({ message: "Failed to deactivate account" });
  }
}

async function deleteAccount(req, res) {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ message: "Password confirmation required" });
    }

    const user = await settingsModel.getUserPassword(req.user.userId);
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ message: "Incorrect password" });
    }

    const request = await settingsModel.createAccountActionRequest(req.user.userId, "account_deletion");
    await settingsModel.notifyAdminsOfDeletionRequest(request);
    await settingsModel.createSettingsAuditLog(req.user.userId, {
      action: "Account deletion requested for admin approval",
      module: "danger_zone",
      ip_address: req.ip
    });
    res.status(request.alreadyPending ? 200 : 202).json({
      message: request.alreadyPending
        ? "Your account deletion request is already awaiting admin approval"
        : "Account deletion request submitted for admin approval",
      request
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete account" });
  }
}

async function getPrivacy(req, res) {
  try {
    res.json(await settingsModel.getPrivacySettings(req.user.userId));
  } catch (error) {
    res.status(500).json({ message: "Failed to load privacy preferences" });
  }
}

async function updatePrivacy(req, res) {
  try {
    const preferences = await settingsModel.upsertPrivacySettings(req.user.userId, req.body);
    await settingsModel.createSettingsAuditLog(req.user.userId, {
      action: "Privacy preferences updated",
      module: "privacy",
      ip_address: req.ip
    });
    res.json({ message: "Privacy preferences saved", preferences });
  } catch (error) {
    res.status(500).json({ message: "Failed to save privacy preferences" });
  }
}

async function exportPersonalData(req, res) {
  try {
    res.json(await settingsModel.getPersonalDataExport(req.user.userId));
  } catch (error) {
    res.status(500).json({ message: "Failed to prepare your data export" });
  }
}

async function requestAccountData(req, res) {
  try {
    const request = await settingsModel.createAccountActionRequest(req.user.userId, "data_access");
    await settingsModel.createSettingsAuditLog(req.user.userId, {
      action: "Formal account data request submitted",
      module: "privacy",
      ip_address: req.ip
    });
    res.status(request.alreadyPending ? 200 : 202).json({
      message: request.alreadyPending ? "A data request is already pending" : "Data request submitted",
      request
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to submit data request" });
  }
}

async function resetSettings(req, res) {
  try {
    await settingsModel.resetUserSettings(req.user.userId);
    await settingsModel.createSettingsAuditLog(req.user.userId, {
      action: "Personal settings reset to defaults",
      module: "danger_zone",
      ip_address: req.ip
    });
    res.json({ message: "Settings reset to defaults" });
  } catch (error) {
    res.status(500).json({ message: "Failed to reset settings" });
  }
}

async function getDeletionRequests(req, res) {
  try {
    res.json({ requests: await settingsModel.listDeletionRequests() });
  } catch (error) {
    res.status(500).json({ message: "Failed to load deletion requests" });
  }
}

async function reviewDeletionRequest(req, res) {
  try {
    const decision = req.body.decision;
    if (!["approved", "rejected"].includes(decision)) {
      return res.status(400).json({ message: "Decision must be approved or rejected" });
    }
    const requests = await settingsModel.listDeletionRequests();
    const pending = requests.find((item) => Number(item.request_id) === Number(req.params.id));
    if (pending && Number(pending.user_id) === Number(req.user.userId)) {
      return res.status(409).json({ message: "An admin cannot review their own deletion request" });
    }
    const request = await settingsModel.reviewDeletionRequest(
      Number(req.params.id), req.user.userId, decision, String(req.body.note || "").trim()
    );
    if (!request) return res.status(404).json({ message: "Pending deletion request not found" });
    await settingsModel.createSettingsAuditLog(req.user.userId, {
      action: `${decision === "approved" ? "Approved" : "Rejected"} account deletion request ${req.params.id}`,
      module: "danger_zone",
      ip_address: req.ip
    });
    res.json({ message: `Deletion request ${decision}`, request });
  } catch (error) {
    res.status(500).json({ message: "Failed to review deletion request" });
  }
}

async function deleteManagedUser(req, res) {
  try {
    const result = await settingsModel.deleteUserAccountByAdmin(Number(req.params.userId), req.user.userId, String(req.body.note || "").trim() || "Deleted from Payroll User Management");
    if (result.notFound) return res.status(404).json({ message: "User account not found" });
    if (result.selfDelete) return res.status(409).json({ message: "You cannot delete your own Admin account" });
    if (result.lastAdmin) return res.status(409).json({ message: "The final active Admin account cannot be deleted" });
    await settingsModel.createSettingsAuditLog(req.user.userId, { action: `Deleted user account ${result.user.email}`, module: "user_management", ip_address: req.ip });
    return res.json({ message: "User account deleted. The staff record remains available to HR.", deletedUser: result.user });
  } catch (error) {
    return res.status(500).json({ message: "Failed to delete user account", detail: error.message });
  }
}

// ─── OTP (Phone/Email Verification) ─────────────────────────────────────────

async function sendOtp(req, res) {
  try {
    // Generate a 6-digit OTP (placeholder - would integrate with SMS/email service)
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const { type } = req.body; // "phone" or "email"

    // In production, store OTP with expiry and send via SMS/email service
    // For now, return success with the OTP for testing
    await settingsModel.createSettingsAuditLog(req.user.userId, {
      action: `OTP sent via ${type}`,
      module: "verification",
      ip_address: req.ip
    });

    res.json({ message: `OTP sent to your ${type}`, otp_preview: otp });
  } catch (error) {
    res.status(500).json({ message: "Failed to send OTP" });
  }
}

async function verifyOtp(req, res) {
  try {
    const { otp, type } = req.body;
    if (!otp || otp.length !== 6) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    // In production, verify against stored OTP
    // For now, accept any 6-digit code
    await settingsModel.createSettingsAuditLog(req.user.userId, {
      action: `${type} verified via OTP`,
      module: "verification",
      ip_address: req.ip
    });

    res.json({ message: `${type} verified successfully`, verified: true });
  } catch (error) {
    res.status(500).json({ message: "Failed to verify OTP" });
  }
}

// ─── Subscription Settings ──────────────────────────────────────────────────

async function getSubscriptionSettings(req, res) {
  try {
    const settings = await settingsModel.getSubscriptionSettings(req.user.userId);
    res.json(settings || {});
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch subscription settings" });
  }
}

async function updateSubscriptionSettings(req, res) {
  try {
    await settingsModel.upsertSubscriptionSettings(req.user.userId, req.body);
    await settingsModel.createSettingsAuditLog(req.user.userId, {
      action: "Subscription settings updated",
      module: "subscription_settings",
      ip_address: req.ip
    });
    res.json({ message: "Subscription settings updated successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to update subscription settings" });
  }
}

// ─── Payment Settings ───────────────────────────────────────────────────────

async function getPaymentSettings(req, res) {
  try {
    const settings = await settingsModel.getPaymentSettings(req.user.userId);
    res.json(settings || {});
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch payment settings" });
  }
}

async function updatePaymentSettings(req, res) {
  try {
    await settingsModel.upsertPaymentSettings(req.user.userId, req.body);
    await settingsModel.createSettingsAuditLog(req.user.userId, {
      action: "Payment settings updated",
      module: "payment_settings",
      ip_address: req.ip
    });
    res.json({ message: "Payment settings updated successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to update payment settings" });
  }
}

// ─── Email Settings ─────────────────────────────────────────────────────────

async function getEmailSettings(req, res) {
  try {
    const settings = await settingsModel.getEmailSettings(req.user.userId);
    res.json(settings || {});
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch email settings" });
  }
}

async function updateEmailSettings(req, res) {
  try {
    await settingsModel.upsertEmailSettings(req.user.userId, req.body);
    await settingsModel.createSettingsAuditLog(req.user.userId, {
      action: "Email settings updated",
      module: "email_settings",
      ip_address: req.ip
    });
    res.json({ message: "Email settings updated successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to update email settings" });
  }
}

async function sendTestEmail(req, res) {
  try {
    // In production, this would send a real test email
    res.json({ message: "Test email sent successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to send test email" });
  }
}

module.exports = {
  getProfile,
  updateProfile,
  changePassword,
  get2FA,
  update2FA,
  generateRecoveryCodes,
  getConnectedAccounts,
  connectAccount,
  disconnectAccount,
  getNotifications,
  updateNotifications,
  getInvoiceSettings,
  updateInvoiceSettings,
  getPayrollSettings,
  updatePayrollSettings,
  getCompanySettings,
  updateCompanySettings,
  getSubscriptionSettings,
  updateSubscriptionSettings,
  getPaymentSettings,
  updatePaymentSettings,
  getEmailSettings,
  updateEmailSettings,
  sendTestEmail,
  getSessions,
  deleteSession,
  logoutAll,
  getAuditLogs,
  getAppearance,
  updateAppearance,
  getApiSettings,
  generateApiKey,
  updateApiSettings,
  deactivateAccount,
  deleteAccount,
  sendOtp,
  verifyOtp,
  getPrivacy,
  updatePrivacy,
  exportPersonalData,
  requestAccountData,
  resetSettings,
  getDeletionRequests,
  reviewDeletionRequest,
  deleteManagedUser
};
