/**
 * EVALUATION HEADER
 * FEATURE: INVOICE - SHARED
 * PURPOSE: Provides reusable admin Subscription Settings Service business or integration operations.
 * LAYER: Frontend service - calls backend APIs or manages browser-side application state.
 * FIND RELATED CODE: Search the API path in server/src/routes to continue into the backend.
 */
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
