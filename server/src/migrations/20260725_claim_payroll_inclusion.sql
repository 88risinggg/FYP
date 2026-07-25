ALTER TABLE claims_and_loans
  ADD COLUMN IF NOT EXISTS payroll_target_month TINYINT UNSIGNED NULL,
  ADD COLUMN IF NOT EXISTS payroll_target_year SMALLINT UNSIGNED NULL,
  ADD COLUMN IF NOT EXISTS payroll_inclusion_status VARCHAR(32) NULL,
  ADD COLUMN IF NOT EXISTS included_payroll_id BIGINT NULL,
  ADD COLUMN IF NOT EXISTS payroll_approved_at DATETIME NULL,
  ADD COLUMN IF NOT EXISTS payroll_included_at DATETIME NULL;

UPDATE claims_and_loans
SET payroll_inclusion_status = 'historical_external'
WHERE type = 'expense_claim'
  AND status = 'released'
  AND payroll_inclusion_status IS NULL;

CREATE INDEX idx_claim_payroll_queue
  ON claims_and_loans (type, payroll_inclusion_status, payroll_target_year, payroll_target_month, staff_employee_id);
