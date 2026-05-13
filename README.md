# PayNivo

PayNivo is a Final Year Project prototype for a responsive web-based Automated Invoicing and Payroll System for SMEs.

This is a prototype, not a production system. It uses hardcoded demo accounts and in-memory data so the main workflows can be demonstrated quickly.

## Tech Stack

- Frontend: React.js with Vite
- Backend: Node.js with Express.js
- Database target: MySQL
- Excel upload: Multer + ExcelJS
- PDF generation: Puppeteer
- Email: Nodemailer
- Authentication target: JWT + bcrypt
- Payments: Stripe, PayNow, bank transfer placeholders

## Project Structure

```text
PayNivo/
  frontend/
  backend/
    src/
      middleware/
      routes/
        adminRoutes.js
        financeRoutes.js
        hrRoutes.js
        staffRoutes.js
        payrollRoutes.js
        invoiceRoutes.js
        paymentRoutes.js
        emailRoutes.js
        reportRoutes.js
        auditRoutes.js
        settingsRoutes.js
        legacyRoutes.js
      services/
      utils/
    database/
      schema.sql
      seed.sql
```

## Route Organisation

The backend is separated for GitHub review:

- Role routes: `adminRoutes.js`, `financeRoutes.js`, `hrRoutes.js`, `staffRoutes.js`
- Payroll feature routes: `payrollRoutes.js`
- Invoicing feature routes: `invoiceRoutes.js`, `paymentRoutes.js`, `emailRoutes.js`
- Admin/management support: `settingsRoutes.js`, `reportRoutes.js`, `auditRoutes.js`
- Shared access control: `middleware/auth.js`
- Backward-compatible old frontend URLs: `legacyRoutes.js`

## Demo Accounts

Use any of these emails on the login page. The password is ignored in the prototype.

- `admin@paynivo.com`
- `finance@paynivo.com`
- `hr@paynivo.com`
- `staff@paynivo.com`

Each account redirects to its own dashboard.

## Run Backend

```bash
cd backend
npm install
copy .env.example .env
npm run dev
```

Backend URL:

```text
http://localhost:4001
```

## Run Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend URL:

```text
http://127.0.0.1:4173
```

If the backend is on a different port, create `frontend/.env`:

```env
VITE_API_URL=http://localhost:4001
```

Note: for this workspace, `npm run dev` builds the Vite app and serves it with `vite preview`. This avoids a OneDrive path permission issue in Vite's hot dev dependency optimizer while keeping the prototype runnable.

## MySQL Setup

Create the database and tables:

```bash
mysql -u root -p < backend/database/schema.sql
```

Seed demo data:

```bash
mysql -u root -p < backend/database/seed.sql
```

The current Express prototype uses in-memory arrays for faster demonstration. The schema is ready for the next development phase where routes are connected to MySQL using `mysql2`.

## Payroll Excel Upload Fields

The first sheet must use these header names in row 1:

```text
staff_id
staff_name
email
payroll_month
working_days
no_pay_leave_days
basic_salary
services_commission
product_commission
credit_commission
loan_deduction
other_deduction
```

Validation examples included:

- Missing staff name
- Missing email
- Missing basic salary
- Negative salary amount
- Invalid working days

## Vaniday Invoice CSV Upload Fields

The Finance invoice page can import the provided Vaniday CSV sample. Supported fields include:

```text
seller_id
shop_title
OrderID
paymentMethod
productType
customerId
status
orderStatus
email
customerName
contactNo
qty
serviceName
bookedDate
service_duration
staffId
staffName
Total_Revenue
vanidayCommission
vanidayShare
cashbackFee
cashbackDiscount
salonshare
```

Prototype mapping:

- `OrderID` becomes the invoice number reference.
- `paymentMethod` maps to Stripe, PayNow, or Bank transfer.
- `status` / `orderStatus` maps to invoice status.
- `customerName`, `email`, and `contactNo` become customer details.
- `serviceName`, `qty`, and `Total_Revenue` become invoice item and amount.
- `shop_title`, `seller_id`, commission, Vaniday share, and salon share are stored on the imported invoice object for reporting/demo use.

## Completed Prototype Features

- Mock login for Admin, Finance, HR, and Staff
- Admin-created user accounts as the minimum account creation flow
- Role-specific dashboards
- Responsive layout for desktop and mobile
- Admin user list, audit logs, payroll rate configuration, and reports
- HR staff records, add staff record, Excel payroll upload, manual payroll entry, validation, and payroll table
- System-computed payroll calculations for salary inputs, allowance, CPF, deductions, employer CPF, and net pay
- Configurable payroll rates. Prototype defaults are based on the CPFB 2026 full-rate example for Singapore Citizen/SPR third year and above, age 55 and below: employee CPF 20%, employer CPF 17%.
- Puppeteer PDF payslip generation with download link
- Staff-only payroll and payslip visibility
- Staff contact detail update
- Finance invoice creation, invoice list, status update, invoice email action, payment proof upload, individual payment approval, and bulk payment approval
- Vaniday invoice CSV import for sample booking/order data
- Payment methods included: Stripe, PayNow, and bank transfer
- Nodemailer email functions for payslip, invoice, and two overdue reminder emails
- Automation settings for scheduled payslip emails, invoice emails, reminder timing, and WhatsApp as a disabled future option
- Audit events for login, payroll upload, manual payroll entry, payslip generation, email sent, invoice created, payment proof upload, payment approved, bulk approval, account creation, automation settings, and rate updates
- MySQL schema and seed files for the requested tables

## Placeholders

- Stripe checkout is a UI/API placeholder only
- PayNow and bank transfer proof approval are prototype status changes
- Scheduled auto generation/email stores settings only; production needs a job runner such as cron, BullMQ, or a hosted scheduler
- WhatsApp notification is shown as a future option; email is the priority channel
- Email sends are preview-only unless real SMTP values are added to `.env`
- JWT is implemented for the prototype, but demo login does not verify passwords
- MySQL schema exists, but Express routes currently use in-memory data
- CPF rules are simplified to configured percentage rates. Production should use CPFB tables/calculator rules for age, citizenship/SPR year, wage band, Ordinary Wage ceiling, and Additional Wage ceiling.

## Next Steps For Full Development

- Replace in-memory data with MySQL repositories
- Hash and verify passwords with bcrypt during login
- Add real role-based middleware per route
- Add file storage cleanup and upload history screens
- Add complete CPF, SDL, allowances, and deduction rules
- Add production-safe Puppeteer deployment settings
- Integrate Stripe Checkout and payment webhooks
- Add PayNow QR generation and bank transfer proof uploads
- Add automated tests for payroll calculation and upload validation
