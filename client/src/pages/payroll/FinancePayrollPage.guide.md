# FinancePayrollPage.jsx Guide

This guide explains the main function groups in `FinancePayrollPage.jsx` and where to change behaviour during development or evaluation.

## 1. Page Constants And Navigation

Main code area: `pageTitle`, `FINANCE_PAYROLL_STORAGE_KEY`, `payrollSidebarSections`, `routeHeadings`, `workflowSteps`

What it does:
- Sets the browser/page title for the Finance payroll dashboard.
- Defines the Finance sidebar menu items.
- Maps each route path to the heading shown on the page.
- Defines the Finance workflow cards: review, approval, payment, payslips, ledger, reconciliation.

Change here if:
- You want to rename sidebar labels.
- You want to add/remove Finance menu pages.
- You want to rename workflow steps shown on the dashboard.
- You want to change the order of workflow cards.

## 2. Demo Payroll Data And Mock Runs

Main functions/data:
- `initialPayrollRuns`
- `demoEmployeeBankDetails`
- `normalizeDemoEmployeeBankDetails`
- `createMockFinancePayrollRun`
- `getInitialPayrollRuns`
- `createFinancePayrollRunFromStaff` service call

What it does:
- Provides sample payroll runs for the Finance module before HR is connected.
- Stores Finance workflow state in browser `localStorage`.
- Backfills fake bank details for demo employees.
- Creates a new mock payroll run when Finance clicks `Mock Run`.
- Creates DB-backed Finance payroll runs from active `staff` table records when Finance clicks `Staff DB Run`.

Change here if:
- You want to add another sample employee.
- You want to change salary, CPF, deductions, bank name, or bank account.
- You want mock runs to start as `Ready`, `Approved`, or `Submitted for Finance Review`.
- You want mock runs to use another month/year.

Useful edits:
- Change employee pay: edit `earningItems`, `deductionItems`, and `employerItems`.
- Change fake bank data: edit `demoEmployeeBankDetails`.
- Change mock run defaults: edit `createMockFinancePayrollRun`.
- Change DB staff-run mapping: edit `server/src/models/financePayrollModel.js`.

## 3. Date, Money And Filter Helpers

Main functions:
- `formatDateTime`
- `formatMoney`
- `formatPayrollPeriod`
- `getMonthFilterValue`
- `getWeekFilterValue`
- `getFilteredPayrollRuns`
- `getAggregatePayrollStats`
- `getAggregateAccountingTotals`

What it does:
- Formats dates and money for display.
- Converts a payroll run into a readable period like `July 2026`.
- Filters payroll dashboard statistics by week or month.
- Calculates dashboard totals across selected payroll runs.

Change here if:
- You want to show another currency format.
- You want the dashboard filter to use quarter/year instead of week/month.
- You want summary cards to count different payroll totals.

Important note:
- `formatMoney` currently displays `SGD`. If the UI should show USD, change the currency inside this function.

## 4. Payroll Calculation, CPF/MBMF And Compliance Helpers

Main functions:
- `sumPayrollItems`
- `getPayrollComponentRule`
- `getPayrollDeductionRule`
- `isEmployeeMbmfEligible`
- `getExpectedMbmfEmployeeAmount`
- `getEmployeeCpfApplicableEarnings`
- `getEmployeeCpfRateTier`
- `getEmployeeTotalEarnings`
- `getEmployeeTotalDeductions`
- `getRunTotals`
- `getEmployeeNetPay`
- `getComplianceRules`
- `getEmployeeExceptions`
- `getComplianceChecks`

What it does:
- Calculates earnings, deductions, CPF, MBMF, employer costs, net pay, and accounting totals.
- Applies Admin payroll settings where available.
- Detects issues such as missing bank account, wrong CPF amount, missing department, negative net pay, or unclassified earnings.
- Produces the compliance checklist used before Finance approval.

Change here if:
- Evaluators ask how CPF is calculated.
- You want to change CPF/MBMF rules.
- You want to add a new compliance check.
- You want to allow payment even if a field is missing.

Useful edits:
- Add a new exception: edit `getEmployeeExceptions`.
- Add a new compliance checklist row: edit `getComplianceChecks`.
- Change net pay calculation: edit `getEmployeeNetPay`.
- Change total run cost: edit `getRunTotals`.

## 5. Workflow, Modern Treasury And Payment-File Helpers

Main functions:
- `canApprovePayrollRun`
- `getCompletedSteps`
- `getStatusClass`
- `createTimelineEntry`
- `getAuditEntries`
- `buildPaymentFileRows`
- `getApprovedPaymentRecipients`
- `getMissingModernTreasuryRecipientCount`
- `getCpfDeductionProcessRows`

What it does:
- Decides whether each workflow step is complete.
- Controls whether Finance can approve a payroll run.
- Builds payment file rows used in PDF export.
- Converts approved employees into Modern Treasury payment recipients.
- Checks whether approved employees already have Modern Treasury counterparty/external account IDs.
- Builds CPF, MBMF and other-deduction payable rows for Finance remittance logging.

Change here if:
- You want approval to allow `Ready` staff instead of only `Approved`.
- You want to change when a button becomes enabled.
- You want to send different employee data to Modern Treasury.
- You want to include held staff in payment exports.
- You want CPF, MBMF or other deductions to be logged differently before ledger posting.

Useful edits:
- Approval rule: edit `canApprovePayrollRun`.
- Workflow completion rule: edit `getCompletedSteps`.
- Modern Treasury payload: edit `getApprovedPaymentRecipients`.
- CPF/deduction process rows: edit `getCpfDeductionProcessRows`.

## 6. PDF Generation Helpers

Main functions:
- `escapePdfText`
- `wrapPdfText`
- `createPdfBlob`
- `downloadPdf`

What it does:
- Builds simple PDF documents in the browser without a PDF library.
- Used by payment file and report downloads.

Change here if:
- You want a different PDF layout.
- You want more columns in a report.
- You want to change PDF footer text or styling.

Important note:
- The PDF generator is hand-built. For complex PDF layouts, use a proper library later.

## 7. Shared UI Components

Main components:
- `PageShell`
- `ActionButton`
- `EmptyState`
- `WorkflowCard`
- `ExceptionPanel`
- `AdminCpfConfigPanel`
- `CompliancePanel`
- `AuditTrailPanel`
- `StatCard`
- `PayrollStatsFilter`
- `RunSelector`
- `AccountingImpact`

What it does:
- Provides reusable layout, buttons, panels, cards, filters, and selectors.
- `ActionButton` supports `disabledReason`, so blocked buttons can explain why an action cannot continue.

Change here if:
- You want to redesign repeated Finance UI elements.
- You want blocked buttons to use modal/toast instead of `window.alert`.
- You want to add tooltips or improve button styling.

Useful edits:
- Disabled button prompt: edit `ActionButton`.
- Run dropdown display: edit `RunSelector`.
- Accounting table: edit `AccountingImpact`.

## 8. Dashboard And Payroll-Run Workflow Views

Main components:
- `DashboardView`
- `PayrollRunsView`
- `CpfDeductionProcessPanel`

What it does:
- `DashboardView` shows high-level Finance summary, workflow cards, compliance, exceptions, and accounting impact.
- `PayrollRunsView` is the main workflow screen for mock run creation, review, approval, Modern Treasury recipient setup, payment PDF, payment submission, payslips, ledger, and reconciliation.
- `CpfDeductionProcessPanel` lets Finance log CPF/MBMF payables and other deduction recoveries after payment is processed.

Change here if:
- You want to add a new workflow button.
- You want to change the order of actions.
- You want to change disabled reasons shown to users.
- You want to add more status cards.
- You want ledger posting to require or skip CPF/deduction logs.

Useful edits:
- Add button: edit the `actions` area in `PayrollRunsView`.
- Change blocked prompt text: edit functions like `getPaymentSubmissionBlockedReason`.
- Change displayed Modern Treasury balance: edit the `selectedRun.simulationAccount` display block.
- Change CPF/deduction panel layout: edit `CpfDeductionProcessPanel`.

## 9. Staff Payroll Detail Editor

Main components/functions:
- `PayrollItemList`
- `StaffPayrollDetailModal`
- `StaffPayrollDetailsView`

What it does:
- Shows employee earnings, deductions, employer items, CPF, MBMF, bank info, and Finance status.
- Lets Finance update staff payroll details before approval.
- Locks editing after payroll approval.

Change here if:
- You want Finance to edit different employee fields.
- You want to unlock editing after approval.
- You want to add new payroll item types.

Useful edits:
- Locking rule: check `isLocked = getCompletedSteps(selectedRun).approved`.
- Save logic: edit `handleSave` inside `StaffPayrollDetailModal`.

## 10. Payslip Approval Workflow

Main functions/components:
- `getAuthHeaders`
- `formatPayslipMoney`
- `getPayslipPeriod`
- `PayslipsApprovalView`

What it does:
- Connects to backend HR/Admin payslip approval APIs.
- Lets Finance approve or reject payslips sent by HR.
- This is separate from the local mock payroll-run workflow.

Change here if:
- You want Finance approval to update a different backend status.
- You want to change rejection reason handling.
- You want to add bulk approval.

Important note:
- This section uses backend data. The Finance payroll run workflow currently uses local demo data until HR integration is connected.

## 11. Reports And Summaries

Main functions/components:
- `NotificationRecordsView`
- `buildReportRows`
- `getStaffReportRows`
- `getExceptionReportRows`
- `getCpfReportRows`
- `getDeductionReportRows`
- `getMbmfReportRows`
- `getComplianceReportRows`
- `getAuditReportRows`
- `getCostReportRows`
- `downloadReport`
- `PayrollReportsView`
- `PayrollSummariesView`

What it does:
- Builds rows for Finance reports.
- Downloads report PDFs.
- Shows monthly/weekly payroll summaries and accounting totals.

Change here if:
- You want to add a new report card.
- You want to change report PDF rows.
- You want to rename report titles.

Useful edits:
- Add report type: edit `buildReportRows` and `downloadReport`.
- Change report columns: edit the matching `get...ReportRows` function.

## 12. View Router

Main component:
- `FinancePayrollContent`

What it does:
- Chooses which view to render based on the current route path.
- Routes payroll runs, staff details, notifications, reports, and summaries to the correct component.

Change here if:
- You add a new Finance page route.
- You want a route to show a different component.

## 13. Main Page State And Event Handlers

Main component:
- `FinancePayrollPage`

Important state:
- `payrollRuns`: all local Finance payroll runs.
- `selectedRunId`: currently selected run.
- `payrollRuleConfig`: Admin payroll rules loaded from backend.
- `paymentError`: Modern Treasury or workflow errors.
- `paymentProcessing`: payment submission loading state.
- `recipientSetupProcessing`: Modern Treasury recipient setup loading state.

Important handlers:
- `handleCreateMockRun`
- `handleGeneratePaymentFile`
- `handleSetupModernTreasuryRecipients`
- `handleSubmitModernTreasuryTransfer`
- `handleAdvanceRun`
- `handleUpdateEmployee`
- `handleUpdateStaffStatus`

What it does:
- Owns the Finance payroll workflow.
- Saves local workflow changes to `localStorage`.
- Calls Modern Treasury recipient setup and payment APIs.
- Advances payroll steps and writes timeline entries.

Change here if:
- You want to connect Finance runs to backend/HR data instead of localStorage.
- You want payment submission to call another provider.
- You want to change what happens after a workflow button succeeds.

Useful edits:
- Mock run creation: `handleCreateMockRun`.
- Payment PDF generation: `handleGeneratePaymentFile`.
- Modern Treasury recipient setup: `handleSetupModernTreasuryRecipients`.
- Modern Treasury payment submission: `handleSubmitModernTreasuryTransfer`.
- Workflow status transitions, including CPF/deduction log actions: `handleAdvanceRun`.

## Common Evaluator Questions

### Where do I change the fake payroll run?
Edit `createMockFinancePayrollRun` and `initialPayrollRuns`.

### Where do I change employee salary?
Edit each employee's `earningItems`, `deductionItems`, and `employerItems` in `initialPayrollRuns`.

### Where do I change net pay?
Edit `getEmployeeNetPay`.

### Where do I change CPF logic?
Edit `getEmployeeCpfApplicableEarnings`, `getEmployeeCpfRateTier`, `getEmployeeCpfAmount`, and `getEmployeeExceptions`.

### Where do I change the approval rule?
Edit `canApprovePayrollRun`.

### Where do I change why buttons are disabled?
Edit the `get...BlockedReason` functions inside `PayrollRunsView`.

### Where do I change the CPF and other-deduction Finance process?
Edit `getCpfDeductionProcessRows` for the amounts/rows, `CpfDeductionProcessPanel` for the UI, and `handleAdvanceRun` for the status/timeline transitions.

### Where is ledger posting blocked until CPF/deduction logs are done?
Edit `getLedgerBlockedReason` and the `Record in Ledger` `ActionButton` inside `PayrollRunsView`.

### Where do I change Modern Treasury payment data?
Edit `getApprovedPaymentRecipients` in this file and `server/src/services/modernTreasuryPaymentService.js`.

### Where is the SGD 500,000 simulation balance shown?
Backend value: `server/.env` -> `SIMULATED_TREASURY_BALANCE_SGD`.

Frontend display: `PayrollRunsView`, inside the `selectedRun.simulationAccount` block.

### Where do I switch from SGD simulation to real Modern Treasury dashboard payment orders?
Set this in `server/.env`:

```env
MODERN_TREASURY_PAYMENT_CURRENCY=USD
```

Then restart the server. Real Modern Treasury payment orders require USD for your current sandbox account.

### Where do I connect real HR-created payroll runs later?
Replace `getInitialPayrollRuns` / `localStorage` usage in `FinancePayrollPage` with a backend fetch, then map backend payroll run data into the same shape used by `selectedRun`.

### Where is the Finance staff database implementation?
Backend:
- `server/src/models/financePayrollModel.js`
- `server/src/controllers/financePayrollController.js`
- `server/src/routes/financePayrollRoutes.js`
- Mounted in `server/src/app.js` at `/api/payroll/finance`

Frontend:
- `client/src/services/financePayrollService.js`
- `Staff DB Run` button in `PayrollRunsView`

Database table:
- `finance_payroll_run`
- Stores each Finance payroll run as JSON in `run_data`, so workflow status, Modern Treasury IDs, CPF/deduction logs, and ledger/reconciliation timestamps persist.

### How does Staff DB Run work?
It reads active staff from the `staff` table, joins `department`, maps `base_salary`, `bank`, `account_no`, `race`, `religion`, and `department_name` into the same Finance payroll run shape, then saves it into `finance_payroll_run`.
