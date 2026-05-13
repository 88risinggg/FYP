USE paynivo;

INSERT INTO roles (name) VALUES
('Admin'), ('Finance'), ('HR'), ('Staff');

INSERT INTO users (role_id, name, email, password_hash) VALUES
((SELECT id FROM roles WHERE name = 'Admin'), 'Alicia Admin', 'admin@paynivo.com', '$2b$10$demo_hash_replace_before_production'),
((SELECT id FROM roles WHERE name = 'Finance'), 'Farid Finance', 'finance@paynivo.com', '$2b$10$demo_hash_replace_before_production'),
((SELECT id FROM roles WHERE name = 'HR'), 'Hana HR', 'hr@paynivo.com', '$2b$10$demo_hash_replace_before_production'),
((SELECT id FROM roles WHERE name = 'Staff'), 'Siti Staff', 'staff@paynivo.com', '$2b$10$demo_hash_replace_before_production');

INSERT INTO staff_profiles (user_id, staff_id, staff_name, email, phone, department, work_location) VALUES
((SELECT id FROM users WHERE email = 'staff@paynivo.com'), 'STF001', 'Siti Staff', 'staff@paynivo.com', '+65 8123 4567', 'Operations', 'Singapore HQ'),
(NULL, 'STF002', 'Marcus Tan', 'marcus@example.com', '+65 9234 5678', 'Sales', 'Tampines Branch');

INSERT INTO payroll_rate_configs (employee_cpf_rate, employer_cpf_rate, sdl_rate, default_allowance_rate, default_deduction_rate)
VALUES (0.2000, 0.1700, 0.0025, 100.00, 50.00);

INSERT INTO automation_settings (payslip_auto_email_enabled, payslip_email_day, invoice_auto_email_enabled, invoice_email_day, reminder_1_days_after_due, reminder_2_days_after_due, whatsapp_enabled)
VALUES (TRUE, 28, TRUE, 1, 3, 7, FALSE);

INSERT INTO customers (name, email, phone, billing_address) VALUES
('Acme Retail Pte Ltd', 'billing@acmeretail.test', '+65 6000 1111', '1 Demo Street, Singapore'),
('Bright Services LLP', 'accounts@brightservices.test', '+65 6000 2222', '2 Prototype Road, Singapore');

INSERT INTO audit_logs (actor_email, action, module, details) VALUES
('system@paynivo.com', 'Seed demo users', 'System', 'Initial FYP prototype data');
