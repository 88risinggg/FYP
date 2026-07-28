CREATE TABLE IF NOT EXISTS account_action_requests (
  request_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  user_name VARCHAR(255) NOT NULL,
  user_email VARCHAR(255) NOT NULL,
  request_type VARCHAR(40) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  requested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMP NULL,
  reviewed_by INT NULL,
  review_note VARCHAR(500) NULL,
  INDEX idx_account_requests_user (user_id, request_type, status),
  INDEX idx_account_requests_status (request_type, status, requested_at)
);
