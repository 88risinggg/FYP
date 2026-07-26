import { apiRequest } from "./apiClient.js";

const SETTINGS_PATH = "/api/admin/invoicing/subscription-settings";

export function getAdminSubscriptionSettings() {
  return apiRequest(SETTINGS_PATH);
}

export function updateAdminSubscriptionSettings(payload) {
  return apiRequest(SETTINGS_PATH, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}
