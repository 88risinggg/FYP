/**
 * EVALUATION HEADER
 * FEATURE: PAYROLL - FINANCE
 * PURPOSE: Implements the Finance Payroll Page screen and its page-level interactions.
 * LAYER: Frontend page - renders a complete screen and coordinates its user interactions.
 * FIND RELATED CODE: Trace its imports for UI components and frontend services used by this screen.
 */
import {
  AlertCircle,
  ArrowRight,
  Banknote,
  Bell,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Download,
  Edit3,
  FileBarChart,
  FileText,
  History,
  LayoutDashboard,
  ListChecks,
  Lock,
  Mail,
  Plus,
  ReceiptText,
  RefreshCw,
  CalendarClock,
  Search,
  Send,
  ShieldCheck,
  Users,
  Loader2,
  X
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import DashboardLayout from "../../components/layout/DashboardLayout.jsx";
import PayrollProgressTracker from "../../components/payroll/PayrollProgressTracker.jsx";
import { getEffectivePayrollRules, getPayrollRuleConfig } from "../../services/adminPayrollService.js";
import {
  createFinancePayrollRunFromStaff,
  exportFinancePayrollReport,
  generateFinancePayrollAdjustments,
  getFinancePayrollAdjustments,
  getFinancePayrollActivity,
  getFinancePayrollSchedule,
  getFinancePayrollSchedulePreview,
  getFinancePayrollRuns,
  getFinancePayrollWorkflow,
  getFinanceRuleAcknowledgement,
  acknowledgeFinancePayrollRules,
  getPayslipPeriodSummary,
  performFinancePayrollScheduleAction,
  performFinancePayrollWorkflowAction,
  recalculateFinancePayrollRun,
  reviewFinancePayrollAdjustments,
  saveFinancePayrollRun,
  updateFinancePayrollRunSchedule,
  updateFinancePayrollSchedule,
  validateFinancePayrollRun
} from "../../services/financePayrollService.js";
import {
  canAdvanceFinancePayrollRun,
  getFinanceWorkflowState,
  getFinanceAutoAdvance
} from "../../utils/financePayrollWorkflow.js";
import {
  setupModernTreasuryRecipients
} from "../../services/payrollPaymentService.js";
import { getCompanyScopedKey, getStoredSession } from "../../services/sessionService.js";
import {
  createDefaultFinancePayrollConfig,
  getShgBandAmount,
  resolveFinancePayrollConfig
} from "../../utils/payrollRules.js";
import { createPayrollReportPdf } from "../../utils/payrollReportPdf.js";
import { normalizeFinancePayrollRuns } from "../../utils/financePayrollData.js";
import { getMissingScheduleFields, shouldShowFinanceTracker } from "../../utils/financePayrollNavigation.js";
import FinanceRequestsPage from "./FinanceRequestsPage.jsx";
import PayrollNotificationsView from "../../components/payroll/PayrollNotificationsView.jsx";

/*
===============================================================================
Finance Payroll Page Guide
===============================================================================
Detailed function-by-function notes are in:
client/src/pages/payroll/FinancePayrollPage.guide.md

1. Page constants and navigation
2. Demo payroll data and mock-run setup
3. Date, money and filter helpers
4. Payroll calculation, CPF/MBMF and compliance helpers
5. Workflow, Modern Treasury and payment-file helpers
6. PDF generation helpers
7. Shared UI components
8. Dashboard and payroll-run workflow views
9. Staff payroll detail editor
10. Payslip approval workflow
11. Reports and summaries
12. Main page state and event handlers
===============================================================================
*/

// -----------------------------------------------------------------------------
// 1. Page constants and navigation
// -----------------------------------------------------------------------------

const pageTitle = "Automated Payroll System - Finance Payroll Dashboard";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
const FINANCE_SELECTED_RUN_KEY = "financePayrollSelectedRunId";

const payrollSidebarSections = [
  {
    label: "MAIN",
    items: [
      {
        label: "Dashboard",
        icon: LayoutDashboard,
        path: "/dashboard/payroll/finance",
        end: true,
        children: [
          { label: "Overview", path: "/dashboard/payroll/finance", end: true },
          { label: "Finance Summary", path: "/dashboard/payroll/finance/payroll-summaries" }
        ]
      },
    ]
  },
  {
    label: "GUIDED WORKFLOW",
    items: [
      { label: "Claim Requests", icon: ReceiptText, path: "/dashboard/payroll/finance/employee-requests" },
      {
        label: "Payroll Run Review",
        icon: ClipboardList,
        path: "/dashboard/payroll/finance/payroll-runs"
      },
      {
        label: "Staff Review & Adjustments",
        icon: Users,
        path: "/dashboard/payroll/finance/staff-payroll-details"
      },
      {
        label: "Payroll Approval",
        icon: CheckCircle2,
        path: "/dashboard/payroll/finance/payroll-approval"
      },
      { label: "Payment Preparation", icon: FileText, path: "/dashboard/payroll/finance/payment-preparation" },
      { label: "Payment Release", icon: Banknote, path: "/dashboard/payroll/finance/payment-release" },
      { label: "Statutory & Ledger", icon: ReceiptText, path: "/dashboard/payroll/finance/statutory-ledger" },
      { label: "Reconciliation & Reports", icon: FileBarChart, path: "/dashboard/payroll/finance/reconciliation-reports" }
    ]
  },
  {
    label: "STAFF DATA",
    items: [
      { label: "Staff Records", icon: Users, path: "/dashboard/payroll/finance/staff-records" }
    ]
  },
  {
    label: "CONFIGURATION",
    items: [
      { label: "Schedule & Cut-off", icon: CalendarClock, path: "/dashboard/payroll/finance/payroll-schedule" }
    ]
  },
  {
    label: "REFERENCE",
    items: [
      { label: "Compliance Rules", icon: ShieldCheck, path: "/dashboard/payroll/finance/compliance-rules" }
    ]
  },
  {
    label: "REPORT & AUDIT",
    items: [
      { label: "Payroll Run History", icon: ClipboardList, path: "/dashboard/payroll/finance/payroll-run-history" },
      {
        label: "Finance Reports",
        icon: FileBarChart,
        path: "/dashboard/payroll/finance/payroll-reports"
      },
      { label: "Payroll Activity Log", icon: History, path: "/dashboard/payroll/finance/activity-log" }
    ]
  }
];

const routeHeadings = {
  "/dashboard/payroll/finance": "Dashboard",
  "/dashboard/payroll/finance/payroll-runs": "Payroll Runs",
  "/dashboard/payroll/finance/payslips-approval": "Payslips Approval",
  "/dashboard/payroll/finance/employee-requests": "Claim Requests",
  "/dashboard/payroll/finance/staff-payroll-details": "Staff Payroll Details",
  "/dashboard/payroll/finance/payroll-approval": "Payroll Approval",
  "/dashboard/payroll/finance/payment-preparation": "Payment Preparation",
  "/dashboard/payroll/finance/payment-release": "Payment Release",
  "/dashboard/payroll/finance/statutory-ledger": "Statutory & Ledger",
  "/dashboard/payroll/finance/reconciliation-reports": "Reconciliation & Reports",
  "/dashboard/payroll/finance/payroll-completion": "Payroll Run Completed",
  "/dashboard/payroll/finance/payroll-run-history": "Payroll Run History",
  "/dashboard/payroll/finance/staff-records": "Staff Records",
  "/dashboard/payroll/finance/compliance-rules": "Compliance Rules",
  "/dashboard/payroll/finance/activity-log": "Payroll Activity Log",
  "/dashboard/payroll/finance/payroll-schedule": "Payroll Schedule",
  "/dashboard/payroll/finance/payroll-reports": "Finance Reports",
  "/dashboard/payroll/finance/payroll-summaries": "Finance Summary"
};

let adminCpfConfiguration = createDefaultFinancePayrollConfig();

const workflowStepDefinitions = [
  {
    key: "reviewed",
    title: "Cut-off, Snapshot & Compliance",
    owner: "System / Finance",
    icon: FileText,
    details: ["System checks completed", "Exceptions reviewed", "Staff records approved or held"]
  },
  {
    key: "approved",
    title: "Approve Payroll",
    owner: "Finance approver",
    icon: ClipboardCheck,
    details: ["Pay run approved", "Payroll locked for payment processing"]
  },
  {
    key: "paid",
    title: "Generate & Confirm Payment",
    owner: "Finance payments",
    icon: Banknote,
    details: ["Bank payment file generated", "Bank reference recorded", "Payment status confirmed"]
  },
  {
    key: "payslipsSent",
    title: "Generate Payslips",
    owner: "System",
    icon: Mail,
    details: ["Final PDF payslips generated", "Payslips sent to employees"]
  },
  {
    key: "statutoryDeductionsLogged",
    title: "CPF & Deduction Logs",
    owner: "Finance operations",
    icon: ReceiptText,
    details: ["CPF payable recorded", "Other deductions logged", "Recovery accounts prepared"]
  },
  {
    key: "ledgerRecorded",
    title: "Record in Ledger",
    owner: "Finance accounting",
    icon: RefreshCw,
    details: ["Payroll journal created", "Internal general ledger updated"]
  },
  {
    key: "reconciled",
    title: "Reports & Reconciliation",
    owner: "Finance accounting",
    icon: FileBarChart,
    details: ["Payroll reports generated", "Bank payment reconciled"]
  }
];

// -----------------------------------------------------------------------------
// 2. Demo payroll data and mock-run setup
// -----------------------------------------------------------------------------

const initialPayrollRuns = [
  {
    id: "PAY-2026-05",
    month: 5,
    year: 2026,
    status: "Submitted for Finance Review",
    submittedBy: "Admin",
    submittedAt: "2026-05-24T09:30:00",
    bankReference: "",
    paymentMethod: "GIRO",
    employees: [
      {
        id: "EMP-001",
        name: "Alicia Tan",
        department: "Operations",
        workLocation: "Joo Chiat",
        workingDays: 24,
        noPayLeave: 0,
        cpfAgeGroup: "55 and below",
        grossPay: 4200,
        previousGrossPay: 4200,
        religion: "Buddhist",
        allowances: 250,
        deductions: 80,
        employeeCpf: 840,
        employerCpf: 714,
        earningItems: [
          { label: "Basic salary", rate: "1 Month", amount: 4200 },
          { label: "Transport allowance", rate: "-", amount: 250 }
        ],
        deductionItems: [
          { label: "Employee CPF", rate: "20%", amount: 840 },
          { label: "Staff loan repayment", rate: "-", amount: 80 },
          { label: "MBMF", rate: "-", amount: 6.5 }
        ],
        employerItems: [
          { label: "Employer CPF", rate: "17%", amount: 714 },
          { label: "SDL", rate: "-", amount: 10.6 }
        ],
        bankType: "DBS",
        bankAccount: "DBS-001-234567"
      },
      {
        id: "EMP-002",
        name: "Daniel Lim",
        department: "Finance",
        workLocation: "Raffles",
        workingDays: 27,
        noPayLeave: 0,
        cpfAgeGroup: "55 and below",
        grossPay: 3800,
        previousGrossPay: 3800,
        religion: "Christian",
        allowances: 200,
        deductions: 60,
        employeeCpf: 760,
        employerCpf: 646,
        earningItems: [
          { label: "Basic salary", rate: "1 Month", amount: 3800 },
          { label: "Services commission", rate: "-", amount: 200 },
          { label: "Physical products commission", rate: "-", amount: 15.9 }
        ],
        deductionItems: [
          { label: "Employee CPF", rate: "20%", amount: 760 },
          { label: "Loan", rate: "-", amount: 139.45 }
        ],
        employerItems: [
          { label: "Employer CPF", rate: "17%", amount: 646 },
          { label: "SDL", rate: "-", amount: 10.1 }
        ],
        bankType: "OCBC",
        bankAccount: "OCBC-501-991122"
      },
      {
        id: "EMP-003",
        name: "Nur Aisyah",
        department: "HR",
        workLocation: "Tampines",
        workingDays: 25,
        noPayLeave: 1,
        cpfAgeGroup: "55 and below",
        grossPay: 4500,
        previousGrossPay: 3600,
        religion: "Muslim",
        allowances: 300,
        deductions: 120,
        employeeCpf: 900,
        employerCpf: 765,
        earningItems: [
          { label: "Basic salary", rate: "1 Month", amount: 4500 },
          { label: "Credit commission", rate: "-", amount: 300 }
        ],
        deductionItems: [
          { label: "Employee CPF", rate: "20%", amount: 900 },
          { label: "Salary advance recovery", rate: "-", amount: 120 }
        ],
        employerItems: [
          { label: "Employer CPF", rate: "17%", amount: 765 },
          { label: "SDL", rate: "-", amount: 11 }
        ],
        bankType: "UOB",
        bankAccount: "UOB-721-443210"
      }
    ],
    timeline: [
      { action: "Payroll submitted to Finance", at: "2026-05-24T09:30:00", owner: "Admin" }
    ]
  },
  {
    id: "PAY-2026-04",
    month: 4,
    year: 2026,
    status: "Reconciled",
    submittedBy: "Admin",
    submittedAt: "2026-04-24T09:10:00",
    approvedAt: "2026-04-24T13:20:00",
    paymentFileGeneratedAt: "2026-04-25T09:45:00",
    paidAt: "2026-04-25T10:15:00",
    payslipsSentAt: "2026-04-25T11:05:00",
    ledgerRecordedAt: "2026-04-25T11:45:00",
    reconciledAt: "2026-04-26T15:30:00",
    bankReference: "GIRO-APR-2026-8842",
    paymentMethod: "GIRO",
    employees: [
      {
        id: "EMP-001",
        name: "Alicia Tan",
        department: "Operations",
        workLocation: "Joo Chiat",
        workingDays: 24,
        noPayLeave: 0,
        cpfAgeGroup: "55 and below",
        grossPay: 4200,
        previousGrossPay: 4200,
        religion: "Buddhist",
        allowances: 250,
        deductions: 80,
        employeeCpf: 840,
        employerCpf: 714,
        earningItems: [
          { label: "Basic salary", rate: "1 Month", amount: 4200 },
          { label: "Transport allowance", rate: "-", amount: 250 }
        ],
        deductionItems: [
          { label: "Employee CPF", rate: "20%", amount: 840 },
          { label: "Staff loan repayment", rate: "-", amount: 80 }
        ],
        employerItems: [
          { label: "Employer CPF", rate: "17%", amount: 714 },
          { label: "SDL", rate: "-", amount: 10.6 }
        ],
        bankType: "DBS",
        bankAccount: "DBS-001-234567",
        financeStatus: "Approved"
      },
      {
        id: "EMP-002",
        name: "Daniel Lim",
        department: "Finance",
        workLocation: "Raffles",
        workingDays: 27,
        noPayLeave: 0,
        cpfAgeGroup: "55 and below",
        grossPay: 3800,
        previousGrossPay: 3800,
        religion: "Christian",
        allowances: 200,
        deductions: 60,
        employeeCpf: 760,
        employerCpf: 646,
        earningItems: [
          { label: "Basic salary", rate: "1 Month", amount: 3800 },
          { label: "Services commission", rate: "-", amount: 200 },
          { label: "Physical products commission", rate: "-", amount: 15.9 }
        ],
        deductionItems: [
          { label: "Employee CPF", rate: "20%", amount: 760 },
          { label: "Loan", rate: "-", amount: 139.45 }
        ],
        employerItems: [
          { label: "Employer CPF", rate: "17%", amount: 646 },
          { label: "SDL", rate: "-", amount: 10.1 }
        ],
        bankType: "OCBC",
        bankAccount: "OCBC-501-991122",
        financeStatus: "Approved"
      }
    ],
    timeline: [
      { action: "Payroll submitted to Finance", at: "2026-04-24T09:10:00", owner: "Admin" },
      { action: "Payment file generated", at: "2026-04-25T09:45:00", owner: "System" },
      { action: "Payroll approved", at: "2026-04-24T13:20:00", owner: "Finance" },
      { action: "Payment processed", at: "2026-04-25T10:15:00", owner: "Finance" },
      { action: "Payslips sent", at: "2026-04-25T11:05:00", owner: "System" },
      { action: "Internal ledger journal recorded", at: "2026-04-25T11:45:00", owner: "System" },
      { action: "Bank payment reconciled", at: "2026-04-26T15:30:00", owner: "Finance" }
    ]
  }
];

const demoEmployeeBankDetails = {
  "EMP-001": { bankType: "DBS", bankAccount: "DBS-001-234567" },
  "EMP-002": { bankType: "OCBC", bankAccount: "OCBC-501-991122" },
  "EMP-003": { bankType: "UOB", bankAccount: "UOB-721-443210" }
};

function normalizeDemoEmployeeBankDetails(employee) {
  const fallbackBankDetails = demoEmployeeBankDetails[employee?.id];

  if (!fallbackBankDetails) return employee;

  return {
    ...employee,
    bankType: employee.bankType || fallbackBankDetails.bankType,
    bankAccount: employee.bankAccount || fallbackBankDetails.bankAccount
  };
}

function createMockFinancePayrollRun(existingRuns = []) {
  const now = new Date();
  const runMonth = now.getMonth() + 1;
  const runYear = now.getFullYear();
  const duplicateCount = existingRuns.filter((run) => run.month === runMonth && run.year === runYear).length;
  const runIdSuffix = duplicateCount ? `-MOCK-${duplicateCount + 1}` : "-MOCK";
  const sourceEmployees = initialPayrollRuns[0].employees;

  return {
    id: `PAY-${runYear}-${padDatePart(runMonth)}${runIdSuffix}`,
    month: runMonth,
    year: runYear,
    status: "Submitted for Finance Review",
    submittedBy: "Finance Demo",
    submittedAt: now.toISOString(),
    bankReference: "",
    paymentMethod: "Modern Treasury ACH Sandbox",
    employees: sourceEmployees.map((employee) =>
      normalizeDemoEmployeeBankDetails({
        ...employee,
        earningItems: (employee.earningItems || []).map((item) => ({ ...item })),
        deductionItems: (employee.deductionItems || []).map((item) => ({ ...item })),
        employerItems: (employee.employerItems || []).map((item) => ({ ...item })),
        financeStatus: "Approved",
        modernTreasuryCounterpartyId: "",
        modernTreasuryReceivingAccountId: ""
      })
    ),
    timeline: [
      {
        action: "Mock payroll run created for Finance testing",
        at: now.toISOString(),
        owner: "Finance Demo"
      }
    ]
  };
}

function getInitialPayrollRuns() {
  return [];
}

// -----------------------------------------------------------------------------
// 3. Date, money and filter helpers
// -----------------------------------------------------------------------------

function formatDateTime(value) {
  if (!value) return "Not completed";

  return new Intl.DateTimeFormat("en-SG", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

function formatDate(value) {
  if (!value) return "Not specified";
  const dateOnly = String(value).slice(0, 10);
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(dateOnly)
    ? new Date(`${dateOnly}T00:00:00+08:00`)
    : new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-SG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Singapore"
  }).format(parsed);
}

function formatMoney(value) {
  return new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency: "SGD"
  }).format(Number(value || 0));
}

function formatPayrollPeriod(run) {
  if (!run) return "No payroll selected";

  return new Intl.DateTimeFormat("en-SG", {
    month: "long",
    year: "numeric"
  }).format(new Date(run.year, run.month - 1, 1));
}

function formatPayrollRunId(run) {
  if (!run) return "No run ID";
  if (run.runReference || run.run_reference) return String(run.runReference || run.run_reference);
  const rawId = String(run.id || "0");
  const suffix = /^\d+$/.test(rawId) ? rawId.padStart(4, "0") : rawId.replace(/[^a-z0-9-]/gi, "-").toUpperCase();
  return `PAY-${run.year}-${String(run.month).padStart(2, "0")}-${suffix}`;
}

function padDatePart(value) {
  return String(value).padStart(2, "0");
}

function getPayrollRunDate(run) {
  return new Date(run?.year || 2026, (run?.month || 1) - 1, 1);
}

function getMonthFilterValue(date) {
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}`;
}

function getWeekFilterValue(date) {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNumber = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil((((target - yearStart) / 86400000) + 1) / 7);

  return `${target.getUTCFullYear()}-W${padDatePart(weekNumber)}`;
}

function getDefaultStatsFilter(run) {
  return {
    mode: "month",
    value: getMonthFilterValue(getPayrollRunDate(run))
  };
}

function isRunInStatsFilter(run, filter) {
  const runPeriod = getMonthFilterValue(getPayrollRunDate(run));
  if (filter.mode === "range") return runPeriod >= filter.start && runPeriod <= filter.end;
  return runPeriod === filter.value;
}

function getFilteredPayrollRuns(payrollRuns, filter) {
  return payrollRuns.filter((run) => isRunInStatsFilter(run, filter));
}

function getAggregatePayrollStats(runs = []) {
  return runs.reduce(
    (result, run) => {
      const totals = getRunTotals(run);
      const complianceSummary = getComplianceSummary(run);
      const approvedStaff = run.employees.filter((employee) => getEmployeeFinanceStatus(employee) === "Approved").length;

      return {
        approvedStaff: result.approvedStaff + approvedStaff,
        compliancePassed: result.compliancePassed + complianceSummary.passed,
        complianceTotal: result.complianceTotal + complianceSummary.total,
        employees: result.employees + run.employees.length,
        exceptions: result.exceptions + getRunExceptions(run).length,
        netPay: result.netPay + totals.netPay,
        pendingRuns: result.pendingRuns + (getCompletedSteps(run).reconciled ? 0 : 1),
        runs: result.runs + 1,
        totals: {
          grossPay: result.totals.grossPay + totals.grossPay,
          allowances: result.totals.allowances + totals.allowances,
          deductions: result.totals.deductions + totals.deductions,
          employeeCpf: result.totals.employeeCpf + totals.employeeCpf,
          employeeMbmf: result.totals.employeeMbmf + totals.employeeMbmf,
          employerCpf: result.totals.employerCpf + totals.employerCpf,
          employerMbmf: result.totals.employerMbmf + totals.employerMbmf,
          sdl: result.totals.sdl + totals.sdl,
          netPay: result.totals.netPay + totals.netPay
        }
      };
    },
    {
      approvedStaff: 0,
      compliancePassed: 0,
      complianceTotal: 0,
      employees: 0,
      exceptions: 0,
      netPay: 0,
      pendingRuns: 0,
      runs: 0,
      totals: {
        grossPay: 0,
        allowances: 0,
        deductions: 0,
        employeeCpf: 0,
        employeeMbmf: 0,
        employerCpf: 0,
        employerMbmf: 0,
        sdl: 0,
        netPay: 0
      }
    }
  );
}

function getAggregateAccountingTotals(runs = []) {
  return runs.reduce(
    (result, run) => {
      const totals = getRunTotals(run);

      return {
        salaryExpense: result.salaryExpense + totals.salaryExpense,
        netPay: result.netPay + totals.netPay,
        employeeCpf: result.employeeCpf + totals.employeeCpf,
        employerCpf: result.employerCpf + totals.employerCpf,
        employeeMbmf: result.employeeMbmf + totals.employeeMbmf,
        employerMbmf: result.employerMbmf + totals.employerMbmf,
        sdl: result.sdl + totals.sdl,
        otherDeductions: result.otherDeductions + totals.otherDeductions,
        totalDebit: result.totalDebit + totals.totalDebit,
        totalCredit: result.totalCredit + totals.totalCredit
      };
    },
    {
      salaryExpense: 0,
      netPay: 0,
      employeeCpf: 0,
      employerCpf: 0,
      employeeMbmf: 0,
      employerMbmf: 0,
      sdl: 0,
      otherDeductions: 0,
      totalDebit: 0,
      totalCredit: 0
    }
  );
}

// -----------------------------------------------------------------------------
// 4. Payroll calculation, CPF/MBMF and compliance helpers
// -----------------------------------------------------------------------------

function sumPayrollItems(items = []) {
  return items.reduce((total, item) => total + Number(item.amount || 0), 0);
}

function normalizePayrollLabel(value) {
  return String(value || "").trim().toLowerCase();
}

function getCanonicalComponentKey(label) {
  const normalized = normalizePayrollLabel(label);

  if (normalized.includes("basic")) return "basic salary";
  if (normalized.includes("allowance")) return "allowance";
  if (normalized.includes("commission")) return "commission";
  if (normalized.includes("bonus")) return "bonus";
  if (normalized.includes("reimbursement")) return "reimbursement";
  if (normalized.includes("tips") || normalized.includes("tip")) return "tips";
  return normalized;
}

function getPayrollComponentRule(label) {
  return adminCpfConfiguration.componentRules[getCanonicalComponentKey(label)] || {
    cpfApplicable: false,
    wageType: "Unclassified"
  };
}

function getPayrollDeductionRule(label) {
  const normalized = normalizePayrollLabel(label);
  const key = normalized.includes("mbmf")
    ? "mbmf"
    : normalized.includes("cpf")
      ? "employee cpf"
      : normalized.includes("loan")
        ? "loan"
        : normalized.includes("advance")
          ? "salary advance"
          : normalized.includes("no-pay")
            ? "no-pay leave"
            : normalized;

  return adminCpfConfiguration.deductionRules?.[key] || {
    affectsNetPay: true,
    affectsCpfWageBase: false,
    type: "Other"
  };
}

function isEmployeeMbmfEligible(employee) {
  const configuredReligion = normalizePayrollLabel(adminCpfConfiguration.mbmf?.applicableReligion || "Muslim");
  const staffReligion = normalizePayrollLabel(employee.religion);
  const eligibleReligions = configuredReligion === "muslim" ? ["muslim", "islam"] : [configuredReligion];
  return adminCpfConfiguration.mbmf?.enabled && eligibleReligions.includes(staffReligion);
}

function getMbmfWageBase(employee) {
  return getEmployeeTotalEarnings(employee);
}

function getMbmfSkipReason(employee) {
  const applicableReligion = adminCpfConfiguration.mbmf?.applicableReligion || "Muslim";
  const staffReligion = String(employee.religion || "").trim();

  if (!adminCpfConfiguration.mbmf?.enabled) return "MBMF is disabled in Admin settings";
  if (!staffReligion) return "Religion is not recorded";
  if (!isEmployeeMbmfEligible(employee)) {
    return `Religion is not ${applicableReligion}`;
  }

  return "";
}

function getExpectedMbmfEmployeeAmount(employee) {
  if (!isEmployeeMbmfEligible(employee)) return 0;
  return getShgBandAmount("MBMF", getMbmfWageBase(employee));
}

function getExpectedMbmfEmployerAmount(employee) {
  return 0;
}

function getMbmfDeductionAmount(employee) {
  const mbmfItem = getEmployeeDeductionItems(employee).find((item) => normalizePayrollLabel(item.label).includes("mbmf"));
  return Number(mbmfItem?.amount || 0);
}

function getMbmfReview(employee) {
  const eligible = isEmployeeMbmfEligible(employee);
  const uploadedEmployeeAmount = getMbmfDeductionAmount(employee);
  const hasStoredPayrollResult = Object.prototype.hasOwnProperty.call(employee, "mbmf");
  const storedEmployeeAmount = hasStoredPayrollResult ? Number(employee.mbmf || 0) : uploadedEmployeeAmount;

  return {
    eligible,
    religionSource: employee.religion || "Not recorded",
    skipReason: eligible ? "" : getMbmfSkipReason(employee),
    wageBase: eligible ? getMbmfWageBase(employee) : 0,
    employeeAmount: hasStoredPayrollResult ? storedEmployeeAmount : getExpectedMbmfEmployeeAmount(employee),
    employerAmount: getExpectedMbmfEmployerAmount(employee),
    uploadedEmployeeAmount: hasStoredPayrollResult ? storedEmployeeAmount : uploadedEmployeeAmount
  };
}

function isCpfApplicableEarning(item) {
  if (typeof item.cpfApplicable === "boolean") return item.cpfApplicable;

  return getPayrollComponentRule(item.label).cpfApplicable;
}

function getEmployeeCpfApplicableEarnings(employee) {
  return getEmployeeEarningItems(employee)
    .filter(isCpfApplicableEarning)
    .reduce((total, item) => total + Number(item.amount || 0), 0);
}

function getEmployeeCpfRateTier(employee) {
  return adminCpfConfiguration.rateTiers.find((tier) => tier.ageGroup === employee.cpfAgeGroup) || adminCpfConfiguration.rateTiers[0];
}

function getEmployeeEarningItems(employee) {
  if (employee.earningItems?.length) return employee.earningItems;

  return [
    { label: "Basic salary", rate: "1 Month", amount: employee.grossPay || 0 },
    ...(employee.allowances ? [{ label: "Allowances", rate: "-", amount: employee.allowances }] : [])
  ];
}

function getEmployeeDeductionItems(employee) {
  if (employee.deductionItems?.length) return employee.deductionItems;

  return [
    { label: "Employee CPF", rate: `${getEmployeeCpfRateTier(employee).employeeOrdinaryRate}%`, amount: employee.employeeCpf || 0 },
    ...(employee.deductions ? [{ label: "Other deductions", rate: "-", amount: employee.deductions }] : [])
  ];
}

function getEmployeeReviewDeductionItems(employee) {
  const nonMbmfItems = getEmployeeDeductionItems(employee).filter((item) => !normalizePayrollLabel(item.label).includes("mbmf"));
  const mbmfReview = getMbmfReview(employee);

  if (!adminCpfConfiguration.mbmf?.enabled && !mbmfReview.uploadedEmployeeAmount) return nonMbmfItems;

  return [
    ...nonMbmfItems,
    {
      label: "Employee MBMF",
      rate: mbmfReview.eligible ? "CPF Board wage band" : "Skipped",
      amount: mbmfReview.employeeAmount,
      calculated: true
    }
  ];
}

function getEmployeeEmployerItems(employee) {
  if (employee.employerItems?.length) return employee.employerItems;

  return [
    { label: "Employer CPF", rate: `${getEmployeeCpfRateTier(employee).employerOrdinaryRate}%`, amount: employee.employerCpf || 0 }
  ];
}

function getEmployeeReviewEmployerItems(employee) {
  const mbmfReview = getMbmfReview(employee);

  if (!adminCpfConfiguration.mbmf?.enabled && !mbmfReview.employerAmount) return getEmployeeEmployerItems(employee);

  return [
    ...getEmployeeEmployerItems(employee),
    {
      label: "Employer MBMF",
      rate: "Not applicable",
      amount: mbmfReview.employerAmount,
      calculated: true
    }
  ];
}

function getEmployeeTotalEarnings(employee) {
  if (employee.recordSource === "staff_db" && employee.storedGrossPay != null) {
    return Number(employee.storedGrossPay);
  }
  return sumPayrollItems(getEmployeeEarningItems(employee));
}

function getEmployeeTotalDeductions(employee) {
  if (employee.recordSource === "staff_db" && employee.storedTotalDeductions != null) {
    return Number(employee.storedTotalDeductions);
  }
  return sumPayrollItems(getEmployeeReviewDeductionItems(employee));
}

function getEmployeeCpfAmount(employee) {
  const cpfItem = getEmployeeDeductionItems(employee).find((item) => normalizePayrollLabel(item.label).includes("cpf"));
  return Number(cpfItem?.amount ?? employee.employeeCpf ?? 0);
}

function getEmployerCpfAmount(employee) {
  const cpfItem = getEmployeeEmployerItems(employee).find((item) => normalizePayrollLabel(item.label).includes("cpf"));
  return Number(cpfItem?.amount ?? employee.employerCpf ?? 0);
}

function getEmployerSdlAmount(employee) {
  const sdlItem = getEmployeeEmployerItems(employee).find((item) => normalizePayrollLabel(item.label).includes("sdl"));
  return Number(sdlItem?.amount ?? employee.sdl ?? 0);
}

function getEmployeeOtherDeductions(employee) {
  const mbmfAmount = employee.recordSource === "staff_db"
    ? Number(employee.mbmf || 0)
    : getExpectedMbmfEmployeeAmount(employee);
  return getEmployeeTotalDeductions(employee) - getEmployeeCpfAmount(employee) - mbmfAmount;
}

function getRunTotals(run) {
  const totals = (run?.employees || []).reduce(
    (result, employee) => {
      const netPay = getEmployeeNetPay(employee);
      const totalEarnings = getEmployeeTotalEarnings(employee);
      const basicPay = getEmployeeEarningItems(employee)
        .filter((item) => normalizePayrollLabel(item.label).includes("basic"))
        .reduce((total, item) => total + Number(item.amount || 0), 0);
      const totalDeductions = getEmployeeTotalDeductions(employee);
      const employeeCpf = getEmployeeCpfAmount(employee);
      const employerCpf = getEmployerCpfAmount(employee);
      const employeeMbmf = employee.recordSource === "staff_db"
        ? Number(employee.mbmf || 0)
        : getExpectedMbmfEmployeeAmount(employee);
      const employerMbmf = getExpectedMbmfEmployerAmount(employee);
      const sdl = getEmployerSdlAmount(employee);

      return {
        grossPay: result.grossPay + basicPay,
        allowances: result.allowances + (totalEarnings - basicPay),
        deductions: result.deductions + totalDeductions,
        employeeCpf: result.employeeCpf + employeeCpf,
        employerCpf: result.employerCpf + employerCpf,
        employeeMbmf: result.employeeMbmf + employeeMbmf,
        employerMbmf: result.employerMbmf + employerMbmf,
        sdl: result.sdl + sdl,
        netPay: result.netPay + netPay
      };
    },
    {
      grossPay: 0,
      allowances: 0,
      deductions: 0,
      employeeCpf: 0,
      employerCpf: 0,
      employeeMbmf: 0,
      employerMbmf: 0,
      sdl: 0,
      netPay: 0
    }
  );
  const otherDeductions = Math.max(0, totals.deductions - totals.employeeCpf - totals.employeeMbmf);

  return {
    ...totals,
    otherDeductions,
    salaryExpense: totals.grossPay + totals.allowances,
    totalDebit: totals.grossPay + totals.allowances + totals.employerCpf + totals.sdl,
    totalCredit: totals.netPay + totals.employeeCpf + totals.employerCpf + totals.employeeMbmf + otherDeductions + totals.sdl
  };
}

function getEmployeeNetPay(employee) {
  if (employee.recordSource === "staff_db" && employee.storedNetPay != null) {
    return Number(employee.storedNetPay);
  }
  return getEmployeeTotalEarnings(employee) - getEmployeeTotalDeductions(employee);
}

function getComplianceRules() {
  return {
    cpfEnabled: true,
    bankAccountEnabled: true,
    departmentEnabled: true,
    positiveNetPayEnabled: true,
    sdlEnabled: true,
    mbmfEnabled: true,
    loanRecoveryEnabled: true,
    grossIncreaseEnabled: true,
    financeApprovalLockEnabled: true,
    paymentDeadlineEnabled: true,
    auditTrailEnabled: true,
    maxOtherDeductionPercent: 30,
    maxGrossIncreasePercent: 20,
    ...(adminCpfConfiguration.compliance || {})
  };
}

function getEmployeeExceptions(employee) {
  const exceptions = [...(employee.complianceExceptions || [])];
  if (employee.recordSource === "staff_db") return [...new Set(exceptions)];
  const complianceRules = getComplianceRules();
  const netPay = getEmployeeNetPay(employee);
  const totalEarnings = getEmployeeTotalEarnings(employee);
  const cpfApplicableEarnings = getEmployeeCpfApplicableEarnings(employee);
  const cpfWageBase = Math.min(cpfApplicableEarnings, adminCpfConfiguration.monthlyWageCeiling);
  const cpfRateTier = getEmployeeCpfRateTier(employee);
  const expectedEmployeeCpf = Math.floor(cpfWageBase * (cpfRateTier.employeeOrdinaryRate / 100));
  const expectedTotalCpf = Math.round(
    cpfWageBase * ((cpfRateTier.employeeOrdinaryRate + cpfRateTier.employerOrdinaryRate) / 100)
  );
  const expectedEmployerCpf = expectedTotalCpf - expectedEmployeeCpf;
  const employeeCpf = getEmployeeCpfAmount(employee);
  const employerCpf = getEmployerCpfAmount(employee);
  const expectedMbmf = getExpectedMbmfEmployeeAmount(employee);
  const mbmfDeduction = getMbmfDeductionAmount(employee);
  const hasUnclassifiedEarnings = getEmployeeEarningItems(employee).some(
    (item) => getPayrollComponentRule(item.label).wageType === "Unclassified" && typeof item.cpfApplicable !== "boolean"
  );
  const maxOtherDeductionRatio = Number(complianceRules.maxOtherDeductionPercent || 30) / 100;
  const maxGrossIncreaseRatio = 1 + (Number(complianceRules.maxGrossIncreasePercent || 20) / 100);

  if (complianceRules.bankAccountEnabled && !employee.bankAccount) exceptions.push("Missing bank account");
  if (complianceRules.bankAccountEnabled && !employee.bankType) exceptions.push("Missing bank type");
  if (complianceRules.departmentEnabled && !employee.department) exceptions.push("Missing department");
  if (complianceRules.positiveNetPayEnabled && netPay <= 0) exceptions.push("Net pay is zero or negative");
  if (complianceRules.cpfEnabled && hasUnclassifiedEarnings) exceptions.push("Earning component is missing Admin CPF classification");
  if (complianceRules.loanRecoveryEnabled && getEmployeeOtherDeductions(employee) > totalEarnings * maxOtherDeductionRatio) {
    exceptions.push(`Other deductions exceed ${complianceRules.maxOtherDeductionPercent}% of earnings`);
  }
  if (complianceRules.cpfEnabled && Math.abs(employeeCpf - expectedEmployeeCpf) > 1) {
    exceptions.push("Employee CPF does not match CPF-applicable wage calculation");
  }
  if (complianceRules.cpfEnabled && Math.abs(employerCpf - expectedEmployerCpf) > 1) {
    exceptions.push("Employer CPF does not match CPF-applicable wage calculation");
  }
  if (complianceRules.mbmfEnabled && !isEmployeeMbmfEligible(employee) && mbmfDeduction > 0) {
    exceptions.push(`MBMF should not apply: ${getMbmfSkipReason(employee)}`);
  }
  if (complianceRules.mbmfEnabled && isEmployeeMbmfEligible(employee) && Math.abs(mbmfDeduction - expectedMbmf) > 1) {
    exceptions.push(`MBMF does not match Admin ${adminCpfConfiguration.mbmf?.applicableReligion || "Muslim"} employee contribution rule`);
  }
  if (complianceRules.grossIncreaseEnabled && employee.previousGrossPay && totalEarnings > employee.previousGrossPay * maxGrossIncreaseRatio) {
    exceptions.push(`Gross pay increased by more than ${complianceRules.maxGrossIncreasePercent}%`);
  }

  return exceptions;
}

function getEmployeeFinanceStatus(employee) {
  if (getEmployeeExceptions(employee).length) return "Hold";
  if (employee.financeStatus) return employee.financeStatus;
  return "Ready";
}

function getRunExceptions(run) {
  return (run?.employees || []).flatMap((employee) =>
    getEmployeeExceptions(employee).map((message) => ({
      employee,
      message
    }))
  );
}

function getComplianceChecks(run) {
  const complianceRules = getComplianceRules();
  const exceptions = getRunExceptions(run);
  const hasException = (keyword) => exceptions.some((item) => normalizePayrollLabel(item.message).includes(keyword));
  const allEmployees = run?.employees || [];
  const allHaveSdl = allEmployees.every((employee) =>
    Object.prototype.hasOwnProperty.call(employee, "sdl") ||
    getEmployeeEmployerItems(employee).some((item) => normalizePayrollLabel(item.label).includes("sdl"))
  );
  const hasLoanDeductions = allEmployees.some((employee) =>
    getEmployeeDeductionItems(employee).some((item) => normalizePayrollLabel(item.label).includes("loan"))
  );
  const maxOtherDeductionRatio = Number(complianceRules.maxOtherDeductionPercent || 30) / 100;
  const allLoansWithinLimit = allEmployees.every((employee) =>
    getEmployeeOtherDeductions(employee) <= getEmployeeTotalEarnings(employee) * maxOtherDeductionRatio
  );

  return [
    {
      label: "CPF rates and wage ceiling",
      enabled: complianceRules.cpfEnabled,
      status: !hasException("cpf"),
      detail: `${adminCpfConfiguration.rateTiers.length} Admin age tier(s), applied by staff CPF age group`
    },
    {
      label: "Bank account completeness",
      enabled: complianceRules.bankAccountEnabled,
      status: !hasException("missing bank account"),
      detail: "All approved staff must have a bank account before payment file generation"
    },
    {
      label: "Department completeness",
      enabled: complianceRules.departmentEnabled,
      status: !hasException("missing department"),
      detail: "Every staff payroll record must have a department"
    },
    {
      label: "Positive net pay",
      enabled: complianceRules.positiveNetPayEnabled,
      status: !hasException("net pay"),
      detail: "No employee should have zero or negative payable amount"
    },
    {
      label: "SDL employer contribution",
      enabled: complianceRules.sdlEnabled,
      status: allHaveSdl,
      detail: "Employer SDL item is available for every staff record"
    },
    {
      label: "MBMF eligibility",
      enabled: complianceRules.mbmfEnabled,
      status: !hasException("mbmf"),
      detail: adminCpfConfiguration.mbmf?.enabled
        ? `Applied only when staff religion is ${adminCpfConfiguration.mbmf.applicableReligion}`
        : "MBMF is disabled in Admin settings"
    },
    {
      label: "Loan and recovery deductions",
      enabled: complianceRules.loanRecoveryEnabled,
      status: !hasLoanDeductions || allLoansWithinLimit,
      detail: hasLoanDeductions
        ? `Loan deductions are checked against the Admin ${complianceRules.maxOtherDeductionPercent}% limit`
        : "No loan deductions in this pay run"
    },
    {
      label: "Gross pay variance",
      enabled: complianceRules.grossIncreaseEnabled,
      status: !hasException("gross pay increased"),
      detail: `Gross pay increase threshold: ${complianceRules.maxGrossIncreasePercent}%`
    },
    {
      label: "Finance approval lock",
      enabled: complianceRules.financeApprovalLockEnabled,
      status: Boolean(run?.approvedAt),
      detail: run?.approvedAt ? `Payroll locked on ${formatDateTime(run.approvedAt)}` : "Payroll is not locked until Finance approval"
    },
    {
      label: "Payment deadline readiness",
      enabled: complianceRules.paymentDeadlineEnabled,
      status: Boolean(run?.paymentFileGeneratedAt || run?.paidAt),
      detail: `CPF/payment due reference: ${adminCpfConfiguration.paymentDue}`
    },
    {
      label: "Audit trail available",
      enabled: complianceRules.auditTrailEnabled,
      status: Boolean(run?.timeline?.length),
      detail: `${run?.timeline?.length || 0} workflow event(s) captured`
    }
  ].filter((check) => check.enabled);
}

function getComplianceSummary(run) {
  const checks = getComplianceChecks(run);
  const passed = checks.filter((check) => check.status).length;

  return {
    checks,
    failed: checks.length - passed,
    passed,
    total: checks.length
  };
}

// -----------------------------------------------------------------------------
// 5. Workflow, Modern Treasury and payment-file helpers
// -----------------------------------------------------------------------------

function canApprovePayrollRun(run) {
  const employees = run?.employees || [];
  return employees.length > 0 && employees.every((employee) => getEmployeeFinanceStatus(employee) === "Approved");
}

function getCompletedSteps(run) {
  const state = getFinanceWorkflowState(run);
  return {
    ...state,
    statutoryDeductionsLogged: Boolean(run?.cpfSubmissionLoggedAt && run?.otherDeductionsLoggedAt),
  };
}

function getStatusClass(status) {
  const normalizedStatus = String(status || "").toLowerCase();

  if (normalizedStatus.includes("reconciled") || normalizedStatus.includes("recorded")) {
    return "border-[#2f8758]/25 bg-[#2f8758]/10 text-[#2f8758]";
  }

  if (normalizedStatus.includes("approved") || normalizedStatus.includes("paid") || normalizedStatus.includes("sent")) {
    return "border-[#2D7C83]/25 bg-[#2D7C83]/10 text-[#2D7C83]";
  }

  if (normalizedStatus.includes("exception")) {
    return "border-[#D97706]/25 bg-[#D97706]/10 text-[#9A6412]";
  }

  return "border-[#f0d2ca] bg-white/80 text-[#7b6660]";
}

function createTimelineEntry(action, owner = "Finance") {
  return {
    action,
    at: new Date().toISOString(),
    owner
  };
}

function getAuditEntries(run) {
  return [...(run?.timeline || [])].sort((first, second) => new Date(second.at) - new Date(first.at));
}

function buildPaymentFileRows(run) {
  return [
    ["Employee ID", "Employee Name", "Bank Type", "Bank Account", "Net Pay", "Payroll Period"],
    ...(run?.employees || [])
      .filter((employee) => getEmployeeFinanceStatus(employee) === "Approved")
      .map((employee) => [
        employee.id,
        employee.name,
        employee.bankType || "Missing bank type",
        employee.bankAccount || "Missing bank account",
        getEmployeeNetPay(employee).toFixed(2),
        formatPayrollPeriod(run)
      ])
  ];
}

function getApprovedPaymentRecipients(run) {
  return (run?.employees || [])
    .filter((employee) => getEmployeeFinanceStatus(employee) === "Approved")
    .map((employee) => ({
      employeeId: employee.id,
      employeeName: employee.name,
      bankName: employee.bankType,
      bankAccount: employee.bankAccount,
      amount: getEmployeeNetPay(employee),
      currency: "SGD",
      modernTreasuryCounterpartyId: employee.modernTreasuryCounterpartyId,
      modernTreasuryReceivingAccountId: employee.modernTreasuryReceivingAccountId
    }));
}

function getMissingModernTreasuryRecipientCount(run) {
  return (run?.employees || []).filter(
    (employee) =>
      getEmployeeFinanceStatus(employee) === "Approved" &&
      (!employee.modernTreasuryCounterpartyId || !employee.modernTreasuryReceivingAccountId)
  ).length;
}

function getCpfDeductionProcessRows(run) {
  const totals = getRunTotals(run);

  return [
    {
      key: "cpf",
      label: "CPF Payable",
      amount: totals.employeeCpf + totals.employerCpf,
      detail: `Employee ${formatMoney(totals.employeeCpf)} + employer ${formatMoney(totals.employerCpf)}`,
      status: run?.cpfSubmissionLoggedAt ? "Logged" : "Pending",
      completedAt: run?.cpfSubmissionLoggedAt
    },
    {
      key: "mbmf",
      label: "MBMF Payable",
      amount: totals.employeeMbmf,
      detail: `Employee wage-band deductions ${formatMoney(totals.employeeMbmf)}`,
      status: run?.cpfSubmissionLoggedAt ? "Logged with CPF" : "Pending",
      completedAt: run?.cpfSubmissionLoggedAt
    },
    {
      key: "otherDeductions",
      label: "Other Deduction Recovery",
      amount: totals.otherDeductions,
      detail: "Loans, salary advances and other recoveries",
      status: run?.otherDeductionsLoggedAt ? "Logged" : "Pending",
      completedAt: run?.otherDeductionsLoggedAt
    }
  ];
}

// -----------------------------------------------------------------------------
// 6. PDF generation helpers
// -----------------------------------------------------------------------------

function createPdfBlob({ footer, summaryRows = [], tableRows = [], subtitle, title }) {
  return createPayrollReportPdf({
    category: "FINANCE PAYROLL",
    categorySubtitle: "Payroll controls, statutory reporting and reconciliation",
    footer: footer || "Prepared by Finance Payroll.",
    summaryRows,
    tableRows,
    subtitle,
    title
  });
}

function downloadPdf(filename, pdfBlob) {
  const url = URL.createObjectURL(pdfBlob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

// -----------------------------------------------------------------------------
// 7. Shared UI components
// -----------------------------------------------------------------------------

function PageShell({ heading, children, actions }) {
  return (
    <section>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#F38978]/80">
            Finance Payroll Workflow
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-[#251E1F]">{heading}</h2>
        </div>
        {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function ActionButton({ children, disabled = false, disabledReason = "", icon: Icon, onClick, type = "button", variant = "primary" }) {
  const isBlockedWithReason = Boolean(disabled && disabledReason);
  const className =
    variant === "secondary"
      ? "inline-flex items-center justify-center gap-2 rounded-xl border border-[#f0d2ca] bg-white/80 px-4 py-2.5 text-sm font-semibold text-[#251E1F] transition hover:bg-[#FDD9CD]/45"
      : variant === "success"
        ? "inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-600 bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
        : variant === "warning"
          ? "inline-flex items-center justify-center gap-2 rounded-xl border border-orange-500 bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600"
      : "primary-button inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold";
  const handleClick = () => {
    if (isBlockedWithReason) {
      window.alert(disabledReason);
      return;
    }

    onClick?.();
  };

  return (
    <button
      type={type}
      className={`${className} ${(disabled || isBlockedWithReason) ? "cursor-not-allowed opacity-60" : ""} disabled:cursor-not-allowed disabled:opacity-60`}
      onClick={handleClick}
      disabled={disabled && !isBlockedWithReason}
      aria-disabled={disabled || undefined}
      title={isBlockedWithReason ? disabledReason : undefined}
    >
      {Icon ? <Icon size={17} aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

function EmptyState({ message }) {
  return (
    <div className="rounded-xl border border-dashed border-[#f0d2ca] bg-white/80 p-6 text-sm text-[#7b6660]">
      {message}
    </div>
  );
}

function WorkflowCard({ run, step }) {
  const Icon = step.icon;
  const completed = getCompletedSteps(run)[step.key];
  const tones = {
    reviewed: ["bg-[#e7effd] text-[#3564a4] ring-[#4778ba]/25", "text-[#4778ba]"],
    approved: ["bg-[#eee9fb] text-[#6348a2] ring-[#7156b2]/25", "text-[#7156b2]"],
    paid: ["bg-[#eaf8f0] text-[#28724d] ring-[#36855d]/25", "text-[#36855d]"],
    payslipsSent: ["bg-[#fce9e4] text-[#a84f37] ring-[#bd684f]/25", "text-[#bd684f]"],
    statutoryDeductionsLogged: ["bg-[#fdf2dc] text-[#9f6519] ring-[#bd7b22]/25", "text-[#bd7b22]"],
    ledgerRecorded: ["bg-[#e3f4f4] text-[#286f75] ring-[#2d7c83]/25", "text-[#2d7c83]"],
    reconciled: ["bg-[#eee9fb] text-[#6348a2] ring-[#7156b2]/25", "text-[#7156b2]"]
  };
  const [iconTone, checkTone] = tones[step.key] || ["bg-[#fce9e4] text-[#a84f37] ring-[#bd684f]/25", "text-[#bd684f]"];

  return (
    <article className="app-panel rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3">
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl ring-1 ${iconTone}`}>
          <Icon size={24} />
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${completed ? "border-[#2f8758]/25 bg-[#2f8758]/10 text-[#2f8758]" : "border-[#f0d2ca] bg-white/80 text-[#7b6660]"}`}>
          {completed ? "Completed" : "Pending"}
        </span>
      </div>
      <h3 className="mt-5 text-base font-semibold text-[#251E1F]">{step.title}</h3>
      <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-[#F38978]">Owner: {step.owner}</p>
      <p className="mt-2 text-xs text-[#7b6660]">{completed ? `Completed ${formatDateTime(run?.[`${step.key}At`] || run?.updatedAt)}` : getRunExceptions(run).length ? `${getRunExceptions(run).length} blocker(s) require correction` : "Ready when the previous stage is complete"}</p>
      <ul className="mt-3 space-y-2 text-sm text-[#7b6660]">
        {step.details.map((detail) => (
          <li key={detail} className="flex gap-2">
            <CheckCircle2 size={16} className={`mt-0.5 shrink-0 ${checkTone}`} />
            <span>{detail}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

function ExceptionPanel({ run }) {
  const exceptions = getRunExceptions(run);
  const [expandedException, setExpandedException] = useState("");
  const [review, setReview] = useState({ completed: false, running: false, checkedAt: "", serverErrors: [], error: "" });
  useEffect(() => {
    setExpandedException("");
    setReview({ completed: false, running: false, checkedAt: "", serverErrors: [], error: "" });
  }, [run.id, run.updatedAt]);
  const runReview = async () => {
    setReview((current) => ({ ...current, running: true, error: "" }));
    try {
      await validateFinancePayrollRun(run.id);
      setReview({ completed: true, running: false, checkedAt: new Date().toISOString(), serverErrors: [], error: "" });
    } catch (reviewError) {
      const serverErrors = Array.isArray(reviewError.details) ? reviewError.details : [];
      setReview({ completed: Boolean(serverErrors.length), running: false, checkedAt: new Date().toISOString(), serverErrors, error: serverErrors.length ? "" : reviewError.message });
    }
  };
  useEffect(() => {
    runReview();
  }, [run.id]);
  const runWarnings = review.serverErrors.filter((item) => !item.payrollId);
  const groupedExceptions = Object.values(
    exceptions.reduce((groups, item) => {
      const group = groups[item.message] || {
        message: item.message,
        employees: []
      };

      if (!group.employees.some((employee) => employee.id === item.employee.id)) {
        group.employees.push(item.employee);
      }

      groups[item.message] = group;
      return groups;
    }, {})
  );

  return (
    <div className="app-panel rounded-2xl p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-[#251E1F]">Automated Exception Review</h3>
          <p className="mt-1 text-sm text-[#7b6660]">System validation before Finance approves payment.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2"><span className={`w-fit rounded-full border px-3 py-1 text-xs font-semibold ${!review.completed ? "border-[#f0d2ca] bg-white text-[#7b6660]" : exceptions.length ? "border-[#D97706]/25 bg-[#D97706]/10 text-[#9A6412]" : "border-[#2f8758]/25 bg-[#2f8758]/10 text-[#2f8758]"}`}>{!review.completed ? "Not checked" : exceptions.length ? `${exceptions.length} exception(s)` : "No exceptions"}</span><ActionButton icon={review.running ? Loader2 : RefreshCw} variant="secondary" disabled={review.running} onClick={runReview}>{review.running ? "Running review..." : review.completed ? "Run review again" : "Run automated review"}</ActionButton></div>
      </div>
      {!review.completed && !review.error ? <div className="mt-5 rounded-xl border border-dashed border-[#f0d2ca] bg-[#fff8f5] p-5 text-sm text-[#7b6660]"><strong className="block text-[#251E1F]">Review has not been run for this page session.</strong><span className="mt-1 block">Select Run automated review to check the stored payroll snapshot and show affected staff.</span></div> : null}
      {review.error ? <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{review.error}</div> : null}
      {review.completed && runWarnings.length ? <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"><strong>Run-level warning:</strong> {runWarnings.map((item) => item.message).join(" ")}</div> : null}
      {review.completed ? <div className="mt-5 grid gap-3">
        {groupedExceptions.length ? (
          groupedExceptions.map((group) => (
            <div key={group.message} className="rounded-xl border border-[#D97706]/20 bg-[#D97706]/10 p-4 text-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-[#251E1F]">{group.message}</p>
                  <p className="mt-1 text-xs text-[#9A6412]/80">
                    Click the affected user count to view staff with this issue.
                  </p>
                </div>
                <button
                  type="button"
                  className="w-fit rounded-full border border-[#D97706]/30 bg-[#D97706]/10 px-3 py-1 text-xs font-semibold text-[#9A6412] transition hover:bg-[#D97706]/20"
                  onClick={() => setExpandedException((current) => (current === group.message ? "" : group.message))}
                >
                  {group.employees.length} user(s)
                </button>
              </div>
              {expandedException === group.message ? (
                <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {group.employees.map((employee) => (
                    <div key={employee.id} className="rounded-lg border border-[#f0d2ca] bg-white/80 p-3">
                      <p className="font-semibold text-[#251E1F]">{employee.name}</p>
                      <p className="mt-1 text-xs text-[#7b6660]">{employee.department || "Missing department"}</p>
                      <p className="mt-1 text-xs text-[#7b6660]">Net pay: {formatMoney(getEmployeeNetPay(employee))}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ))
        ) : (
          <EmptyState message="All selected payroll records passed automated checks." />
        )}
      </div> : null}
      {review.checkedAt ? <p className="mt-3 text-right text-xs text-[#7b6660]">Last checked {formatDateTime(review.checkedAt)}</p> : null}
    </div>
  );
}

function AdminCpfConfigPanel() {
  const updatedAt = adminCpfConfiguration.updatedAt;
  const lastUpdatedLabel = updatedAt ? formatDateTime(updatedAt) : "Database timestamp not recorded";
  const rows = [
    ["CPF Rate Tiers", `${adminCpfConfiguration.rateTiers.length} age group(s)`],
    ["Rate Source", adminCpfConfiguration.source],
    ["Monthly Wage Ceiling", formatMoney(adminCpfConfiguration.monthlyWageCeiling)],
    ["Effective From", adminCpfConfiguration.effectiveFrom],
    ["Payment Due", adminCpfConfiguration.paymentDue],
    ["MBMF Rule", adminCpfConfiguration.mbmf?.enabled ? `CPF Board wage bands; ${adminCpfConfiguration.mbmf.applicableReligion} staff only` : "Disabled"]
  ];
  const componentRows = Object.entries(adminCpfConfiguration.componentRules);
  const deductionRows = Object.entries(adminCpfConfiguration.deductionRules || {});

  return (
    <div className="app-panel rounded-2xl p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-[#251E1F]">Admin Payroll Rules</h3>
          <p className="mt-1 text-sm text-[#7b6660]">Read-only CPF, component and statutory contribution rules from Admin.</p>
          <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-[#F38978]/80">
            Last updated: <span className="normal-case tracking-normal text-[#251E1F]">{lastUpdatedLabel}</span>
          </p>
        </div>
        <span className="w-fit rounded-full border border-[#2D7C83]/25 bg-[#2D7C83]/10 px-3 py-1 text-xs font-semibold text-[#2D7C83]">
          Admin controlled
        </span>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {rows.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-[#f0d2ca] bg-white/80 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#F38978]/80">{label}</p>
            <p className="mt-2 text-sm font-semibold text-[#251E1F]">{value}</p>
          </div>
        ))}
      </div>
      <div className="mt-5 overflow-hidden rounded-xl border border-[#f0d2ca]">
        <div className="grid grid-cols-3 gap-3 border-b border-[#f0d2ca] bg-white/80 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#F38978]/80">
          <span>Age Group</span>
          <span>Employee CPF</span>
          <span>Employer CPF</span>
        </div>
        {adminCpfConfiguration.rateTiers.map((tier) => (
          <div key={tier.ageGroup} className="grid grid-cols-3 gap-3 border-b border-[#f0d2ca] px-4 py-3 text-sm last:border-b-0">
            <span className="font-semibold text-[#251E1F]">{tier.ageGroup}</span>
            <span className="text-[#7b6660]">{tier.employeeOrdinaryRate}%</span>
            <span className="text-[#7b6660]">{tier.employerOrdinaryRate}%</span>
          </div>
        ))}
      </div>
      <div className="mt-5 overflow-hidden rounded-xl border border-[#f0d2ca]">
        <div className="grid grid-cols-3 gap-3 border-b border-[#f0d2ca] bg-white/80 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#F38978]/80">
          <span>Component</span>
          <span>CPF</span>
          <span>Wage Type</span>
        </div>
        {componentRows.map(([component, rule]) => (
          <div key={component} className="grid grid-cols-3 gap-3 border-b border-[#f0d2ca] px-4 py-3 text-sm last:border-b-0">
            <span className="font-semibold capitalize text-[#251E1F]">{component}</span>
            <span className={rule.cpfApplicable ? "font-semibold text-[#2f8758]" : "text-[#7b6660]"}>
              {rule.cpfApplicable ? "Applicable" : "Excluded"}
            </span>
            <span className="text-[#7b6660]">{rule.wageType}</span>
          </div>
        ))}
      </div>
      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <div className="overflow-hidden rounded-xl border border-[#f0d2ca]">
          <div className="grid grid-cols-3 gap-3 border-b border-[#f0d2ca] bg-white/80 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#F38978]/80">
            <span>Deduction</span>
            <span>Type</span>
            <span>CPF Wage Base</span>
          </div>
          {deductionRows.map(([deduction, rule]) => (
            <div key={deduction} className="grid grid-cols-3 gap-3 border-b border-[#f0d2ca] px-4 py-3 text-sm last:border-b-0">
              <span className="font-semibold capitalize text-[#251E1F]">{deduction}</span>
              <span className="text-[#7b6660]">{rule.type}</span>
              <span className="text-[#7b6660]">{rule.affectsCpfWageBase ? "Affects" : "No effect"}</span>
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-[#2D7C83]/25 bg-[#2D7C83]/10 p-4">
          <h4 className="text-sm font-semibold text-[#251E1F]">MBMF Applicability</h4>
          <p className="mt-2 text-sm text-[#2D7C83]">
            Finance applies MBMF only when staff religion is {adminCpfConfiguration.mbmf?.applicableReligion || "Muslim"}.
            Other religions are skipped even if the deduction item appears in the payroll upload.
          </p>
          <div className="mt-4 grid gap-2 text-sm text-[#7b6660]">
            <div className="flex justify-between gap-3">
              <span>Rate type</span>
              <span className="font-semibold text-[#251E1F]">{adminCpfConfiguration.mbmf?.rateType || "Not configured"}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span>Employee rate</span>
              <span className="font-semibold text-[#251E1F]">CPF Board wage band</span>
            </div>
            <div className="flex justify-between gap-3">
              <span>Employer rate</span>
              <span className="font-semibold text-[#251E1F]">Not applicable</span>
            </div>
            <div className="flex justify-between gap-3">
              <span>Wage ceiling</span>
              <span className="font-semibold text-[#251E1F]">{formatMoney(adminCpfConfiguration.mbmf?.monthlyWageCeiling)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span>Employee payable account</span>
              <span className="text-right font-semibold text-[#251E1F]">{adminCpfConfiguration.mbmf?.employeePayableAccount || "Not configured"}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span>Employer expense account</span>
              <span className="text-right font-semibold text-[#251E1F]">{adminCpfConfiguration.mbmf?.employerExpenseAccount || "Not configured"}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FinanceComplianceRulesPanel({ catalogue, loading }) {
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");
  if (loading) return <div className="app-panel flex items-center gap-3 rounded-2xl p-8 text-sm text-[#7b6660]"><Loader2 size={18} className="motion-safe:animate-spin"/>Loading the effective Admin payroll rules…</div>;
  const rules = catalogue?.rules || [];
  const categories = catalogue?.categories || [];
  const normalizedQuery = query.trim().toLowerCase();
  const visibleRules = rules.filter((rule) => (category === "All" || rule.category === category) && (!normalizedQuery || [rule.name, rule.category, rule.value, rule.source, rule.usage].some((value) => String(value || "").toLowerCase().includes(normalizedQuery))));
  const overrides = rules.filter((rule) => rule.source === "Admin Override").length;
  const usageLabel = { calculation: "Payroll calculation", validation: "Compliance validation", reference: "Reference only" };
  return <div className="space-y-5">
    <section className="app-panel overflow-hidden rounded-2xl"><div className="border-b border-[#f0d2ca] bg-gradient-to-r from-[#2D7C83]/10 via-white to-[#F38978]/10 p-6"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div className="flex gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#2D7C83] text-white"><ShieldCheck size={22}/></span><div><h2 className="text-lg font-semibold text-[#251E1F]">Effective payroll compliance rules</h2><p className="mt-1 max-w-3xl text-sm text-[#7b6660]">This is the same resolved rule catalogue maintained by Payroll Admin. Finance uses these values for calculation, automated exception review, approval checks, and payroll snapshots.</p></div></div><span className="w-fit rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">Live Admin source · read only</span></div></div>
      <div className="grid gap-px bg-[#f0d2ca] sm:grid-cols-2 xl:grid-cols-4">{[["Rule groups", catalogue?.groupCount || 0], ["Active groups", catalogue?.activeGroupCount || 0], ["Admin overrides", overrides], ["Last synchronised", catalogue?.asOf ? formatDateTime(catalogue.asOf) : "Not available"]].map(([label,value]) => <div key={label} className="bg-white p-5"><p className="text-xs font-semibold uppercase tracking-wide text-[#7b6660]">{label}</p><strong className="mt-2 block text-lg text-[#251E1F]">{value}</strong></div>)}</div>
    </section>
    <section className="app-panel rounded-2xl p-5"><div className="flex flex-col gap-3 md:flex-row"><label className="flex flex-1 items-center gap-2 rounded-xl border border-[#f0d2ca] bg-white px-3 py-2.5"><Search size={16} className="text-[#F38978]"/><span className="sr-only">Search rules</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search rule, value, source, or usage" className="w-full bg-transparent text-sm outline-none"/></label><label><span className="sr-only">Rule category</span><select value={category} onChange={(event) => setCategory(event.target.value)} className="min-w-56 rounded-xl border border-[#f0d2ca] bg-white px-3 py-2.5 text-sm font-semibold outline-none"><option>All</option>{categories.map((item) => <option key={item.category}>{item.category}</option>)}</select></label></div><div className="mt-3 flex flex-wrap gap-2">{categories.map((item) => <span key={item.category} className="rounded-full bg-[#fff8f5] px-3 py-1 text-xs text-[#7b6660]">{item.category}: <b>{item.active}/{item.count} active</b></span>)}</div></section>
    <section className="app-panel overflow-hidden rounded-2xl"><div className="overflow-x-auto"><table className="min-w-[72rem] w-full text-left text-sm"><thead className="bg-[#fff8f5] text-xs uppercase tracking-wide text-[#7b6660]"><tr><th className="px-5 py-4">Rule</th><th>Current value</th><th>Payroll use</th><th>Source</th><th>Effective from</th><th>Status</th><th className="pr-5">Last update</th></tr></thead><tbody className="divide-y divide-[#f0d2ca]">{visibleRules.map((rule) => <tr key={rule.key} className="align-top transition-colors hover:bg-[#fff8f5]/70"><td className="px-5 py-4"><strong className="text-[#251E1F]">{rule.name}</strong><small className="mt-1 block text-[#7b6660]">{rule.category}</small>{rule.details?.length ? <details className="mt-2"><summary className="cursor-pointer text-xs font-semibold text-[#2D7C83]">View {rule.details.length} applied values</summary><dl className="mt-2 space-y-1 rounded-lg bg-[#2D7C83]/5 p-3">{rule.details.map((detail) => <div key={detail.label} className="flex justify-between gap-4 text-xs"><dt className="capitalize text-[#7b6660]">{detail.label}</dt><dd className="text-right font-semibold">{detail.value}</dd></div>)}</dl></details> : null}</td><td className="py-4 font-semibold text-[#251E1F]">{rule.value}</td><td className="py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${rule.usage === "calculation" ? "bg-blue-50 text-blue-700" : rule.usage === "validation" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{usageLabel[rule.usage] || "Reference only"}</span></td><td className="py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${rule.source === "Admin Override" ? "bg-purple-50 text-purple-700" : "bg-slate-100 text-slate-600"}`}>{rule.source}</span></td><td className="py-4">{formatDate(rule.effectiveFrom)}</td><td className="py-4"><span className={`inline-flex items-center gap-1.5 font-semibold ${rule.isActive ? "text-emerald-700" : "text-red-600"}`}><span className={`h-2 w-2 rounded-full ${rule.isActive ? "bg-emerald-500" : "bg-red-500"}`}/>{rule.status}</span></td><td className="py-4 pr-5"><strong className="block">{rule.updatedAt ? formatDateTime(rule.updatedAt) : "Statutory baseline"}</strong><small className="text-[#7b6660]">{rule.updatedBy || "System default"}</small></td></tr>)}</tbody></table></div>{!visibleRules.length ? <div className="p-10 text-center text-sm text-[#7b6660]">No effective rules match the selected filters.</div> : null}</section>
    <section className="app-panel rounded-2xl p-5"><div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-semibold text-[#251E1F]">Supporting references</h3><p className="mt-1 text-sm text-[#7b6660]">Authoritative sources linked by Payroll Admin for the currently published rules.</p></div><span className="rounded-full bg-[#2D7C83]/10 px-3 py-1 text-xs font-semibold text-[#2D7C83]">Published version {catalogue?.publication?.version || 1}</span></div><div className="mt-4 grid gap-3 md:grid-cols-2">{[...new Map(rules.filter((rule) => rule.referenceUrl).map((rule) => [rule.referenceUrl, rule])).values()].map((rule) => <a key={rule.referenceUrl} href={rule.referenceUrl} target="_blank" rel="noreferrer" className="rounded-xl border border-[#f0d2ca] bg-white p-4 transition hover:border-[#2D7C83]"><strong className="block text-sm text-[#251E1F]">{rule.referenceTitle || rule.name}</strong><small className="mt-1 block truncate text-[#2D7C83]">{rule.referenceUrl}</small></a>)}</div>{!rules.some((rule) => rule.referenceUrl) ? <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">No supporting reference links have been published yet.</p> : null}</section>
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"><strong>How rule changes affect Finance:</strong> new payroll runs use the latest active Admin rules. Existing runs keep their immutable rule snapshot and display a recalculation warning if Admin changes rules before Finance approval.</div>
  </div>;
}

function CompliancePanel({ run }) {
  const { checks, failed, passed, total } = getComplianceSummary(run);
  const lastUpdatedLabel = run?.rulesVersion || "Stored snapshot";

  return (
    <div className="app-panel rounded-2xl p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-[#251E1F]">Compliance Checklist</h3>
          <p className="mt-1 text-sm text-[#7b6660]">Read-only results from the run snapshot; final validation is enforced by the server.</p>
          <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-[#F38978]/80">
            Rule version: <span className="normal-case tracking-normal text-[#251E1F]">{lastUpdatedLabel}</span>
          </p>
        </div>
        <span className={`w-fit rounded-full border px-3 py-1 text-xs font-semibold ${failed ? "border-[#D97706]/25 bg-[#D97706]/10 text-[#9A6412]" : "border-[#2f8758]/25 bg-[#2f8758]/10 text-[#2f8758]"}`}>
          {passed}/{total} passed
        </span>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {checks.map((check) => (
          <div key={check.label} className={`rounded-xl border p-4 ${check.status ? "border-[#2f8758]/20 bg-[#2f8758]/10" : "border-[#D97706]/20 bg-[#D97706]/10"}`}>
            <div className="flex items-start gap-3">
              <CheckCircle2 size={18} className={`mt-0.5 shrink-0 ${check.status ? "text-[#2f8758]" : "text-[#9A6412]"}`} />
              <div>
                <p className="font-semibold text-[#251E1F]">{check.label}</p>
                <p className="mt-1 text-sm text-[#7b6660]">{check.detail}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AuditTrailPanel({ run }) {
  const auditEntries = getAuditEntries(run);

  return (
    <div className="app-panel rounded-2xl p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-[#251E1F]">Audit Trail</h3>
          <p className="mt-1 text-sm text-[#7b6660]">Workflow activity captured for Finance review and audit readiness.</p>
        </div>
        <span className="w-fit rounded-full border border-[#2D7C83]/25 bg-[#2D7C83]/10 px-3 py-1 text-xs font-semibold text-[#2D7C83]">
          {auditEntries.length} event(s)
        </span>
      </div>
      <div className="mt-5 grid gap-3">
        {auditEntries.length ? (
          auditEntries.slice(0, 8).map((entry, index) => (
            <div key={`${entry.action}-${entry.at}-${index}`} className="grid gap-3 rounded-xl border border-[#f0d2ca] bg-white/80 p-4 text-sm md:grid-cols-[10rem_1fr_8rem]">
              <span className="font-semibold text-[#251E1F]">{formatDateTime(entry.at)}</span>
              <span className="text-[#7b6660]">{entry.action}</span>
              <span className="text-right font-semibold text-[#F38978] md:text-left">{entry.owner}</span>
            </div>
          ))
        ) : (
          <EmptyState message="No audit trail events have been captured yet." />
        )}
      </div>
    </div>
  );
}

function StatCard({ detail, label, tone = "text-[#251E1F]", value }) {
  return (
    <div className="app-panel rounded-2xl p-5">
      <p className="text-sm text-[#7b6660]">{label}</p>
      <p className={`mt-3 text-3xl font-semibold ${tone}`}>{value}</p>
      {detail ? <p className="mt-2 text-xs font-semibold text-[#7b6660]">{detail}</p> : null}
    </div>
  );
}

function PayrollStatsFilter({ filter, onFilterChange, resultCount }) {
  const anchor = filter.mode === "month" ? filter.value : filter.end;
  const usePreset = (months) => {
    if (months === 1) onFilterChange({ mode: "month", value: anchor });
    else onFilterChange({ mode: "range", months, start: shiftMonth(anchor, -(months - 1)), end: anchor });
  };
  return (
    <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-[#f0d2ca] bg-white/80 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F38978]/20 text-[#F38978]">
          <CalendarDays size={18} />
        </div>
        <div>
          <p className="text-sm font-semibold text-[#251E1F]">Payroll Statistics Filter</p>
          <p className="text-xs text-[#7b6660]">{resultCount} payroll run(s) included</p>
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="inline-flex rounded-xl border border-[#f0d2ca] bg-white/80 p-1">
          {[1, 3, 6, 12].map((months) => (
            <button
              key={months}
              type="button"
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${(months === 1 ? filter.mode === "month" : filter.mode === "range" && filter.months === months) ? "bg-[#F38978] text-white" : "text-[#7b6660] hover:bg-white/80"}`}
              onClick={() => usePreset(months)}
            >
              {months === 1 ? "Month" : `${months}M`}
            </button>
          ))}
        </div>
        {filter.mode === "month" ? <input type="month" value={filter.value} onChange={(event) => onFilterChange({ mode: "month", value: event.target.value })} className="rounded-xl border border-[#f0d2ca] bg-[#ffffff] px-3 py-2 text-sm font-semibold text-[#251E1F] outline-none"/> : <div className="flex items-center gap-2"><input aria-label="Payroll range start" type="month" value={filter.start} onChange={(event) => onFilterChange({ ...filter, months: 0, start: event.target.value })} className="rounded-xl border border-[#f0d2ca] bg-white px-3 py-2 text-sm font-semibold"/><span className="text-xs text-[#7b6660]">to</span><input aria-label="Payroll range end" type="month" value={filter.end} onChange={(event) => onFilterChange({ ...filter, months: 0, end: event.target.value })} className="rounded-xl border border-[#f0d2ca] bg-white px-3 py-2 text-sm font-semibold"/></div>}
      </div>
    </div>
  );
}

function RunSelector({ payrollRuns, selectedRunId, onSelectRun }) {
  return (
    <label className="flex min-w-[17rem] items-center gap-2 rounded-xl border border-[#f0d2ca] bg-white/80 px-3 py-2.5">
      <Search size={16} className="text-[#F38978]" />
      <select
        value={selectedRunId}
        onChange={(event) => onSelectRun(event.target.value)}
        className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-[#251E1F] outline-none"
      >
        {payrollRuns.map((run) => (
          <option key={run.id} value={run.id} className="bg-[#ffffff]">
            {formatPayrollPeriod(run)} · {formatPayrollRunId(run)} · {run.status}
          </option>
        ))}
      </select>
    </label>
  );
}

function FinancePayrollJourney({ run, isLiveUpdating = false, lastSyncAt = null, activityLabel = "" }) {
  const navigate = useNavigate();
  const completed = getCompletedSteps(run);
  const exceptions = getRunExceptions(run).length;
  const approvedStaff = (run?.employees || []).filter((employee) => getEmployeeFinanceStatus(employee) === "Approved").length;
  const allStaffReviewed = Boolean(run?.employees?.length) && approvedStaff === run.employees.length && exceptions === 0;
  const recipientsReady = Number(run?.paymentRecipientsConfigured || 0) >= (run?.employees?.length || 0);
  const finalised = completed.reconciled;
  // Persisted downstream milestones are authoritative. Employee display statuses can
  // change during delivery, but a paid run cannot regress to review or approval.
  const payrollLocked = completed.approved || completed.paid || Boolean(run?.paymentSubmittedAt || run?.paymentFileGeneratedAt);
  const staffReviewComplete = finalised || payrollLocked || allStaffReviewed;
  const stages = [
    ["Claim requests", "/dashboard/payroll/finance/employee-requests", finalised || Boolean(run?.submittedAt), false, "Snapshotted"],
    ["Payroll run review", "/dashboard/payroll/finance/payroll-runs", finalised || completed.reviewed, !finalised && Boolean(run?.rulesChanged), "Review"],
    ["Staff review", "/dashboard/payroll/finance/staff-payroll-details", staffReviewComplete, !staffReviewComplete && exceptions > 0, "Adjust"],
    ["Payroll approval", "/dashboard/payroll/finance/payroll-approval", finalised || payrollLocked, !payrollLocked && (!completed.reviewed || !allStaffReviewed), "Approve"],
    ["Payment preparation", "/dashboard/payroll/finance/payment-preparation", finalised || Boolean(run?.paymentFileGeneratedAt && recipientsReady), !finalised && !completed.approved, "Prepare"],
    ["Payment release", "/dashboard/payroll/finance/payment-release", finalised || completed.paid, !finalised && !run?.paymentFileGeneratedAt, run?.paymentStatus === "Processing" ? "Processing" : run?.paymentStatus === "Failed" ? "Failed" : "Release"],
    ["Payslip delivery (HR)", "/dashboard/payroll/finance/payment-release", finalised || completed.payslipsSent, !finalised && !completed.paid, run?.payslipDelivery?.failed ? `${run.payslipDelivery.failed} failed` : "HR owned"],
    ["Statutory & ledger", "/dashboard/payroll/finance/statutory-ledger", finalised || completed.ledgerRecorded && completed.cpfLogged && completed.otherDeductionsLogged, !finalised && !completed.payslipsSent, "Record"],
    ["Reconcile & report", "/dashboard/payroll/finance/reconciliation-reports", completed.reconciled, !completed.ledgerRecorded, "Reconcile"]
  ];
  const currentIndex = stages.findIndex((stage) => !stage[2] && !stage[3]);
  const trackerStages = stages.map(([label, path, done, blocked, fallback], index) => {
    const current = index === currentIndex;
    return {
      key: `${path}:${label}`,
      label,
      path,
      status: blocked ? "blocked" : done ? "completed" : current ? "current" : "upcoming",
      detail: blocked ? "Blocked" : done ? "Complete" : current ? "Current" : fallback || "Upcoming"
    };
  });
  return (
    <PayrollProgressTracker
      ariaLabel="Finance payroll progress"
      title="Payroll Run Progress"
      runId={formatPayrollRunId(run)}
      period={formatPayrollPeriod(run)}
      stages={trackerStages}
      onSelectStage={(stage) => navigate(stage.path)}
      className="mb-5"
      badge={<span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${isLiveUpdating ? "bg-blue-100 text-blue-700" : "bg-emerald-50 text-emerald-700"}`}><span className={`h-2 w-2 rounded-full ${isLiveUpdating ? "bg-blue-500 motion-safe:animate-pulse" : "bg-emerald-500"}`}/>{isLiveUpdating ? activityLabel || "Updating workflow…" : `Live${lastSyncAt ? ` · ${lastSyncAt.toLocaleTimeString("en-SG", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : ""}`}</span>}
    />
  );
}

function AccountingImpact({ payrollRuns = [], run }) {
  const availableRuns = payrollRuns.length ? payrollRuns : [run].filter(Boolean);
  const [accountingFilter, setAccountingFilter] = useState(() => getDefaultStatsFilter(run || availableRuns[0]));
  useEffect(() => {
    if (run || availableRuns[0]) setAccountingFilter(getDefaultStatsFilter(run || availableRuns[0]));
  }, [run?.id]);
  const filteredRuns = getFilteredPayrollRuns(availableRuns, accountingFilter);
  const totals = getAggregateAccountingTotals(filteredRuns);
  const mbmf = adminCpfConfiguration.mbmf || {};
  const postedRuns = filteredRuns.filter((payrollRun) => getCompletedSteps(payrollRun).ledgerRecorded).length;
  const updateAccountingMode = (mode) => {
    const runDate = getPayrollRunDate(run || availableRuns[0]);
    setAccountingFilter({
      mode,
      value: mode === "week" ? getWeekFilterValue(runDate) : getMonthFilterValue(runDate)
    });
  };
  const rows = [
    ["Salary Expense", totals.salaryExpense, "Salary Payable / Bank", totals.netPay],
    ["Employer CPF Expense", totals.employerCpf, "CPF Payable (Employee + Employer)", totals.employeeCpf + totals.employerCpf],
    ["SDL Expense", totals.sdl, "SDL Payable", totals.sdl],
    ["", 0, mbmf.employeePayableAccount || "MBMF Payable (Employee)", totals.employeeMbmf],
    ["", 0, "Other Deduction Payable", totals.otherDeductions]
  ];

  return (
    <div className="app-panel rounded-2xl p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-[#251E1F]">Accounting Impact in Internal Ledger</h3>
          <p className="mt-1 text-sm text-[#7b6660]">Journal totals for the selected accounting period.</p>
        </div>
        <span className={`w-fit rounded-full border px-3 py-1 text-xs font-semibold ${postedRuns === filteredRuns.length && filteredRuns.length ? "border-[#2f8758]/25 bg-[#2f8758]/10 text-[#2f8758]" : "border-[#f0d2ca] bg-white/80 text-[#7b6660]"}`}>
          {postedRuns}/{filteredRuns.length} posted
        </span>
      </div>
      <div className="mt-5">
        <PayrollStatsFilter
          filter={accountingFilter}
          resultCount={filteredRuns.length}
          onFilterChange={setAccountingFilter}
          onModeChange={updateAccountingMode}
        />
      </div>
      <div className="mt-5 overflow-x-auto">
        <table className="min-w-full text-left text-sm text-[#7b6660]">
          <thead className="text-xs uppercase tracking-wide text-[#F38978]/80">
            <tr>
              <th className="border-b border-[#f0d2ca] px-4 py-3">Account (Dr)</th>
              <th className="border-b border-[#f0d2ca] px-4 py-3">Debit</th>
              <th className="border-b border-[#f0d2ca] px-4 py-3">Account (Cr)</th>
              <th className="border-b border-[#f0d2ca] px-4 py-3">Credit</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([debitAccount, debit, creditAccount, credit]) => (
              <tr key={`${debitAccount}-${creditAccount}`}>
                <td className="border-b border-[#f0d2ca] px-4 py-3 font-semibold text-[#251E1F]">{debitAccount || "-"}</td>
                <td className="border-b border-[#f0d2ca] px-4 py-3">{debit ? formatMoney(debit) : "-"}</td>
                <td className="border-b border-[#f0d2ca] px-4 py-3 font-semibold text-[#251E1F]">{creditAccount}</td>
                <td className="border-b border-[#f0d2ca] px-4 py-3">{credit ? formatMoney(credit) : "-"}</td>
              </tr>
            ))}
            <tr className="font-semibold text-[#251E1F]">
              <td className="px-4 py-3">Total Debit</td>
              <td className="px-4 py-3">{formatMoney(totals.totalDebit)}</td>
              <td className="px-4 py-3">Total Credit</td>
              <td className="px-4 py-3">{formatMoney(totals.totalCredit)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CpfDeductionProcessPanel({ onAdvanceRun, run }) {
  const rows = getCpfDeductionProcessRows(run);
  const steps = getCompletedSteps(run);

  return (
    <div className="app-panel rounded-2xl p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-[#251E1F]">CPF & Deduction Remittance</h3>
          <p className="mt-1 text-sm text-[#7b6660]">
            Finance records statutory CPF/MBMF payables and employee deduction recoveries before ledger posting.
          </p>
        </div>
        <span className={`w-fit rounded-full border px-3 py-1 text-xs font-semibold ${steps.statutoryDeductionsLogged ? "border-[#2f8758]/25 bg-[#2f8758]/10 text-[#2f8758]" : "border-[#D97706]/25 bg-[#D97706]/10 text-[#9A6412]"}`}>
          {steps.statutoryDeductionsLogged ? "Ready for ledger" : "Action required"}
        </span>
      </div>
      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        {rows.map((row) => (
          <div key={row.key} className="rounded-xl border border-[#f0d2ca] bg-white/80 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-[#251E1F]">{row.label}</p>
              <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${row.completedAt ? "border-[#2f8758]/25 bg-[#2f8758]/10 text-[#2f8758]" : "border-[#f0d2ca] bg-white/80 text-[#7b6660]"}`}>
                {row.status}
              </span>
            </div>
            <p className="mt-3 text-2xl font-semibold text-[#251E1F]">{formatMoney(row.amount)}</p>
            <p className="mt-2 text-xs leading-5 text-[#7b6660]">{row.detail}</p>
            {row.completedAt ? <p className="mt-2 text-xs text-[#2f8758]">Logged {formatDateTime(row.completedAt)}</p> : null}
          </div>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        <ActionButton
          icon={ReceiptText}
          variant="secondary"
          disabled={!steps.paid || steps.cpfLogged}
          disabledReason={
            steps.cpfLogged
              ? "CPF and MBMF payables have already been logged."
              : !steps.paid
                ? "Process payroll payment before logging CPF payable."
                : ""
          }
          onClick={() => onAdvanceRun("cpfLogged")}
        >
          Log CPF Payable
        </ActionButton>
        <ActionButton
          icon={ListChecks}
          variant="secondary"
          disabled={!steps.paid || steps.otherDeductionsLogged}
          disabledReason={
            steps.otherDeductionsLogged
              ? "Other deduction recoveries have already been logged."
              : !steps.paid
                ? "Process payroll payment before logging other deductions."
                : ""
          }
          onClick={() => onAdvanceRun("otherDeductionsLogged")}
        >
          Log Other Deductions
        </ActionButton>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// 8. Dashboard and payroll-run workflow views
// -----------------------------------------------------------------------------

function DashboardMetricCard({ icon: Icon, iconClass, label, value, detail, valueClass = "text-[#251E1F]" }) {
  return <article className="app-panel flex items-center gap-4 rounded-2xl p-5"><span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${iconClass}`}><Icon size={23}/></span><div className="min-w-0"><p className="text-sm text-[#7b6660]">{label}</p><p className={`mt-1 truncate text-2xl font-semibold ${valueClass}`}>{value}</p><p className="mt-1 text-xs text-[#7b6660]">{detail}</p></div></article>;
}

function monthKey(year, month) { return `${year}-${String(month).padStart(2, "0")}`; }
function shiftMonth(key, offset) { const [year, month] = key.split("-").map(Number); const date = new Date(year, month - 1 + offset, 1); return monthKey(date.getFullYear(), date.getMonth() + 1); }
function monthRange(start, end) { const result = []; let cursor = start; while (cursor <= end && result.length < 24) { result.push(cursor); cursor = shiftMonth(cursor, 1); } return result; }

function MonthlyPayrollBarChart({ payrollRuns, selectedRun }) {
  const selectedKey = monthKey(selectedRun.year, selectedRun.month);
  const [metric, setMetric] = useState("totalFunding");
  const [preset, setPreset] = useState(6);
  const [start, setStart] = useState(shiftMonth(selectedKey, -5));
  const [end, setEnd] = useState(selectedKey);
  const applyPreset = (months) => { setPreset(months); setEnd(selectedKey); setStart(shiftMonth(selectedKey, -(months - 1))); };
  const periods = monthRange(start, end);
  const values = periods.map((key) => {
    const runs = payrollRuns.filter((run) => monthKey(run.year, run.month) === key);
    const totals = runs.reduce((sum, run) => { const item = getRunTotals(run); return { netPay: sum.netPay + item.netPay, gross: sum.gross + item.grossPay + item.allowances, totalFunding: sum.totalFunding + item.netPay + item.employeeCpf + item.employeeMbmf + item.employerCpf + item.employerMbmf + item.sdl }; }, { netPay: 0, gross: 0, totalFunding: 0 });
    return { key, value: totals[metric] };
  });
  const max = Math.max(...values.map((item) => item.value), 1);
  const metricLabels = { netPay: "Net Pay", gross: "Gross Earnings", totalFunding: "Total Funding" };
  return <section className="app-panel rounded-2xl p-6 lg:col-span-2"><div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between"><div><p className="text-xs font-semibold uppercase tracking-wide text-[#F38978]">Monthly payroll trend</p><h3 className="mt-1 text-lg font-semibold text-[#251E1F]">{metricLabels[metric]} by pay run</h3><p className="mt-1 text-sm text-[#7b6660]">Database-backed totals across the selected month range.</p></div><div className="flex flex-wrap gap-2">{Object.entries(metricLabels).map(([key, label]) => <button key={key} onClick={() => setMetric(key)} className={`rounded-lg px-3 py-2 text-xs font-semibold ${metric === key ? "bg-[#F38978] text-white" : "border border-[#f0d2ca] bg-white"}`}>{label}</button>)}</div></div>
    <div className="mt-5 flex flex-wrap items-end gap-3"><div className="flex rounded-xl border border-[#f0d2ca] bg-white p-1">{[3,6,12].map((months) => <button key={months} onClick={() => applyPreset(months)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${preset === months ? "bg-[#fce9e4] text-[#a84f37]" : "text-[#7b6660]"}`}>{months} months</button>)}</div><label className="text-xs text-[#7b6660]">From<input type="month" value={start} onChange={(e) => { setStart(e.target.value); setPreset(0); }} className="ml-2 rounded-lg border border-[#f0d2ca] px-2 py-1.5"/></label><label className="text-xs text-[#7b6660]">To<input type="month" value={end} onChange={(e) => { setEnd(e.target.value); setPreset(0); }} className="ml-2 rounded-lg border border-[#f0d2ca] px-2 py-1.5"/></label></div>
    {periods.length ? <><div className="mt-8 overflow-x-auto"><div className="flex h-64 min-w-[620px] items-end gap-3 border-b border-[#f0d2ca] px-3">{values.map((item) => <div key={item.key} className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end"><div className="mb-2 hidden whitespace-nowrap rounded-lg bg-[#251E1F] px-2 py-1 text-xs text-white group-hover:block">{formatMoney(item.value)}</div><div role="img" aria-label={`${item.key}: ${formatMoney(item.value)}`} className="w-full max-w-14 rounded-t-lg bg-gradient-to-t from-[#bd684f] to-[#F38978] transition hover:from-[#2d7c83] hover:to-[#54aab1]" style={{ height: `${item.value ? Math.max((item.value / max) * 190, 8) : 3}px` }}/><span className="mt-2 text-[11px] text-[#7b6660]">{new Intl.DateTimeFormat("en-SG", { month: "short", year: "2-digit" }).format(new Date(`${item.key}-01T00:00:00`))}</span></div>)}</div></div><table className="sr-only"><caption>{metricLabels[metric]} by month</caption><tbody>{values.map((item) => <tr key={item.key}><th>{item.key}</th><td>{item.value}</td></tr>)}</tbody></table></> : <EmptyState message="Choose a valid month range of up to 24 months."/>}
  </section>;
}

function DashboardView({ onAdvanceRun, onRecalculateRun, onSelectRun, payrollRuns, selectedRun }) {
  const navigate = useNavigate();
  const [validationStatus, setValidationStatus] = useState(null);
  const [validationLoading, setValidationLoading] = useState(false);
  useEffect(() => setValidationStatus(null), [selectedRun.id]);
  const [statsFilter, setStatsFilter] = useState(() => getDefaultStatsFilter(selectedRun));
  useEffect(() => setStatsFilter(getDefaultStatsFilter(selectedRun)), [selectedRun.id]);
  const filteredRuns = getFilteredPayrollRuns(payrollRuns, statsFilter);
  const stats = getAggregatePayrollStats(filteredRuns);
  const completedSteps = getCompletedSteps(selectedRun);
  const rulesChangedRuns = filteredRuns.filter((run) => run.rulesChanged);
  const exceptionRuns = filteredRuns.filter((run) => getRunExceptions(run).length > 0);
  const reviewRuns = filteredRuns.filter((run) => !run.rulesChanged && !getCompletedSteps(run).reviewed);
  const approvalRuns = filteredRuns.filter((run) => getCompletedSteps(run).reviewed && !getCompletedSteps(run).approved);
  const missingPaymentRuns = filteredRuns.filter((run) => getMissingModernTreasuryRecipientCount(run) > 0);
  const openRun = (run) => {
    onSelectRun(run.id);
    navigate("/dashboard/payroll/finance/payroll-runs");
  };
  const refreshServerValidation = async () => {
    setValidationLoading(true);
    try {
      const result = await validateFinancePayrollRun(selectedRun.id);
      setValidationStatus({ passed: true, checkedAt: result.checkedAt, errors: [] });
    } catch (error) {
      setValidationStatus({ passed: false, checkedAt: new Date().toISOString(), errors: error.details || [] });
    } finally {
      setValidationLoading(false);
    }
  };
  const actionItems = [
    { label: "Rules changed — recalculate", runs: rulesChangedRuns, tone: "text-amber-700" },
    { label: "Compliance exceptions", runs: exceptionRuns, tone: "text-[#D97706]" },
    { label: "Awaiting Finance review", runs: reviewRuns, tone: "text-[#2D7C83]" },
    { label: "Awaiting approval", runs: approvalRuns, tone: "text-[#F38978]" },
    { label: "Missing payment recipients", runs: missingPaymentRuns, tone: "text-[#9A6412]" }
  ];
  const activeActionItems = actionItems.filter((item) => item.runs.length > 0);
  const clearedActionCount = actionItems.length - activeActionItems.length;
  const selectedRunEmployees = selectedRun.employees || [];
  const selectedRunApprovedCount = selectedRunEmployees.filter((employee) => getEmployeeFinanceStatus(employee) === "Approved").length;
  const selectedRunExceptions = getRunExceptions(selectedRun).length;
  const nextAction = selectedRun.rulesChanged
    ? { label: "Recalculate with current Admin rules", onClick: onRecalculateRun, className: "bg-amber-600 hover:bg-amber-700" }
    : !completedSteps.reviewed
      ? { label: "Continue Finance review", onClick: () => openRun(selectedRun), className: "bg-[#2D7C83] hover:bg-[#24676c]" }
      : !completedSteps.approved
        ? { label: "Review and approve run", onClick: () => openRun(selectedRun), className: "bg-[#F38978] hover:bg-[#dc7566]" }
        : { label: "Open payroll workflow", onClick: () => openRun(selectedRun), className: "bg-[#2f8758] hover:bg-[#267149]" };
  const workflowChecklist = [
    { label: "Payroll reviewed and approved", completed: completedSteps.reviewed && completedSteps.approved },
    { label: "Payment processed", completed: completedSteps.paid },
    { label: "Payslips sent to employees", completed: completedSteps.payslipsSent },
    { label: "Payroll recorded in internal ledger", completed: completedSteps.ledgerRecorded },
    { label: "Payroll reconciled", completed: completedSteps.reconciled }
  ];
  const updateStatsMode = (mode) => {
    const runDate = getPayrollRunDate(selectedRun);
    setStatsFilter({
      mode,
      value: mode === "week" ? getWeekFilterValue(runDate) : getMonthFilterValue(runDate)
    });
  };

  return (
    <PageShell heading="Dashboard">
      <section className="relative mb-6 overflow-hidden rounded-2xl border border-[#efc8bd] bg-gradient-to-r from-white via-[#fffaf8] to-[#fdf0eb] p-5 shadow-[0_10px_30px_rgba(128,72,54,0.08)] sm:p-6">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#F38978] via-[#D97706] to-[#2D7C83]" />
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#fce9e4] text-[#c85f4e]"><LayoutDashboard size={23} /></span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#F38978]">Finance payroll control centre</p>
              <h2 className="mt-1 text-2xl font-semibold text-[#251E1F]">{formatPayrollPeriod(selectedRun)}</h2>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[#7b6660]">
                <span>{selectedRunEmployees.length || stats.employees} staff in this run</span>
                <span className="hidden h-1 w-1 rounded-full bg-[#c9aaa2] sm:block" />
                <span>Database-backed rules snapshot</span>
                <span className="hidden h-1 w-1 rounded-full bg-[#c9aaa2] sm:block" />
                <span>Last activity {formatDateTime(selectedRun.updatedAt || selectedRun.submittedAt)}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <span className={`w-fit rounded-full px-3 py-1.5 text-xs font-semibold ${selectedRun.rulesChanged ? "bg-amber-100 text-amber-800" : completedSteps.approved ? "bg-emerald-100 text-emerald-700" : "bg-[#e3f4f4] text-[#286f75]"}`}>
              {selectedRun.rulesChanged ? "Recalculation required" : completedSteps.approved ? "Finance approved" : "Finance review in progress"}
            </span>
            <RunSelector payrollRuns={payrollRuns} selectedRunId={selectedRun?.id} onSelectRun={onSelectRun} />
          </div>
        </div>
      </section>
      {selectedRun.rulesChanged ? (
        <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-amber-400/40 bg-amber-50 p-5 text-amber-900 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold">Admin payroll rules changed — recalculation required</p>
            <p className="mt-1 text-sm">{formatPayrollPeriod(selectedRun)} uses an older rules snapshot and cannot be approved until Finance recalculates and reviews it again.</p>
          </div>
          <ActionButton icon={RefreshCw} onClick={onRecalculateRun}>Recalculate now</ActionButton>
        </div>
      ) : null}
      <PayrollStatsFilter
        filter={statsFilter}
        resultCount={filteredRuns.length}
        onFilterChange={setStatsFilter}
        onModeChange={updateStatsMode}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><DashboardMetricCard icon={Users} iconClass="bg-[#fce9e4] text-[#a84f37]" label="Staff Awaiting Review" value={Math.max(stats.employees - stats.approvedStaff, 0)} detail={`${stats.approvedStaff}/${stats.employees} staff approved`} valueClass="text-[#D97706]"/><DashboardMetricCard icon={Banknote} iconClass="bg-[#eaf8f0] text-[#28724d]" label="Net Pay To Process" value={formatMoney(stats.netPay)} detail={`${stats.runs} payroll run(s)`} valueClass="text-[#2f8758]"/><DashboardMetricCard icon={FileText} iconClass="bg-[#e7effd] text-[#3564a4]" label="Payment Files" value={`${filteredRuns.filter((run) => run.paymentFileGeneratedAt).length}/${stats.runs}`} detail="Generated for filtered runs" valueClass="text-[#4778ba]"/><DashboardMetricCard icon={AlertCircle} iconClass="bg-[#fdf2dc] text-[#9f6519]" label="Compliance Exceptions" value={stats.exceptions} detail={`${stats.pendingRuns} pending run(s)`} valueClass={stats.exceptions ? "text-[#D97706]" : "text-[#2f8758]"}/><DashboardMetricCard icon={CalendarClock} iconClass="bg-[#eee9fb] text-[#6348a2]" label="Scheduled Release" value={selectedRun.scheduledReleaseAt ? new Intl.DateTimeFormat("en-SG", { day: "numeric", month: "short" }).format(new Date(selectedRun.scheduledReleaseAt)) : "Not set"} detail={selectedRun.releaseScheduleStatus || "Unscheduled"} valueClass="text-[#6348a2]"/></div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <section className="app-panel rounded-2xl p-6 lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-[#251E1F]">Action Required</h3>
              <p className="mt-1 text-sm text-[#7b6660]">Outstanding work for the selected dashboard period.</p>
            </div>
            <div className="text-right"><span className="rounded-full border border-[#f0d2ca] bg-white/80 px-3 py-1 text-xs font-semibold text-[#7b6660]">{activeActionItems.reduce((sum, item) => sum + item.runs.length, 0)} item(s)</span><p className="mt-2 text-xs text-[#2f8758]">{clearedActionCount} checks clear</p></div>
          </div>
          {activeActionItems.length ? <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {activeActionItems.map((item) => (
              <div key={item.label} className="rounded-xl border border-amber-200 bg-gradient-to-br from-white to-amber-50/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-[#7b6660]">{item.label}</span>
                  <span className={`text-lg font-semibold ${item.tone}`}>{item.runs.length}</span>
                </div>
                <p className="mt-2 text-xs text-[#9a7d75]">{item.runs.slice(0, 3).map(formatPayrollPeriod).join(" • ")}</p>
                <button type="button" className="mt-3 text-xs font-semibold text-[#F38978] hover:underline" onClick={() => openRun(item.runs[0])}>Open first affected run</button>
              </div>
            ))}
          </div> : <div className="mt-5 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700"><CheckCircle2 size={19}/><span>No action is required for the selected period.</span></div>}
        </section>
        <aside className="app-panel rounded-2xl p-6">
          <div className="flex items-center gap-3"><span className="admin-report-icon admin-report-icon--teal"><ClipboardCheck size={20}/></span><div><h3 className="text-lg font-semibold text-[#251E1F]">Current Pay Run</h3><p className="text-sm text-[#7b6660]">What Finance should do next.</p></div></div>
          <div className="mt-5 grid grid-cols-2 gap-3 rounded-xl border border-[#f0d2ca] bg-white/80 p-4 text-sm">
            <div><p className="text-xs text-[#7b6660]">Staff approved</p><p className="mt-1 font-semibold text-[#251E1F]">{selectedRunApprovedCount}/{selectedRunEmployees.length || stats.employees}</p></div>
            <div><p className="text-xs text-[#7b6660]">Exceptions</p><p className={`mt-1 font-semibold ${selectedRunExceptions ? "text-amber-700" : "text-emerald-700"}`}>{selectedRunExceptions}</p></div>
            <div><p className="text-xs text-[#7b6660]">Claim cutoff</p><p className="mt-1 font-semibold text-[#251E1F]">{selectedRun.effectiveClaimCutoffAt ? formatDateTime(selectedRun.effectiveClaimCutoffAt) : "Not set"}</p></div>
            <div><p className="text-xs text-[#7b6660]">Final approval</p><p className="mt-1 font-semibold text-[#251E1F]">{selectedRun.approvedAt ? "Approved" : "Pending"}</p></div>
          </div>
          <button type="button" onClick={nextAction.onClick} className={`mt-4 w-full rounded-xl px-4 py-3 text-sm font-semibold text-white transition ${nextAction.className}`}>{nextAction.label}</button>
          <details className="mt-4 rounded-xl border border-[#f0d2ca] bg-white/70 p-4">
            <summary className="cursor-pointer text-sm font-semibold text-[#7b6660]">Rules snapshot and audit details</summary>
          <div className="mt-4 space-y-3 text-sm">
            {[
              ["Rule version", selectedRun.rulesVersion || "Stored snapshot"],
              ["Snapshot identity", selectedRun.rulesHash ? `${selectedRun.rulesHash.slice(0, 12)}…` : "Stored in database"],
              ["Rules status", selectedRun.rulesChanged ? "Recalculation required" : "Matches current Admin rules"],
              ["Server validation", validationStatus ? `${validationStatus.passed ? "Passed" : `${validationStatus.errors.length || "One or more"} issue(s)`} · ${formatDateTime(validationStatus.checkedAt)}` : "Not checked in this session"],
              ["Recalculated", selectedRun.recalculatedAt ? formatDateTime(selectedRun.recalculatedAt) : "Not recalculated"],
              ["Recalculated by", selectedRun.recalculatedBy || "—"],
              ["Approved", selectedRun.approvedAt ? formatDateTime(selectedRun.approvedAt) : "Pending"]
            ].map(([label, value]) => <div key={label} className="flex items-start justify-between gap-3 border-b border-[#f0d2ca] pb-3"><span className="text-[#7b6660]">{label}</span><span className="text-right font-semibold text-[#251E1F]">{value}</span></div>)}
          </div>
          </details>
          <button type="button" disabled={validationLoading} className="mt-4 mr-4 text-sm font-semibold text-[#2D7C83] hover:underline disabled:opacity-60" onClick={refreshServerValidation}>{validationLoading ? "Checking…" : "Run server validation"}</button>
          <button type="button" className="mt-4 text-sm font-semibold text-[#F38978] hover:underline" onClick={() => navigate("/dashboard/payroll/finance/compliance-rules")}>View current compliance rules</button>
        </aside>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><DashboardMetricCard icon={Users} iconClass="bg-[#eaf8f0] text-[#28724d]" label="Employee CPF" value={formatMoney(stats.totals.employeeCpf)} detail="Filtered payroll liability"/><DashboardMetricCard icon={Building2} iconClass="bg-[#eee9fb] text-[#6348a2]" label="Employer CPF" value={formatMoney(stats.totals.employerCpf)} detail="Filtered employer contribution"/><DashboardMetricCard icon={ReceiptText} iconClass="bg-[#e3f4f4] text-[#286f75]" label="SDL & MBMF" value={formatMoney(stats.totals.sdl + stats.totals.employeeMbmf + stats.totals.employerMbmf)} detail="Filtered statutory amounts"/><DashboardMetricCard icon={Banknote} iconClass="bg-[#eaf8f0] text-[#28724d]" label="Total Payroll Funding" value={formatMoney(stats.totals.netPay + stats.totals.employeeCpf + stats.totals.employeeMbmf + stats.totals.employerCpf + stats.totals.employerMbmf + stats.totals.sdl)} detail="Net pay plus statutory liabilities" valueClass="text-[#2f8758]"/></div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3"><MonthlyPayrollBarChart payrollRuns={payrollRuns} selectedRun={selectedRun}/><aside className="app-panel rounded-2xl p-6"><span className="admin-report-icon admin-report-icon--amber"><CalendarClock size={22}/></span><h3 className="mt-4 text-lg font-semibold text-[#251E1F]">Upcoming Payroll Schedule</h3><p className="mt-1 text-sm text-[#7b6660]">Effective operational dates saved with {formatPayrollPeriod(selectedRun)}.</p><div className="mt-5 space-y-3 text-sm">{[["Claim cutoff", selectedRun.effectiveClaimCutoffAt ? formatDateTime(selectedRun.effectiveClaimCutoffAt) : "Not configured"],["Salary release", selectedRun.scheduledReleaseAt ? formatDateTime(selectedRun.scheduledReleaseAt) : "Not configured"],["Schedule state", selectedRun.releaseScheduleStatus || "Unscheduled"],["Confirmed", selectedRun.releaseConfirmedAt ? formatDateTime(selectedRun.releaseConfirmedAt) : "Pending"]].map(([label,value]) => <div key={label} className="flex justify-between gap-3 border-b border-[#f0d2ca] pb-3"><span className="text-[#7b6660]">{label}</span><strong className="text-right">{value}</strong></div>)}</div><button onClick={() => navigate("/dashboard/payroll/finance/payroll-schedule")} className="mt-5 text-sm font-semibold text-[#F38978] hover:underline">Open Payroll Schedule →</button></aside></div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-[#251E1F]">{formatPayrollPeriod(selectedRun)}</h3>
              <p className="mt-1 text-sm text-[#7b6660]">Finance review, approval, payment and accounting workflow.</p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {workflowStepDefinitions.map((step) => (
              <WorkflowCard key={step.key} run={selectedRun} step={step} />
            ))}
          </div>
        </div>

        <aside className="app-panel rounded-2xl p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F38978]/20 text-[#F38978]">
              <ShieldCheck size={21} />
            </div>
            <div>
              <h3 className="font-semibold text-[#251E1F]">Finance Deliverable</h3>
              <p className="text-sm text-[#7b6660]">Status for {formatPayrollPeriod(selectedRun)}.</p>
            </div>
          </div>
          <div className="mt-6 space-y-3 text-sm text-[#7b6660]">
            {workflowChecklist.map((item) => (
              <div key={item.label} className="flex items-center gap-3 rounded-xl border border-[#f0d2ca] bg-white/80 p-3">
                <CheckCircle2 size={17} className={item.completed ? "text-[#2f8758]" : "text-[#7b6660]/50"} />
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </aside>
      </div>

      <div className="mt-6">
        <CompliancePanel run={selectedRun} />
      </div>

      <div className="mt-6">
        <ExceptionPanel run={selectedRun} />
      </div>

      <div className="mt-6">
        <CpfDeductionProcessPanel run={selectedRun} onAdvanceRun={onAdvanceRun} />
      </div>

      <div className="mt-6">
        <AccountingImpact payrollRuns={payrollRuns} run={selectedRun} />
      </div>
    </PageShell>
  );
}

function PayrollRunsView({
  onAdvanceRun,
  onCreateDbRun,
  onGeneratePaymentFile,
  onRecalculateRun,
  onSaveRun,
  onSelectRun,
  onSystemCheckApproveAll,
  onSetupModernTreasuryRecipients,
  onSubmitModernTreasuryTransfer,
  paymentError,
  paymentProcessing,
  payrollRuns,
  recalculationProcessing,
  saveProcessing,
  simulationProcessing,
  recipientSetupProcessing,
  selectedRun
}) {
  const navigate = useNavigate();
  const steps = getCompletedSteps(selectedRun);
  const canApprove = canApprovePayrollRun(selectedRun);
  const exceptionCount = getRunExceptions(selectedRun).length;
  const approvedStaffCount = selectedRun.employees.filter((employee) => getEmployeeFinanceStatus(employee) === "Approved").length;
  const missingRecipientCount = getMissingModernTreasuryRecipientCount(selectedRun);
  const getApprovalBlockedReason = () => {
    if (steps.approved) return "This payroll run has already been approved.";
    if (selectedRun.rulesChanged) return "Admin payroll rules changed. Recalculate and review the run again before approval.";
    if (!steps.reviewed) return "Review Payroll must be completed before approval.";
    if (!canApprove) {
      return `All staff must be approved before payroll approval. Current approved staff: ${approvedStaffCount}/${selectedRun.employees.length}.`;
    }

    return "";
  };
  const getPaymentPdfBlockedReason = () => {
    if (selectedRun.paymentFileGeneratedAt) return "The payment PDF has already been generated for this payroll run.";
    if (!steps.approved) return "Approve the payroll run before generating the payment PDF.";

    return "";
  };
  const getPaymentSubmissionBlockedReason = () => {
    if (paymentProcessing) return "Modern Treasury submission is already in progress.";
    if (steps.paid) return "Payment has already been processed for this payroll run.";
    if (!selectedRun.paymentFileGeneratedAt) return "Generate the payment PDF before submitting to Modern Treasury.";
    if (missingRecipientCount) return `Set up Modern Treasury recipients first. Missing recipient setup: ${missingRecipientCount} approved staff.`;

    return "";
  };
  const getRecipientSetupBlockedReason = () => {
    if (recipientSetupProcessing) return "Modern Treasury recipient setup is already in progress.";
    if (!steps.approved) return "Approve the payroll run before setting up Modern Treasury recipients.";
    if (!approvedStaffCount) return "At least one staff payment must be approved before recipient setup.";
    return "";
  };
  const getPayslipBlockedReason = () => {
    if (steps.payslipsSent) return "Payslips have already been sent for this payroll run.";
    if (!steps.paid) return "Process or manually confirm payment before sending payslips.";

    return "";
  };
  const getLedgerBlockedReason = () => {
    if (steps.ledgerRecorded) return "This payroll run has already been recorded in the ledger.";
    if (!steps.payslipsSent) return "Send payslips before recording the payroll run in the ledger.";
    if (!steps.statutoryDeductionsLogged) return "Log CPF payable and other deductions before recording the payroll run in the ledger.";

    return "";
  };
  const getReconciliationBlockedReason = () => {
    if (steps.reconciled) return "This payroll run has already been reconciled.";
    if (!steps.ledgerRecorded) return "Record the payroll run in the ledger before reconciliation.";

    return "";
  };

  return (
    <PageShell
      heading="Payroll Runs"
      actions={
        <>
          <ActionButton icon={Users} variant="secondary" onClick={onCreateDbRun}>
            Staff DB Run
          </ActionButton>
          <RunSelector payrollRuns={payrollRuns} selectedRunId={selectedRun?.id} onSelectRun={onSelectRun} />
        </>
      }
    >
      {selectedRun.rulesChanged ? (
        <div className="mb-5 flex flex-col gap-4 rounded-2xl border border-amber-400/40 bg-amber-50 p-5 text-amber-900 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold">Admin payroll rules changed — recalculation required</p>
            <p className="mt-1 text-sm">This pending run uses an older Admin rule snapshot. Recalculate before Finance reviews or approves it.</p>
          </div>
          <ActionButton icon={simulationProcessing ? Loader2 : RefreshCw} disabled={simulationProcessing} onClick={onSystemCheckApproveAll}>
            {simulationProcessing ? "Refreshing and checking..." : "Recalculate & recheck salaries"}
          </ActionButton>
        </div>
      ) : selectedRun.recalculatedAt && !steps.reviewed ? (
        <div className="mb-5 rounded-2xl border border-[#2f8758]/25 bg-[#2f8758]/10 p-5 text-sm text-[#256b48]">
          Recalculated using the latest Admin rules on {formatDateTime(selectedRun.recalculatedAt)}. Review employee results, save any permitted corrections, then select Review Payroll again.
        </div>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="app-panel overflow-hidden rounded-2xl">
            <div className="hidden grid-cols-[1.1fr_1.5fr_.65fr_1fr_1.15fr] gap-4 border-b border-[#f0d2ca] px-6 py-4 text-xs font-semibold uppercase tracking-wide text-[#F38978]/80 md:grid">
              <span>Period</span>
              <span>Status</span>
              <span>Employees</span>
              <span>Net Pay</span>
              <span>Submitted</span>
            </div>
            {payrollRuns.map((run) => {
              const totals = getRunTotals(run);

              return (
                <button
                  key={run.id}
                  type="button"
                  className={`hidden w-full grid-cols-[1.1fr_1.5fr_.65fr_1fr_1.15fr] items-center gap-4 border-b border-[#f0d2ca] px-6 py-4 text-left text-sm last:border-b-0 md:grid ${run.id === selectedRun?.id ? "bg-[#F38978]/10" : "hover:bg-[#FDD9CD]/45"}`}
                  onClick={() => onSelectRun(run.id)}
                >
                  <span className="font-semibold text-[#251E1F]">{formatPayrollPeriod(run)}</span>
                  <span>
                    <span title={run.status} className={`block max-w-[13rem] truncate rounded-full border px-3 py-1 text-xs font-semibold ${getStatusClass(run.status)}`}>
                      {run.status}
                    </span>
                  </span>
                  <span className="text-[#7b6660]">{run.employees.length}</span>
                  <span className="font-semibold text-[#251E1F]">{formatMoney(totals.netPay)}</span>
                  <span className="text-[#7b6660]">{formatDateTime(run.submittedAt)}</span>
                </button>
              );
            })}
            <div className="divide-y divide-[#f0d2ca] md:hidden">{payrollRuns.map((run) => { const totals = getRunTotals(run); return <button key={run.id} type="button" onClick={() => onSelectRun(run.id)} className={`w-full p-4 text-left ${run.id === selectedRun?.id ? "bg-[#F38978]/10" : "bg-white"}`}><div className="flex items-start justify-between gap-3"><strong>{formatPayrollPeriod(run)}</strong><span className={`max-w-[10rem] truncate rounded-full border px-2 py-1 text-xs ${getStatusClass(run.status)}`}>{run.status}</span></div><dl className="mt-3 grid grid-cols-3 gap-2 text-xs"><div><dt className="text-[#7b6660]">Employees</dt><dd className="mt-1 font-semibold">{run.employees.length}</dd></div><div><dt className="text-[#7b6660]">Net pay</dt><dd className="mt-1 font-semibold">{formatMoney(totals.netPay)}</dd></div><div><dt className="text-[#7b6660]">Submitted</dt><dd className="mt-1 font-semibold">{formatDateTime(run.submittedAt)}</dd></div></dl></button>; })}</div>
          </div>
        </div>

        <aside className="app-panel rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-[#251E1F]">{formatPayrollPeriod(selectedRun)}</h3>
          <p className="mt-1 text-sm text-[#7b6660]">Process the selected pay run in order.</p>
          <div className="mt-4 grid gap-3 rounded-xl border border-[#f0d2ca] bg-white/80 p-4 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[#7b6660]">Exceptions</span>
              <span className={exceptionCount ? "font-semibold text-[#9A6412]" : "font-semibold text-[#2f8758]"}>
                {exceptionCount}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[#7b6660]">Staff approvals</span>
              <span className="font-semibold text-[#251E1F]">
                {approvedStaffCount}/{selectedRun.employees.length}
              </span>
            </div>
          </div>
          <div className="mt-5 grid gap-3">
            {!steps.reviewed ? <><ActionButton icon={ClipboardCheck} disabled={selectedRun.rulesChanged || saveProcessing} disabledReason={selectedRun.rulesChanged ? "Recalculate this run using the latest Admin rules first." : saveProcessing ? "Saving the current workflow change." : ""} onClick={() => onAdvanceRun("reviewed")}>Next: Validate & review payroll</ActionButton><p className="text-xs text-[#7b6660]">Stage 1: validate the run and record Finance review.</p></> : exceptionCount ? <><ActionButton icon={ListChecks} onClick={() => navigate("/dashboard/payroll/finance/staff-payroll-details")}>Next: Review suggested adjustments</ActionButton><p className="text-xs text-amber-700">Stage 2 is blocked by {exceptionCount} exception(s).</p></> : !steps.approved ? <><ActionButton icon={ShieldCheck} disabled={!canApprove || saveProcessing} disabledReason={saveProcessing ? "Saving the current workflow change." : getApprovalBlockedReason()} onClick={() => onAdvanceRun("approved")}>{saveProcessing ? "Approving payroll..." : "Next: Approve payroll"}</ActionButton><p className="text-xs text-[#7b6660]">Stage 3 locks the reviewed payroll run.</p></> : null}
            <div className="rounded-xl border border-[#f0d2ca] bg-[#fff8f5] p-4"><p className="text-xs font-semibold uppercase tracking-wide text-[#F38978]">Workflow stages</p><ol className="mt-3 space-y-2 text-sm">{[["1","Validate & review",steps.reviewed],["2","Suggested adjustments",!exceptionCount],["3","Approve payroll",steps.approved],["4","Generate payment PDF",Boolean(selectedRun.paymentFileGeneratedAt)],["5","Submit / confirm payment",steps.paid],["6","Send payslips",steps.payslipsSent],["7","Statutory logs & ledger",steps.ledgerRecorded],["8","Reconcile & report",steps.reconciled]].map(([number,label,done]) => <li key={number} className="flex items-center gap-2"><span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${done ? "bg-emerald-600 text-white" : "bg-[#f0d2ca] text-[#7b6660]"}`}>{done ? "✓" : number}</span><span className={done ? "text-[#2f8758]" : "text-[#7b6660]"}>{label}</span></li>)}</ol></div>
            {steps.approved && !selectedRun.paymentFileGeneratedAt ? <ActionButton
              icon={Download}
              disabled={saveProcessing}
              disabledReason={getPaymentPdfBlockedReason()}
              onClick={onGeneratePaymentFile}
            >
              Next: Generate Payment PDF
            </ActionButton> : null}
            {selectedRun.paymentFileGeneratedAt && !steps.paid ? <><div className="rounded-xl border border-[#2D7C83]/20 bg-[#2D7C83]/10 p-3 text-xs text-[#2D7C83]">Payment stage: configure recipients, then submit through Modern Treasury or use manual confirmation.</div><ActionButton
              icon={Users}
              variant="secondary"
              disabled={!approvedStaffCount || recipientSetupProcessing}
              disabledReason={getRecipientSetupBlockedReason()}
              onClick={onSetupModernTreasuryRecipients}
            >
              {recipientSetupProcessing ? "Setting up..." : missingRecipientCount ? "Setup MT Recipients" : "Refresh MT Recipients"}
            </ActionButton>
            <ActionButton
              icon={paymentProcessing ? Loader2 : Banknote}
              disabled={!selectedRun.paymentFileGeneratedAt || steps.paid || paymentProcessing || Boolean(missingRecipientCount)}
              disabledReason={getPaymentSubmissionBlockedReason()}
              onClick={onSubmitModernTreasuryTransfer}
            >
              {paymentProcessing ? "Submitting..." : "Submit Modern Treasury"}
            </ActionButton>
            <ActionButton
              icon={Banknote}
              variant="secondary"
              disabled={!selectedRun.paymentFileGeneratedAt || steps.paid || paymentProcessing}
              disabledReason={getPaymentSubmissionBlockedReason()}
              onClick={() => onAdvanceRun("paid")}
            >
              Manual Confirm
            </ActionButton></> : null}
            {steps.paid && !steps.payslipsSent ? <ActionButton
              icon={Mail}
              disabled={false}
              disabledReason={getPayslipBlockedReason()}
              onClick={() => onAdvanceRun("payslipsSent")}
            >
              Next: Send Payslips
            </ActionButton> : null}
            {steps.payslipsSent && !steps.statutoryDeductionsLogged ? <ActionButton icon={Building2} onClick={() => onAdvanceRun("statutoryLogged")}>Next: Record statutory deductions</ActionButton> : null}
            {steps.payslipsSent && steps.statutoryDeductionsLogged && !steps.ledgerRecorded ? <ActionButton
              icon={Building2}
              disabledReason={getLedgerBlockedReason()}
              onClick={() => onAdvanceRun("ledgerRecorded")}
            >
              Next: Record in Ledger
            </ActionButton> : null}
            {steps.ledgerRecorded && !steps.reconciled ? <ActionButton
              icon={FileBarChart}
              disabledReason={getReconciliationBlockedReason()}
              onClick={() => onAdvanceRun("reconciled")}
            >
              Next: Reconcile and report
            </ActionButton> : null}
          </div>
          <div className="mt-6 rounded-xl border border-[#f0d2ca] bg-white/80 p-4 text-sm text-[#7b6660]">
            Bank reference: <span className="font-semibold text-[#251E1F]">{selectedRun.bankReference || "Pending payment"}</span>
          </div>
          {selectedRun.paymentProvider ? (
            <div className="mt-3 rounded-xl border border-[#2f8758]/20 bg-[#2f8758]/10 p-4 text-sm text-[#2D7C83]">
              {selectedRun.paymentProvider} submitted {selectedRun.paymentTransferCount || 0} transfer(s).
            </div>
          ) : null}
          {selectedRun.simulationAccount ? (
            <div className="mt-3 rounded-xl border border-[#2D7C83]/20 bg-[#2D7C83]/10 p-4 text-sm text-[#FFF6F2]">
              <p className="font-semibold text-[#251E1F]">{selectedRun.simulationAccount.accountName}</p>
              <p className="mt-1">
                Balance: {formatMoney(selectedRun.simulationAccount.balanceBefore)} to {formatMoney(selectedRun.simulationAccount.balanceAfter)}
              </p>
            </div>
          ) : null}
          <div className="mt-3 rounded-xl border border-[#f0d2ca] bg-white/80 p-4 text-sm text-[#7b6660]">
            Modern Treasury recipients: <span className="font-semibold text-[#251E1F]">{approvedStaffCount - missingRecipientCount}/{approvedStaffCount}</span>
          </div>
          {paymentError ? (
            <div className="mt-3 rounded-xl border border-[#D97706]/25 bg-[#D97706]/10 p-4 text-sm text-[#9A6412]">
              {paymentError}
            </div>
          ) : null}
        </aside>
      </div>

      <div className="mt-6">
        <CompliancePanel run={selectedRun} />
      </div>

      <div className="mt-6">
        <AuditTrailPanel run={selectedRun} />
      </div>

      <div className="mt-6">
        <CpfDeductionProcessPanel run={selectedRun} onAdvanceRun={onAdvanceRun} />
      </div>
    </PageShell>
  );
}

// -----------------------------------------------------------------------------
// 9. Staff payroll detail editor
// -----------------------------------------------------------------------------

function PayrollItemList({ items, title }) {
  const total = items.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  return (
    <div className="flex min-h-56 flex-col rounded-xl border border-[#f0d2ca] bg-white/80 p-4">
      <div className="flex items-center justify-between gap-3 border-b border-[#f0d2ca] pb-3"><h4 className="text-sm font-semibold text-[#251E1F]">{title}</h4><span className="rounded-full bg-[#fff8f5] px-2 py-1 text-[11px] font-semibold text-[#7b6660]">{items.length} {items.length === 1 ? "item" : "items"}</span></div>
      <div className="flex-1 divide-y divide-[#f0d2ca]">
        {items.length ? (
          items.map((item, index) => (
            <div key={`${item.label}-${index}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 py-3 text-sm first:pt-3">
              <div className="min-w-0"><span title={item.label} className="block break-words font-medium leading-5 text-[#554945]">{item.label}</span>{item.rate && item.rate !== "-" ? <span className="mt-1 inline-flex rounded-md bg-[#f5efec] px-2 py-0.5 text-[11px] leading-4 text-[#7b6660]">{item.rate}</span> : null}</div>
              <span className="whitespace-nowrap text-right font-semibold tabular-nums text-[#251E1F]">{formatMoney(item.amount)}</span>
            </div>
          ))
        ) : (
          <div className="flex min-h-24 items-center justify-center text-sm text-[#7b6660]">No items recorded.</div>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between border-t-2 border-[#f0d2ca] pt-3"><span className="text-xs font-semibold uppercase tracking-wide text-[#7b6660]">Total</span><strong className="text-base tabular-nums text-[#251E1F]">{formatMoney(total)}</strong></div>
    </div>
  );
}

function StaffPayrollDetailModal({ employee, isLocked, onClose, onSave, onStatusChange }) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(employee);
  const exceptions = getEmployeeExceptions(draft);
  const cpfTier = getEmployeeCpfRateTier(draft);
  const mbmfReview = getMbmfReview(draft);
  const numberFields = ["workingDays", "noPayLeave", "previousGrossPay"];
  const isDatabaseBacked = employee.recordSource === "staff_db";
  const financeStatus = getEmployeeFinanceStatus(draft);

  const updateField = (field, value) => {
    setDraft((current) => ({
      ...current,
      [field]: numberFields.includes(field) ? Number(value || 0) : value
    }));
  };

  const addPayrollItem = (collection, label) => {
    const itemLabel = window.prompt(`${label} name`);
    if (!itemLabel) return;

    const amountInput = window.prompt(`${label} amount`, "0");
    if (amountInput === null) return;

    const rateInput = window.prompt(`${label} rate`, "-");
    if (rateInput === null) return;

    const amount = Number(amountInput || 0);
    const rate = rateInput || "-";

    setDraft((current) => ({
      ...current,
      [collection]: [...(current[collection] || []), { label: itemLabel, rate, amount }]
    }));
  };

  const handleSave = () => {
    onSave(draft);
    setIsEditing(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#fff8f5]/80 px-4 backdrop-blur-sm">
      <section className="app-panel max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-2xl p-6">
        <div className="flex flex-col gap-4 border-b border-[#f0d2ca] pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#F38978]/80">Staff Payroll Details</p>
            <h3 className="mt-2 text-xl font-semibold text-[#251E1F]">{draft.name}</h3>
            <p className="mt-1 text-sm text-[#7b6660]">
              {draft.department || "Missing department"} / {draft.workLocation || "No work location"} / CPF tier: {cpfTier.ageGroup}
            </p>
          </div>
          <button
            type="button"
            className="rounded-xl border border-[#f0d2ca] bg-white/80 p-2 text-[#251E1F] hover:bg-[#FDD9CD]/45"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total Earnings" value={formatMoney(getEmployeeTotalEarnings(draft))} />
          <StatCard label="Total Deductions" value={formatMoney(getEmployeeTotalDeductions(draft))} tone="text-[#D97706]" />
          <StatCard label="Net Pay" value={formatMoney(getEmployeeNetPay(draft))} tone="text-[#2f8758]" />
          <StatCard label="Other Deductions" value={formatMoney(getEmployeeOtherDeductions(draft))} tone="text-[#F38978]" />
        </div>

        {isDatabaseBacked ? <div className="mt-5 rounded-xl border border-[#2D7C83]/25 bg-[#2D7C83]/10 p-4 text-sm text-[#2D7C83]">Calculated pay, CPF and statutory values come from this run's stored Admin rules snapshot and are read-only here. Correct the source staff or claim record, then use payroll recalculation so the database and audit snapshot remain consistent.</div> : null}

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-[#f0d2ca] bg-white/80 p-4">
            <h4 className="text-sm font-semibold text-[#251E1F]">Employee & Payment Details</h4>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                ["department", "Department"],
                ["workLocation", "Work Location"],
                ["bankType", "Bank Type"],
                ["bankAccount", "Bank Account"],
                ["cpfAgeGroup", "CPF Age Group"],
                ["workingDays", "Working Days"],
                ["noPayLeave", "No Pay Leave"],
                ["previousGrossPay", "Previous Gross Pay"]
              ].map(([field, label]) => (
                <label key={field} className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-[#F38978]/80">{label}</span>
                  {isEditing ? (
                    field === "cpfAgeGroup" ? (
                      <select
                        value={draft.cpfAgeGroup || adminCpfConfiguration.rateTiers[0].ageGroup}
                        onChange={(event) => updateField(field, event.target.value)}
                        className="w-full rounded-xl border border-[#f0d2ca] bg-[#ffffff] px-3 py-2.5 text-sm font-semibold text-[#251E1F] outline-none"
                      >
                        {adminCpfConfiguration.rateTiers.map((tier) => (
                          <option key={tier.ageGroup} value={tier.ageGroup}>{tier.ageGroup}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={numberFields.includes(field) ? "number" : "text"}
                        value={draft[field] ?? ""}
                        onChange={(event) => updateField(field, event.target.value)}
                        className="w-full rounded-xl border border-[#f0d2ca] bg-[#ffffff] px-3 py-2.5 text-sm font-semibold text-[#251E1F] outline-none"
                      />
                    )
                  ) : (
                    <p className="rounded-xl border border-[#f0d2ca] bg-white/80 px-3 py-2.5 text-sm font-semibold text-[#251E1F]">
                      {draft[field] || "Not recorded"}
                    </p>
                  )}
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-[#f0d2ca] bg-white/80 p-4">
            <h4 className="text-sm font-semibold text-[#251E1F]">Finance Checks</h4>
            <div className="mt-4 grid gap-2">
              {exceptions.length ? (
                exceptions.map((exception) => (
                  <div key={exception} className="rounded-lg border border-[#D97706]/20 bg-[#D97706]/10 p-3 text-sm text-[#9A6412]">
                    {exception}
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-[#2f8758]/20 bg-[#2f8758]/10 p-3 text-sm text-[#2f8758]">
                  No payment exceptions detected.
                </div>
              )}
            </div>
            <div className="mt-4 rounded-lg border border-[#2D7C83]/25 bg-[#2D7C83]/10 p-3 text-sm text-[#2D7C83]">
              MBMF: {mbmfReview.eligible ? "Applied" : "Skipped"} / Employee {formatMoney(mbmfReview.employeeAmount)} / Employer {formatMoney(mbmfReview.employerAmount)}
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[0.9fr_1.2fr_0.9fr]">
          <PayrollItemList title="Earnings" items={getEmployeeEarningItems(draft)} />
          <PayrollItemList title="Deductions" items={getEmployeeReviewDeductionItems(draft)} />
          <PayrollItemList title="Employer Expenses" items={getEmployeeReviewEmployerItems(draft)} />
        </div>

        <div className="mt-5 flex flex-col gap-4 border-t border-[#f0d2ca] pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-xs font-semibold uppercase tracking-wide text-[#7b6660]">Finance decision</p><div className="mt-2 flex items-center gap-2"><span className={`rounded-full border px-3 py-1 text-xs font-semibold ${financeStatus === "Approved" ? "border-emerald-300 bg-emerald-50 text-emerald-700" : financeStatus === "Hold" ? "border-amber-300 bg-amber-50 text-amber-800" : "border-[#f0d2ca] bg-white text-[#7b6660]"}`}>{financeStatus}</span>{exceptions.length ? <span className="text-xs text-red-700">Approval unavailable until {exceptions.length} exception(s) are resolved.</span> : null}</div></div>
          <div className="flex flex-wrap gap-3">
          {isEditing ? (
            <>
              <ActionButton icon={Plus} variant="secondary" onClick={() => addPayrollItem("earningItems", "Earning")}>
                Add Earning
              </ActionButton>
              <ActionButton icon={Plus} variant="secondary" onClick={() => addPayrollItem("deductionItems", "Deduction")}>
                Add Deduction
              </ActionButton>
              <ActionButton icon={Plus} variant="secondary" onClick={() => addPayrollItem("employerItems", "Employer Expense")}>
                Add Employer Expense
              </ActionButton>
              <ActionButton icon={ShieldCheck} onClick={handleSave}>
                Save Changes
              </ActionButton>
              <ActionButton
                icon={X}
                variant="secondary"
                onClick={() => {
                  setDraft(employee);
                  setIsEditing(false);
                }}
              >
                Cancel
              </ActionButton>
            </>
          ) : (
            <><ActionButton icon={Edit3} variant="secondary" disabled={isLocked || isDatabaseBacked} disabledReason={isDatabaseBacked ? "Database payroll results must be corrected at source and recalculated." : "Approved payroll runs are locked."} onClick={() => setIsEditing(true)}>Edit Details</ActionButton><ActionButton icon={ShieldCheck} variant="success" disabled={isLocked || Boolean(exceptions.length) || financeStatus === "Approved"} disabledReason={exceptions.length ? "Resolve automated compliance exceptions before approval." : isLocked ? "Approved payroll runs are locked." : ""} onClick={() => { onStatusChange(employee.id, "Approved"); onClose(); }}>Approve salary</ActionButton><ActionButton icon={X} variant="warning" disabled={isLocked || financeStatus === "Hold"} disabledReason={isLocked ? "Approved payroll runs are locked." : ""} onClick={() => { onStatusChange(employee.id, "Hold"); onClose(); }}>Place on hold</ActionButton></>
          )}
          </div>
        </div>
      </section>
    </div>
  );
}

// -----------------------------------------------------------------------------
// 10. Payslip approval workflow
// -----------------------------------------------------------------------------

function getAuthHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function formatPayslipMoney(value) {
  return formatMoney(Number(value || 0));
}

function getPayslipPeriod(payslip) {
  const month = Number(payslip.period_month);
  const year = Number(payslip.period_year);
  if (!month || !year) return "Not recorded";
  return new Intl.DateTimeFormat("en-SG", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));
}

function FinancePayrollActivityView() {
  const [filters, setFilters] = useState({ startDate: "", endDate: "", eventType: "", status: "", actor: "", keyword: "", page: 1 });
  const [data, setData] = useState({ logs: [], total: 0, eventTypes: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = async (next = filters) => {
    setLoading(true);
    try { setData(await getFinancePayrollActivity({ ...next, limit: 25 })); setError(""); }
    catch (loadError) { setError(loadError.message || "Unable to load payroll activity."); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(filters); }, [filters.page]);
  const apply = (event) => { event.preventDefault(); setFilters((current) => ({ ...current, page: 1 })); load({ ...filters, page: 1 }); };
  const reset = () => { const cleared = { startDate: "", endDate: "", eventType: "", status: "", actor: "", keyword: "", page: 1 }; setFilters(cleared); load(cleared); };
  const activeFilters = Object.entries(filters).filter(([key, value]) => key !== "page" && value);
  const pages = Math.max(1, Math.ceil(Number(data.total || 0) / 25));
  return <PageShell heading="Payroll Activity Log">
    <div className="mb-5 rounded-2xl border border-[#2D7C83]/25 bg-[#2D7C83]/10 p-5 text-sm text-[#2D7C83]">Personal alerts and unread actions remain in the header bell. This page is the Finance-safe operational history for payroll, claims, payslips, compliance and payment events.</div>
    <div className="app-panel rounded-2xl p-5"><div className="mb-2 hidden grid-cols-7 gap-3 px-1 text-xs font-semibold uppercase tracking-wide text-[#7b6660] xl:grid"><span>Date From</span><span>Date To</span><span>Event Type</span><span>Outcome</span><span>Actor</span><span>Record / Keyword</span><span>Actions</span></div><form onSubmit={apply} className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
      <input type="date" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} className="rounded-xl border border-[#f0d2ca] bg-white px-3 py-2.5 text-sm" aria-label="Activity start date" />
      <input type="date" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} className="rounded-xl border border-[#f0d2ca] bg-white px-3 py-2.5 text-sm" aria-label="Activity end date" />
      <select value={filters.eventType} onChange={(e) => setFilters({ ...filters, eventType: e.target.value })} className="rounded-xl border border-[#f0d2ca] bg-white px-3 py-2.5 text-sm"><option value="">All event types</option>{data.eventTypes.map((value) => <option key={value}>{value}</option>)}</select>
      <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className="rounded-xl border border-[#f0d2ca] bg-white px-3 py-2.5 text-sm"><option value="">All outcomes</option><option>Success</option><option>Failed</option><option>Warning</option></select>
      <input value={filters.actor} onChange={(e) => setFilters({ ...filters, actor: e.target.value })} placeholder="Actor" className="rounded-xl border border-[#f0d2ca] bg-white px-3 py-2.5 text-sm" />
      <input value={filters.keyword} onChange={(e) => setFilters({ ...filters, keyword: e.target.value })} placeholder="Search activity…" className="rounded-xl border border-[#f0d2ca] bg-white px-3 py-2.5 text-sm" />
      <ActionButton icon={Search} type="submit">Apply filters</ActionButton>
    </form><div className="mt-4 flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-2">{activeFilters.map(([key,value]) => <span key={key} className="rounded-full bg-[#fce9e4] px-3 py-1 text-xs font-semibold text-[#9f5142]">{key}: {value}</span>)}{!activeFilters.length ? <span className="text-sm text-[#7b6660]">No filters applied · {data.total} event(s)</span> : null}</div><ActionButton icon={X} type="button" variant="secondary" onClick={reset}>Clear filters</ActionButton></div></div>
    {error ? <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
    <div className="app-panel mt-5 overflow-hidden rounded-2xl">
      {loading ? <div className="flex items-center gap-2 p-8 text-sm text-[#7b6660]"><Loader2 className="animate-spin" size={18}/>Loading activity…</div> : !data.logs.length ? <EmptyState message="No payroll activity matches these filters."/> : <div className="overflow-x-auto"><table className="min-w-[62rem] w-full text-left text-sm"><thead className="border-b border-[#f0d2ca] bg-white/80 text-xs uppercase tracking-wide text-[#F38978]"><tr><th className="px-4 py-3">Time</th><th className="px-4 py-3">Area</th><th className="px-4 py-3">Event</th><th className="px-4 py-3">Action</th><th className="px-4 py-3">Actor</th><th className="px-4 py-3">Record</th><th className="px-4 py-3">Outcome</th></tr></thead><tbody>{data.logs.map((log) => <tr key={log.id} className="border-b border-[#f0d2ca] last:border-0"><td className="px-4 py-4 text-[#7b6660]">{formatDateTime(log.createdAt)}</td><td className="px-4 py-4"><span className="rounded-full bg-[#e3f4f4] px-3 py-1 text-xs font-semibold text-[#286f75]">{log.area}</span></td><td className="px-4 py-4 font-semibold">{log.eventType || "Payroll"}</td><td className="px-4 py-4 text-[#7b6660]">{log.action}</td><td className="px-4 py-4">{log.actor}</td><td className="px-4 py-4 text-[#7b6660]">{log.affectedRecord || "—"}</td><td className="px-4 py-4"><span className={`font-semibold ${log.outcome === "Failed" ? "text-red-700" : "text-[#2f8758]"}`}>{log.outcome}</span></td></tr>)}</tbody></table></div>}
      <div className="flex items-center justify-between border-t border-[#f0d2ca] px-5 py-4 text-sm"><span className="text-[#7b6660]">{data.total} event(s)</span><div className="flex items-center gap-3"><button disabled={filters.page <= 1} onClick={() => setFilters({ ...filters, page: filters.page - 1 })} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Previous</button><span>{filters.page}/{pages}</span><button disabled={filters.page >= pages} onClick={() => setFilters({ ...filters, page: filters.page + 1 })} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Next</button></div></div>
    </div>
  </PageShell>;
}

function datetimeLocalValue(value) {
  if (!value) return "";
  const text = String(value).replace(" ", "T");
  return text.slice(0, 16);
}

function PayrollScheduleView({ payrollRuns, onRunUpdated, onSelectRun, selectedGlobalRun }) {
  const [tab, setTab] = useState("defaults");
  const [schedule, setSchedule] = useState({ enabled: false, salaryReleaseDay: "", salaryReleaseTime: "09:00", claimCutoffDay: "", claimCutoffTime: "23:59", timezone: "Asia/Singapore" });
  const [selectedRunId, setSelectedRunId] = useState(selectedGlobalRun?.id || payrollRuns[0]?.id || "");
  const selectedRun = payrollRuns.find((run) => run.id === selectedRunId) || payrollRuns[0];
  const [runDates, setRunDates] = useState({ claimCutoffAt: "", scheduledReleaseAt: "" });
  const [overrideEnabled, setOverrideEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(null);
  const missingDefaultFields = getMissingScheduleFields(schedule);
  const completeDefaults = Boolean(schedule.enabled && missingDefaultFields.length === 0);

  useEffect(() => { getFinancePayrollSchedule().then((result) => setSchedule(result.schedule)).catch((e) => setError(e.message)).finally(() => setLoading(false)); }, []);
  useEffect(() => {
    if (!selectedRun) return;
    setRunDates({ claimCutoffAt: datetimeLocalValue(selectedRun.effectiveClaimCutoffAt), scheduledReleaseAt: datetimeLocalValue(selectedRun.scheduledReleaseAt) });
    setOverrideEnabled(false);
  }, [selectedRun?.id, selectedRun?.effectiveClaimCutoffAt, selectedRun?.scheduledReleaseAt]);
  useEffect(() => {
    if (!selectedRun || !completeDefaults) { setPreview(null); return; }
    const timer = setTimeout(() => getFinancePayrollSchedulePreview({ year: selectedRun.year, month: selectedRun.month, ...schedule }).then((result) => setPreview(result.preview)).catch(() => setPreview(null)), 250);
    return () => clearTimeout(timer);
  }, [selectedRun?.id, completeDefaults, schedule.salaryReleaseDay, schedule.salaryReleaseTime, schedule.claimCutoffDay, schedule.claimCutoffTime]);

  const saveDefaults = async () => {
    if (schedule.enabled && missingDefaultFields.length) { setError(`Complete the following monthly fields before saving: ${missingDefaultFields.join(", ")}.`); return; }
    setProcessing("defaults");
    try { const result = await updateFinancePayrollSchedule(schedule); setSchedule(result.schedule); setMessage("Monthly schedule defaults saved for future payroll runs."); setError(""); }
    catch (e) { setError(e.message); } finally { setProcessing(""); }
  };
  const saveRun = async () => {
    if (!selectedRun || !runDates.claimCutoffAt || !runDates.scheduledReleaseAt) { setError("Enter both override dates before saving this payroll run."); return; }
    setProcessing("run");
    try { const result = await updateFinancePayrollRunSchedule(selectedRun.id, runDates); onRunUpdated(result.run); setMessage("Run-specific dates saved. The schedule is not authorised until you confirm it."); setError(""); setOverrideEnabled(false); }
    catch (e) { setError(e.message); } finally { setProcessing(""); }
  };
  const action = async (name) => {
    setProcessing(name);
    try { const result = await performFinancePayrollScheduleAction(selectedRun.id, name); onRunUpdated(result.run); setMessage(name === "confirm" ? "Scheduled release confirmed." : name === "cancel" ? "Schedule cancelled." : "Manual retry authorised."); setError(""); }
    catch (e) { setError(e.message); } finally { setProcessing(""); }
  };
  const updateScheduleField = (key, value, type) => setSchedule((current) => ({ ...current, [key]: type === "number" ? (value === "" ? "" : Number(value)) : value }));
  const defaultFields = [
    { key: "salaryReleaseDay", label: "Salary release day", type: "number", placeholder: "25", help: "Calendar day from 1–31. Shorter months use their final valid day." },
    { key: "salaryReleaseTime", label: "Release time", type: "time", placeholder: "09:00", help: "Singapore time when automatic salary release may begin." },
    { key: "claimCutoffDay", label: "Claim cut-off day", type: "number", placeholder: "20", help: "Final calendar day for approved claims to enter this payroll period." },
    { key: "claimCutoffTime", label: "Claim cut-off time", type: "time", placeholder: "23:59", help: "Singapore time when claim inclusion closes on the cut-off day." }
  ];

  if (loading) return <PageShell heading="Schedule & Cut-off"><div className="flex gap-2 p-8 text-sm text-[#7b6660]"><Loader2 className="animate-spin"/>Loading schedule…</div></PageShell>;
  return <PageShell heading="Schedule & Cut-off">
    <section className="app-panel rounded-2xl p-5"><h3 className="text-lg font-semibold text-[#251E1F]">Plan payroll dates with confidence</h3><p className="mt-1 text-sm leading-6 text-[#7b6660]">Set monthly defaults, review the server-calculated business dates, then save or confirm one payroll run. All times use Asia/Singapore; weekends and active public holidays move dates backward.</p><div className="mt-4 flex flex-wrap gap-4 text-sm">{["1. Configure dates","2. Review preview","3. Save or confirm"].map((step) => <span key={step} className="rounded-full bg-[#fff8f5] px-3 py-1.5 font-medium text-[#7b6660]">{step}</span>)}</div></section>
    <div className="mt-5 inline-flex rounded-xl border border-[#f0d2ca] bg-white p-1" role="tablist" aria-label="Schedule configuration"><button type="button" role="tab" aria-selected={tab === "defaults"} onClick={() => setTab("defaults")} className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === "defaults" ? "bg-[#F38978] text-white" : "text-[#7b6660]"}`}>Monthly Defaults</button><button type="button" role="tab" aria-selected={tab === "run"} onClick={() => setTab("run")} className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === "run" ? "bg-[#F38978] text-white" : "text-[#7b6660]"}`}>Selected Payroll Run</button></div>
    {error ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}{message ? <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{message}</div> : null}

    {tab === "defaults" ? <section className="app-panel mt-5 rounded-2xl p-6" role="tabpanel"><div><h3 className="text-lg font-semibold text-[#251E1F]">Monthly schedule defaults</h3><p className="mt-1 text-sm text-[#7b6660]">These values apply only to newly created payroll runs. Existing runs remain unchanged.</p></div><label className="mt-5 flex items-center justify-between gap-4 rounded-xl border border-[#f0d2ca] bg-[#fff8f5] p-4"><span><strong className="block text-sm font-semibold">Enable automatic scheduling</strong><small className="mt-1 block text-xs leading-5 text-[#7b6660]">Turn this on to calculate default claim cut-off and salary release dates for future runs.</small></span><input aria-label="Enable automatic scheduling" type="checkbox" checked={schedule.enabled} onChange={(e) => setSchedule({ ...schedule, enabled: e.target.checked })}/></label><div className="mt-5 grid gap-5 md:grid-cols-2">{defaultFields.map((field) => <label key={field.key} className="block"><span className="text-sm font-semibold text-[#251E1F]">{field.label}</span><span className="mt-1 block min-h-10 text-xs leading-5 text-[#7b6660]">{field.help}</span><input aria-label={field.label} disabled={!schedule.enabled} type={field.type} min={field.type === "number" ? 1 : undefined} max={field.type === "number" ? 31 : undefined} placeholder={field.placeholder} value={schedule[field.key] ?? ""} onChange={(e) => updateScheduleField(field.key, e.target.value, field.type)} className="mt-2 w-full rounded-xl border border-[#f0d2ca] bg-white px-3 py-2.5 text-sm disabled:cursor-not-allowed disabled:bg-[#f5f1ef] disabled:text-[#a79791]"/></label>)}</div><div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[#f0d2ca] pt-5"><p className="max-w-2xl text-xs leading-5 text-[#7b6660]">Example: if day 25 is Sunday and Friday 23 is a holiday, the date moves to Thursday 22.</p><ActionButton icon={ShieldCheck} disabled={processing === "defaults"} onClick={saveDefaults}>{processing === "defaults" ? "Saving…" : "Save monthly defaults"}</ActionButton></div></section> : null}

    {tab === "run" ? <section className="app-panel mt-5 rounded-2xl p-6" role="tabpanel"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><h3 className="text-lg font-semibold text-[#251E1F]">Selected payroll run</h3><p className="mt-1 text-sm text-[#7b6660]">Review calculated dates, optionally override them, then confirm when payroll is approved.</p></div><span className={`w-fit rounded-full border px-3 py-1 text-xs font-semibold ${getStatusClass(selectedRun?.releaseScheduleStatus || "Unscheduled")}`}>{selectedRun?.releaseScheduleStatus || "Unscheduled"}</span></div><label className="mt-5 block"><span className="text-sm font-semibold text-[#251E1F]">Payroll period</span><span className="mt-1 block text-xs text-[#7b6660]">Choose the database-backed run whose release dates you want to manage.</span><select value={selectedRun?.id || ""} onChange={(e) => { setSelectedRunId(e.target.value); onSelectRun(e.target.value); }} className="mt-2 w-full rounded-xl border border-[#f0d2ca] bg-white px-3 py-2.5 text-sm font-medium">{payrollRuns.map((run) => <option key={run.id} value={run.id}>{formatPayrollPeriod(run)} · {run.releaseScheduleStatus || "Unscheduled"}</option>)}</select></label>{selectedRun ? <><div className="mt-5 rounded-xl border border-[#2D7C83]/20 bg-[#2D7C83]/10 p-4"><p className="text-sm font-semibold text-[#2D7C83]">Policy-derived preview · Asia/Singapore</p>{preview?.claimCutoffAt && preview?.scheduledReleaseAt ? <div className="mt-3 grid gap-3 sm:grid-cols-2"><div><span className="text-xs text-[#7b6660]">Claim cut-off</span><strong className="mt-1 block text-sm">{formatDateTime(preview.claimCutoffAt)}</strong></div><div><span className="text-xs text-[#7b6660]">Salary release</span><strong className="mt-1 block text-sm">{formatDateTime(preview.scheduledReleaseAt)}</strong></div></div> : <div className="mt-3 rounded-lg bg-white/70 p-3 text-sm text-[#7b6660]">Complete and enable all four Monthly Defaults fields to calculate a preview for this period.</div>}{preview?.holidays?.length ? <p className="mt-3 text-xs text-[#7b6660]">Public holidays considered: {preview.holidays.join(", ")}</p> : null}</div><label className="mt-5 flex items-center justify-between gap-4 rounded-xl border border-[#f0d2ca] p-4"><span><strong className="block text-sm font-semibold">Override dates for this run</strong><small className="mt-1 block text-xs text-[#7b6660]">Use exact dates for this period without changing Monthly Defaults.</small></span><input aria-label="Override dates for this run" type="checkbox" checked={overrideEnabled} onChange={(e) => setOverrideEnabled(e.target.checked)}/></label>{overrideEnabled ? <div className="mt-4 grid gap-5 md:grid-cols-2"><label><span className="text-sm font-semibold">Effective claim cut-off</span><span className="mt-1 block text-xs text-[#7b6660]">Exact final date and time for including approved claims.</span><input aria-label="Effective claim cut-off" type="datetime-local" value={runDates.claimCutoffAt} onChange={(e) => setRunDates({ ...runDates, claimCutoffAt: e.target.value })} className="mt-2 w-full rounded-xl border border-[#f0d2ca] px-3 py-2.5 text-sm"/></label><label><span className="text-sm font-semibold">Scheduled salary release</span><span className="mt-1 block text-xs text-[#7b6660]">Exact date and time when automatic release may begin.</span><input aria-label="Scheduled salary release" type="datetime-local" value={runDates.scheduledReleaseAt} onChange={(e) => setRunDates({ ...runDates, scheduledReleaseAt: e.target.value })} className="mt-2 w-full rounded-xl border border-[#f0d2ca] px-3 py-2.5 text-sm"/></label></div> : null}{selectedRun.releaseFailureReason ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><strong>Previous release failed:</strong> {selectedRun.releaseFailureReason}</div> : null}<div className="mt-6 grid gap-3 border-t border-[#f0d2ca] pt-5 lg:grid-cols-2"><div className="rounded-xl bg-[#fff8f5] p-4"><strong className="text-sm">Save dates</strong><p className="mt-1 text-xs leading-5 text-[#7b6660]">Stores the override only. It does not authorise payment release.</p>{overrideEnabled ? <div className="mt-3"><ActionButton icon={ShieldCheck} variant="secondary" disabled={processing === "run"} onClick={saveRun}>Save run dates</ActionButton></div> : null}</div><div className="rounded-xl bg-[#fff8f5] p-4"><strong className="text-sm">Confirm release</strong><p className="mt-1 text-xs leading-5 text-[#7b6660]">Authorises the schedule after Finance approves payroll. Cancel stops an unprocessed schedule.</p><div className="mt-3 flex flex-wrap gap-2"><ActionButton icon={CalendarClock} disabled={!selectedRun.approvedAt || processing === "confirm"} disabledReason={!selectedRun.approvedAt ? "Approve the payroll run before confirming release." : ""} onClick={() => action("confirm")}>Confirm schedule</ActionButton><ActionButton icon={X} variant="secondary" onClick={() => action("cancel")}>Cancel</ActionButton>{selectedRun.releaseScheduleStatus === "Release Failed" ? <ActionButton icon={RefreshCw} onClick={() => action("retry")}>Authorise retry</ActionButton> : null}</div></div></div></> : <EmptyState message="No database payroll runs are available."/>}</section> : null}
  </PageShell>;
}

function PayslipsApprovalView({ selectedRun, onSelectRun, payrollRuns }) {
  const session = getStoredSession();
  const [payslips, setPayslips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [actionInProgress, setActionInProgress] = useState(null);
  const [rejectingPayslipId, setRejectingPayslipId] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [periods, setPeriods] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState(() => selectedRun ? `${selectedRun.year}-${selectedRun.month}` : "");

  const selectedSummary = periods.find((period) => `${period.year}-${period.month}` === selectedPeriod);

  const fetchPayslips = async (periodValue = selectedPeriod) => {
    try {
      setLoading(true);
      setError("");
      const [year, month] = String(periodValue || "").split("-");
      const query = year && month ? `?month=${month}&year=${year}` : "";
      const response = await fetch(`${API_BASE_URL}/api/hr/payslips${query}`, {
        headers: getAuthHeaders(session?.token)
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || "Failed to load payslips");
      }

      const data = await response.json();
      setPayslips(data);
    } catch (err) {
      setError(err.message || "Failed to load payslips");
      setPayslips([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchPeriodSummary = async () => {
    const result = await getPayslipPeriodSummary();
    const nextPeriods = Array.isArray(result.periods) ? result.periods : [];
    setPeriods(nextPeriods);
    if (!nextPeriods.length) {
      setSelectedPeriod("");
      setPayslips([]);
      setLoading(false);
      return;
    }
    if (!nextPeriods.some((period) => `${period.year}-${period.month}` === selectedPeriod) && nextPeriods.length) {
      const preferred = nextPeriods.find((period) => `${period.year}-${period.month}` === `${selectedRun?.year}-${selectedRun?.month}`) || nextPeriods.find((period) => period.financePending > 0) || nextPeriods[0];
      setSelectedPeriod(`${preferred.year}-${preferred.month}`);
    }
  };

  const handleApprove = async (payslipId) => {
    try {
      setActionInProgress(payslipId);
      setError("");

      const response = await fetch(`${API_BASE_URL}/api/payroll/payslips/${payslipId}/finance-approve`, {
        method: "PUT",
        headers: {
          ...getAuthHeaders(session?.token),
          "Content-Type": "application/json"
        }
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || "Failed to approve payslip");
      }

      setSuccessMessage("Payslip approved successfully");
      await fetchPayslips();
      await fetchPeriodSummary();
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      setError(err.message || "Failed to approve payslip");
    } finally {
      setActionInProgress(null);
    }
  };

  const handleReject = async (payslipId) => {
    if (!rejectReason.trim()) {
      setError("Please enter a rejection reason");
      return;
    }

    try {
      setActionInProgress(payslipId);
      setError("");

      const response = await fetch(`${API_BASE_URL}/api/payroll/payslips/${payslipId}/finance-reject`, {
        method: "PUT",
        headers: {
          ...getAuthHeaders(session?.token),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ reason: rejectReason })
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || "Failed to reject payslip");
      }

      setSuccessMessage("Payslip rejected successfully");
      setRejectingPayslipId(null);
      setRejectReason("");
      await fetchPayslips();
      await fetchPeriodSummary();
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      setError(err.message || "Failed to reject payslip");
    } finally {
      setActionInProgress(null);
    }
  };

  useEffect(() => {
    fetchPeriodSummary().catch((err) => { setError(err.message); setLoading(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.token]);
  useEffect(() => { if (selectedPeriod) fetchPayslips(selectedPeriod); }, [selectedPeriod]);
  useEffect(() => {
    if (!selectedPeriod) return;
    const [year, month] = selectedPeriod.split("-").map(Number);
    const run = payrollRuns.find((item) => item.year === year && item.month === month);
    if (run && run.id !== selectedRun?.id) onSelectRun(run.id);
  }, [selectedPeriod]);

  const stageLabels = { prepared: "Payroll prepared", sentToFinance: "Sent to Finance", financeReview: "Finance review", financeApproved: "Finance approved", delivered: "Sent to employees" };
  const workflowStages = (selectedSummary?.workflowStages || []).map((stage) => ({
    ...stage, label: stageLabels[stage.key] || stage.key,
    active: !stage.complete && (stage.count > 0 || stage.blocked > 0)
  }));

  return (
    <PageShell
      heading="Payslips Approval"
      actions={
        <div className="flex flex-wrap gap-2"><select value={selectedPeriod} onChange={(e) => setSelectedPeriod(e.target.value)} className="rounded-xl border border-[#f0d2ca] bg-white px-4 py-2.5 text-sm font-semibold">{periods.map((period) => <option key={`${period.year}-${period.month}`} value={`${period.year}-${period.month}`}>{new Intl.DateTimeFormat("en-SG", { month: "long", year: "numeric" }).format(new Date(period.year, period.month - 1, 1))}</option>)}</select><ActionButton icon={RefreshCw} variant="secondary" onClick={() => { fetchPayslips(); fetchPeriodSummary(); }}>Refresh</ActionButton></div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Pending Review" value={selectedSummary?.financePending || 0} detail={selectedSummary?.held ? `${selectedSummary.held} record(s) blocked by exceptions` : "Selected payroll period"} tone="text-[#D97706]" />
        <StatCard label="Period Gross" value={formatPayslipMoney(selectedSummary?.totalGross)} detail="All payslips in selected period" />
        <StatCard label="Period Net Pay" value={formatPayslipMoney(selectedSummary?.totalNet)} detail={`${selectedSummary?.exceptionCount || 0} compliance exception(s)`} tone="text-[#2f8758]" />
        <StatCard label="Approval Progress" value={selectedSummary ? `${selectedSummary.financeApproved + selectedSummary.sent}/${selectedSummary.total}` : "0/0"} detail="Finance-approved payslips in period" tone="text-[#F38978]" />
      </div>

      {selectedSummary ? <div className="app-panel mt-5 flex flex-col gap-4 rounded-2xl border-l-4 border-l-[#F38978] p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-wide text-[#F38978]">Payroll period under review</p><h3 className="mt-1 text-2xl font-semibold text-[#251E1F]">{new Intl.DateTimeFormat("en-SG", { month: "long", year: "numeric" }).format(new Date(selectedSummary.year, selectedSummary.month - 1, 1))}</h3><p className="mt-1 text-sm text-[#7b6660]">{selectedSummary.total} staff payslip(s) in this database-backed payroll run.</p></div><span className="rounded-full bg-[#fdf2dc] px-4 py-2 text-sm font-semibold text-[#9f6519]">{selectedSummary.financePending} awaiting Finance</span></div> : null}

      {workflowStages.length ? <section className="app-panel mt-5 overflow-x-auto rounded-2xl p-6"><h3 className="font-semibold text-[#251E1F]">Payslip process status</h3><p className="mt-1 text-sm text-[#7b6660]">Complete-period progress; approved historical records remain visible below.</p><ol className="mt-6 flex min-w-[760px] items-start">{workflowStages.map((stage, index) => <li key={stage.label} className="relative flex-1 text-center">{index ? <span className={`absolute right-1/2 top-5 h-1 w-full transition-colors duration-700 motion-reduce:transition-none ${stage.complete || stage.active ? "bg-[#2f8758]" : stage.blocked ? "bg-amber-400" : "bg-[#f0d2ca]"}`}/> : null}<span className={`relative z-10 mx-auto flex h-11 w-11 items-center justify-center rounded-full border-4 border-white font-semibold ${stage.active ? "animate-pulse bg-[#fdf2dc] text-[#9f6519] motion-reduce:animate-none" : stage.complete ? "bg-[#2f8758] text-white" : stage.blocked ? "bg-amber-500 text-white" : "bg-[#f0d2ca] text-[#7b6660]"}`}>{stage.complete ? <CheckCircle2 size={20}/> : index + 1}</span><p className="relative z-10 mt-3 text-sm font-semibold text-[#251E1F]">{stage.label}</p><p className="mt-1 text-xs text-[#7b6660]">{stage.count} record(s){stage.blocked ? ` · ${stage.blocked} blocked` : ""}{stage.at ? ` · ${formatDateTime(stage.at)}` : ""}</p></li>)}</ol></section> : null}

      {error ? (
        <div className="app-panel mt-5 rounded-2xl border-red-500/40 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {successMessage ? (
        <div className="app-panel mt-5 rounded-2xl border-emerald-500/40 p-4 text-sm text-emerald-700">
          {successMessage}
        </div>
      ) : null}

      <div className="app-panel mt-5 overflow-hidden rounded-2xl">
        {loading ? (
          <div className="flex items-center gap-3 p-6 text-[#7b6660]">
            <Loader2 className="animate-spin" size={18} />
            Loading payslips...
          </div>
        ) : payslips.length === 0 ? (
          <EmptyState message="No payslips exist for this payroll period." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[#f0d2ca] bg-white/80 text-xs font-semibold uppercase tracking-wide text-[#F38978]/80">
                <tr>
                  <th className="px-4 py-3">Staff</th>
                  <th className="px-4 py-3">Period</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Gross</th>
                  <th className="px-4 py-3">Net Pay</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Exceptions</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {payslips.map((payslip) => (
                  <tr key={payslip.payslip_id} className="border-b border-[#f0d2ca] text-[#251E1F] last:border-b-0">
                    <td className="px-4 py-3">
                      <span className="block font-semibold">{payslip.staff_name || "Unknown staff"}</span>
                      <span className="block text-xs text-[#7b6660]">Payslip #{payslip.payslip_id}</span>
                    </td>
                    <td className="px-4 py-3 text-[#7b6660]">{getPayslipPeriod(payslip)}</td>
                    <td className="px-4 py-3 text-[#7b6660]">{payslip.department_name || "—"}</td>
                    <td className="px-4 py-3 text-[#7b6660]">{formatPayslipMoney(payslip.gross_salary)}</td>
                    <td className="px-4 py-3 font-semibold text-[#2f8758]">{formatPayslipMoney(payslip.net_pay)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${["approved","finance_approved","sent","sent_to_staff"].includes(String(payslip.status).toLowerCase()) ? "border-emerald-300 bg-emerald-50 text-emerald-700" : String(payslip.status).toLowerCase() === "hold" ? "border-amber-300 bg-amber-50 text-amber-800" : "border-[#D97706]/25 bg-[#D97706]/10 text-[#9A6412]"}`}>
                        {String(payslip.status || "Draft").replaceAll("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#7b6660]">{(() => { try { const value = typeof payslip.deduction_breakdown === "object" ? payslip.deduction_breakdown : JSON.parse(payslip.deduction_breakdown || "{}"); const exceptions = value.complianceExceptions || []; return exceptions.length ? `${exceptions.length} issue(s)` : "Clear"; } catch { return "Review"; } })()}</td>
                    <td className="px-4 py-3">
                      {["draft", "finance_pending"].includes(String(payslip.status).toLowerCase()) ? <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleApprove(payslip.payslip_id)}
                          disabled={actionInProgress === payslip.payslip_id}
                          className="rounded-lg bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-500/30 disabled:opacity-50"
                        >
                          {actionInProgress === payslip.payslip_id ? <Loader2 className="inline animate-spin" size={12} /> : "Approve"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setRejectingPayslipId(payslip.payslip_id)}
                          disabled={actionInProgress === payslip.payslip_id}
                          className="rounded-lg bg-red-500/20 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-500/30 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div> : <span className="text-xs font-semibold text-[#7b6660]">Completed record</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {rejectingPayslipId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#251E1F]/50 px-4">
          <div className="app-panel w-full max-w-md rounded-2xl p-6">
            <div className="mb-4 flex items-center gap-3">
              <AlertCircle className="text-red-700" size={20} />
              <h3 className="text-lg font-semibold text-[#251E1F]">Reject Payslip</h3>
            </div>
            <textarea
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              placeholder="Enter rejection reason..."
              className="w-full rounded-lg border border-[#f0d2ca] bg-white/80 px-3 py-2 text-sm text-[#251E1F] placeholder-white/30"
              rows={4}
            />
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => handleReject(rejectingPayslipId)}
                disabled={actionInProgress === rejectingPayslipId}
                className="flex-1 rounded-lg bg-red-500/20 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-500/30 disabled:opacity-50"
              >
                Reject
              </button>
              <button
                type="button"
                onClick={() => {
                  setRejectingPayslipId(null);
                  setRejectReason("");
                }}
                className="flex-1 rounded-lg border border-[#f0d2ca] bg-white/80 px-4 py-2 text-sm font-medium text-[#251E1F] hover:bg-[#FDD9CD]/45"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </PageShell>
  );
}

// -----------------------------------------------------------------------------
// 11. Staff details, reports and summaries
// -----------------------------------------------------------------------------

function PayrollAdjustmentReview({ selectedRun, onRunUpdated }) {
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState("");
  const [error, setError] = useState("");
  const load = async () => {
    setLoading(true);
    try { const result = await getFinancePayrollAdjustments(selectedRun.id); setProposals(result.proposals || []); setError(""); }
    catch (loadError) { setError(loadError.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [selectedRun.id, selectedRun.updatedAt]);
  const generate = async () => {
    setProcessing("generate");
    try { const result = await generateFinancePayrollAdjustments(selectedRun.id); setProposals(result.proposals || []); setError(""); }
    catch (actionError) { setError(actionError.message); }
    finally { setProcessing(""); }
  };
  const review = async (ids, action) => {
    const reason = action === "reject" ? window.prompt("Reason for rejecting the suggested adjustment") : "";
    if (action === "reject" && !reason?.trim()) return;
    setProcessing(`${action}-${ids.join("-")}`);
    try {
      const result = await reviewFinancePayrollAdjustments(selectedRun.id, { ids, action, reason });
      setProposals(result.proposals || []);
      if (result.run) onRunUpdated(normalizeFinancePayrollRuns([result.run])[0]);
      setError("");
    } catch (actionError) { setError(actionError.message); }
    finally { setProcessing(""); }
  };
  const pendingActionable = proposals.filter((item) => item.status === "Pending" && item.actionable);
  return <section className="app-panel mt-6 rounded-2xl p-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-wide text-[#F38978]">Automated exception adjustment</p><h3 className="mt-1 text-lg font-semibold">Finance suggestion review</h3><p className="mt-1 max-w-3xl text-sm text-[#7b6660]">Safe proposals use this run’s stored Admin-rule snapshot. Missing staff master data remains blocked for HR/Admin correction.</p></div><div className="flex flex-wrap gap-2"><ActionButton icon={RefreshCw} variant="secondary" disabled={Boolean(processing)} onClick={generate}>{processing === "generate" ? "Generating…" : "Generate suggestions"}</ActionButton>{pendingActionable.length ? <ActionButton icon={ShieldCheck} disabled={Boolean(processing)} onClick={() => review(pendingActionable.map((item) => item.id), "approve")}>Approve all safe ({pendingActionable.length})</ActionButton> : null}</div></div>
    {error ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
    {loading ? <div className="mt-5 flex items-center gap-2 text-sm text-[#7b6660]"><Loader2 size={16} className="animate-spin"/>Loading suggestions…</div> : !proposals.length ? <div className="mt-5 rounded-xl border border-dashed border-[#f0d2ca] p-5 text-sm text-[#7b6660]">No proposals generated for this period. Generate suggestions after payroll calculation or source-data changes.</div> : <div className="mt-5 space-y-3">{proposals.map((proposal) => {
      const before = proposal.originalValue || {}; const after = proposal.proposedValue || {};
      return <article key={proposal.id} className={`rounded-xl border p-4 ${proposal.actionable ? "border-[#2D7C83]/25 bg-[#2D7C83]/5" : "border-amber-300 bg-amber-50"}`}><div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div><div className="flex flex-wrap items-center gap-2"><strong>{proposal.employee}</strong><span className={`rounded-full px-2 py-1 text-xs font-semibold ${proposal.actionable ? "bg-[#e3f4f4] text-[#286f75]" : "bg-amber-100 text-amber-800"}`}>{proposal.actionable ? "Safe suggestion" : "Source blocker"}</span><span className="text-xs text-[#7b6660]">{proposal.status}</span></div><p className="mt-2 text-sm text-[#7b6660]">{proposal.reason}</p><p className="mt-1 text-xs font-semibold text-[#F38978]">Rule: {proposal.ruleReference}</p></div>{proposal.status === "Pending" && proposal.actionable ? <div className="flex gap-2"><ActionButton icon={ShieldCheck} onClick={() => review([proposal.id], "approve")}>Approve</ActionButton><ActionButton icon={X} variant="secondary" onClick={() => review([proposal.id], "reject")}>Reject</ActionButton></div> : null}</div>{proposal.actionable ? <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[42rem] text-sm"><thead><tr className="text-left text-xs uppercase text-[#7b6660]"><th className="py-2">Value</th><th>Before</th><th>Suggested</th><th>Impact</th></tr></thead><tbody>{[["Gross pay","grossPay"],["Deductions","totalDeductions"],["Employee CPF","employeeCpf"],["Employer CPF","employerCpf"],["MBMF","mbmf"],["SDL","sdl"],["Net pay","netPay"]].map(([label,key]) => <tr key={key} className="border-t border-[#f0d2ca]"><td className="py-2 font-medium">{label}</td><td>{formatMoney(before[key])}</td><td>{formatMoney(after[key])}</td><td className={Number(after[key]) === Number(before[key]) ? "text-[#7b6660]" : "font-semibold text-[#2D7C83]"}>{formatMoney(Number(after[key] || 0)-Number(before[key] || 0))}</td></tr>)}</tbody></table></div> : null}</article>;
    })}</div>}
  </section>;
}

function ExplainablePayrollAdjustmentReview({ selectedRun, onRunUpdated, onRecalculateRun, recalculationProcessing }) {
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState("");
  const [error, setError] = useState("");
  const [confirmBulk, setConfirmBulk] = useState(false);
  const load = async () => {
    setLoading(true);
    try { const result = await getFinancePayrollAdjustments(selectedRun.id); setProposals(result.proposals || []); setError(""); }
    catch (loadError) { setError(loadError.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [selectedRun.id, selectedRun.updatedAt]);
  const generate = async () => {
    setProcessing("generate");
    try { const result = await generateFinancePayrollAdjustments(selectedRun.id); setProposals(result.proposals || []); setError(""); }
    catch (actionError) { setError(actionError.message); }
    finally { setProcessing(""); }
  };
  const review = async (ids, action) => {
    const reason = action === "reject" ? window.prompt("Reason for rejecting the suggested adjustment") : "";
    if (action === "reject" && !reason?.trim()) return;
    setProcessing(`${action}-${ids.join("-")}`);
    try {
      const result = await reviewFinancePayrollAdjustments(selectedRun.id, { ids, action, reason });
      setProposals(result.proposals || []);
      if (result.run) onRunUpdated(normalizeFinancePayrollRuns([result.run])[0]);
      setError("");
    } catch (actionError) { setError(actionError.message); }
    finally { setProcessing(""); }
  };
  const activeProposals = proposals.filter((item) => item.status === "Pending");
  const resolvedCount = proposals.filter((item) => ["Resolved", "Stale"].includes(item.status)).length;
  const pending = activeProposals.filter((item) => item.actionable);
  const hasSourceBlockers = activeProposals.some((item) => !item.actionable);
  const employeeCount = new Set(pending.map((item) => item.staffEmployeeId)).size;
  const sections = [["Why this was flagged", "flaggedBecause"], ["Compliance rule checked", "ruleApplied"], ["Suggested correction", "changeMade"], ["What happens if approved", "expectedOutcome"]];
  return <section className="app-panel mt-6 rounded-2xl p-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-wide text-[#F38978]">Automated exception adjustment</p><h3 className="mt-1 text-lg font-semibold">Finance suggestion review</h3><p className="mt-1 max-w-3xl text-sm text-[#7b6660]">Every explanation and amount uses this run's stored Admin-rule snapshot. No change is applied until Finance approves it.</p></div><div className="flex flex-wrap gap-2">{hasSourceBlockers ? <ActionButton icon={recalculationProcessing ? Loader2 : RefreshCw} variant="secondary" disabled={Boolean(processing) || recalculationProcessing} onClick={onRecalculateRun}>{recalculationProcessing ? "Refreshing payroll..." : "Refresh after HR correction"}</ActionButton> : null}<ActionButton icon={RefreshCw} variant="secondary" disabled={Boolean(processing) || recalculationProcessing} onClick={generate}>{processing === "generate" ? "Generating..." : "Generate suggestions"}</ActionButton>{pending.length ? <ActionButton icon={ShieldCheck} disabled={Boolean(processing) || recalculationProcessing} onClick={() => setConfirmBulk(true)}>Approve all safe ({pending.length})</ActionButton> : null}</div></div>
    {confirmBulk ? <div className="mt-4 rounded-xl border border-[#2D7C83]/30 bg-[#eaf6f6] p-4 text-sm"><strong>Confirm bulk approval</strong><p className="mt-1 text-[#47676a]">Approve {pending.length} safe {pending.length === 1 ? "proposal" : "proposals"} for {employeeCount} {employeeCount === 1 ? "employee" : "employees"}, then recalculate the complete pending run.</p><div className="mt-3 flex gap-2"><ActionButton icon={ShieldCheck} onClick={() => { setConfirmBulk(false); review(pending.map((item) => item.id), "approve"); }}>Confirm bulk approval</ActionButton><ActionButton variant="secondary" onClick={() => setConfirmBulk(false)}>Cancel</ActionButton></div></div> : null}
    {error ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
    {resolvedCount ? <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{resolvedCount} previous {resolvedCount === 1 ? "suggestion is" : "suggestions are"} no longer active after payroll recalculation.</div> : null}
    {loading ? <div className="mt-5 flex items-center gap-2 text-sm text-[#7b6660]"><Loader2 size={16} className="animate-spin"/>Loading suggestions...</div> : !activeProposals.length ? <div className="mt-5 rounded-xl border border-dashed border-[#f0d2ca] p-5 text-sm text-[#7b6660]">No active suggestions for this period. Generate suggestions after a new payroll calculation or source-data change.</div> : <div className="mt-5 space-y-4">{activeProposals.map((proposal) => {
      const before = proposal.originalValue || {}; const after = proposal.proposedValue || {}; const explanation = proposal.explanation || {};
      return <article key={proposal.id} className={`rounded-xl border p-4 ${proposal.actionable ? "border-[#2D7C83]/25 bg-[#2D7C83]/5" : "border-amber-300 bg-amber-50"}`}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div className="flex flex-wrap items-center gap-2"><strong>{proposal.employee}</strong><span className={`rounded-full px-2 py-1 text-xs font-semibold ${proposal.actionable ? "bg-[#e3f4f4] text-[#286f75]" : "bg-amber-100 text-amber-800"}`}>{proposal.actionable ? "Safe suggestion" : "Source blocker"}</span><span className="text-xs text-[#7b6660]">{proposal.status}</span></div>{proposal.status === "Pending" && proposal.actionable ? <div className="flex gap-2"><ActionButton icon={ShieldCheck} onClick={() => review([proposal.id], "approve")}>Approve</ActionButton><ActionButton icon={X} variant="secondary" onClick={() => review([proposal.id], "reject")}>Reject</ActionButton></div> : null}</div>
        {proposal.legacyExplanation ? <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">This older proposal has no stored calculation detail. Regenerate pending suggestions to see the exact snapshot formula and inputs.</div> : null}
        <div className="mt-4 grid gap-3 md:grid-cols-2">{sections.map(([label, key]) => <div key={key} className="rounded-lg border border-black/5 bg-white/75 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-[#F38978]">{label}</p><p className="mt-1 text-sm leading-6 text-[#554945]">{explanation[key] || proposal.reason}</p></div>)}</div>
        {!proposal.actionable ? <div className="mt-3 rounded-lg border border-amber-300 bg-white/70 p-3"><p className="text-xs font-semibold uppercase text-amber-800">Required source action</p><p className="mt-1 text-sm">{explanation.sourceActionRequired || proposal.reason}</p><p className="mt-1 text-xs text-[#7b6660]">Finance cannot approve an automatic amendment until HR/Admin corrects the source record.</p></div> : <details className="mt-4 rounded-lg border border-[#2D7C83]/20 bg-white/80 p-3"><summary className="cursor-pointer text-sm font-semibold text-[#2D7C83]">Show calculation</summary><div className="mt-3">{explanation.calculationSteps?.length ? <ol className="list-decimal space-y-1 pl-5 text-sm text-[#554945]">{explanation.calculationSteps.map((step, index) => <li key={index}>{step}</li>)}</ol> : <p className="text-sm text-[#7b6660]">Regenerate this proposal to retrieve exact calculation details.</p>}<p className="mt-3 text-xs text-[#7b6660]"><strong>Changed components:</strong> {explanation.affectedComponents?.length ? explanation.affectedComponents.join(", ") : "None identified"}. Other values are unaffected.</p><div className="mt-3 overflow-x-auto"><table className="w-full min-w-[42rem] text-sm"><thead><tr className="text-left text-xs uppercase text-[#7b6660]"><th className="py-2">Value</th><th>Before</th><th>Suggested</th><th>Impact</th></tr></thead><tbody>{[["Gross pay","grossPay"],["Deductions","totalDeductions"],["Employee CPF","employeeCpf"],["Employer CPF","employerCpf"],["MBMF","mbmf"],["SDL","sdl"],["Net pay","netPay"]].map(([label,key]) => { const changed = Number(after[key]) !== Number(before[key]); return <tr key={key} className={`border-t border-[#f0d2ca] ${changed ? "bg-[#eaf6f6]" : ""}`}><td className="py-2 font-medium">{label}</td><td>{formatMoney(before[key])}</td><td>{formatMoney(after[key])}</td><td className={changed ? "font-semibold text-[#2D7C83]" : "text-[#7b6660]"}>{changed ? formatMoney(Number(after[key] || 0) - Number(before[key] || 0)) : "Unaffected"}</td></tr>; })}</tbody></table></div></div></details>}
      </article>;
    })}</div>}
  </section>;
}

function StaffPayrollDetailsView({ error, onSystemCheckApproveAll, onUpdateEmployee, onUpdateStaffStatus, onRunUpdated, onRecalculateRun, onSelectRun, payrollRuns, recalculationProcessing, selectedRun, simulationProcessing, simulationResult }) {
  const stats = getAggregatePayrollStats([selectedRun]);
  const isLocked = getCompletedSteps(selectedRun).approved;
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const selectedEmployee = selectedRun.employees.find((employee) => employee.id === selectedEmployeeId);
  const salaryApprovalCount = selectedRun.employees.filter((employee) => getEmployeeFinanceStatus(employee) === "Approved").length;
  return (
    <PageShell heading="Staff Review & Adjustments" actions={<RunSelector payrollRuns={payrollRuns} selectedRunId={selectedRun.id} onSelectRun={onSelectRun} />}>
      <div className="mb-4 rounded-2xl border border-[#2D7C83]/20 bg-[#2D7C83]/10 p-4 text-sm text-[#2D7C83]"><strong>{formatPayrollPeriod(selectedRun)}</strong> is the only period included in the employee table and totals below.</div>
      {error ? <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Gross Pay" value={formatMoney(stats.totals.grossPay)} />
        <StatCard label="Net Pay" value={formatMoney(stats.totals.netPay)} tone="text-[#2f8758]" />
        <StatCard label="Employee CPF" value={formatMoney(stats.totals.employeeCpf)} tone="text-[#D97706]" />
        <StatCard label="Total Deductions" value={formatMoney(stats.totals.deductions)} tone="text-[#F38978]" />
      </div>
      <div className="mt-6">
        <ExceptionPanel run={selectedRun} />
      </div>
      <ExplainablePayrollAdjustmentReview selectedRun={selectedRun} onRunUpdated={onRunUpdated} onRecalculateRun={onRecalculateRun} recalculationProcessing={recalculationProcessing} />
      <div className="app-panel mt-6 overflow-hidden rounded-2xl">
        <div className="flex flex-col gap-3 border-b border-[#f0d2ca] bg-[#fff8f5] px-6 py-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold text-[#251E1F]">Salary approval simulation</p><span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-[#2D7C83]">{salaryApprovalCount}/{selectedRun.employees.length} approved</span></div><p className="mt-1 text-xs text-[#7b6660]">For presentation use: runs the automated system check, approves every eligible salary row below, and keeps flagged staff on hold.</p></div><ActionButton icon={ShieldCheck} disabled={isLocked || simulationProcessing} disabledReason={isLocked ? "Approved payroll runs are locked." : ""} onClick={onSystemCheckApproveAll}>{simulationProcessing ? "Checking and approving salaries..." : "System Check & Approve All Salaries"}</ActionButton></div>
        {simulationResult ? <div className={`border-b px-6 py-3 text-sm ${simulationResult.error ? "border-red-200 bg-red-50 text-red-700" : simulationResult.held ? "border-amber-200 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{simulationResult.message}</div> : null}
        <div className="grid grid-cols-8 gap-4 border-b border-[#f0d2ca] px-6 py-4 text-xs font-semibold uppercase tracking-wide text-[#F38978]/80">
          <span>Employee</span>
          <span>Department</span>
          <span>Gross Pay</span>
          <span>Deductions</span>
          <span>Net Pay</span>
          <span>Bank</span>
          <span>Status</span>
          <span>Action</span>
        </div>
        {selectedRun.employees.map((employee) => {
          const netPay = getEmployeeNetPay(employee);
          const exceptions = getEmployeeExceptions(employee);
          const status = getEmployeeFinanceStatus(employee);

          return (
            <div key={employee.id} className={`grid grid-cols-8 gap-4 border-b px-6 py-4 text-sm last:border-b-0 ${exceptions.length ? "border-l-4 border-l-red-500 border-b-red-200 bg-red-50" : "border-[#f0d2ca]"}`}>
              <span>
                <button
                  type="button"
                  className="block text-left font-semibold text-[#251E1F] underline-offset-4 hover:underline"
                  onClick={() => setSelectedEmployeeId(employee.id)}
                >
                  {employee.name}
                </button>
                {exceptions.length ? <><span className="mt-1 block w-fit rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">Flagged by automated review</span><span className="mt-1 block text-xs font-medium text-red-700">{exceptions.join(", ")}</span></> : null}
              </span>
              <span className="text-[#7b6660]">
                <span className="block">{employee.department || "Missing"}</span>
                <span className="block text-xs">{employee.workLocation || "No location"}</span>
              </span>
              <span className="text-[#251E1F]">
                <span className="block font-semibold">{formatMoney(getEmployeeTotalEarnings(employee))}</span>
              </span>
              <span className="text-[#7b6660]">
                <span className="block font-semibold text-[#251E1F]">{formatMoney(getEmployeeTotalDeductions(employee))}</span>
              </span>
              <span className="font-semibold text-[#2f8758]">{formatMoney(netPay)}</span>
              <span className={employee.bankAccount ? "text-[#7b6660]" : "text-[#9A6412]"}>
                <span className="block">{employee.bankType || "Missing bank"}</span>
                <span className="block text-xs">{employee.bankAccount || "Missing account"}</span>
              </span>
              <span>
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${exceptions.length ? "border-red-300 bg-red-100 text-red-700" : status === "Approved" ? "border-[#2f8758]/25 bg-[#2f8758]/10 text-[#2f8758]" : status === "Hold" ? "border-[#D97706]/25 bg-[#D97706]/10 text-[#9A6412]" : "border-[#f0d2ca] bg-white/80 text-[#7b6660]"}`}>
                  {status}
                </span>
              </span>
              <span className="flex flex-wrap gap-2">
                {isLocked ? (
                  <span className="inline-flex items-center gap-2 text-xs font-semibold text-[#7b6660]">
                    <Lock size={14} />
                    Locked
                  </span>
                ) : (
                  <>
                    <button
                      type="button"
                      className="rounded-lg border border-[#2f8758]/25 bg-[#2f8758]/10 px-3 py-1 text-xs font-semibold text-[#2f8758] disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() => onUpdateStaffStatus(employee.id, "Approved")}
                      disabled={status === "Approved"}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-[#D97706]/25 bg-[#D97706]/10 px-3 py-1 text-xs font-semibold text-[#9A6412] disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() => onUpdateStaffStatus(employee.id, "Hold")}
                      disabled={status === "Hold"}
                    >
                      Hold
                    </button>
                  </>
                )}
              </span>
            </div>
          );
        })}
      </div>
      {selectedEmployee ? (
        <StaffPayrollDetailModal
          employee={selectedEmployee}
          isLocked={isLocked}
          onClose={() => setSelectedEmployeeId("")}
          onStatusChange={onUpdateStaffStatus}
          onSave={(updatedEmployee) => onUpdateEmployee(updatedEmployee.id, updatedEmployee)}
        />
      ) : null}
    </PageShell>
  );
}

function NotificationRecordsView({ selectedRun }) {
  const steps = getCompletedSteps(selectedRun);
  const notifications = selectedRun.employees.map((employee) => ({
    id: `${selectedRun.id}-${employee.id}`,
    employee: employee.name,
    type: "Final Payslip",
    status: steps.payslipsSent ? "Sent" : "Pending",
    sentAt: selectedRun.payslipsSentAt
  }));

  return (
    <PageShell heading="Payslip Notifications">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {notifications.map((notification) => (
          <article key={notification.id} className="app-panel rounded-2xl p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F38978]/12 text-[#F38978]">
                <Send size={21} />
              </div>
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${notification.status === "Sent" ? "border-[#2f8758]/25 bg-[#2f8758]/10 text-[#2f8758]" : "border-[#f0d2ca] bg-white/80 text-[#7b6660]"}`}>
                {notification.status}
              </span>
            </div>
            <h3 className="mt-5 font-semibold text-[#251E1F]">{notification.employee}</h3>
            <p className="mt-2 text-sm text-[#7b6660]">{notification.type} for {formatPayrollPeriod(selectedRun)}</p>
            <p className="mt-4 text-sm text-[#7b6660]">Sent at: <span className="font-semibold text-[#251E1F]">{formatDateTime(notification.sentAt)}</span></p>
          </article>
        ))}
      </div>
      {!notifications.length ? <EmptyState message="No payslip notifications found." /> : null}
    </PageShell>
  );
}

function buildReportRows(selectedRun) {
  const totals = getRunTotals(selectedRun);
  const exceptionCount = getRunExceptions(selectedRun).length;
  const approvedStaffCount = selectedRun.employees.filter((employee) => getEmployeeFinanceStatus(employee) === "Approved").length;

  return [
    ["Payroll Summary", `${selectedRun.employees.length} employee(s)`, `${formatMoney(totals.salaryExpense)} gross / ${formatMoney(totals.netPay)} net`],
    ["Pay Run Summary", selectedRun.status || "Pending", formatPayrollPeriod(selectedRun)],
    ["Payment File", selectedRun.paymentFileGeneratedAt ? "Generated" : "Not generated", selectedRun.bankReference || "Pending bank reference"],
    ["Exception Summary", `${exceptionCount} exception(s)`, `${approvedStaffCount}/${selectedRun.employees.length} staff approved`],
    ["CPF Summary", formatMoney(totals.employeeCpf + totals.employerCpf), `${formatMoney(totals.employeeCpf)} employee / ${formatMoney(totals.employerCpf)} employer`],
    ["MBMF Summary", formatMoney(totals.employeeMbmf), "Employee wage-band deductions"],
    ["Deduction Summary", formatMoney(totals.deductions), `${formatMoney(totals.otherDeductions)} non-statutory`],
    ["Compliance Checklist", `${getComplianceSummary(selectedRun).passed}/${getComplianceSummary(selectedRun).total} passed`, `${getComplianceSummary(selectedRun).failed} issue(s)`],
    ["Audit Trail", `${getAuditEntries(selectedRun).length} event(s)`, selectedRun.status || "Pending"],
    ["Cost to Company", formatMoney(totals.salaryExpense + totals.employerCpf + totals.sdl), formatPayrollPeriod(selectedRun)]
  ];
}

function getStaffReportRows(selectedRun) {
  return [
    ["Employee", "Work Location", "Bank", "Earnings", "Deductions", "Net Pay", "Status"],
    ...selectedRun.employees.map((employee) => [
      employee.name,
      employee.workLocation || "Missing",
      `${employee.bankType || "Missing"} / ${employee.bankAccount || "Missing"}`,
      formatMoney(getEmployeeTotalEarnings(employee)),
      formatMoney(getEmployeeTotalDeductions(employee)),
      formatMoney(getEmployeeNetPay(employee)),
      getEmployeeFinanceStatus(employee)
    ])
  ];
}

function getExceptionReportRows(selectedRun) {
  const exceptions = getRunExceptions(selectedRun);

  return [
    ["Employee", "Department", "Exception", "Status"],
    ...(exceptions.length
      ? exceptions.map(({ employee, message }) => [
          employee.name,
          employee.department || "Missing",
          message,
          getEmployeeFinanceStatus(employee)
        ])
      : [["All employees", "All departments", "No automated exceptions detected", "Clear"]])
  ];
}

function getCpfReportRows(selectedRun) {
  return [
    ["Employee", "CPF Tier", "CPF Wage", "Employee CPF", "Employer CPF", "2026 Rate"],
    ...selectedRun.employees.map((employee) => {
      const tier = getEmployeeCpfRateTier(employee);

      return [
        employee.name,
        tier.ageGroup,
        formatMoney(Math.min(getEmployeeCpfApplicableEarnings(employee), adminCpfConfiguration.monthlyWageCeiling)),
        formatMoney(getEmployeeCpfAmount(employee)),
        formatMoney(getEmployerCpfAmount(employee)),
        `${tier.employeeOrdinaryRate}% / ${tier.employerOrdinaryRate}%`
      ];
    })
  ];
}

function getCpfTierReportRows() {
  return [
    ["Age Group", "Employee CPF", "Employer CPF"],
    ...adminCpfConfiguration.rateTiers.map((tier) => [
      tier.ageGroup,
      `${tier.employeeOrdinaryRate}%`,
      `${tier.employerOrdinaryRate}%`
    ])
  ];
}

function getCpfComponentReportRows() {
  return [
    ["Component", "CPF Applicable", "Wage Type"],
    ...Object.entries(adminCpfConfiguration.componentRules).map(([component, rule]) => [
      component,
      rule.cpfApplicable ? "Yes" : "No",
      rule.wageType
    ])
  ];
}

function getDeductionReportRows(selectedRun) {
  return [
    ["Employee", "Deduction", "Rate", "Amount", "Net Pay"],
    ...selectedRun.employees.flatMap((employee) =>
      getEmployeeReviewDeductionItems(employee).map((item) => [
        employee.name,
        item.label,
        item.rate || "-",
        formatMoney(item.amount),
        formatMoney(getEmployeeNetPay(employee))
      ])
    )
  ];
}

function getMbmfReportRows(selectedRun) {
  return [
    ["Employee", "Religion Source", "Eligible", "Employee MBMF", "Reason", "Recorded MBMF"],
    ...selectedRun.employees.map((employee) => {
      const review = getMbmfReview(employee);

      return [
        employee.name,
        review.religionSource,
        review.eligible ? "Eligible" : "Not Eligible",
        formatMoney(review.employeeAmount),
        review.eligible ? "Muslim employee; CPF Board wage band" : review.skipReason,
        formatMoney(review.uploadedEmployeeAmount)
      ];
    })
  ];
}

function getComplianceReportRows(selectedRun) {
  return [
    ["Check", "Status", "Detail"],
    ...getComplianceChecks(selectedRun).map((check) => [
      check.label,
      check.status ? "Passed" : "Action required",
      check.detail
    ])
  ];
}

function getAuditReportRows(selectedRun) {
  return [
    ["Time", "Action", "Owner"],
    ...getAuditEntries(selectedRun).map((entry) => [
      formatDateTime(entry.at),
      entry.action,
      entry.owner
    ])
  ];
}

function getCostReportRows(selectedRun) {
  return [
    ["Department", "Basic Pay", "Allowances", "Employer CPF", "SDL", "Total Cost"],
    ...Object.values(
      selectedRun.employees.reduce((groups, employee) => {
        const key = employee.department || "Missing";
        const current = groups[key] || {
          department: key,
          grossPay: 0,
          allowances: 0,
          employerCpf: 0,
          sdl: 0
        };

        const totalEarnings = getEmployeeTotalEarnings(employee);
        const basicPay = getEmployeeEarningItems(employee)
          .filter((item) => normalizePayrollLabel(item.label).includes("basic"))
          .reduce((total, item) => total + Number(item.amount || 0), 0);

        current.grossPay += basicPay;
        current.allowances += totalEarnings - basicPay;
        current.employerCpf += getEmployerCpfAmount(employee);
        current.sdl += getEmployerSdlAmount(employee);
        groups[key] = current;
        return groups;
      }, {})
    ).map((department) => [
      department.department,
      formatMoney(department.grossPay),
      formatMoney(department.allowances),
      formatMoney(department.employerCpf),
      formatMoney(department.sdl),
      formatMoney(department.grossPay + department.allowances + department.employerCpf + department.sdl)
    ])
  ];
}

function createFinanceReportPdf(selectedRun, reportTitle) {
  const totals = getRunTotals(selectedRun);
  const exceptionCount = getRunExceptions(selectedRun).length;
  const approvedStaffCount = selectedRun.employees.filter((employee) => getEmployeeFinanceStatus(employee) === "Approved").length;
  const complianceSummary = getComplianceSummary(selectedRun);
  const reportConfig = {
    "Payroll Summary": {
      filename: "payroll-summary",
      summaryRows: [
        ["Payroll Period", formatPayrollPeriod(selectedRun), selectedRun.status],
        ["Employees", `${selectedRun.employees.length} employee(s)`, `${approvedStaffCount} approved`],
        ["Basic Pay", formatMoney(totals.grossPay), "Base salary"],
        ["Allowances", formatMoney(totals.allowances), "Payroll allowances"],
        ["Gross Pay", formatMoney(totals.salaryExpense), "Before deductions"],
        ["Net Pay", formatMoney(totals.netPay), "Bank payment total"]
      ],
      tableRows: getStaffReportRows(selectedRun),
      footer: "Payroll summary generated from Finance-approved payroll records."
    },
    "Pay Run Summary": {
      filename: "pay-run-summary",
      summaryRows: [
        ["Status", selectedRun.status, formatPayrollPeriod(selectedRun)],
        ["Submitted", selectedRun.submittedBy, formatDateTime(selectedRun.submittedAt)],
        ["Approved", "Finance", formatDateTime(selectedRun.approvedAt)],
        ["Payment", selectedRun.bankReference || "Pending", formatDateTime(selectedRun.paidAt)]
      ],
      tableRows: [
        ["Step", "Owner", "Completed At"],
        ["Reviewed", "Finance", formatDateTime(selectedRun.reviewedAt)],
        ["Approved", "Finance", formatDateTime(selectedRun.approvedAt)],
        ["Payment PDF", "System", formatDateTime(selectedRun.paymentFileGeneratedAt)],
        ["Payment Confirmed", "Finance", formatDateTime(selectedRun.paidAt)],
        ["Payslips Sent", "System", formatDateTime(selectedRun.payslipsSentAt)],
        ["Ledger Posted", "System", formatDateTime(selectedRun.ledgerRecordedAt)],
        ["Reconciled", "Finance", formatDateTime(selectedRun.reconciledAt)]
      ],
      footer: "Pay run summary generated from workflow audit timestamps."
    },
    "Exception Summary": {
      filename: "exception-summary",
      summaryRows: [
        ["Exceptions", `${exceptionCount} detected`, exceptionCount ? "Finance review required" : "Clear"],
        ["Staff Approved", `${approvedStaffCount}/${selectedRun.employees.length}`, canApprovePayrollRun(selectedRun) ? "Ready" : "Pending"],
        ["CPF Source", "PayNivo SG-2026 statutory snapshot", "Persisted with payroll run"],
        ["Payroll Lock", selectedRun.approvedAt ? "Locked" : "Unlocked", formatDateTime(selectedRun.approvedAt)]
      ],
      tableRows: getExceptionReportRows(selectedRun),
      footer: "Exception checks are automated. Finance approves or holds affected staff records."
    },
    "CPF Summary": {
      filename: "cpf-summary",
      summaryRows: [
        ["Employee CPF", formatMoney(totals.employeeCpf), "2026 statutory age tier"],
        ["Employer CPF", formatMoney(totals.employerCpf), "2026 statutory age tier"],
        ["CPF Wage Basis", "CPF-applicable earnings only", "Ordinary wage ceiling applied"],
        ["CPF Rate Tiers", `${adminCpfConfiguration.rateTiers.length} age group(s)`, "SG-2026 rules snapshot"],
        ["Wage Ceiling", formatMoney(adminCpfConfiguration.monthlyWageCeiling), adminCpfConfiguration.effectiveFrom],
        ["Payment Due", adminCpfConfiguration.paymentDue, "Admin controlled"]
      ],
      tableRows: getCpfReportRows(selectedRun),
      footer: "CPF figures reflect the SG-2026 payroll rules snapshot stored with the payroll run."
    },
    "MBMF Summary": {
      filename: "mbmf-summary",
      summaryRows: [
        ["Employee MBMF", formatMoney(totals.employeeMbmf), `${adminCpfConfiguration.mbmf?.applicableReligion || "Muslim"} staff only`],
        ["Employer MBMF", formatMoney(0), "Not applicable"],
        ["Applicable Religion", adminCpfConfiguration.mbmf?.applicableReligion || "Muslim", "Staff master record"],
        ["Rate Type", "CPF Board wage bands", "Fixed amount by total wages"],
        ["Effective Rules", "SG-2026", adminCpfConfiguration.mbmf?.effectiveFrom || "2026-01-01"]
      ],
      tableRows: getMbmfReportRows(selectedRun),
      footer: `MBMF validation applies only to staff records whose religion matches ${adminCpfConfiguration.mbmf?.applicableReligion || "Muslim"}.`
    },
    "Deduction Summary": {
      filename: "deduction-summary",
      summaryRows: [
        ["Total Deductions", formatMoney(totals.deductions), "CPF, loans and funds"],
        ["Employee CPF", formatMoney(totals.employeeCpf), "SG-2026 statutory rules"],
        ["Other Deductions", formatMoney(totals.otherDeductions), "Loans and recoveries"],
        ["Net Pay After Deductions", formatMoney(totals.netPay), "Payment amount"]
      ],
      tableRows: getDeductionReportRows(selectedRun),
      footer: "Deduction summary itemises employee CPF, loans, funds and salary recoveries."
    },
    "Compliance Checklist": {
      filename: "compliance-checklist",
      summaryRows: [
        ["Compliance Status", `${complianceSummary.passed}/${complianceSummary.total} checks passed`, complianceSummary.failed ? `${complianceSummary.failed} action required` : "Ready"],
        ["CPF Source", "PayNivo SG-2026 statutory snapshot", "Persisted with payroll run"],
        ["Payment Due", adminCpfConfiguration.paymentDue, "Reference deadline"],
        ["Payroll Lock", selectedRun.approvedAt ? "Locked" : "Unlocked", formatDateTime(selectedRun.approvedAt)]
      ],
      tableRows: getComplianceReportRows(selectedRun),
      footer: "Compliance checklist supports Finance review before payment confirmation."
    },
    "Audit Trail": {
      filename: "audit-trail",
      summaryRows: [
        ["Audit Events", `${getAuditEntries(selectedRun).length} captured`, formatPayrollPeriod(selectedRun)],
        ["Latest Status", selectedRun.status, selectedRun.bankReference || "No bank reference"],
        ["Approved By", selectedRun.approvedAt ? "Finance" : "Pending", formatDateTime(selectedRun.approvedAt)],
        ["Generated", "Automated Payroll System", formatDateTime(new Date())]
      ],
      tableRows: getAuditReportRows(selectedRun),
      footer: "Audit trail captures workflow actions for internal and external review."
    },
    "Payment File": {
      filename: "payment-file-status",
      summaryRows: [
        ["Payment File", selectedRun.paymentFileGeneratedAt ? "Generated" : "Not generated", formatDateTime(selectedRun.paymentFileGeneratedAt)],
        ["Payment Method", selectedRun.paymentMethod || "GIRO", selectedRun.bankReference || "Pending bank reference"],
        ["Bank Total", formatMoney(totals.netPay), selectedRun.paidAt ? "Confirmed" : "Pending"],
        ["Approved Staff", `${approvedStaffCount} employee(s)`, "Included in payment"]
      ],
      tableRows: buildPaymentFileRows(selectedRun),
      footer: "Payment file report includes approved staff records only."
    },
    "Cost to Company": {
      filename: "cost-to-company",
      summaryRows: [
        ["Salary Expense", formatMoney(totals.salaryExpense), "Gross plus allowances"],
        ["Employer CPF", formatMoney(totals.employerCpf), "Company CPF cost"],
        ["SDL", formatMoney(totals.sdl), "Employer levy"],
        ["Total Cost", formatMoney(totals.salaryExpense + totals.employerCpf + totals.sdl), formatPayrollPeriod(selectedRun)],
        ["Ledger Status", getCompletedSteps(selectedRun).ledgerRecorded ? "Posted" : "Pending", formatDateTime(selectedRun.ledgerRecordedAt)]
      ],
      tableRows: getCostReportRows(selectedRun),
      footer: "Cost to company report groups payroll cost by department."
    }
  };
  const config = reportConfig[reportTitle];

  if (!config) return;

  return {
    filename: `${String(selectedRun.id).toLowerCase()}-${config.filename}.pdf`,
    blob: createPdfBlob({
      title: reportTitle,
      subtitle: `${formatPayrollPeriod(selectedRun)} / ${selectedRun.status}`,
      summaryRows: config.summaryRows,
      tableRows: config.tableRows,
      footer: config.footer
    })
  };
}

function downloadReport(selectedRun, reportTitle) {
  const report = createFinanceReportPdf(selectedRun, reportTitle);
  if (report) downloadPdf(report.filename, report.blob);
}

function FinanceReportPreviewModal({ reportTitle, selectedRun, onClose }) {
  const report = useMemo(() => createFinanceReportPdf(selectedRun, reportTitle), [reportTitle, selectedRun]);
  const [pdfUrl, setPdfUrl] = useState("");
  const [excelProgress, setExcelProgress] = useState({ running: false, percent: 0, message: "" });
  const downloadExcel = async () => {
    if (excelProgress.running) return;
    setExcelProgress({ running: true, percent: 8, message: "Preparing payroll rows…" });
    const timer = window.setInterval(() => setExcelProgress((current) => current.running ? { ...current, percent: Math.min(90, current.percent + 7), message: current.percent > 55 ? "Formatting workbook…" : "Preparing payroll rows…" } : current), 180);
    try {
      await exportFinancePayrollReport(selectedRun.id, reportTitle);
      window.clearInterval(timer);
      setExcelProgress({ running: false, percent: 100, message: "Excel report downloaded." });
    } catch (error) {
      window.clearInterval(timer);
      setExcelProgress({ running: false, percent: 0, message: error.message });
    }
  };
  useEffect(() => {
    if (!report?.blob) return undefined;
    const url = URL.createObjectURL(report.blob);
    setPdfUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [report]);
  if (!report) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#251E1F]/45 p-4 backdrop-blur-sm">
      <section className="app-panel flex max-h-[94vh] w-full max-w-6xl flex-col rounded-2xl p-5">
        <header className="flex flex-col gap-3 border-b border-[#f0d2ca] pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-xs font-semibold uppercase tracking-wide text-[#F38978]">Report preview</p><h3 className="mt-1 text-lg font-semibold text-[#251E1F]">{reportTitle}</h3><p className="mt-1 text-sm text-[#7b6660]">{formatPayrollPeriod(selectedRun)} · database-backed payroll snapshot</p></div>
          <div className="flex flex-wrap gap-2"><ActionButton icon={Download} onClick={() => downloadPdf(report.filename, report.blob)}>Export PDF</ActionButton><ActionButton icon={FileBarChart} variant="secondary" disabled={excelProgress.running} onClick={downloadExcel}>{excelProgress.running ? "Generating Excel…" : "Export Excel"}</ActionButton><ActionButton icon={X} variant="secondary" disabled={excelProgress.running} onClick={onClose}>Close</ActionButton></div>
        </header>
        {excelProgress.message ? <div role="status" aria-live="polite" className={`mt-4 rounded-xl border p-3 text-sm ${excelProgress.percent === 0 ? "border-red-200 bg-red-50 text-red-700" : excelProgress.percent === 100 ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-[#2D7C83]/25 bg-[#2D7C83]/10 text-[#2D7C83]"}`}><div className="flex items-center justify-between gap-3"><span className="inline-flex items-center gap-2 font-semibold">{excelProgress.running ? <Loader2 size={16} className="motion-safe:animate-spin"/> : excelProgress.percent === 100 ? <CheckCircle2 size={16}/> : <AlertCircle size={16}/>} {excelProgress.message}</span>{excelProgress.percent > 0 ? <b>{excelProgress.percent}%</b> : null}</div>{excelProgress.percent > 0 ? <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/80"><div className="h-full rounded-full bg-gradient-to-r from-[#2D7C83] to-emerald-500 transition-all duration-300" style={{ width: `${excelProgress.percent}%` }}/></div> : null}</div> : null}
        <div className="mt-5 min-h-0 flex-1 overflow-hidden rounded-xl border border-[#f0d2ca] bg-white">{pdfUrl ? <iframe title={`${reportTitle} preview`} src={pdfUrl} className="h-[68vh] w-full" /> : null}</div>
      </section>
    </div>
  );
}

function PayrollReportsView({ onSelectRun, payrollRuns, selectedRun }) {
  const [selectedReport, setSelectedReport] = useState("");
  const toneClasses = [
    ["admin-report-card--coral", "admin-report-icon--coral"], ["admin-report-card--teal", "admin-report-icon--teal"],
    ["admin-report-card--purple", "admin-report-icon--purple"], ["admin-report-card--amber", "admin-report-icon--amber"],
    ["admin-report-card--blue", "admin-report-icon--blue"], ["admin-report-card--green", "admin-report-icon--green"]
  ];
  const reportCards = buildReportRows(selectedRun).map(([title, detail, value], index) => ({
    title, description: detail, value,
    category: index < 3 ? "Payroll oversight" : index < 7 ? "Compliance & deductions" : "Payment, audit & cost",
    contains: detail,
    purpose: index < 3 ? "Finance review and approval" : index < 7 ? "Compliance evidence and statutory review" : "Payment, reconciliation and management reporting",
    filter: formatPayrollPeriod(selectedRun),
    cardClass: toneClasses[index % toneClasses.length][0], iconClass: toneClasses[index % toneClasses.length][1]
  }));
  const reportGroups = ["Payroll oversight", "Compliance & deductions", "Payment, audit & cost"].map((category) => ({ category, reports: reportCards.filter((report) => report.category === category) }));
  const lastRefresh = formatDateTime(selectedRun.updatedAt || selectedRun.recalculatedAt || selectedRun.approvedAt || selectedRun.submittedAt);

  return (
    <PageShell
      heading="Finance Reports"
      actions={<RunSelector payrollRuns={payrollRuns} selectedRunId={selectedRun?.id} onSelectRun={onSelectRun} />}
    >
      <div className="space-y-7">{reportGroups.map((group) => <section key={group.category}>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-[#7b6660]">{group.category}</h3>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{group.reports.map((report) => (
          <article key={report.title} className={`app-panel admin-report-card ${report.cardClass}`}>
            <span className={`admin-report-icon ${report.iconClass}`}><FileBarChart size={22} /></span>
            <h3 className="mt-4 font-semibold text-[#251E1F]">{report.title}</h3>
            <p className="mt-2 text-sm text-[#7b6660]">{report.description}</p>
            <dl className="mt-4 space-y-3 rounded-xl bg-[#fff8f5] p-4 text-sm">
              <div><dt className="text-xs font-semibold uppercase tracking-wide text-[#F38978]">Contains</dt><dd className="mt-1 text-[#7b6660]">{report.contains}</dd></div>
              <div><dt className="text-xs font-semibold uppercase tracking-wide text-[#F38978]">Best used for</dt><dd className="mt-1 text-[#7b6660]">{report.purpose}</dd></div>
              <div><dt className="text-xs font-semibold uppercase tracking-wide text-[#F38978]">Filter</dt><dd className="mt-1 text-[#7b6660]">{report.filter}</dd></div>
              <div><dt className="text-xs font-semibold uppercase tracking-wide text-[#F38978]">Last refreshed</dt><dd className="mt-1 text-[#7b6660]">{lastRefresh}</dd></div>
              <div><dt className="text-xs font-semibold uppercase tracking-wide text-[#F38978]">Current result</dt><dd className="mt-1 font-semibold text-[#251E1F]">{report.value}</dd></div>
            </dl>
            <button type="button" className="mt-auto pt-5 text-left text-sm font-semibold text-[#F38978] hover:underline" onClick={() => setSelectedReport(report.title)}>Preview report →</button>
          </article>
        ))}</div>
      </section>)}</div>
      {selectedReport ? <FinanceReportPreviewModal reportTitle={selectedReport} selectedRun={selectedRun} onClose={() => setSelectedReport("")} /> : null}
    </PageShell>
  );
}

function PayrollSummariesView({ payrollRuns, selectedRun }) {
  const [statsFilter, setStatsFilter] = useState(() => getDefaultStatsFilter(selectedRun));
  useEffect(() => setStatsFilter(getDefaultStatsFilter(selectedRun)), [selectedRun.id]);
  const filteredRuns = getFilteredPayrollRuns(payrollRuns, statsFilter);
  const stats = getAggregatePayrollStats(filteredRuns);
  const totals = stats.totals;
  const updateStatsMode = (mode) => {
    const runDate = getPayrollRunDate(selectedRun);
    setStatsFilter({
      mode,
      value: mode === "week" ? getWeekFilterValue(runDate) : getMonthFilterValue(runDate)
    });
  };
  const summaryRows = [
    ["Gross Pay", totals.grossPay],
    ["Allowances", totals.allowances],
    ["Total Gross Earnings", totals.grossPay + totals.allowances],
    ["Deductions", totals.deductions],
    ["Employee CPF", totals.employeeCpf],
    ["Employee MBMF", totals.employeeMbmf],
    ["Employer CPF", totals.employerCpf],
    ["SDL", totals.sdl],
    ["Net Pay", totals.netPay]
  ];

  return (
    <PageShell heading="Finance Summary">
      <PayrollStatsFilter
        filter={statsFilter}
        resultCount={filteredRuns.length}
        onFilterChange={setStatsFilter}
        onModeChange={updateStatsMode}
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="app-panel rounded-2xl p-6">
          <div className="flex items-center gap-3">
            <ReceiptText size={24} className="text-[#F38978]" />
            <div>
              <h3 className="font-semibold text-[#251E1F]">Filtered Payroll Summary</h3>
              <p className="text-sm text-[#7b6660]">{filteredRuns.length} run(s), {stats.employees} employee record(s)</p>
            </div>
          </div>
          <div className="mt-6 space-y-3">
            {summaryRows.map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-4 rounded-xl border border-[#f0d2ca] bg-white/80 p-3 text-sm">
                <span className="text-[#7b6660]">{label}</span>
                <span className="font-semibold text-[#251E1F]">{formatMoney(value)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="lg:col-span-2">
          <AccountingImpact payrollRuns={payrollRuns} run={selectedRun} />
        </div>
      </div>
    </PageShell>
  );
}

// -----------------------------------------------------------------------------
// 12. View router
// -----------------------------------------------------------------------------

function FinanceStaffRecordsView() {
  const session = getStoredSession();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  useEffect(() => {
    let active = true;
    fetch(`${API_BASE_URL}/api/hr/staff`, { headers: getAuthHeaders(session?.token) })
      .then(async (response) => { const body = await response.json(); if (!response.ok) throw new Error(body.message || "Unable to load HR staff records."); return body; })
      .then((rows) => { if (active) { setStaff(Array.isArray(rows) ? rows : []); setError(""); } })
      .catch((loadError) => { if (active) setError(loadError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [session?.token]);
  const query = search.trim().toLowerCase();
  const filtered = staff.filter((item) => [item.employee_code, item.name, item.department_name, item.email, item.bank].some((value) => String(value || "").toLowerCase().includes(query)));
  return <PageShell heading="Staff Records" actions={<label className="flex items-center gap-2 rounded-xl border border-[#f0d2ca] bg-white px-3 py-2"><Search size={16} className="text-[#F38978]"/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search staff records" className="w-56 bg-transparent text-sm outline-none"/></label>}>
    <div className="mb-5 rounded-2xl border border-[#2D7C83]/25 bg-[#2D7C83]/10 p-5 text-sm text-[#2D7C83]"><strong>Read-only HR staff data for Finance.</strong><p className="mt-1">Use these records to verify payroll identity, salary basis, CPF eligibility, department allocation and payment readiness. HR remains responsible for corrections.</p></div>
    {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : loading ? <div className="flex items-center gap-2 p-8 text-sm text-[#7b6660]"><Loader2 size={17} className="animate-spin"/>Loading HR staff records...</div> : <div className="app-panel overflow-x-auto rounded-2xl"><table className="min-w-[60rem] w-full text-left text-sm"><thead><tr className="border-b border-[#f0d2ca] text-xs uppercase tracking-wide text-[#F38978]"><th className="px-5 py-4">Employee</th><th>Department</th><th>Base salary</th><th>CPF verification</th><th>Payment details</th><th>Status</th></tr></thead><tbody>{filtered.map((item) => <tr key={item.employee_id} className="border-b border-[#f0d2ca] last:border-0"><td className="px-5 py-4"><strong className="block text-[#251E1F]">{item.name}</strong><span className="text-xs text-[#7b6660]">{item.employee_code || item.employee_id} · {item.email || "No email"}</span></td><td>{item.department_name || <span className="font-semibold text-red-600">Missing</span>}</td><td className="font-semibold">{formatMoney(item.base_salary)}</td><td><span className={item.date_of_birth ? "text-[#2f8758]" : "font-semibold text-red-600"}>{item.date_of_birth ? `DOB recorded · ${item.race || "Race not recorded"}` : "DOB missing"}</span></td><td><strong className="block">{item.bank || "Missing bank"}</strong><span className="text-xs text-[#7b6660]">{item.account_no ? `Account ending ${String(item.account_no).slice(-4)}` : "Account number missing"}</span></td><td><span className={`rounded-full px-2 py-1 text-xs font-semibold ${Number(item.status) === 1 ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{Number(item.status) === 1 ? "Active" : "Inactive"}</span></td></tr>)}</tbody></table>{!filtered.length ? <div className="p-8 text-center text-sm text-[#7b6660]">No staff records match this search.</div> : null}</div>}
  </PageShell>;
}

function PayrollRunCompletionView({ selectedRun }) {
  const navigate = useNavigate();
  const totals = getRunTotals(selectedRun);
  return <PageShell heading="Payroll run completed">
    <section className="app-panel overflow-hidden rounded-3xl text-center">
      <div className="bg-gradient-to-br from-emerald-50 via-white to-[#fff8f5] px-6 py-10"><span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-600 text-white shadow-xl shadow-emerald-200"><CheckCircle2 size={42}/></span><p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Workflow complete</p><h2 className="mt-2 text-3xl font-semibold text-[#251E1F]">{formatPayrollPeriod(selectedRun)} payroll is complete</h2><p className="mt-2 font-mono text-sm font-semibold text-[#2D7C83]">Run ID: {formatPayrollRunId(selectedRun)}</p><p className="mx-auto mt-3 max-w-2xl text-sm text-[#7b6660]">Payment, payslip delivery, statutory posting, ledger recording, and reconciliation have been saved for this payroll run.</p></div>
      <div className="grid gap-px border-y border-[#f0d2ca] bg-[#f0d2ca] sm:grid-cols-4">{[["Employees", selectedRun.employees.length], ["Gross payroll", formatMoney(totals.grossPay + totals.allowances)], ["Net paid", formatMoney(totals.netPay)], ["Payment reference", selectedRun.bankReference || "Recorded"]].map(([label,value]) => <div key={label} className="bg-white p-5"><p className="text-xs font-semibold uppercase tracking-wide text-[#7b6660]">{label}</p><strong className="mt-2 block text-lg text-[#251E1F]">{value}</strong></div>)}</div>
      <div className="flex flex-col items-center justify-center gap-3 p-6 sm:flex-row"><button type="button" onClick={() => navigate("/dashboard/payroll/finance/payroll-run-history")} className="primary-button inline-flex items-center gap-2 px-5 py-3 font-semibold"><ClipboardList size={17}/>View payroll run history</button><button type="button" onClick={() => navigate("/dashboard/payroll/finance")} className="rounded-xl border border-[#f0d2ca] bg-white px-5 py-3 font-semibold text-[#7b6660]">Return to dashboard</button></div>
    </section>
  </PageShell>;
}

function PayrollRunHistoryView({ payrollRuns, selectedRun, onSelectRun }) {
  const [detailsId, setDetailsId] = useState("");
  const [query, setQuery] = useState("");
  const detailsRun = payrollRuns.find((run) => run.id === detailsId) || null;
  const filtered = payrollRuns.filter((run) => `${formatPayrollPeriod(run)} ${formatPayrollRunId(run)} ${run.status} ${run.bankReference || ""}`.toLowerCase().includes(query.trim().toLowerCase()));
  const openDetails = (run) => { setDetailsId(run.id); onSelectRun(run.id); };
  return <PageShell heading="Payroll Run History" actions={<label className="flex items-center gap-2 rounded-xl border border-[#f0d2ca] bg-white px-3 py-2.5"><Search size={16} className="text-[#F38978]"/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search period, status, or reference" className="w-64 bg-transparent text-sm outline-none"/></label>}>
    <div className="mb-5 rounded-2xl border border-[#2D7C83]/20 bg-[#2D7C83]/10 p-4 text-sm text-[#2D7C83]"><strong>Database payroll archive.</strong> Each entry is loaded from the stored payroll run and its related employee payroll records. Select a row to inspect the saved result.</div>
    <div className="app-panel overflow-x-auto rounded-2xl"><table className="min-w-[64rem] w-full text-left text-sm"><thead className="bg-[#fff8f5] text-xs uppercase tracking-wide text-[#7b6660]"><tr><th className="px-5 py-4">Payroll period</th><th>Run ID</th><th>Status</th><th>Employees</th><th>Gross payroll</th><th>Net payment</th><th>Completed</th><th className="pr-5 text-right">Action</th></tr></thead><tbody className="divide-y divide-[#f0d2ca]">{filtered.map((run) => { const totals = getRunTotals(run); return <tr key={run.id} className="cursor-pointer transition hover:bg-[#fff8f5]" onClick={() => openDetails(run)}><td className="px-5 py-4"><strong className="text-[#251E1F]">{formatPayrollPeriod(run)}</strong><small className="mt-1 block text-[#7b6660]">{run.bankReference || "No payment reference"}</small></td><td className="font-mono text-xs font-semibold text-[#2D7C83]">{formatPayrollRunId(run)}</td><td><span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getStatusClass(run.status)}`}>{run.status}</span></td><td>{run.employees.length}</td><td className="font-semibold">{formatMoney(totals.grossPay + totals.allowances)}</td><td className="font-semibold text-emerald-700">{formatMoney(totals.netPay)}</td><td>{run.reconciledAt ? formatDateTime(run.reconciledAt) : "In progress"}</td><td className="pr-5 text-right"><button type="button" onClick={(event) => { event.stopPropagation(); openDetails(run); }} className="rounded-lg border border-[#f0d2ca] bg-white px-3 py-2 text-xs font-semibold">View details</button></td></tr>; })}</tbody></table>{!filtered.length ? <div className="p-10 text-center text-sm text-[#7b6660]">No payroll runs match your search.</div> : null}</div>
    {detailsRun ? <PayrollRunDetailsDrawer run={detailsRun} onClose={() => setDetailsId("")}/> : null}
  </PageShell>;
}

function PayrollRunDetailsDrawer({ run, onClose }) {
  const totals = getRunTotals(run);
  useEffect(() => { const before = document.body.style.overflow; document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = before; }; }, []);
  return <div className="fixed inset-0 z-[1000] flex justify-end bg-[#251E1F]/45" onMouseDown={onClose}><aside role="dialog" aria-modal="true" aria-labelledby="payroll-run-details-title" onMouseDown={(event) => event.stopPropagation()} className="h-full w-full max-w-4xl overflow-y-auto bg-[#fffdfc] shadow-2xl"><header className="sticky top-0 z-10 flex items-start justify-between border-b border-[#f0d2ca] bg-white/95 p-6 backdrop-blur"><div><p className="text-xs font-semibold uppercase tracking-wider text-[#F38978]">Stored payroll run</p><h2 id="payroll-run-details-title" className="mt-1 text-2xl font-semibold text-[#251E1F]">{formatPayrollPeriod(run)}</h2><p className="mt-1 font-mono text-xs font-semibold text-[#2D7C83]">Run ID: {formatPayrollRunId(run)}</p><p className="mt-1 text-sm text-[#7b6660]">{run.status} · {run.bankReference || "No payment reference"}</p></div><button type="button" onClick={onClose} className="rounded-xl border border-[#f0d2ca] p-2"><X size={20}/></button></header>
    <div className="space-y-5 p-6"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[["Employees", run.employees.length], ["Gross payroll", formatMoney(totals.grossPay + totals.allowances)], ["Total deductions", formatMoney(totals.totalDeductions)], ["Net paid", formatMoney(totals.netPay)]].map(([label,value]) => <div key={label} className="rounded-2xl border border-[#f0d2ca] bg-white p-4"><p className="text-xs uppercase tracking-wide text-[#7b6660]">{label}</p><strong className="mt-2 block text-xl text-[#251E1F]">{value}</strong></div>)}</div>
      <section className="rounded-2xl border border-[#f0d2ca] bg-white p-5"><h3 className="font-semibold text-[#251E1F]">Completion record</h3><dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">{[["Payroll approved", run.approvedAt], ["Payment confirmed", run.paidAt], ["Payslips delivered", run.payslipsSentAt], ["Ledger recorded", run.ledgerRecordedAt || run.xeroRecordedAt], ["Reconciled", run.reconciledAt], ["Payment reference", run.bankReference]].map(([label,value]) => <div key={label}><dt className="text-xs uppercase text-[#7b6660]">{label}</dt><dd className="mt-1 font-semibold">{value && label !== "Payment reference" ? formatDateTime(value) : value || "Not completed"}</dd></div>)}</dl></section>
      <section className="overflow-hidden rounded-2xl border border-[#f0d2ca] bg-white"><div className="border-b border-[#f0d2ca] p-5"><h3 className="font-semibold text-[#251E1F]">Employee payroll records</h3><p className="mt-1 text-xs text-[#7b6660]">{run.employees.length} records stored for this period</p></div><div className="overflow-x-auto"><table className="min-w-[48rem] w-full text-left text-sm"><thead className="bg-[#fff8f5] text-xs uppercase text-[#7b6660]"><tr><th className="px-5 py-3">Employee</th><th>Department</th><th>Gross pay</th><th>Deductions</th><th>Net pay</th><th>Finance status</th></tr></thead><tbody className="divide-y divide-[#f0d2ca]">{run.employees.map((employee) => <tr key={employee.id || employee.payrollId || employee.employeeId}><td className="px-5 py-3 font-semibold">{employee.name || employee.employeeName}</td><td>{employee.department || "—"}</td><td>{formatMoney(employee.grossPay || employee.basicPay)}</td><td>{formatMoney(getEmployeeTotalDeductions(employee))}</td><td className="font-semibold text-emerald-700">{formatMoney(getEmployeeNetPay(employee))}</td><td>{getEmployeeFinanceStatus(employee)}</td></tr>)}</tbody></table></div></section>
    </div><footer className="sticky bottom-0 flex justify-end border-t border-[#f0d2ca] bg-white p-5"><button type="button" onClick={onClose} className="rounded-xl border border-[#f0d2ca] px-5 py-2.5 font-semibold">Close</button></footer></aside></div>;
}

function PayrollRunReviewData({ run, showResults }) {
  const totals = getRunTotals(run);
  const exceptions = getRunExceptions(run);
  const affectedEmployees = new Set(exceptions.map((item) => item.employee.id || item.employee.employeeId)).size;
  const validationChecks = getComplianceChecks(run).slice(0, 8);

  return <div className="mt-5 space-y-4">
    {showResults ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[
        ["Employees", run.employees.length, "Records in this payroll run"],
        ["Gross payroll", formatMoney(totals.grossPay + totals.allowances), "Salary and payroll earnings"],
        ["Net payroll", formatMoney(totals.netPay), "Expected employee payments"],
        ["Exceptions", exceptions.length, affectedEmployees ? `${affectedEmployees} employee(s) affected` : "No compliance blockers"]
      ].map(([label, value, detail]) => <div key={label} className="rounded-xl border border-[#f0d2ca] bg-white p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#7b6660]">{label}</p>
        <strong className={`mt-1 block text-xl ${label === "Exceptions" && exceptions.length ? "text-red-600" : "text-[#251E1F]"}`}>{value}</strong>
        <p className="mt-1 text-xs text-[#7b6660]">{detail}</p>
      </div>)}
    </div> : null}

    <section className="overflow-hidden rounded-xl border border-[#f0d2ca] bg-white">
      <div className="flex flex-col gap-2 border-b border-[#f0d2ca] bg-[#fff8f5] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div><h3 className="font-semibold text-[#251E1F]">{showResults ? "Automated validation results" : "Compliance rules included in this review"}</h3><p className="mt-1 text-xs text-[#7b6660]">{showResults ? "Run-level results only. Review individual salary details and take action in Step 3." : "Review the rules below, then run the automated checks for this payroll period."}</p></div>
        {showResults ? <span className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${exceptions.length ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>{exceptions.length ? `${exceptions.length} issue(s) found` : "All automated checks passed"}</span> : <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">Not run yet</span>}
      </div>
      <div className="grid gap-2 p-4 sm:grid-cols-2">{validationChecks.map((check) => <div key={check.label} className="flex items-center justify-between gap-3 rounded-lg border border-[#f0d2ca] px-3 py-2.5 text-sm"><div><span className="text-[#534647]">{check.label}</span>{!showResults ? <p className="mt-1 text-[11px] leading-4 text-[#7b6660]">{check.detail}</p> : null}</div>{showResults ? <span className={`inline-flex shrink-0 items-center gap-1 font-semibold ${check.status ? "text-emerald-700" : "text-red-600"}`}>{check.status ? <CheckCircle2 size={14}/> : <AlertCircle size={14}/>} {check.status ? "Passed" : "Review"}</span> : null}</div>)}</div>
      {showResults && exceptions.length ? <div className="border-t border-[#f0d2ca] px-5 py-3 text-xs text-[#7b6660]"><strong className="text-red-700">Next:</strong> Open Staff Review &amp; Adjustments to see the affected employees, explanations, and suggested corrections.</div> : null}
    </section>
  </div>;
}

function GuidedWorkflowStageView({ stage, selectedRun, payrollRuns, onSelectRun, onAction, onGeneratePaymentFile, onSetupRecipients, onSubmitPayment, onRecalculate, busy, error }) {
  const navigate = useNavigate();
  const [reviewResultsVisible, setReviewResultsVisible] = useState(() => Boolean(selectedRun.approvedAt));
  useEffect(() => setReviewResultsVisible(Boolean(selectedRun.approvedAt)), [selectedRun.id, selectedRun.approvedAt]);
  const state = getCompletedSteps(selectedRun);
  const approvedStaff = selectedRun.employees.filter((employee) => employee.financeStatus === "Approved").length;
  const allStaffApproved = approvedStaff === selectedRun.employees.length && approvedStaff > 0;
  const delivery = selectedRun.payslipDelivery || {};
  const deliveryTotal = Number(delivery.total || selectedRun.employees.length || 0);
  const deliverySent = Number(delivery.sent || delivery.delivered || 0) + Number(delivery.skipped || 0);
  const deliveryFailed = Number(delivery.failed || 0);
  const deliveryPending = Math.max(0, Number(delivery.pending ?? (deliveryTotal - deliverySent - deliveryFailed)));
  const definitions = {
    review: { title: "Payroll Run Review", description: "Run database-backed compliance checks against the immutable rule snapshot before reviewing employees.", checks: [["Admin rules snapshot is current", !selectedRun.rulesChanged], ["Automated compliance review completed", state.reviewed]], action: "review", label: "Run compliance review", ready: !selectedRun.rulesChanged, done: state.reviewed },
    approval: { title: "Payroll Approval", description: "Confirm the reviewed employee results and lock this payroll period for payment.", checks: [["Compliance review completed", state.reviewed], [`All staff approved (${approvedStaff}/${selectedRun.employees.length})`, allStaffApproved], ["No active rule change", !selectedRun.rulesChanged]], action: "approve-payroll", label: "Approve and lock payroll", ready: state.reviewed && allStaffApproved && !selectedRun.rulesChanged, done: state.approved },
    preparation: { title: "Payment Preparation", description: "Create the Finance payment document and configure every approved Modern Treasury recipient.", checks: [["Payroll approved", state.approved], ["Payment PDF generated", Boolean(selectedRun.paymentFileGeneratedAt)], ["Recipients configured", Number(selectedRun.paymentRecipientsConfigured || 0) >= selectedRun.employees.length]], ready: state.approved, done: Boolean(selectedRun.paymentFileGeneratedAt) && Number(selectedRun.paymentRecipientsConfigured || 0) >= selectedRun.employees.length },
    payment: { title: "Payment Release", description: "Submit the approved batch to Modern Treasury, then confirm settlement before delivery.", checks: [["Payment PDF generated", Boolean(selectedRun.paymentFileGeneratedAt)], ["Recipients configured", Number(selectedRun.paymentRecipientsConfigured || 0) >= selectedRun.employees.length], ["Batch submitted", Boolean(selectedRun.paymentSubmittedAt)], ["Settlement confirmed", state.paid]], ready: Boolean(selectedRun.paymentFileGeneratedAt) && Number(selectedRun.paymentRecipientsConfigured || 0) >= selectedRun.employees.length, done: state.paid },
    payslips: { title: "Payslip Delivery", description: "Generate and deliver employee payslips after payment settlement. Successful deliveries are never resent.", checks: [["Payment confirmed", state.paid], ["All payslips delivered", state.payslipsSent]], action: "send-payslips", label: state.payslipsSent ? "Payslips delivered" : "Send pending payslips", ready: state.paid, done: state.payslipsSent },
    statutory: { title: "Statutory & Ledger", description: "Record CPF, MBMF, SDL, recoveries, and the balanced payroll journal.", checks: [["Payslips delivered", state.payslipsSent], ["Statutory deductions logged", state.cpfLogged && state.otherDeductionsLogged], ["Payroll ledger recorded", state.ledgerRecorded]], action: "record-statutory-ledger", label: "Record statutory items and ledger", ready: state.payslipsSent, done: state.ledgerRecorded && state.cpfLogged && state.otherDeductionsLogged },
    reconciliation: { title: "Reconciliation & Reports", description: "Match the confirmed payment reference to payroll totals and complete the period.", checks: [["Payment confirmed", state.paid], ["Ledger recorded", state.ledgerRecorded], ["Payroll reconciled", state.reconciled]], action: "reconcile", label: "Reconcile and complete reporting", ready: state.ledgerRecorded, done: state.reconciled }
  };
  const item = definitions[stage];
  const runAction = async (action, payload) => { try { await onAction(action, payload); } catch { /* error banner is shared */ } };
  const runComplianceReview = async () => { try { await onAction("review"); setReviewResultsVisible(true); } catch { /* error banner is shared */ } };
  const displayedChecks = stage === "review" ? [["Admin rules snapshot is current", !selectedRun.rulesChanged], ["Automated compliance review completed", reviewResultsVisible]] : item.checks;
  return <PageShell heading={item.title} actions={<RunSelector payrollRuns={payrollRuns} selectedRunId={selectedRun.id} onSelectRun={onSelectRun} />}>
    <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
      <section className="app-panel rounded-2xl p-6"><p className="text-sm text-[#7b6660]">{item.description}</p><div className="mt-5 rounded-xl border border-[#f0d2ca] bg-[#fff8f5] p-4"><p className="text-xs font-semibold uppercase tracking-wide text-[#F38978]">Selected payroll period</p><h3 className="mt-1 text-xl font-semibold text-[#251E1F]">{formatPayrollPeriod(selectedRun)}</h3><p className="mt-1 font-mono text-xs font-semibold text-[#2D7C83]">Run ID: {formatPayrollRunId(selectedRun)}</p><p className="mt-1 text-sm text-[#7b6660]">{stage === "review" && !reviewResultsVisible ? "Ready for automated review" : selectedRun.status}</p></div>
        {stage === "review" ? <PayrollRunReviewData run={selectedRun} showResults={reviewResultsVisible}/> : null}
        {stage === "payment" && selectedRun.paymentStatus ? <div className={`mt-4 rounded-xl border p-4 text-sm ${["Failed", "Partially Submitted"].includes(selectedRun.paymentStatus) ? "border-red-200 bg-red-50 text-red-700" : "border-blue-200 bg-blue-50 text-blue-700"}`}><div className="flex items-center justify-between gap-3"><strong>Modern Treasury: {selectedRun.paymentStatus}</strong>{["Submitting", "Processing", "Partially Submitted"].includes(selectedRun.paymentStatus) ? <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2 py-1 text-[11px] font-semibold text-blue-700"><span className="h-2 w-2 rounded-full bg-blue-500 motion-safe:animate-pulse"/>Live</span> : null}</div><p className="mt-1">{selectedRun.bankReference || selectedRun.paymentFailureReason || "Awaiting provider reference"}</p>{selectedRun.paymentBatch ? <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs"><span><b className="block text-base">{selectedRun.paymentBatch.total || 0}</b>Total</span><span><b className="block text-base">{selectedRun.paymentBatch.succeeded || 0}</b>Submitted</span><span><b className="block text-base">{selectedRun.paymentBatch.failed || 0}</b>Failed</span><span><b className="block text-base">{selectedRun.paymentBatch.remaining || 0}</b>Remaining</span></div> : null}</div> : null}
        {stage === "payment" && state.paid && !state.payslipsSent ? <div className="mt-4 overflow-hidden rounded-xl border border-violet-200 bg-violet-50"><div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between"><div className="flex gap-3"><span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-700"><Mail size={20}/><span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-violet-50 bg-violet-500 motion-safe:animate-pulse"/></span><div><p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Handoff to HR</p><h4 className="mt-1 font-semibold text-[#251E1F]">Waiting for HR payslip delivery</h4><p className="mt-1 max-w-2xl text-sm leading-6 text-[#6d5a73]">Payment is confirmed and HR has been notified. HR now previews and sends the payslips. This page updates automatically; Finance can continue only after all required deliveries are resolved.</p></div></div><span className="w-fit shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-violet-700 shadow-sm">Owner: HR</span></div><div className="grid grid-cols-2 border-t border-violet-200 bg-white/60 sm:grid-cols-4"><div className="p-3 text-center text-xs text-[#7b6660]"><b className="block text-lg text-[#251E1F]">{deliveryTotal}</b>Total</div><div className="border-l border-violet-100 p-3 text-center text-xs text-[#7b6660]"><b className="block text-lg text-emerald-700">{deliverySent}</b>Delivered</div><div className="border-l border-violet-100 p-3 text-center text-xs text-[#7b6660]"><b className="block text-lg text-amber-700">{deliveryPending}</b>Pending</div><div className="border-l border-violet-100 p-3 text-center text-xs text-[#7b6660]"><b className="block text-lg text-red-600">{deliveryFailed}</b>Needs attention</div></div></div> : null}
        {stage === "payslips" && selectedRun.payslipDelivery ? <div className={`mt-4 rounded-xl border p-4 text-sm ${selectedRun.payslipDelivery.failed ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}><strong>Payslip delivery result</strong><div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs"><span><b className="block text-base">{selectedRun.payslipDelivery.sent || 0}</b>Sent now</span><span><b className="block text-base">{selectedRun.payslipDelivery.skipped || 0}</b>Already sent</span><span><b className="block text-base">{selectedRun.payslipDelivery.failed || 0}</b>Failed</span></div>{selectedRun.payslipDelivery.errors?.map((item) => <div key={item.payrollId} className="mt-3 rounded-lg bg-white/70 p-3"><b>{item.employee || item.employeeId || `Payroll ${item.payrollId}`}</b><p>{item.message}</p>{item.correctiveAction ? <p className="mt-1 font-medium">Required: {item.correctiveAction}</p> : null}</div>)}</div> : null}
        {error ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
      </section>
      <aside className="app-panel rounded-2xl p-5"><h3 className="font-semibold text-[#251E1F]">Stage checklist</h3><ul className="mt-4 space-y-3">{displayedChecks.map(([label, complete]) => <li key={label} className="flex items-start gap-2 text-sm"><span className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${complete ? "bg-emerald-600 text-white" : "bg-[#f0d2ca] text-[#7b6660]"}`}>{complete ? "✓" : "·"}</span><span className={complete ? "text-emerald-700" : "text-[#7b6660]"}>{label}</span></li>)}</ul>
        {busy ? <div role="status" aria-live="polite" className="mt-5 overflow-hidden rounded-xl border border-[#2D7C83]/25 bg-[#2D7C83]/10 p-3 text-sm text-[#2D7C83]"><div className="flex items-center gap-2 font-semibold"><Loader2 size={17} className="motion-safe:animate-spin"/><span>Validating and saving this stage…</span></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/80"><span className="block h-full w-2/3 rounded-full bg-gradient-to-r from-[#2D7C83] via-emerald-400 to-[#2D7C83] motion-safe:animate-pulse"/></div><p className="mt-2 text-xs">The next stage unlocks only after the database confirms this action.</p></div> : null}
        <div className="mt-6 space-y-2">{stage === "review" && selectedRun.rulesChanged ? <ActionButton icon={RefreshCw} disabled={busy} onClick={onRecalculate}>Recalculate with current rules</ActionButton> : stage === "review" ? reviewResultsVisible ? <ActionButton icon={ArrowRight} onClick={() => navigate("/dashboard/payroll/finance/staff-payroll-details")}>Next: Staff Review &amp; Adjustments</ActionButton> : <ActionButton icon={ShieldCheck} disabled={busy} onClick={runComplianceReview}>Run automated review</ActionButton> : stage === "preparation" ? <><ActionButton icon={Download} disabled={!state.approved || busy || Boolean(selectedRun.paymentFileGeneratedAt)} onClick={onGeneratePaymentFile}>{selectedRun.paymentFileGeneratedAt ? "Payment PDF generated" : "Generate payment PDF"}</ActionButton><ActionButton icon={Users} variant="secondary" disabled={!state.approved || busy} onClick={onSetupRecipients}>{selectedRun.paymentRecipientsConfigured >= selectedRun.employees.length ? "Recipients configured" : "Configure recipients"}</ActionButton></> : stage === "payment" ? <>{selectedRun.paymentStatus === "Submitting" ? <ActionButton icon={RefreshCw} disabled={!item.ready || busy} onClick={() => onSubmitPayment("retry-payment")}>Resume remaining payments</ActionButton> : ["Failed", "Partially Submitted"].includes(selectedRun.paymentStatus) ? <ActionButton icon={RefreshCw} disabled={!item.ready || busy} onClick={() => onSubmitPayment("retry-payment")}>Retry remaining payments</ActionButton> : !selectedRun.paymentSubmittedAt ? <ActionButton icon={Send} disabled={!item.ready || busy} onClick={onSubmitPayment}>Submit to Modern Treasury</ActionButton> : !state.paid ? <ActionButton icon={CheckCircle2} disabled={busy} onClick={() => runAction("confirm-payment", { manual: true, batchReference: selectedRun.bankReference })}>Awaiting settlement confirmation</ActionButton> : !state.payslipsSent ? <ActionButton icon={History} variant="secondary" onClick={() => navigate("/dashboard/payroll/finance/activity-log")}>View payroll activity</ActionButton> : <ActionButton icon={ArrowRight} onClick={() => navigate("/dashboard/payroll/finance/statutory-ledger")}>Continue to Statutory &amp; Ledger</ActionButton>}</> : <ActionButton icon={CheckCircle2} disabled={!item.ready || item.done || busy} onClick={() => runAction(item.action)}>{item.done ? "Stage completed" : item.label}</ActionButton>}</div>
        {!item.ready && !item.done ? <p className="mt-3 text-xs text-red-600">Complete the unchecked prerequisites before continuing.</p> : null}
      </aside>
    </div>
  </PageShell>;
}

function RecipientProgressModal({ state, onClose, onRetry }) {
  if (!state.open) return null;
  const finished = !state.running;
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#251E1F]/45 p-4"><div className="w-full max-w-lg rounded-3xl border border-[#f0d2ca] bg-white p-7 shadow-2xl" role="dialog" aria-modal="true" aria-label="Modern Treasury recipient configuration progress">
    <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#2D7C83]/10 text-[#2D7C83]">{state.running ? <Loader2 className="motion-safe:animate-spin"/> : state.error ? <AlertCircle/> : <CheckCircle2/>}</span><div><h3 className="font-semibold text-[#251E1F]">Configure Modern Treasury recipients</h3><p className="text-sm text-[#7b6660]">{state.phase}</p></div></div>
    <div className="mt-6"><div className="mb-2 flex justify-between text-sm font-semibold"><span>Progress</span><span>{state.progress}%</span></div><div className="h-3 overflow-hidden rounded-full bg-[#f0d2ca]"><div className={`h-full rounded-full transition-all duration-500 ${state.error ? "bg-red-500" : "bg-gradient-to-r from-[#2D7C83] to-emerald-500"}`} style={{ width: `${state.progress}%` }}/></div></div>
    {state.result ? <div className="mt-5 grid grid-cols-3 gap-3 text-center text-sm"><div className="rounded-xl bg-emerald-50 p-3"><b className="block text-lg text-emerald-700">{state.result.configured}</b>Configured</div><div className="rounded-xl bg-blue-50 p-3"><b className="block text-lg text-blue-700">{state.result.reused}</b>Reused</div><div className="rounded-xl bg-red-50 p-3"><b className="block text-lg text-red-700">{state.result.failed}</b>Failed</div></div> : null}
    {state.error ? <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{state.error}</p> : null}
    {finished ? <div className="mt-6 flex justify-end gap-2">{state.result?.failed ? <ActionButton variant="warning" icon={RefreshCw} onClick={onRetry}>Retry failed recipients</ActionButton> : null}<ActionButton variant="secondary" onClick={onClose}>Close</ActionButton></div> : <p className="mt-5 text-center text-xs text-[#7b6660]">Keep this window open while recipient mappings are saved.</p>}
  </div></div>;
}

function AutoAdvanceNotice({ state, onStay, onContinue }) {
  if (!state) return null;
  return <div className="fixed inset-0 z-[1200] grid place-items-center bg-[#251E1F]/50 p-4 backdrop-blur-sm"><section role="dialog" aria-modal="true" aria-labelledby="workflow-complete-title" className="w-full max-w-md rounded-3xl border border-emerald-200 bg-white p-7 text-center shadow-2xl"><span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600"><CheckCircle2 size={34} className="motion-safe:animate-[financeClaimResultPop_.4s_ease_both]"/></span><p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Process completed</p><h3 id="workflow-complete-title" className="mt-1 text-xl font-semibold text-[#251E1F]">This stage was saved successfully</h3><p className="mt-2 text-sm leading-6 text-[#7b6660]">Redirecting to <strong>{state.label}</strong> in {state.seconds} second{state.seconds === 1 ? "" : "s"}.</p><div className="mt-5 h-2 overflow-hidden rounded-full bg-emerald-100"><span className="block h-full rounded-full bg-emerald-500 transition-all duration-1000 motion-reduce:transition-none" style={{ width: `${Math.max(12, (state.seconds / 4) * 100)}%` }}/></div><div className="mt-6 grid gap-2 sm:grid-cols-2"><button type="button" onClick={onStay} className="rounded-xl border border-[#f0d2ca] bg-white px-4 py-3 text-sm font-semibold text-[#7b6660]">Stay on this page</button><button type="button" onClick={onContinue} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white">Continue now<ArrowRight size={16}/></button></div></section></div>;
}

function FinancePayrollContent({
  configError,
  effectiveRuleCatalogue,
  effectiveRulesLoading,
  onAdvanceRun,
  onCreateDbRun,
  onGeneratePaymentFile,
  onRecalculateRun,
  onRunUpdated,
  onSaveRun,
  onSelectRun,
  onSystemCheckApproveAll,
  onSetupModernTreasuryRecipients,
  onSubmitModernTreasuryTransfer,
  onUpdateEmployee,
  onUpdateStaffStatus,
  onWorkflowAction,
  pathname,
  paymentError,
  paymentProcessing,
  payrollRuns,
  recalculationProcessing,
  saveProcessing,
  simulationProcessing,
  simulationResult,
  recipientSetupProcessing,
  selectedRun
}) {
  if (pathname.endsWith("/employee-requests")) return <FinanceRequestsPage />;
  if (pathname.endsWith("/staff-records")) return <FinanceStaffRecordsView />;
  if (pathname.endsWith("/activity-log")) return <FinancePayrollActivityView />;
  if (pathname.endsWith("/payroll-schedule")) return <PayrollScheduleView payrollRuns={payrollRuns} selectedGlobalRun={selectedRun} onSelectRun={onSelectRun} onRunUpdated={onRunUpdated} />;
  if (pathname.endsWith("/compliance-rules")) {
    return (
      <PageShell heading="Compliance Rules">
        <div className="mb-5 rounded-2xl border border-[#2D7C83]/25 bg-[#2D7C83]/10 p-5 text-sm text-[#2D7C83]">
          Finance has read-only access. All values below come from Admin Payroll configuration in the connected database; changes must be made by an authorised Admin.
        </div>
        {configError ? <div className="rounded-2xl border border-red-300 bg-red-50 p-4 text-sm text-red-700"><strong>Unable to synchronise Admin payroll rules.</strong><p className="mt-1">Finance is not being shown fallback values. Refresh after the Admin configuration service is available. {configError}</p></div> : <FinanceComplianceRulesPanel catalogue={effectiveRuleCatalogue} loading={effectiveRulesLoading} />}
      </PageShell>
    );
  }
  if (pathname.endsWith("/payroll-runs")) return <GuidedWorkflowStageView stage="review" selectedRun={selectedRun} payrollRuns={payrollRuns} onSelectRun={onSelectRun} onAction={onWorkflowAction} onRecalculate={onRecalculateRun} busy={saveProcessing || recalculationProcessing} error={paymentError} />;

  if (pathname.endsWith("/staff-payroll-details")) {
    return (
      <StaffPayrollDetailsView
        payrollRuns={payrollRuns}
        selectedRun={selectedRun}
        onSelectRun={onSelectRun}
        onRunUpdated={onRunUpdated}
        onRecalculateRun={onRecalculateRun}
        recalculationProcessing={recalculationProcessing}
        error={paymentError}
        onSystemCheckApproveAll={onSystemCheckApproveAll}
        onUpdateEmployee={onUpdateEmployee}
        onUpdateStaffStatus={onUpdateStaffStatus}
        simulationProcessing={simulationProcessing}
        simulationResult={simulationResult}
      />
    );
  }
  if (pathname.endsWith("/payroll-reports")) {
    return (
      <PayrollReportsView
        onSelectRun={onSelectRun}
        payrollRuns={payrollRuns}
        selectedRun={selectedRun}
      />
    );
  }
  if (pathname.endsWith("/payroll-summaries")) return <PayrollSummariesView payrollRuns={payrollRuns} selectedRun={selectedRun} />;
  if (pathname.endsWith("/payroll-completion")) return <PayrollRunCompletionView selectedRun={selectedRun} />;
  if (pathname.endsWith("/payroll-run-history")) return <PayrollRunHistoryView payrollRuns={payrollRuns} selectedRun={selectedRun} onSelectRun={onSelectRun} />;
  const guidedStage = ({
    "/payroll-approval": "approval", "/payment-preparation": "preparation", "/payment-release": "payment",
    "/statutory-ledger": "statutory", "/reconciliation-reports": "reconciliation"
  })[Object.keys({ "/payroll-approval": 1, "/payment-preparation": 1, "/payment-release": 1, "/statutory-ledger": 1, "/reconciliation-reports": 1 }).find((suffix) => pathname.endsWith(suffix))];
  if (guidedStage) return <GuidedWorkflowStageView stage={guidedStage} selectedRun={selectedRun} payrollRuns={payrollRuns} onSelectRun={onSelectRun} onAction={onWorkflowAction} onGeneratePaymentFile={onGeneratePaymentFile} onSetupRecipients={onSetupModernTreasuryRecipients} onSubmitPayment={onSubmitModernTreasuryTransfer} onRecalculate={onRecalculateRun} busy={saveProcessing || paymentProcessing || recipientSetupProcessing} error={paymentError} />;

  return (
    <DashboardView
      onAdvanceRun={onAdvanceRun}
      onRecalculateRun={onRecalculateRun}
      payrollRuns={payrollRuns}
      selectedRun={selectedRun}
      onSelectRun={onSelectRun}
    />
  );
}

// -----------------------------------------------------------------------------
// 13. Main page state and event handlers
// -----------------------------------------------------------------------------

export default function FinancePayrollPage() {
  const session = getStoredSession();
  const financeSelectedRunKey = getCompanyScopedKey(FINANCE_SELECTED_RUN_KEY, session?.user?.companyId);
  const location = useLocation();
  const navigate = useNavigate();
  const heading = routeHeadings[location.pathname] || "Dashboard";
  const [payrollRuns, setPayrollRuns] = useState([]);
  const [selectedRunId, setSelectedRunId] = useState("");
  const [payrollRuleConfig, setPayrollRuleConfig] = useState(createDefaultFinancePayrollConfig);
  const [configError, setConfigError] = useState("");
  const [effectiveRuleCatalogue, setEffectiveRuleCatalogue] = useState(null);
  const [effectiveRulesLoading, setEffectiveRulesLoading] = useState(true);
  const [financeDbError, setFinanceDbError] = useState("");
  const [financeDbLoaded, setFinanceDbLoaded] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [recipientSetupProcessing, setRecipientSetupProcessing] = useState(false);
  const [recalculationProcessing, setRecalculationProcessing] = useState(false);
  const [saveProcessing, setSaveProcessing] = useState(false);
  const [simulationProcessing, setSimulationProcessing] = useState(false);
  const [simulationResult, setSimulationResult] = useState(null);
  const [recipientProgress, setRecipientProgress] = useState({ open: false, running: false, progress: 0, phase: "", result: null, error: "" });
  const [autoAdvance, setAutoAdvance] = useState(null);
  const [lastWorkflowSyncAt, setLastWorkflowSyncAt] = useState(null);
  const [ruleAcknowledgement, setRuleAcknowledgement] = useState(null);
  const [acknowledgingRules, setAcknowledgingRules] = useState(false);
  const livePaymentStatus = payrollRuns.find((run) => run.id === selectedRunId)?.paymentStatus;
  const workflowActionActive = saveProcessing || paymentProcessing || recipientSetupProcessing || recalculationProcessing || simulationProcessing;

  adminCpfConfiguration = payrollRuleConfig;

  useEffect(() => {
    if (location.pathname.endsWith("/payslip-delivery")) navigate("/dashboard/payroll/finance/payment-release", { replace: true });
  }, [location.pathname, navigate]);

  useEffect(() => {
    let active = true;
    getFinanceRuleAcknowledgement()
      .then((state) => { if (active) setRuleAcknowledgement(state); })
      .catch((error) => { if (active) setConfigError(error.message); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    async function loadFinancePayrollRuns() {
      try {
        setFinanceDbError("");
        const data = await getFinancePayrollRuns();
        const dbRuns = Array.isArray(data.runs) ? data.runs : [];

        setPayrollRuns(normalizeFinancePayrollRuns(dbRuns));
        const storedRunId = sessionStorage.getItem(financeSelectedRunKey);
        setSelectedRunId(dbRuns.some((run) => run.id === storedRunId) ? storedRunId : dbRuns[0]?.id || "");
        setFinanceDbLoaded(true);
      } catch (error) {
        setFinanceDbError(`Finance payroll database unavailable. ${error.message}`);
      }
    }

    loadFinancePayrollRuns();
  }, []);

  useEffect(() => {
    setPaymentError("");
    if (selectedRunId) sessionStorage.setItem(financeSelectedRunKey, selectedRunId);
  }, [selectedRunId, financeSelectedRunKey]);

  useEffect(() => {
    if (!selectedRunId || !financeDbLoaded) return;
    let active = true;
    getFinancePayrollWorkflow(selectedRunId).then((result) => {
      if (!active || !result?.run) return;
      const refreshed = normalizeFinancePayrollRuns([result.run])[0];
      setPayrollRuns((runs) => runs.map((run) => run.id === refreshed.id ? refreshed : run));
    }).catch((error) => { if (active) setFinanceDbError(`${error.code || "WORKFLOW_READ_FAILED"}: ${error.message}`); });
    return () => { active = false; };
  }, [selectedRunId, financeDbLoaded, location.pathname]);

  useEffect(() => {
    const liveStatuses = ["Submitting", "Processing", "Partially Submitted"];
    const shouldPoll = shouldShowFinanceTracker(location.pathname) && selectedRunId && financeDbLoaded;
    if (!shouldPoll) return undefined;
    let active = true;
    let requestInFlight = false;
    const refreshWorkflow = async () => {
      if (requestInFlight) return;
      requestInFlight = true;
      try {
        const result = await getFinancePayrollWorkflow(selectedRunId);
        if (!active || !result?.run) return;
        const refreshed = normalizeFinancePayrollRuns([result.run])[0];
        setPayrollRuns((runs) => runs.map((run) => run.id === refreshed.id ? refreshed : run));
        setLastWorkflowSyncAt(new Date());
      } catch (error) {
        if (active) setPaymentError((current) => current || `Live payment status unavailable: ${error.message}`);
      } finally { requestInFlight = false; }
    };
    refreshWorkflow();
    const interval = window.setInterval(refreshWorkflow, workflowActionActive || liveStatuses.includes(livePaymentStatus) ? 1000 : 4000);
    return () => { active = false; window.clearInterval(interval); };
  }, [selectedRunId, financeDbLoaded, location.pathname, workflowActionActive, livePaymentStatus]);

  useEffect(() => {
    let active = true;
    let firstLoad = true;
    async function loadPayrollRuleConfig() {
      try {
        if (firstLoad) setEffectiveRulesLoading(true);
        const [data, catalogue] = await Promise.all([getPayrollRuleConfig(), getEffectivePayrollRules()]);
        if (!active) return;
        setConfigError("");
        setPayrollRuleConfig(resolveFinancePayrollConfig(data.settings || []));
        setEffectiveRuleCatalogue(catalogue);
      } catch (error) {
        if (active) setConfigError(error.message);
      } finally { if (active) setEffectiveRulesLoading(false); firstLoad = false; }
    }

    loadPayrollRuleConfig();
    const interval = location.pathname.endsWith("/compliance-rules") ? window.setInterval(loadPayrollRuleConfig, 15000) : null;
    return () => { active = false; if (interval) window.clearInterval(interval); };
  }, [location.pathname]);

  const selectedRun = useMemo(
    () => payrollRuns.find((run) => run.id === selectedRunId) || payrollRuns[0],
    [payrollRuns, selectedRunId]
  );

  useEffect(() => {
    if (!autoAdvance) return undefined;
    const timer = setTimeout(() => {
      if (autoAdvance.seconds <= 1) {
        setRecipientProgress((current) => ({ ...current, open: false }));
        navigate(autoAdvance.path);
        setAutoAdvance(null);
      } else setAutoAdvance((current) => current ? { ...current, seconds: current.seconds - 1 } : null);
    }, 1000);
    return () => clearTimeout(timer);
  }, [autoAdvance, navigate]);

  const scheduleAutoAdvance = (path, label) => setAutoAdvance({ path, label, seconds: 4 });

  const continueAutoAdvance = () => {
    if (!autoAdvance) return;
    setRecipientProgress((current) => ({ ...current, open: false }));
    navigate(autoAdvance.path);
    setAutoAdvance(null);
  };

  const scheduleAfterAction = (action, run) => {
    const destination = getFinanceAutoAdvance(action, run);
    if (destination) scheduleAutoAdvance(destination.path, destination.label);
  };

  const updateSelectedRun = (updater) => {
    setPayrollRuns((currentRuns) =>
      currentRuns.map((run) => (run.id === selectedRun.id ? updater(run) : run))
    );
  };

  const applyWorkflowResult = (result) => {
    const refreshed = normalizeFinancePayrollRuns([result.run])[0];
    setPayrollRuns((runs) => runs.map((run) => run.id === refreshed.id ? refreshed : run));
    setFinanceDbError("");
    return refreshed;
  };

  const executeWorkflowAction = async (action, payload = {}) => {
    setSaveProcessing(true);
    setPaymentError("");
    try {
      const result = await performFinancePayrollWorkflowAction(selectedRun.id, action, { expectedUpdatedAt: selectedRun.updatedAt, ...payload });
      const refreshed = applyWorkflowResult(result);
      scheduleAfterAction(action, refreshed);
      return refreshed;
    } catch (error) {
      if (error.run) applyWorkflowResult({ run: error.run });
      setFinanceDbError(`${error.code || "WORKFLOW_ACTION_FAILED"}: ${formatComplianceFailure(error)}`);
      throw error;
    } finally { setSaveProcessing(false); }
  };

  const persistSelectedRunImmediately = async (nextRun) => {
    if (nextRun.source !== "staff_db") {
      setPayrollRuns((runs) => runs.map((run) => run.id === nextRun.id ? nextRun : run));
      return nextRun;
    }
    setSaveProcessing(true);
    try {
      const result = await saveFinancePayrollRun(nextRun);
      const savedRun = normalizeFinancePayrollRuns([result.run])[0];
      setPayrollRuns((runs) => runs.map((run) => run.id === savedRun.id ? savedRun : run));
      setFinanceDbError("");
      return savedRun;
    } catch (error) {
      setFinanceDbError(`Finance payroll DB save failed. ${formatComplianceFailure(error)}`);
      throw error;
    } finally {
      setSaveProcessing(false);
    }
  };

  const handleUpdateStaffStatus = async (employeeId, financeStatus) => {
    const employee = selectedRun.employees.find((item) => item.id === employeeId);
    if (!employee) return;
    try { await executeWorkflowAction("employee-status", { staffEmployeeId: employee.staffEmployeeId, status: financeStatus }); }
    catch { /* The persisted row remains authoritative; no optimistic state to revert. */ }
  };

  const handleSystemCheckApproveAll = async () => {
    if (!selectedRun || getCompletedSteps(selectedRun).approved) return;
    setSimulationProcessing(true);
    setSimulationResult(null);
    setPaymentError("");
    try {
      let workingRun = selectedRun;
      let recalculated = false;
      if (selectedRun.rulesChanged) {
        const result = await recalculateFinancePayrollRun(selectedRun.id);
        workingRun = normalizeFinancePayrollRuns([result.run])[0];
        recalculated = true;
        setPayrollRuns((runs) => runs.map((run) => run.id === workingRun.id ? workingRun : run));
      }
      const result = await performFinancePayrollWorkflowAction(workingRun.id, "bulk-approve", { expectedUpdatedAt: workingRun.updatedAt });
      const saved = applyWorkflowResult(result);
      const held = saved.employees.filter((employee) => employee.financeStatus === "Hold").length;
      const approved = saved.employees.length - held;
      setSimulationResult({
        held,
        message: `${recalculated ? "Payroll was recalculated with the latest Admin rules. " : ""}${approved} of ${saved.employees.length} salary rows approved${held ? `; ${held} flagged row(s) remain on hold` : ""}.`
      });
      if (!held) scheduleAutoAdvance("/dashboard/payroll/finance/payroll-approval", "Payroll Approval");
      if (held) setPaymentError(`${held} staff record(s) remain on hold because automated compliance checks flagged them.`);
    } catch (error) {
      setPaymentError(formatComplianceFailure(error));
      setSimulationResult({ error: true, message: formatComplianceFailure(error) });
    } finally {
      setSimulationProcessing(false);
    }
  };

  const handleUpdateEmployee = (employeeId, updatedEmployee) => {
    updateSelectedRun((run) => ({
      ...run,
      employees: run.employees.map((employee) =>
        employee.id === employeeId
          ? {
              ...updatedEmployee,
              financeStatus: getEmployeeExceptions(updatedEmployee).length ? "Hold" : updatedEmployee.financeStatus || "Ready"
            }
          : employee
      ),
      timeline: [
        createTimelineEntry(`Updated payroll details for ${updatedEmployee.name || employeeId}`),
        ...(run.timeline || [])
      ]
    }));
  };

  const handleCreateMockRun = () => {
    const mockRun = createMockFinancePayrollRun(payrollRuns);

    setPayrollRuns((currentRuns) => [mockRun, ...currentRuns]);
    setSelectedRunId(mockRun.id);
    setPaymentError("");
  };

  const handleCreateDbRun = async () => {
    try {
      setPaymentError("");
      setFinanceDbError("");
      const now = new Date();
      const result = await createFinancePayrollRunFromStaff({
        month: now.getMonth() + 1,
        year: now.getFullYear()
      });

      setPayrollRuns((currentRuns) => [result.run, ...currentRuns]);
      setSelectedRunId(result.run.id);
      setFinanceDbLoaded(true);
    } catch (error) {
      setFinanceDbError(error.message || "Failed to create Finance payroll run from staff database.");
    }
  };

  const handleRecalculateRun = async () => {
    if (!selectedRun?.id || selectedRun.source !== "staff_db") {
      setPaymentError("Only database-backed pending payroll runs can be recalculated.");
      return;
    }
    setRecalculationProcessing(true);
    setPaymentError("");
    try {
      const result = await recalculateFinancePayrollRun(selectedRun.id);
      const refreshedRun = normalizeFinancePayrollRuns([result.run])[0];
      setPayrollRuns((runs) => runs.map((run) => run.id === refreshedRun.id ? refreshedRun : run));
      setFinanceDbError("");
    } catch (error) {
      setPaymentError(error.message || "Payroll recalculation failed.");
    } finally {
      setRecalculationProcessing(false);
    }
  };

  const handleSaveRun = async () => {
    if (!selectedRun?.id || selectedRun.source !== "staff_db") return;
    setSaveProcessing(true);
    setFinanceDbError("");
    try {
      const result = await saveFinancePayrollRun(selectedRun);
      const savedRun = normalizeFinancePayrollRuns([result.run])[0];
      setPayrollRuns((runs) => runs.map((run) => run.id === savedRun.id ? savedRun : run));
    } catch (error) {
      setFinanceDbError(`Finance payroll DB save failed. ${formatComplianceFailure(error)}`);
    } finally {
      setSaveProcessing(false);
    }
  };

  const formatComplianceFailure = (error) => {
    const details = Array.isArray(error?.details) ? error.details : [];
    if (!details.length) return error?.message || "Payroll compliance validation failed.";
    return `${error.message} ${details.map((item) => `${item.employee || "Run"}: ${item.message}${item.correctiveAction ? ` — ${item.correctiveAction}` : ""}`).join(" ")}`;
  };

  const handleGeneratePaymentFile = async () => {
    try {
      await validateFinancePayrollRun(selectedRun.id);
    } catch (error) {
      setPaymentError(formatComplianceFailure(error));
      return;
    }
    const now = new Date().toISOString();
    const totals = getRunTotals(selectedRun);

    downloadPdf(
      `${String(selectedRun.id).toLowerCase()}-payment-file.pdf`,
      createPdfBlob({
        title: "Payment File",
        subtitle: `${formatPayrollPeriod(selectedRun)} / ${selectedRun.paymentMethod}`,
        summaryRows: [
          ["Approved Staff", `${selectedRun.employees.filter((employee) => getEmployeeFinanceStatus(employee) === "Approved").length} employee(s)`, formatMoney(totals.netPay)],
          ["Payment Method", selectedRun.paymentMethod, selectedRun.bankReference || "Pending bank reference"],
          ["Payroll Status", selectedRun.status, "Ready for bank confirmation"],
          ["Generated By", "Automated Payroll System", formatDateTime(now)]
        ],
        tableRows: buildPaymentFileRows(selectedRun),
        footer: "Finance payment document generated from approved staff payroll records."
      })
    );
    try {
      await executeWorkflowAction("payment-document");
    } catch {
      setPaymentError("The payment PDF was created, but its workflow state could not be saved. Retry after checking the database connection.");
    }
  };

  const handleSubmitModernTreasuryTransfer = async (action = "submit-payment") => {
    const approvedRecipients = getApprovedPaymentRecipients(selectedRun);

    if (!approvedRecipients.length) {
      setPaymentError("No approved staff payments are ready for bank transfer.");
      return;
    }

    setPaymentProcessing(true);
    setPaymentError("");
    setFinanceDbError("");

    try {
      const started = await performFinancePayrollWorkflowAction(selectedRun.id, action, { expectedUpdatedAt: selectedRun.updatedAt });
      if (started.run) applyWorkflowResult(started);
      let refreshed = started.run ? normalizeFinancePayrollRuns([started.run])[0] : selectedRun;

      for (let attempt = 0; attempt < 150; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 2000));
        const result = await getFinancePayrollWorkflow(selectedRun.id);
        refreshed = applyWorkflowResult(result);
        if (["Submitted", "Partially Submitted", "Failed"].includes(refreshed.paymentStatus) || refreshed.paymentSubmittedAt) break;
      }

      if (!["Submitted", "Partially Submitted", "Failed"].includes(refreshed.paymentStatus) && !refreshed.paymentSubmittedAt) {
        throw new Error("Payment submission is still running. Refresh shortly to check its progress.");
      }
      if (refreshed.paymentBatch?.failed) {
        setPaymentError(`${refreshed.paymentBatch.failed} payment(s) failed to submit. ${refreshed.paymentBatch.succeeded || 0} succeeded and will not be duplicated; retry the remaining payments.`);
      } else if (refreshed.paymentStatus === "Failed") {
        setPaymentError(refreshed.paymentFailureReason || "Modern Treasury submission failed. Correct the payment configuration and retry.");
      } else {
        scheduleAfterAction(action, refreshed);
      }
    } catch (error) {
      setPaymentError(formatComplianceFailure(error));
    } finally {
      setPaymentProcessing(false);
    }
  };

  const handleSetupModernTreasuryRecipients = async () => {
    const approvedRecipients = getApprovedPaymentRecipients(selectedRun);

    if (!approvedRecipients.length) {
      setPaymentError("No approved staff payments are ready for Modern Treasury recipient setup.");
      return;
    }

    setRecipientSetupProcessing(true);
    setPaymentError("");
    setRecipientProgress({ open: true, running: true, progress: 1, phase: "Validating approved employee payment details…", result: null, error: "" });
    const progressTimer = window.setInterval(() => setRecipientProgress((current) => current.running ? {
      ...current,
      progress: Math.min(90, current.progress + Math.max(1, Math.ceil((90 - current.progress) / 8))),
      phase: current.progress < 25 ? "Validating approved employee payment details…" : current.progress < 70 ? "Configuring and reusing Modern Treasury recipients…" : "Saving recipient mappings to this payroll run…"
    } : current), 350);

    try {
      const result = await setupModernTreasuryRecipients({
        forceNew: false,
        payrollRunId: selectedRun.id,
        employees: approvedRecipients
      });
      const recipientByEmployeeId = new Map(
        result.recipients.map((recipient) => [recipient.employeeId, recipient])
      );

      const paymentRecipients = Object.fromEntries(selectedRun.employees.map((employee) => {
        const recipient = recipientByEmployeeId.get(employee.id);
        return [String(employee.staffEmployeeId), {
          modernTreasuryCounterpartyId: recipient?.modernTreasuryCounterpartyId || employee.modernTreasuryCounterpartyId || "",
          modernTreasuryReceivingAccountId: recipient?.modernTreasuryReceivingAccountId || employee.modernTreasuryReceivingAccountId || ""
        }];
      }));
      await executeWorkflowAction("save-recipients", { paymentRecipients });
      setRecipientProgress({
        open: true,
        running: false,
        progress: 100,
        phase: result.failedCount
          ? "Recipient configuration completed with items requiring attention."
          : "All recipient mappings are configured and saved.",
        result: {
          configured: result.recipientCount,
          reused: result.reusedCount || 0,
          failed: result.failedCount || 0,
        },
        error: result.failedCount
          ? `${result.failedCount} recipient(s) could not be configured. ${result.failures?.[0]?.message || "Retry will process only missing mappings."}`
          : "",
      });
    } catch (error) {
      setPaymentError(error.message || "Modern Treasury recipient setup failed.");
      setRecipientProgress((current) => ({ ...current, running: false, phase: "Recipient configuration stopped.", error: error.message || "Modern Treasury recipient setup failed." }));
    } finally {
      window.clearInterval(progressTimer);
      setRecipientSetupProcessing(false);
    }
  };

  const handleAdvanceRun = async (stepKey) => {
    const now = new Date().toISOString();
    const defaultBankReference = `GIRO-${selectedRun.year}${String(selectedRun.month).padStart(2, "0")}-${Math.floor(1000 + Math.random() * 9000)}`;
    let manualBankReference = "";

    if (stepKey === "paid") {
      const bankReferenceInput = window.prompt(
        "Bank confirmation reference",
        selectedRun.bankReference || defaultBankReference
      );

      if (bankReferenceInput === null) return;

      manualBankReference = bankReferenceInput.trim() || selectedRun.bankReference || defaultBankReference;
    }

    const transitions = {
      reviewed: {
        status: "Exceptions Reviewed",
        fields: { reviewedAt: now },
        timeline: createTimelineEntry("Payroll summary and exceptions reviewed")
      },
      approved: {
        status: "Approved for Payment",
        fields: { approvedAt: now },
        timeline: createTimelineEntry("Payroll approved and locked")
      },
      paid: {
        status: "Payment Processed",
        fields: {
          paidAt: now,
          bankReference: manualBankReference
        },
        timeline: createTimelineEntry("Payment file uploaded and confirmed")
      },
      payslipsSent: {
        status: "Payslips Sent",
        fields: { payslipsSentAt: now },
        timeline: createTimelineEntry("Final payslips sent to employees", "System")
      },
      cpfLogged: {
        status: "CPF Payable Logged",
        fields: { cpfSubmissionLoggedAt: now },
        timeline: createTimelineEntry("CPF and MBMF payables logged for remittance")
      },
      otherDeductionsLogged: {
        status: "Deductions Logged",
        fields: { otherDeductionsLoggedAt: now },
        timeline: createTimelineEntry("Other deduction recoveries logged")
      },
      statutoryLogged: {
        status: "Statutory Deductions Recorded",
        fields: { cpfSubmissionLoggedAt: now, otherDeductionsLoggedAt: now },
        timeline: createTimelineEntry("CPF, MBMF and other deduction recoveries recorded")
      },
      ledgerRecorded: {
        status: "Recorded in Internal Ledger",
        fields: { ledgerRecordedAt: now },
        timeline: createTimelineEntry("Payroll journal created in internal ledger", "System")
      },
      reconciled: {
        status: "Reconciled",
        fields: { reconciledAt: now },
        timeline: createTimelineEntry("Bank payment reconciled with payroll records")
      }
    };
    const transition = transitions[stepKey];

    if (!transition) return;
    if (!canAdvanceFinancePayrollRun(selectedRun, stepKey, {
      allEmployeesApproved: canApprovePayrollRun(selectedRun)
    })) return;

    if (["approved", "paid", "payslipsSent"].includes(stepKey)) {
      try {
        await validateFinancePayrollRun(selectedRun.id);
        setPaymentError("");
      } catch (error) {
        setPaymentError(formatComplianceFailure(error));
        return;
      }
    }

    const actionByStep = {
      reviewed: "review", approved: "approve-payroll", paid: "confirm-payment",
      payslipsSent: "send-payslips", statutoryLogged: "record-statutory-ledger",
      ledgerRecorded: "record-statutory-ledger", reconciled: "reconcile"
    };
    try {
      await executeWorkflowAction(actionByStep[stepKey] || stepKey, stepKey === "paid" ? { manual: true, batchReference: manualBankReference } : {});
      setPaymentError("");
    } catch (error) {
      setPaymentError(formatComplianceFailure(error));
    }
  };

  const workflowActivityLabel = recipientSetupProcessing ? "Configuring recipients…"
    : paymentProcessing || ["Submitting", "Processing"].includes(livePaymentStatus) ? "Submitting payments…"
      : recalculationProcessing ? "Recalculating payroll…"
        : simulationProcessing ? "Running system checks…"
          : saveProcessing && location.pathname.endsWith("/payslip-delivery") ? "Delivering payslips…"
            : saveProcessing ? "Saving workflow changes…" : "";
  const trackerIsUpdating = workflowActionActive || ["Submitting", "Processing"].includes(livePaymentStatus);

  // Show payslips approval view for the specific route
  if (location.pathname === "/dashboard/payroll/finance/payslips-approval") {
    return (
      <DashboardLayout
        pageTitle={pageTitle}
        user={session?.user}
        sidebarSections={payrollSidebarSections}
        sidebarTitle="Automated Invoicing & Payroll System"
        searchPlaceholder="Search payroll runs, staff, reports..."
        moduleClassName="payroll-module"
      >
        <section>
          {selectedRun ? <FinancePayrollJourney run={selectedRun} isLiveUpdating={trackerIsUpdating} lastSyncAt={lastWorkflowSyncAt} activityLabel={workflowActivityLabel} /> : null}
          <PayslipsApprovalView selectedRun={selectedRun} payrollRuns={payrollRuns} onSelectRun={setSelectedRunId} />
        </section>
      </DashboardLayout>
    );
  }

  const runIndependentRoute = [
    "/dashboard/payroll/finance/employee-requests",
    "/dashboard/payroll/finance/activity-log",
    "/dashboard/payroll/finance/payroll-schedule",
    "/dashboard/payroll/finance/compliance-rules",
    "/dashboard/payroll/finance/staff-records"
  ].includes(location.pathname);

  return (
    <DashboardLayout
      pageTitle={pageTitle}
      user={session?.user}
      sidebarSections={payrollSidebarSections}
      sidebarTitle="Automated Invoicing & Payroll System"
      searchPlaceholder="Search payroll runs, staff, reports..."
      moduleClassName="payroll-module"
    >
      {configError ? (
        <div className="mb-4 rounded-xl border border-[#D97706]/25 bg-[#D97706]/10 p-4 text-sm text-[#9A6412]">
          Admin payroll settings could not be loaded. Rule details are unavailable; server-side approval and payment gates continue to require the database-backed run snapshot. {configError}
        </div>
      ) : null}
      {financeDbError ? (
        <div className="mb-4 rounded-xl border border-[#D97706]/25 bg-[#D97706]/10 p-4 text-sm text-[#9A6412]">
          {financeDbError}
        </div>
      ) : null}
      <div className="admin-payroll-page">
      {selectedRun && shouldShowFinanceTracker(location.pathname) ? <FinancePayrollJourney run={selectedRun} isLiveUpdating={trackerIsUpdating} lastSyncAt={lastWorkflowSyncAt} activityLabel={workflowActivityLabel} /> : null}
      {selectedRun || runIndependentRoute ? (
        <FinancePayrollContent
          configError={configError}
          effectiveRuleCatalogue={effectiveRuleCatalogue}
          effectiveRulesLoading={effectiveRulesLoading}
          heading={heading}
          pathname={location.pathname}
          payrollRuns={payrollRuns}
          selectedRun={selectedRun}
          onAdvanceRun={handleAdvanceRun}
          onCreateDbRun={handleCreateDbRun}
          onGeneratePaymentFile={handleGeneratePaymentFile}
          onRecalculateRun={handleRecalculateRun}
          onRunUpdated={(updatedRun) => {
            if (!updatedRun) return;
            const normalized = normalizeFinancePayrollRuns([updatedRun])[0];
            setPayrollRuns((runs) => runs.map((run) => run.id === normalized.id ? normalized : run));
          }}
          onSaveRun={handleSaveRun}
          onSelectRun={setSelectedRunId}
          onSystemCheckApproveAll={handleSystemCheckApproveAll}
          onSetupModernTreasuryRecipients={handleSetupModernTreasuryRecipients}
          onSubmitModernTreasuryTransfer={handleSubmitModernTreasuryTransfer}
          onUpdateEmployee={handleUpdateEmployee}
          onUpdateStaffStatus={handleUpdateStaffStatus}
          onWorkflowAction={executeWorkflowAction}
          paymentError={paymentError}
          paymentProcessing={paymentProcessing}
          recipientSetupProcessing={recipientSetupProcessing}
          recalculationProcessing={recalculationProcessing}
          saveProcessing={saveProcessing}
          simulationProcessing={simulationProcessing}
          simulationResult={simulationResult}
        />
      ) : !financeDbLoaded && !financeDbError ? (
        <PageShell heading={heading}>
          <div className="flex items-center gap-3 rounded-2xl border border-[#f0d2ca] bg-white/80 p-6 text-sm text-[#7b6660]"><Loader2 className="animate-spin" size={18}/>Loading database payroll records...</div>
        </PageShell>
      ) : (
        <PageShell heading={heading}>
          <EmptyState message="No payroll runs are ready for Finance review." />
        </PageShell>
      )}
      </div>
      <RecipientProgressModal state={recipientProgress} onClose={() => setRecipientProgress((current) => ({ ...current, open: false }))} onRetry={handleSetupModernTreasuryRecipients} />
      <AutoAdvanceNotice state={autoAdvance} onStay={() => setAutoAdvance(null)} onContinue={continueAutoAdvance} />
      {ruleAcknowledgement?.required && !location.pathname.endsWith("/compliance-rules") ? (
        <div className="fixed inset-0 z-[1400] flex items-center justify-center bg-[#251E1F]/55 p-4" role="dialog" aria-modal="true" aria-labelledby="rules-updated-title">
          <section className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#F38978]">Finance verification required</p>
            <h2 id="rules-updated-title" className="mt-2 text-xl font-semibold text-[#251E1F]">Payroll rules updated</h2>
            <p className="mt-2 text-sm text-[#7b6660]">Version {ruleAcknowledgement.publication?.version || 1} was published by {ruleAcknowledgement.publication?.publishedBy || "Payroll Admin"}. Review it before using operational payroll actions. Acknowledgement does not recalculate existing run snapshots.</p>
            <div className="mt-4 max-h-64 space-y-2 overflow-y-auto">
              {(ruleAcknowledgement.publication?.changes || []).map((change) => <div key={change.settingKey} className="rounded-xl border border-[#f0d2ca] bg-[#fff8f5] p-3 text-sm"><strong className="block capitalize text-[#251E1F]">{change.settingKey.replaceAll("_", " ")}</strong><span className="text-[#7b6660]">{String(change.before ?? "Not configured")} → {String(change.after)}</span>{change.referenceUrl ? <a className="mt-1 block font-semibold text-[#2D7C83] underline" href={change.referenceUrl} target="_blank" rel="noreferrer">{change.referenceTitle || "Official reference"}</a> : null}</div>)}
            </div>
            <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800"><strong>Reason:</strong> {ruleAcknowledgement.publication?.changeReason || "Payroll rules were updated."}</p>
            <div className="mt-5 flex justify-end gap-3"><button type="button" onClick={() => navigate("/dashboard/payroll/finance/compliance-rules")} className="rounded-xl border border-[#f0d2ca] px-4 py-2 text-sm font-semibold">Read full rules</button><button type="button" disabled={acknowledgingRules} onClick={async () => { try { setAcknowledgingRules(true); setRuleAcknowledgement(await acknowledgeFinancePayrollRules()); } catch (error) { setConfigError(error.message); } finally { setAcknowledgingRules(false); } }} className="rounded-xl bg-[#F38978] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{acknowledgingRules ? "Saving acknowledgement…" : "I have reviewed these changes"}</button></div>
          </section>
        </div>
      ) : null}
    </DashboardLayout>
  );
}
