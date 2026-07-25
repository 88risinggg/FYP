/**
 * WhatsApp Notification Service (Client)
 *
 * API client functions for the WhatsApp Notification module.
 * Uses the shared apiRequest helper for auth headers and error handling.
 */

import { apiRequest } from "./apiClient.js";

const BASE_PATH = "/api/whatsapp-notifications";

// ─── Settings ─────────────────────────────────────────────────────────────────

/**
 * Fetch current WhatsApp notification settings.
 * @returns {Promise<Object>} Settings object.
 */
export async function getWhatsAppSettings() {
  return apiRequest(`${BASE_PATH}/settings`);
}

/**
 * Update WhatsApp notification settings.
 * @param {Object} settings
 * @returns {Promise<Object>}
 */
export async function updateWhatsAppSettings(settings) {
  return apiRequest(`${BASE_PATH}/settings`, {
    method: "PUT",
    body: JSON.stringify(settings)
  });
}

// ─── Send ─────────────────────────────────────────────────────────────────────

/**
 * Manually send a WhatsApp notification for a specific invoice/customer.
 * @param {Object} params - { customer_id, invoice_id, notification_type }
 * @returns {Promise<Object>}
 */
export async function sendWhatsAppNotification(params) {
  return apiRequest(`${BASE_PATH}/send`, {
    method: "POST",
    body: JSON.stringify(params)
  });
}

/**
 * Send a test WhatsApp message.
 * @param {string} phone - Phone number to send test to.
 * @returns {Promise<Object>}
 */
export async function sendWhatsAppTest(phone) {
  return apiRequest(`${BASE_PATH}/test`, {
    method: "POST",
    body: JSON.stringify({ phone })
  });
}

// ─── Logs ─────────────────────────────────────────────────────────────────────

/**
 * Fetch WhatsApp notification logs with filtering and pagination.
 * @param {Object} params - { page, limit, search, notification_type, status, sort_by, sort_order }
 * @returns {Promise<Object>} { logs, total, page, limit, totalPages }
 */
export async function getWhatsAppLogs(params = {}) {
  const query = new URLSearchParams();
  if (params.page) query.set("page", params.page);
  if (params.limit) query.set("limit", params.limit);
  if (params.search) query.set("search", params.search);
  if (params.notification_type) query.set("notification_type", params.notification_type);
  if (params.status) query.set("status", params.status);
  if (params.sort_by) query.set("sort_by", params.sort_by);
  if (params.sort_order) query.set("sort_order", params.sort_order);

  const queryString = query.toString();
  return apiRequest(`${BASE_PATH}/logs${queryString ? `?${queryString}` : ""}`);
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

/**
 * Fetch WhatsApp notification dashboard stats and recent logs.
 * @returns {Promise<Object>} { stats, recentLogs }
 */
export async function getWhatsAppDashboard() {
  return apiRequest(`${BASE_PATH}/dashboard`);
}

// ─── Customer WhatsApp Management ─────────────────────────────────────────────

/**
 * Get customer WhatsApp info.
 * @param {number} customerId
 * @returns {Promise<Object>}
 */
export async function getCustomerWhatsApp(customerId) {
  return apiRequest(`${BASE_PATH}/customers/${customerId}/whatsapp`);
}

/**
 * Update customer WhatsApp number.
 * @param {number} customerId
 * @param {string} whatsappNumber
 * @returns {Promise<Object>}
 */
export async function updateCustomerWhatsApp(customerId, whatsappNumber) {
  return apiRequest(`${BASE_PATH}/customers/${customerId}/whatsapp`, {
    method: "PUT",
    body: JSON.stringify({ whatsapp_number: whatsappNumber })
  });
}

/**
 * Verify customer WhatsApp number by sending a test message.
 * @param {number} customerId
 * @returns {Promise<Object>}
 */
export async function verifyCustomerWhatsApp(customerId) {
  return apiRequest(`${BASE_PATH}/customers/${customerId}/verify-whatsapp`, {
    method: "POST"
  });
}
