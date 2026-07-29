/**
 * EVALUATION HEADER
 * FEATURE: SHARED / APPLICATION CORE
 * PURPOSE: Provides reusable finance Dashboard Service business or integration operations.
 * LAYER: Frontend service - calls backend APIs or manages browser-side application state.
 * FIND RELATED CODE: Search the API path in server/src/routes to continue into the backend.
 */
import { apiRequest } from "./apiClient.js";

export function fetchFinanceDashboard() {
  return apiRequest("/api/finance/dashboard");
}

export function fetchFinanceNotifications() {
  return apiRequest("/api/finance/notifications");
}

export function markNotificationRead(notificationId) {
  return apiRequest(`/api/finance/notifications/${notificationId}/read`, {
    method: "PUT"
  });
}

export function markAllNotificationsRead() {
  return apiRequest("/api/finance/notifications/read-all", {
    method: "PUT"
  });
}
