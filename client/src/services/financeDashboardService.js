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
