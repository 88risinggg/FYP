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
