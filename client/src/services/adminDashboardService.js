import { apiRequest } from "./apiClient.js";
import { getStoredSession } from "./sessionService.js";

function authHeaders() {
  const session = getStoredSession();

  return session?.token ? { Authorization: `Bearer ${session.token}` } : {};
}

export function fetchAdminInvoicingDashboard() {
  return apiRequest("/api/admin/invoicing/dashboard", {
    headers: authHeaders()
  });
}
