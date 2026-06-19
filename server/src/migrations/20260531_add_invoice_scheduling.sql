ALTER TABLE invoice
  MODIFY status VARCHAR(20) NOT NULL DEFAULT 'Draft',
  ADD COLUMN scheduled_at DATETIME NULL AFTER created_at;

CREATE INDEX idx_invoice_scheduled_due
  ON invoice (status, scheduled_at);
