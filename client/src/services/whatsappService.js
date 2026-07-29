/**
 * EVALUATION HEADER
 * FEATURE: INVOICE - SHARED
 * PURPOSE: Provides reusable whatsapp Service business or integration operations.
 * LAYER: Frontend service - calls backend APIs or manages browser-side application state.
 * FIND RELATED CODE: Search the API path in server/src/routes to continue into the backend.
 */
/**
 * WhatsApp Integration Service (Client - Refactored)
 *
 * API client for the new role-based WhatsApp integration.
 * Admin endpoints: /api/whatsapp/admin/*
 * Finance endpoints: /api/whatsapp/finance/*
 */

import { apiRequest } from "./apiClient.js";

// ─── Admin Endpoints ──────────────────────────────────────────────────────────

export async function getWhatsAppConfig() {
  return apiRequest("/api/whatsapp/admin/config");
}

export async function saveWhatsAppConfig(config) {
  return apiRequest("/api/whatsapp/admin/config", {
    method: "PUT",
    body: JSON.stringify(config)
  });
}

export async function toggleWhatsApp(is_enabled) {
  return apiRequest("/api/whatsapp/admin/toggle", {
    method: "PUT",
    body: JSON.stringify({ is_enabled })
  });
}

export async function testWhatsAppConnection() {
  return apiRequest("/api/whatsapp/admin/test-connection", { method: "POST" });
}

export async function sendWhatsAppTestMessage(phone) {
  return apiRequest("/api/whatsapp/admin/test-message", {
    method: "POST",
    body: JSON.stringify({ phone })
  });
}

export async function getWhatsAppIntegrationLogs(params = {}) {
  const query = new URLSearchParams();
  if (params.page) query.set("page", params.page);
  if (params.limit) query.set("limit", params.limit);
  const qs = query.toString();
  return apiRequest(`/api/whatsapp/admin/logs${qs ? `?${qs}` : ""}`);
}

export async function getWhatsAppNotificationRules() {
  return apiRequest("/api/whatsapp/admin/notification-rules");
}

export async function updateWhatsAppNotificationRule(ruleType, updates) {
  return apiRequest(`/api/whatsapp/admin/notification-rules/${ruleType}`, {
    method: "PUT",
    body: JSON.stringify(updates)
  });
}

export async function getWhatsAppTemplates(templateType) {
  const qs = templateType ? `?template_type=${templateType}` : "";
  return apiRequest(`/api/whatsapp/admin/templates${qs}`);
}

export async function createWhatsAppTemplate(template) {
  return apiRequest("/api/whatsapp/admin/templates", {
    method: "POST",
    body: JSON.stringify(template)
  });
}

export async function updateWhatsAppTemplate(id, updates) {
  return apiRequest(`/api/whatsapp/admin/templates/${id}`, {
    method: "PUT",
    body: JSON.stringify(updates)
  });
}

export async function deleteWhatsAppTemplate(id) {
  return apiRequest(`/api/whatsapp/admin/templates/${id}`, { method: "DELETE" });
}

export async function setDefaultWhatsAppTemplate(id) {
  return apiRequest(`/api/whatsapp/admin/templates/${id}/default`, { method: "PUT" });
}

// ─── Finance Endpoints ────────────────────────────────────────────────────────

export async function getWhatsAppFinanceStatus() {
  return apiRequest("/api/whatsapp/finance/status");
}

export async function sendInvoiceWhatsApp(invoiceId, recipientPhone) {
  return apiRequest(`/api/whatsapp/finance/send-invoice/${invoiceId}`, {
    method: "POST",
    body: JSON.stringify(recipientPhone ? { recipient_phone: recipientPhone } : {})
  });
}

export async function sendReminderWhatsApp(invoiceId, recipientPhone) {
  return apiRequest(`/api/whatsapp/finance/send-reminder/${invoiceId}`, {
    method: "POST",
    body: JSON.stringify(recipientPhone ? { recipient_phone: recipientPhone } : {})
  });
}

export async function sendOverdueWhatsApp(invoiceId, recipientPhone) {
  return apiRequest(`/api/whatsapp/finance/send-overdue/${invoiceId}`, {
    method: "POST",
    body: JSON.stringify(recipientPhone ? { recipient_phone: recipientPhone } : {})
  });
}

export async function sendConfirmationWhatsApp(invoiceId, recipientPhone) {
  return apiRequest(`/api/whatsapp/finance/send-confirmation/${invoiceId}`, {
    method: "POST",
    body: JSON.stringify(recipientPhone ? { recipient_phone: recipientPhone } : {})
  });
}

export async function getWhatsAppInvoiceHistory(invoiceId) {
  return apiRequest(`/api/whatsapp/finance/history/${invoiceId}`);
}

export async function getWhatsAppMessages(params = {}) {
  const query = new URLSearchParams();
  if (params.page) query.set("page", params.page);
  if (params.limit) query.set("limit", params.limit);
  if (params.search) query.set("search", params.search);
  if (params.message_type) query.set("message_type", params.message_type);
  if (params.status) query.set("status", params.status);
  const qs = query.toString();
  return apiRequest(`/api/whatsapp/finance/messages${qs ? `?${qs}` : ""}`);
}

export async function getWhatsAppDashboard() {
  return apiRequest("/api/whatsapp/finance/dashboard");
}

export async function getWhatsAppDeliveryStatus(invoiceId) {
  return apiRequest(`/api/whatsapp/finance/delivery-status/${invoiceId}`);
}

export async function resendWhatsAppMessage(messageId) {
  return apiRequest(`/api/whatsapp/finance/resend/${messageId}`, { method: "POST" });
}
