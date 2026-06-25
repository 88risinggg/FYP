import { apiRequest } from "./apiClient.js";

export function fetchInvoices() {
  return apiRequest("/api/invoices");
}

export function fetchInvoiceCustomers() {
  return apiRequest("/api/invoices/customers");
}

export function fetchCustomers() {
  return apiRequest("/api/customers");
}

export function fetchNextInvoiceNumber() {
  return apiRequest("/api/invoices/next-number");
}

export function createInvoice(payload) {
  return apiRequest("/api/invoices", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function sendInvoice(invoiceId) {
  return apiRequest(`/api/invoices/${invoiceId}/send`, {
    method: "POST"
  });
}

export function scheduleBulkInvoices(invoiceIds, scheduledAt) {
  return apiRequest("/api/invoices/schedule", {
    method: "POST",
    body: JSON.stringify({
      invoice_ids: invoiceIds,
      scheduled_at: scheduledAt
    })
  });
}

export function validateBulkInvoiceRows(rows, file) {
  return apiRequest("/api/bulk-invoices/validate", {
    method: "POST",
    body: JSON.stringify({ rows, file })
  });
}

export function processBulkInvoiceRows(rows, file) {
  return apiRequest("/api/bulk-invoices/process", {
    method: "POST",
    body: JSON.stringify({ rows, file })
  });
}

export function fetchPaymentsWorkspace() {
  return apiRequest("/api/payments");
}

export function recordManualPayment(payload) {
  return apiRequest("/api/payments/manual", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function createStripePaymentLink(invoiceId) {
  return apiRequest("/api/payments/stripe-link", {
    method: "POST",
    body: JSON.stringify({ invoice_id: invoiceId })
  });
}

export function fetchFraudDashboard(filters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, value);
    }
  });

  const query = params.toString();
  return apiRequest(`/api/fraud/dashboard${query ? `?${query}` : ""}`);
}

export function reviewFraudInvoice(invoiceId, decision, notes = "") {
  return apiRequest(`/api/fraud/invoices/${invoiceId}/review`, {
    method: "POST",
    body: JSON.stringify({ decision, notes })
  });
}

export function reassessFraudInvoice(invoiceId, metadata = {}) {
  return apiRequest(`/api/fraud/invoices/${invoiceId}/reassess`, {
    method: "POST",
    body: JSON.stringify({ metadata })
  });
}

export function fetchInvoiceReports() {
  return apiRequest("/api/reports/invoices");
}
