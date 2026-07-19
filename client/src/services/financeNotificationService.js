/**
 * Finance Notification Service
 *
 * Handles fetching, polling, and managing notifications specifically for Finance users.
 * Uses the /api/finance/notifications endpoint which queries the invoice_notification table.
 * Only Finance role users should use this service.
 */

import { apiRequest } from "./apiClient.js";

/**
 * Fetch all notifications for the current Finance user.
 * @returns {Promise<Array>} Array of notification objects.
 */
export async function fetchFinanceNotifications() {
  const data = await apiRequest("/api/finance/notifications");
  return data.notifications || [];
}

/**
 * Get the unread notification count for the current Finance user.
 * @returns {Promise<number>} Unread count.
 */
export async function fetchUnreadCount() {
  const notifications = await fetchFinanceNotifications();
  return notifications.filter((n) => !n.is_read).length;
}

/**
 * Mark a single notification as read.
 * @param {number} notificationId - The notification ID to mark as read.
 * @returns {Promise<Object>} Response object.
 */
export async function markNotificationRead(notificationId) {
  return apiRequest(`/api/finance/notifications/${notificationId}/read`, {
    method: "PUT"
  });
}

/**
 * Mark all notifications as read for the current Finance user.
 * @returns {Promise<Object>} Response object.
 */
export async function markAllNotificationsRead() {
  return apiRequest("/api/finance/notifications/read-all", {
    method: "PUT"
  });
}

/**
 * Start polling for new notifications.
 * Only calls the callback when there are changes.
 *
 * @param {Function} onUpdate - Callback receiving { notifications, unreadCount }.
 * @param {number} intervalMs - Polling interval in milliseconds (default 30s).
 * @returns {Function} Stop function to cancel polling.
 */
export function startNotificationPolling(onUpdate, intervalMs = 30000) {
  let lastCount = -1;
  let stopped = false;

  async function poll() {
    if (stopped) return;
    try {
      const notifications = await fetchFinanceNotifications();
      const unreadCount = notifications.filter((n) => !n.is_read).length;

      // Always update on first poll or when count changes
      if (lastCount !== unreadCount || lastCount === -1) {
        lastCount = unreadCount;
        onUpdate({ notifications, unreadCount });
      }
    } catch {
      // Silently ignore polling errors
    }
  }

  // Initial poll immediately
  poll();

  const timer = setInterval(poll, intervalMs);

  return function stop() {
    stopped = true;
    clearInterval(timer);
  };
}
