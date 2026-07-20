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

export function processBulkInvoiceRows(rows, file, uploadId) {
  return apiRequest("/api/bulk-invoices/process", {
    method: "POST",
    body: JSON.stringify({ rows, file, uploadId })
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

export function fetchFinancialExport() {
  return apiRequest("/api/reports/invoices/export");
}

export function fetchPaymentHistory(invoiceId) {
  return apiRequest(`/api/payments/history/${invoiceId}`);
}

export function fetchStripeConfig() {
  return apiRequest("/api/payments/stripe-config");
}

export function sendInvoiceReminder(invoiceId) {
  return apiRequest(`/api/invoices/${invoiceId}/reminder`, {
    method: "POST"
  });
}

export function fetchReminderHistory(invoiceId) {
  return apiRequest(`/api/invoices/${invoiceId}/reminders`);
}

export function fetchViewHistory(invoiceId) {
  return apiRequest(`/api/invoices/${invoiceId}/views`);
}

// =====================================================
// Vaniday Import Services
// =====================================================

export function parseVanidayFile(file) {
  const formData = new FormData();
  formData.append("file", file);
  return apiRequest("/api/vaniday-import/parse", {
    method: "POST",
    body: formData,
    headers: { "Content-Type": undefined } // Let browser set multipart boundary
  });
}

export function validateVanidayImport(rows, dateFormat, allowReimport = false) {
  return apiRequest("/api/vaniday-import/validate", {
    method: "POST",
    body: JSON.stringify({ rows, dateFormat, allowReimport })
  });
}

export function processVanidayImport(rows, dateFormat, allowReimport = false) {
  return apiRequest("/api/vaniday-import/process", {
    method: "POST",
    body: JSON.stringify({ rows, dateFormat, allowReimport })
  });
}

export function fetchVanidayMapping() {
  return apiRequest("/api/vaniday-import/mapping");
}

export function updateVanidayMapping(mapping) {
  return apiRequest("/api/vaniday-import/mapping", {
    method: "PUT",
    body: JSON.stringify({ mapping })
  });
}

// =====================================================
// Invoice Template Preview (Admin)
// =====================================================

export function fetchTemplatePreview(settings, previewStatus) {
  return apiRequest("/api/admin/invoicing/invoice-settings/template-preview", {
    method: "POST",
    body: JSON.stringify({ settings, previewStatus }),
    rawResponse: true
  });
}

// =====================================================
// Manual Payment Review (Finance)
// =====================================================

export function fetchPendingPaymentReviews() {
  return apiRequest("/api/payments/pending-reviews");
}

export function reviewPaymentSubmission(submissionId, decision, notes = "") {
  return apiRequest(`/api/payments/review/${submissionId}`, {
    method: "POST",
    body: JSON.stringify({ decision, notes })
  });
}

// =====================================================
// Public Invoice Payment Submission (Customer)
// =====================================================

export function submitCustomerPayment(invoiceId, payload, proofFile) {
  const formData = new FormData();
  formData.append("amount", payload.amount);
  formData.append("payment_date", payload.payment_date);
  if (payload.reference_number) formData.append("reference_number", payload.reference_number);
  if (payload.payment_method) formData.append("payment_method", payload.payment_method);
  if (payload.notes) formData.append("notes", payload.notes);
  if (proofFile) formData.append("proof", proofFile);

  return apiRequest(`/api/public/invoice/${invoiceId}/submit-payment`, {
    method: "POST",
    body: formData,
    headers: { "Content-Type": undefined }
  });
}

// =====================================================
// Finance Dashboard
// =====================================================

export function fetchFinanceDashboard() {
  return apiRequest("/api/finance/dashboard");
}
