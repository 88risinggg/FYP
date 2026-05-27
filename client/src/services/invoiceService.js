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

export function updateInvoiceStatus(invoiceId, status) {
  return apiRequest(`/api/invoices/${invoiceId}/status`, {
    method: "PUT",
    body: JSON.stringify({ status })
  });
}

export function validateBulkInvoiceRows(rows) {
  return apiRequest("/api/bulk-invoices/validate", {
    method: "POST",
    body: JSON.stringify({ rows })
  });
}

export function processBulkInvoiceRows(rows) {
  return apiRequest("/api/bulk-invoices/process", {
    method: "POST",
    body: JSON.stringify({ rows })
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

export function fetchInvoiceReports() {
  return apiRequest("/api/reports/invoices");
}
