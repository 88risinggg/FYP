-- Align invoice lifecycle and dashboard reporting with the active/void model.
-- This migration retains invoice and validation history for audit purposes.

ALTER TABLE invoice MODIFY COLUMN status
  ENUM(
    'Draft', 'Generated', 'Scheduled', 'Sent', 'Viewed', 'Unpaid',
    'Partially_Paid', 'Paid', 'Overdue', 'Pending Review',
    'Cancelled', 'Void', 'Refunded', 'Failed_Payment'
  ) DEFAULT 'Draft';

ALTER TABLE invoice ADD COLUMN IF NOT EXISTS void_reason VARCHAR(500) NULL;
ALTER TABLE invoice ADD COLUMN IF NOT EXISTS voided_by INT NULL;
ALTER TABLE invoice ADD COLUMN IF NOT EXISTS voided_at DATETIME NULL;
ALTER TABLE invoice ADD COLUMN IF NOT EXISTS deleted_at DATETIME NULL;

-- NULL Order IDs remain valid for manually-created invoices. A non-NULL
-- Vaniday order can be officially invoiced only once.
CREATE UNIQUE INDEX IF NOT EXISTS uq_invoice_vaniday_order
  ON invoice (vaniday_order_id);

-- Upload validation state is stored in audit_logs. The dashboard selects the
-- newest validation result per file, so corrected re-validations supersede
-- previous error counts without deleting audit history.
