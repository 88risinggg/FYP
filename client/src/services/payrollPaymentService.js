/**
 * EVALUATION HEADER
 * FEATURE: PAYROLL - SHARED
 * PURPOSE: Provides reusable payroll Payment Service business or integration operations.
 * LAYER: Frontend service - calls backend APIs or manages browser-side application state.
 * FIND RELATED CODE: Search the API path in server/src/routes to continue into the backend.
 */
import { apiRequest } from "./apiClient.js";

export function setupModernTreasuryRecipients(payload) {
  return apiRequest("/api/payroll/payments/modern-treasury-recipients", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function submitModernTreasuryTransfer(payload) {
  return apiRequest("/api/payroll/payments/modern-treasury-transfer", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}
