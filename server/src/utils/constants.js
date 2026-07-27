/**
 * Shared constants extracted from the legacy in-memory data store.
 */

// Payslip status workflow: draft → finance_pending → finance_approved → sent_to_staff
const PAYSLIP_STATUSES = {
  DRAFT: "draft",
  FINANCE_PENDING: "finance_pending",
  FINANCE_APPROVED: "finance_approved",
  SENT_TO_STAFF: "sent_to_staff",
  REJECTED: "rejected",
};

module.exports = {
  PAYSLIP_STATUSES,
};
