# Entity Relationship Diagram (ERD)

## Top 10 Most Related Tables

```mermaid
erDiagram
    companies {
        INT company_id PK
        VARCHAR company_name
        INT owner_user_id FK
        VARCHAR display_name
        VARCHAR legal_name
        VARCHAR currency
        VARCHAR timezone
        VARCHAR brand_color
        VARCHAR logo_path
        VARCHAR setup_status
        JSON subscription_settings_json
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    user {
        INT user_id PK
        INT company_id FK
        VARCHAR name
        VARCHAR email
        VARCHAR password
        VARCHAR role_name
        TINYINT status
        TINYINT must_change_password
        TINYINT two_fa_enabled
        VARCHAR two_fa_method
        TINYINT analytics_tracking
        TINYINT profile_visible
        TINYINT activity_visible
        TINYINT analytics_cookies
        TINYINT marketing_cookies
        JSON notification_preferences
        JSON connected_accounts_json
        JSON login_sessions_json
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    staff {
        INT employee_id PK
        INT company_id FK
        INT user_user_id FK
        VARCHAR employee_code
        VARCHAR name
        VARCHAR email
        VARCHAR phone
        VARCHAR department_name
        DATE hire_date
        DATE date_of_birth
        VARCHAR race
        VARCHAR religion
        DECIMAL base_salary
        TINYINT status
        VARCHAR bank
        VARCHAR account_no
        TIMESTAMP created_at
    }

    customer {
        INT customer_id PK
        INT company_id FK
        VARCHAR name
        VARCHAR email
        VARCHAR address
        TIMESTAMP created_at
    }

    invoice {
        INT invoice_id PK
        VARCHAR invoiceId
        INT customer_id FK
        INT company_id FK
        INT subscription_id FK
        VARCHAR status
        DATE issue_date
        DATE due_date
        DECIMAL total_amount
        JSON items_json
        DATETIME scheduled_at
        INT risk_score
        VARCHAR risk_level
        VARCHAR review_status
        JSON fraud_indicators_json
        TIMESTAMP created_at
    }

    payment {
        INT payment_id PK
        INT invoice_invoice_id FK
        DECIMAL amount
        VARCHAR status
        VARCHAR transaction_id
        VARCHAR payment_method_name
        DATETIME payment_date
        TIMESTAMP created_at
    }

    subscriptions {
        INT subscription_id PK
        INT customer_id FK
        INT company_id FK
        VARCHAR plan_name
        VARCHAR description
        DECIMAL amount
        VARCHAR billing_frequency
        DATE start_date
        DATE next_billing_date
        DATE end_date
        TINYINT auto_renew
        TINYINT auto_send
        VARCHAR status
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    payroll {
        INT payroll_id PK
        INT staff_employee_id FK
        INT payroll_run_id FK
        INT company_id FK
        INT payroll_month
        INT payroll_year
        DECIMAL gross_salary
        DECIMAL total_allowances
        DECIMAL total_deductions
        DECIMAL employee_cpf
        DECIMAL employer_cpf
        DECIMAL net_salary
        JSON deduction_breakdown
        VARCHAR payslip_status
        TIMESTAMP created_at
    }

    payroll_run {
        INT payroll_run_id PK
        INT company_id FK
        INT configuration_id FK
        VARCHAR status
        DATETIME approved_at
        VARCHAR payment_reference
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    audit_logs {
        INT audit_log_id PK
        INT company_id FK
        INT user_id FK
        VARCHAR module
        VARCHAR activity_type
        VARCHAR action_description
        VARCHAR affected_record
        VARCHAR status
        VARCHAR ip_address
        VARCHAR device_info
        TIMESTAMP created_at
    }

    %% ─── Relationships ───────────────────────────────────────

    companies ||--o{ user : "employs"
    companies ||--o{ staff : "has employees"
    companies ||--o{ customer : "has clients"
    companies ||--o{ invoice : "issues"
    companies ||--o{ subscriptions : "manages"
    companies ||--o{ payroll : "processes"
    companies ||--o{ payroll_run : "executes"
    companies ||--o{ audit_logs : "tracks"

    user ||--o| staff : "linked to"
    user ||--o{ audit_logs : "performs"

    customer ||--o{ invoice : "receives"
    customer ||--o{ subscriptions : "subscribes to"

    invoice ||--o{ payment : "paid by"
    subscriptions ||--o{ invoice : "generates"

    staff ||--o{ payroll : "has payslips"
    payroll_run ||--o{ payroll : "contains"
```

## Relationship Summary

| From | To | Type | FK Column |
|------|------|------|-----------|
| companies | user | 1:N | user.company_id |
| companies | staff | 1:N | staff.company_id |
| companies | customer | 1:N | customer.company_id |
| companies | invoice | 1:N | invoice.company_id |
| companies | subscriptions | 1:N | subscriptions.company_id |
| companies | payroll | 1:N | payroll.company_id |
| companies | payroll_run | 1:N | payroll_run.company_id |
| companies | audit_logs | 1:N | audit_logs.company_id |
| user | staff | 1:1 (optional) | staff.user_user_id |
| user | audit_logs | 1:N | audit_logs.user_id |
| customer | invoice | 1:N | invoice.customer_id |
| customer | subscriptions | 1:N | subscriptions.customer_id |
| invoice | payment | 1:N | payment.invoice_invoice_id |
| subscriptions | invoice | 1:N | invoice.subscription_id |
| staff | payroll | 1:N | payroll.staff_employee_id |
| payroll_run | payroll | 1:N | payroll.payroll_run_id |

## Notes

- **Multi-tenant design**: All tables are scoped by `company_id` for tenant isolation.
- **companies** is the central tenant table — all other entities belong to a company.
- **user** and **staff** have an optional 1:1 link (a staff member may or may not have a login account).
- **invoice** items are stored as JSON (`items_json`) on the invoice row for simplicity.
- **subscriptions** automatically generate invoices on billing dates.
- **payment** references the invoice it settles; payment method is stored inline as a name string.
- **payroll_run** groups individual **payroll** records (one per employee per month) into a batch for approval and processing.
