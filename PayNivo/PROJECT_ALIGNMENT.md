# PayNivo Project Alignment

## Project Title

Automated Invoicing and Payroll System, Xero-referenced.

## Reference System

Xero Invoicing and Payroll.

## Confirmed Technology Stack

The original brief mentions Laravel, but PayNivo is aligned to the stack confirmed for this implementation:

- Frontend: React
- Backend: Node.js with Express
- Database: MySQL
- PDF generation: Puppeteer
- Excel generation/import/export: ExcelJS
- Email: Nodemailer
- Online payments: Stripe API
- WhatsApp notifications: Meta WhatsApp Cloud API

## Project Objectives

- Automate invoice and payroll generation.
- Enable mass sending, reminders, and alerts.
- Support online invoice viewing and payment.
- Improve efficiency, accuracy, and auditability.
- Store uploaded and generated records for reporting and history.

## User Roles

- Admin: manages users, roles, system settings, audit logs, and configuration.
- Finance: manages invoices, customer billing, payments, reminders, and invoice reports.
- HR: manages payroll uploads, payroll processing, and payslip generation.
- Staff: views payslips and employee self-service information.

## Core Modules

### 1. User and Role Management

- Secure login and authentication.
- Role-based access for Admin, Finance, HR, and Staff.
- Audit logs for key actions.
- Admin controls for creating, updating, activating, and suspending users.

### 2. Invoicing Module

- Create single invoices manually.
- Bulk import invoices from CSV or Excel.
- Auto invoice numbering.
- Invoice status tracking: Draft, Sent, Viewed, Paid, Overdue.
- Generate invoice PDF with Puppeteer.
- Generate invoice Excel exports with ExcelJS.
- Email invoices through Nodemailer.
- Support online invoice viewing links.

### 3. Payroll Module

- Upload payroll data through CSV or Excel.
- Validate uploaded payroll rows.
- Generate payslips as PDF.
- Provide Staff self-service access to payslips.
- Support allowances, deductions, and optional payroll calculations.

### 4. Bulk Upload and Database Integration

- Bulk upload invoices and payroll records.
- Validate files before saving.
- Report row-level errors.
- Store records in MySQL for reporting and history.

### 5. Email, Reminders, and Alerts

- Mass invoice and payslip email sending.
- Automated reminder schedules.
- Email templates and delivery logs.
- Optional WhatsApp notifications through Meta WhatsApp Cloud API.

### 6. Online Payments

- Stripe credit card payments.
- Bank transfer instructions.
- PayNow or manual proof tracking.
- Stripe webhook-based payment status updates.

### 7. Reporting and Dashboards

- Dashboard summaries for invoicing.
- Dashboard summaries for payroll.
- Validation and error reporting.
- Exportable reports for Admin, Finance, and HR.

## Implementation Notes

- Current data is demo/in-memory where full MySQL models are not yet implemented.
- The API structure is designed so in-memory data can be replaced by MySQL repositories later.
- Audit and notification logs are required for accountability and should be stored permanently in MySQL for production.
