import {
  Banknote,
  Bell,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Download,
  Edit3,
  FileBarChart,
  FileText,
  LayoutDashboard,
  ListChecks,
  Lock,
  Mail,
  Plus,
  ReceiptText,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Users,
  X
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";

import DashboardLayout from "../../components/layout/DashboardLayout.jsx";
import { getStoredSession } from "../../services/sessionService.js";

const pageTitle = "Automated Payroll System - Finance Payroll Dashboard";
const FINANCE_PAYROLL_STORAGE_KEY = "financePayrollWorkflowStateV3";

const payrollSidebarSections = [
  {
    label: "FINANCE",
    items: [
      {
        label: "Dashboard",
        icon: LayoutDashboard,
        path: "/dashboard/payroll/finance",
        end: true
      },
      {
        label: "Payroll Runs",
        icon: ClipboardList,
        path: "/dashboard/payroll/finance/payroll-runs"
      },
      {
        label: "Staff Payroll Details",
        icon: Users,
        path: "/dashboard/payroll/finance/staff-payroll-details"
      },
      {
        label: "Notification Records",
        icon: Bell,
        path: "/dashboard/payroll/finance/notification-records"
      },
      {
        label: "Payroll Reports",
        icon: FileBarChart,
        path: "/dashboard/payroll/finance/payroll-reports"
      },
      {
        label: "Payroll Summaries",
        icon: ListChecks,
        path: "/dashboard/payroll/finance/payroll-summaries"
      }
    ]
  }
];

const routeHeadings = {
  "/dashboard/payroll/finance": "Dashboard",
  "/dashboard/payroll/finance/payroll-runs": "Payroll Runs",
  "/dashboard/payroll/finance/staff-payroll-details": "Staff Payroll Details",
  "/dashboard/payroll/finance/notification-records": "Notification Records",
  "/dashboard/payroll/finance/payroll-reports": "Payroll Reports",
  "/dashboard/payroll/finance/payroll-summaries": "Payroll Summaries"
};

const adminCpfConfiguration = {
  source: "Admin Payroll Settings",
  monthlyWageCeiling: 6800,
  effectiveFrom: "01 Jan 2024",
  paymentDue: "14th of next month",
  rateTiers: [
    {
      ageGroup: "55 and below",
      employeeOrdinaryRate: 20,
      employerOrdinaryRate: 17
    },
    {
      ageGroup: "Above 55 to 60",
      employeeOrdinaryRate: 19,
      employerOrdinaryRate: 16
    },
    {
      ageGroup: "Above 60 to 65",
      employeeOrdinaryRate: 15.5,
      employerOrdinaryRate: 13
    },
    {
      ageGroup: "Above 65 to 70",
      employeeOrdinaryRate: 12,
      employerOrdinaryRate: 10
    },
    {
      ageGroup: "Above 70",
      employeeOrdinaryRate: 7.5,
      employerOrdinaryRate: 7.5
    }
  ],
  componentRules: {
    "basic salary": {
      cpfApplicable: true,
      wageType: "Ordinary Wage"
    },
    "transport allowance": {
      cpfApplicable: false,
      wageType: "Non-CPF"
    },
    "credit commission": {
      cpfApplicable: false,
      wageType: "Non-CPF"
    },
    "physical products commission": {
      cpfApplicable: false,
      wageType: "Non-CPF"
    },
    "services commission": {
      cpfApplicable: false,
      wageType: "Non-CPF"
    }
  }
};

const workflowSteps = [
  {
    key: "reviewed",
    title: "Exception Review",
    icon: FileText,
    details: ["System checks completed", "Exceptions reviewed", "Staff records approved or held"]
  },
  {
    key: "approved",
    title: "Approve Payroll",
    icon: ClipboardCheck,
    details: ["Pay run approved", "Payroll locked for payment processing"]
  },
  {
    key: "paid",
    title: "Generate & Confirm Payment",
    icon: Banknote,
    details: ["Bank payment file generated", "Bank reference recorded", "Payment status confirmed"]
  },
  {
    key: "payslipsSent",
    title: "Generate Payslips",
    icon: Mail,
    details: ["Final PDF payslips generated", "Payslips sent to employees"]
  },
  {
    key: "ledgerRecorded",
    title: "Record in Ledger",
    icon: RefreshCw,
    details: ["Payroll journal created", "Internal general ledger updated"]
  },
  {
    key: "reconciled",
    title: "Reports & Reconciliation",
    icon: FileBarChart,
    details: ["Payroll reports generated", "Bank payment reconciled"]
  }
];

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
        bankType: "",
        bankAccount: ""
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

function getInitialPayrollRuns() {
  try {
    const stored = localStorage.getItem(FINANCE_PAYROLL_STORAGE_KEY);
    return stored ? JSON.parse(stored) : initialPayrollRuns;
  } catch {
    return initialPayrollRuns;
  }
}

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

function sumPayrollItems(items = []) {
  return items.reduce((total, item) => total + Number(item.amount || 0), 0);
}

function getPayrollComponentRule(label) {
  return adminCpfConfiguration.componentRules[String(label || "").trim().toLowerCase()] || {
    cpfApplicable: false,
    wageType: "Unclassified"
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

function getEmployeeEmployerItems(employee) {
  if (employee.employerItems?.length) return employee.employerItems;

  return [
    { label: "Employer CPF", rate: `${getEmployeeCpfRateTier(employee).employerOrdinaryRate}%`, amount: employee.employerCpf || 0 }
  ];
}

function getEmployeeTotalEarnings(employee) {
  return sumPayrollItems(getEmployeeEarningItems(employee));
}

function getEmployeeTotalDeductions(employee) {
  return sumPayrollItems(getEmployeeDeductionItems(employee));
}

function getEmployeeCpfAmount(employee) {
  const cpfItem = getEmployeeDeductionItems(employee).find((item) => item.label.toLowerCase().includes("cpf"));
  return Number(cpfItem?.amount ?? employee.employeeCpf ?? 0);
}

function getEmployerCpfAmount(employee) {
  const cpfItem = getEmployeeEmployerItems(employee).find((item) => item.label.toLowerCase().includes("cpf"));
  return Number(cpfItem?.amount ?? employee.employerCpf ?? 0);
}

function getEmployeeOtherDeductions(employee) {
  return getEmployeeTotalDeductions(employee) - getEmployeeCpfAmount(employee);
}

function getRunTotals(run) {
  const totals = (run?.employees || []).reduce(
    (result, employee) => {
      const netPay = getEmployeeNetPay(employee);
      const totalEarnings = getEmployeeTotalEarnings(employee);
      const basicPay = getEmployeeEarningItems(employee)
        .filter((item) => item.label.toLowerCase().includes("basic"))
        .reduce((total, item) => total + Number(item.amount || 0), 0);
      const totalDeductions = getEmployeeTotalDeductions(employee);
      const employeeCpf = getEmployeeCpfAmount(employee);
      const employerCpf = getEmployerCpfAmount(employee);

      return {
        grossPay: result.grossPay + basicPay,
        allowances: result.allowances + (totalEarnings - basicPay),
        deductions: result.deductions + totalDeductions,
        employeeCpf: result.employeeCpf + employeeCpf,
        employerCpf: result.employerCpf + employerCpf,
        netPay: result.netPay + netPay
      };
    },
    {
      grossPay: 0,
      allowances: 0,
      deductions: 0,
      employeeCpf: 0,
      employerCpf: 0,
      netPay: 0
    }
  );

  return {
    ...totals,
    salaryExpense: totals.grossPay + totals.allowances,
    totalDebit: totals.grossPay + totals.allowances + totals.employerCpf,
    totalCredit: totals.employeeCpf + totals.employerCpf + totals.netPay + totals.deductions
  };
}

function getEmployeeNetPay(employee) {
  return getEmployeeTotalEarnings(employee) - getEmployeeTotalDeductions(employee);
}

function getEmployeeExceptions(employee) {
  const exceptions = [];
  const netPay = getEmployeeNetPay(employee);
  const totalEarnings = getEmployeeTotalEarnings(employee);
  const cpfApplicableEarnings = getEmployeeCpfApplicableEarnings(employee);
  const cpfWageBase = Math.min(cpfApplicableEarnings, adminCpfConfiguration.monthlyWageCeiling);
  const cpfRateTier = getEmployeeCpfRateTier(employee);
  const expectedEmployeeCpf = Math.round(cpfWageBase * (cpfRateTier.employeeOrdinaryRate / 100));
  const expectedEmployerCpf = Math.round(cpfWageBase * (cpfRateTier.employerOrdinaryRate / 100));
  const employeeCpf = getEmployeeCpfAmount(employee);
  const employerCpf = getEmployerCpfAmount(employee);
  const hasUnclassifiedEarnings = getEmployeeEarningItems(employee).some(
    (item) => getPayrollComponentRule(item.label).wageType === "Unclassified" && typeof item.cpfApplicable !== "boolean"
  );

  if (!employee.bankAccount) exceptions.push("Missing bank account");
  if (!employee.bankType) exceptions.push("Missing bank type");
  if (!employee.department) exceptions.push("Missing department");
  if (netPay <= 0) exceptions.push("Net pay is zero or negative");
  if (hasUnclassifiedEarnings) exceptions.push("Earning component is missing Admin CPF classification");
  if (getEmployeeOtherDeductions(employee) > totalEarnings * 0.3) {
    exceptions.push("Other deductions exceed 30% of earnings");
  }
  if (Math.abs(employeeCpf - expectedEmployeeCpf) > 1) {
    exceptions.push("Employee CPF does not match CPF-applicable wage calculation");
  }
  if (Math.abs(employerCpf - expectedEmployerCpf) > 1) {
    exceptions.push("Employer CPF does not match CPF-applicable wage calculation");
  }
  if (employee.previousGrossPay && totalEarnings > employee.previousGrossPay * 1.2) {
    exceptions.push("Gross pay increased by more than 20%");
  }

  return exceptions;
}

function getEmployeeFinanceStatus(employee) {
  if (employee.financeStatus) return employee.financeStatus;

  return getEmployeeExceptions(employee).length ? "Hold" : "Ready";
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
  const exceptions = getRunExceptions(run);
  const hasException = (keyword) => exceptions.some((item) => item.message.toLowerCase().includes(keyword));
  const allEmployees = run?.employees || [];
  const allHaveSdl = allEmployees.every((employee) =>
    getEmployeeEmployerItems(employee).some((item) => item.label.toLowerCase().includes("sdl"))
  );
  const hasLoanDeductions = allEmployees.some((employee) =>
    getEmployeeDeductionItems(employee).some((item) => item.label.toLowerCase().includes("loan"))
  );
  const allLoansWithinLimit = allEmployees.every((employee) =>
    getEmployeeOtherDeductions(employee) <= getEmployeeTotalEarnings(employee) * 0.3
  );

  return [
    {
      label: "CPF rates and wage ceiling",
      status: !hasException("cpf"),
      detail: `${adminCpfConfiguration.rateTiers.length} Admin age tier(s), applied by staff CPF age group`
    },
    {
      label: "Bank account completeness",
      status: !hasException("missing bank account"),
      detail: "All approved staff must have a bank account before payment file generation"
    },
    {
      label: "Positive net pay",
      status: !hasException("net pay"),
      detail: "No employee should have zero or negative payable amount"
    },
    {
      label: "SDL employer contribution",
      status: allHaveSdl,
      detail: "Employer SDL item is available for every staff record"
    },
    {
      label: "Loan and recovery deductions",
      status: !hasLoanDeductions || allLoansWithinLimit,
      detail: hasLoanDeductions ? "Loan deductions are included and checked against payroll limits" : "No loan deductions in this pay run"
    },
    {
      label: "Finance approval lock",
      status: Boolean(run?.approvedAt),
      detail: run?.approvedAt ? `Payroll locked on ${formatDateTime(run.approvedAt)}` : "Payroll is not locked until Finance approval"
    },
    {
      label: "Payment deadline readiness",
      status: Boolean(run?.paymentFileGeneratedAt || run?.paidAt),
      detail: `CPF/payment due reference: ${adminCpfConfiguration.paymentDue}`
    },
    {
      label: "Audit trail available",
      status: Boolean(run?.timeline?.length),
      detail: `${run?.timeline?.length || 0} workflow event(s) captured`
    }
  ];
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

function canApprovePayrollRun(run) {
  return (run?.employees || []).every((employee) => getEmployeeFinanceStatus(employee) === "Approved");
}

function getCompletedSteps(run) {
  return {
    reviewed: Boolean(run?.reviewedAt || run?.approvedAt || run?.paidAt),
    approved: Boolean(run?.approvedAt || run?.paidAt),
    paid: Boolean(run?.paymentFileGeneratedAt && run?.paidAt),
    payslipsSent: Boolean(run?.payslipsSentAt),
    ledgerRecorded: Boolean(run?.ledgerRecordedAt || run?.xeroRecordedAt),
    reconciled: Boolean(run?.reconciledAt)
  };
}

function getStatusClass(status) {
  const normalizedStatus = String(status || "").toLowerCase();

  if (normalizedStatus.includes("reconciled") || normalizedStatus.includes("recorded")) {
    return "border-[#7CFFB2]/25 bg-[#7CFFB2]/10 text-[#7CFFB2]";
  }

  if (normalizedStatus.includes("approved") || normalizedStatus.includes("paid") || normalizedStatus.includes("sent")) {
    return "border-[#7DD3FC]/25 bg-[#7DD3FC]/10 text-[#BAE6FD]";
  }

  if (normalizedStatus.includes("exception")) {
    return "border-[#FFB86B]/25 bg-[#FFB86B]/10 text-[#FFE2B8]";
  }

  return "border-white/10 bg-white/[0.06] text-[#d8c6e8]";
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

function escapePdfText(value) {
  return String(value ?? "")
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)");
}

function wrapPdfText(value, maxLength = 28) {
  const words = String(value ?? "").split(" ");
  const lines = [];
  let currentLine = "";

  words.forEach((word) => {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;

    if (nextLine.length > maxLength) {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = nextLine;
    }
  });

  if (currentLine) lines.push(currentLine);
  return lines.length ? lines : [""];
}

function createPdfBlob({ footer, summaryRows = [], tableRows = [], subtitle, title }) {
  const commands = [];
  const page = { width: 612, height: 792, margin: 42 };
  let y = 708;

  const rect = (x, rectY, width, height, color) => {
    commands.push("q", `${color} rg`, `${x} ${rectY} ${width} ${height} re`, "f", "Q");
  };
  const line = (x1, y1, x2, y2, color = "0.82 0.77 0.88", width = 1) => {
    commands.push("q", `${color} RG`, `${width} w`, `${x1} ${y1} m`, `${x2} ${y2} l`, "S", "Q");
  };
  const text = (value, x, textY, size = 9, color = "0.12 0.08 0.18") => {
    commands.push(
      "BT",
      `${color} rg`,
      `/F1 ${size} Tf`,
      `${x} ${textY} Td`,
      `(${escapePdfText(value)}) Tj`,
      "ET"
    );
  };

  rect(0, 0, page.width, page.height, "0.98 0.97 1");
  rect(0, 724, page.width, 68, "0.20 0.04 0.36");
  rect(0, 720, page.width, 4, "0.78 0.30 1");
  text("AUTOMATED PAYROLL SYSTEM", page.margin, 765, 10, "0.90 0.80 1");
  text(title, page.margin, 742, 20, "1 1 1");
  text(`Generated: ${formatDateTime(new Date())}`, 398, 746, 9, "0.90 0.80 1");
  text(subtitle, page.margin, 704, 10, "0.42 0.25 0.58");

  if (summaryRows.length) {
    text("Summary", page.margin, y - 28, 14, "0.12 0.08 0.18");
    y -= 48;

    const cardWidth = 254;
    summaryRows.slice(0, 8).forEach(([label, detail, value], index) => {
      const x = page.margin + (index % 2) * (cardWidth + 20);
      const cardY = y - Math.floor(index / 2) * 58;

      rect(x, cardY - 40, cardWidth, 48, "1 1 1");
      line(x, cardY - 40, x + cardWidth, cardY - 40, "0.78 0.30 1", 0.8);
      text(label, x + 12, cardY - 8, 8, "0.42 0.25 0.58");
      text(detail, x + 12, cardY - 22, 9, "0.12 0.08 0.18");
      text(value, x + 142, cardY - 22, 9, "0.12 0.08 0.18");
    });

    y -= Math.ceil(summaryRows.slice(0, 8).length / 2) * 58 + 8;
  }

  if (tableRows.length) {
    const [headers, ...rows] = tableRows;
    const tableWidth = page.width - page.margin * 2;
    const columnWidth = tableWidth / headers.length;

    text("Details", page.margin, y, 14, "0.12 0.08 0.18");
    y -= 24;
    rect(page.margin, y - 16, tableWidth, 24, "0.93 0.88 0.98");
    headers.forEach((header, index) => {
      text(header, page.margin + index * columnWidth + 8, y - 7, 7, "0.30 0.12 0.48");
    });
    y -= 20;

    rows.slice(0, 18).forEach((row, rowIndex) => {
      const wrappedColumns = row.map((cell) => wrapPdfText(cell, headers.length > 4 ? 18 : 26));
      const rowHeight = Math.max(30, Math.max(...wrappedColumns.map((column) => column.length)) * 10 + 14);

      rect(page.margin, y - rowHeight + 8, tableWidth, rowHeight, rowIndex % 2 === 0 ? "1 1 1" : "0.96 0.94 0.98");
      wrappedColumns.forEach((lines, columnIndex) => {
        lines.slice(0, 3).forEach((lineText, lineIndex) => {
          text(lineText, page.margin + columnIndex * columnWidth + 8, y - 8 - lineIndex * 10, 7, "0.12 0.08 0.18");
        });
      });
      y -= rowHeight;
    });

    if (rows.length > 18) {
      text(`Showing first 18 of ${rows.length} rows.`, page.margin, y - 8, 8, "0.42 0.25 0.58");
    }
  }

  line(page.margin, 42, page.width - page.margin, 42);
  text(footer || "Prepared by Finance Payroll.", page.margin, 26, 8, "0.42 0.25 0.58");

  const content = commands.join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`
  ];
  const offsets = [0];
  let pdf = "%PDF-1.4\n";

  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new Blob([pdf], { type: "application/pdf" });
}

function downloadPdf(filename, pdfBlob) {
  const url = URL.createObjectURL(pdfBlob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function PageShell({ heading, children, actions }) {
  return (
    <section>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#C77DFF]/80">
            Finance Payroll Workflow
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-white">{heading}</h2>
        </div>
        {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function ActionButton({ children, disabled = false, icon: Icon, onClick, variant = "primary" }) {
  const className =
    variant === "secondary"
      ? "inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
      : "neon-button inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold";

  return (
    <button
      type="button"
      className={`${className} disabled:cursor-not-allowed disabled:opacity-60`}
      onClick={onClick}
      disabled={disabled}
    >
      <Icon size={17} />
      {children}
    </button>
  );
}

function EmptyState({ message }) {
  return (
    <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.03] p-6 text-sm text-[#d8c6e8]">
      {message}
    </div>
  );
}

function WorkflowCard({ run, step }) {
  const Icon = step.icon;
  const completed = getCompletedSteps(run)[step.key];

  return (
    <article className="neon-glass neon-border rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#C77DFF]/12 text-[#C77DFF] ring-1 ring-[#C77DFF]/25">
          <Icon size={24} />
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${completed ? "border-[#7CFFB2]/25 bg-[#7CFFB2]/10 text-[#7CFFB2]" : "border-white/10 bg-white/[0.06] text-[#d8c6e8]"}`}>
          {completed ? "Completed" : "Pending"}
        </span>
      </div>
      <h3 className="mt-5 text-base font-semibold text-white">{step.title}</h3>
      <ul className="mt-3 space-y-2 text-sm text-[#d8c6e8]">
        {step.details.map((detail) => (
          <li key={detail} className="flex gap-2">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[#C77DFF]" />
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
    <div className="neon-glass neon-border rounded-2xl p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Automated Exception Review</h3>
          <p className="mt-1 text-sm text-[#d8c6e8]">System validation before Finance approves payment.</p>
        </div>
        <span className={`w-fit rounded-full border px-3 py-1 text-xs font-semibold ${exceptions.length ? "border-[#FFB86B]/25 bg-[#FFB86B]/10 text-[#FFE2B8]" : "border-[#7CFFB2]/25 bg-[#7CFFB2]/10 text-[#7CFFB2]"}`}>
          {exceptions.length ? `${exceptions.length} exception(s)` : "No exceptions"}
        </span>
      </div>
      <div className="mt-5 grid gap-3">
        {groupedExceptions.length ? (
          groupedExceptions.map((group) => (
            <div key={group.message} className="rounded-xl border border-[#FFB86B]/20 bg-[#FFB86B]/10 p-4 text-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-white">{group.message}</p>
                  <p className="mt-1 text-xs text-[#FFE2B8]/80">
                    Click the affected user count to view staff with this issue.
                  </p>
                </div>
                <button
                  type="button"
                  className="w-fit rounded-full border border-[#FFB86B]/30 bg-[#FFB86B]/10 px-3 py-1 text-xs font-semibold text-[#FFE2B8] transition hover:bg-[#FFB86B]/20"
                  onClick={() => setExpandedException((current) => (current === group.message ? "" : group.message))}
                >
                  {group.employees.length} user(s)
                </button>
              </div>
              {expandedException === group.message ? (
                <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {group.employees.map((employee) => (
                    <div key={employee.id} className="rounded-lg border border-white/10 bg-white/[0.05] p-3">
                      <p className="font-semibold text-white">{employee.name}</p>
                      <p className="mt-1 text-xs text-[#d8c6e8]">{employee.department || "Missing department"}</p>
                      <p className="mt-1 text-xs text-[#d8c6e8]">Net pay: {formatMoney(getEmployeeNetPay(employee))}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ))
        ) : (
          <EmptyState message="All selected payroll records passed automated checks." />
        )}
      </div>
    </div>
  );
}

function AdminCpfConfigPanel() {
  const rows = [
    ["CPF Rate Tiers", `${adminCpfConfiguration.rateTiers.length} age group(s)`],
    ["Rate Source", adminCpfConfiguration.source],
    ["Monthly Wage Ceiling", formatMoney(adminCpfConfiguration.monthlyWageCeiling)],
    ["Effective From", adminCpfConfiguration.effectiveFrom],
    ["Payment Due", adminCpfConfiguration.paymentDue]
  ];
  const componentRows = Object.entries(adminCpfConfiguration.componentRules);

  return (
    <div className="neon-glass neon-border rounded-2xl p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">CPF Configuration</h3>
          <p className="mt-1 text-sm text-[#d8c6e8]">Read-only rates linked from Admin payroll settings.</p>
        </div>
        <span className="w-fit rounded-full border border-[#7DD3FC]/25 bg-[#7DD3FC]/10 px-3 py-1 text-xs font-semibold text-[#BAE6FD]">
          Admin controlled
        </span>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {rows.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#C77DFF]/80">{label}</p>
            <p className="mt-2 text-sm font-semibold text-white">{value}</p>
          </div>
        ))}
      </div>
      <div className="mt-5 overflow-hidden rounded-xl border border-white/10">
        <div className="grid grid-cols-3 gap-3 border-b border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#C77DFF]/80">
          <span>Age Group</span>
          <span>Employee CPF</span>
          <span>Employer CPF</span>
        </div>
        {adminCpfConfiguration.rateTiers.map((tier) => (
          <div key={tier.ageGroup} className="grid grid-cols-3 gap-3 border-b border-white/10 px-4 py-3 text-sm last:border-b-0">
            <span className="font-semibold text-white">{tier.ageGroup}</span>
            <span className="text-[#d8c6e8]">{tier.employeeOrdinaryRate}%</span>
            <span className="text-[#d8c6e8]">{tier.employerOrdinaryRate}%</span>
          </div>
        ))}
      </div>
      <div className="mt-5 overflow-hidden rounded-xl border border-white/10">
        <div className="grid grid-cols-3 gap-3 border-b border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#C77DFF]/80">
          <span>Component</span>
          <span>CPF</span>
          <span>Wage Type</span>
        </div>
        {componentRows.map(([component, rule]) => (
          <div key={component} className="grid grid-cols-3 gap-3 border-b border-white/10 px-4 py-3 text-sm last:border-b-0">
            <span className="font-semibold capitalize text-white">{component}</span>
            <span className={rule.cpfApplicable ? "font-semibold text-[#7CFFB2]" : "text-[#d8c6e8]"}>
              {rule.cpfApplicable ? "Applicable" : "Excluded"}
            </span>
            <span className="text-[#d8c6e8]">{rule.wageType}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CompliancePanel({ run }) {
  const { checks, failed, passed, total } = getComplianceSummary(run);

  return (
    <div className="neon-glass neon-border rounded-2xl p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Compliance Checklist</h3>
          <p className="mt-1 text-sm text-[#d8c6e8]">Finance compliance checks before payment confirmation.</p>
        </div>
        <span className={`w-fit rounded-full border px-3 py-1 text-xs font-semibold ${failed ? "border-[#FFB86B]/25 bg-[#FFB86B]/10 text-[#FFE2B8]" : "border-[#7CFFB2]/25 bg-[#7CFFB2]/10 text-[#7CFFB2]"}`}>
          {passed}/{total} passed
        </span>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {checks.map((check) => (
          <div key={check.label} className={`rounded-xl border p-4 ${check.status ? "border-[#7CFFB2]/20 bg-[#7CFFB2]/10" : "border-[#FFB86B]/20 bg-[#FFB86B]/10"}`}>
            <div className="flex items-start gap-3">
              <CheckCircle2 size={18} className={`mt-0.5 shrink-0 ${check.status ? "text-[#7CFFB2]" : "text-[#FFE2B8]"}`} />
              <div>
                <p className="font-semibold text-white">{check.label}</p>
                <p className="mt-1 text-sm text-[#d8c6e8]">{check.detail}</p>
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
    <div className="neon-glass neon-border rounded-2xl p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Audit Trail</h3>
          <p className="mt-1 text-sm text-[#d8c6e8]">Workflow activity captured for Finance review and audit readiness.</p>
        </div>
        <span className="w-fit rounded-full border border-[#7DD3FC]/25 bg-[#7DD3FC]/10 px-3 py-1 text-xs font-semibold text-[#BAE6FD]">
          {auditEntries.length} event(s)
        </span>
      </div>
      <div className="mt-5 grid gap-3">
        {auditEntries.length ? (
          auditEntries.slice(0, 8).map((entry, index) => (
            <div key={`${entry.action}-${entry.at}-${index}`} className="grid gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm md:grid-cols-[10rem_1fr_8rem]">
              <span className="font-semibold text-white">{formatDateTime(entry.at)}</span>
              <span className="text-[#d8c6e8]">{entry.action}</span>
              <span className="text-right font-semibold text-[#C77DFF] md:text-left">{entry.owner}</span>
            </div>
          ))
        ) : (
          <EmptyState message="No audit trail events have been captured yet." />
        )}
      </div>
    </div>
  );
}

function StatCard({ label, tone = "text-white", value }) {
  return (
    <div className="neon-glass rounded-2xl p-5">
      <p className="text-sm text-[#d8c6e8]">{label}</p>
      <p className={`mt-3 text-3xl font-semibold ${tone}`}>{value}</p>
    </div>
  );
}

function RunSelector({ payrollRuns, selectedRunId, onSelectRun }) {
  return (
    <label className="flex min-w-[17rem] items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2.5">
      <Search size={16} className="text-[#C77DFF]" />
      <select
        value={selectedRunId}
        onChange={(event) => onSelectRun(event.target.value)}
        className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-white outline-none"
      >
        {payrollRuns.map((run) => (
          <option key={run.id} value={run.id} className="bg-[#1d0b2f]">
            {formatPayrollPeriod(run)} - {run.status}
          </option>
        ))}
      </select>
    </label>
  );
}

function AccountingImpact({ run }) {
  const totals = getRunTotals(run);
  const rows = [
    ["Salary Expense", totals.salaryExpense, "Salary Payable / Bank", totals.netPay + totals.deductions],
    ["Employer CPF Expense", totals.employerCpf, "CPF Payable (Employee)", totals.employeeCpf],
    ["Allowance / Commission Expense", totals.allowances, "CPF Payable (Employer)", totals.employerCpf]
  ];

  return (
    <div className="neon-glass neon-border rounded-2xl p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Accounting Impact in Internal Ledger</h3>
          <p className="mt-1 text-sm text-[#d8c6e8]">Example journal entry for {formatPayrollPeriod(run)}.</p>
        </div>
        <span className={`w-fit rounded-full border px-3 py-1 text-xs font-semibold ${getCompletedSteps(run).ledgerRecorded ? "border-[#7CFFB2]/25 bg-[#7CFFB2]/10 text-[#7CFFB2]" : "border-white/10 bg-white/[0.06] text-[#d8c6e8]"}`}>
          {getCompletedSteps(run).ledgerRecorded ? "Posted" : "Not posted"}
        </span>
      </div>
      <div className="mt-5 overflow-x-auto">
        <table className="min-w-full text-left text-sm text-[#d8c6e8]">
          <thead className="text-xs uppercase tracking-wide text-[#C77DFF]/80">
            <tr>
              <th className="border-b border-white/10 px-4 py-3">Account (Dr)</th>
              <th className="border-b border-white/10 px-4 py-3">Debit</th>
              <th className="border-b border-white/10 px-4 py-3">Account (Cr)</th>
              <th className="border-b border-white/10 px-4 py-3">Credit</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([debitAccount, debit, creditAccount, credit]) => (
              <tr key={`${debitAccount}-${creditAccount}`}>
                <td className="border-b border-white/10 px-4 py-3 font-semibold text-white">{debitAccount}</td>
                <td className="border-b border-white/10 px-4 py-3">{formatMoney(debit)}</td>
                <td className="border-b border-white/10 px-4 py-3 font-semibold text-white">{creditAccount}</td>
                <td className="border-b border-white/10 px-4 py-3">{formatMoney(credit)}</td>
              </tr>
            ))}
            <tr className="font-semibold text-white">
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

function DashboardView({ onSelectRun, payrollRuns, selectedRun }) {
  const totals = getRunTotals(selectedRun);
  const completedSteps = Object.values(getCompletedSteps(selectedRun)).filter(Boolean).length;
  const pendingRuns = payrollRuns.filter((run) => !getCompletedSteps(run).reconciled).length;
  const exceptionCount = getRunExceptions(selectedRun).length;
  const approvedStaffCount = selectedRun.employees.filter((employee) => getEmployeeFinanceStatus(employee) === "Approved").length;
  const complianceSummary = getComplianceSummary(selectedRun);

  return (
    <PageShell heading="Dashboard">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Pending Pay Runs" value={pendingRuns} tone="text-[#FFB86B]" />
        <StatCard label="Staff Approved" value={`${approvedStaffCount}/${selectedRun?.employees?.length || 0}`} tone="text-white" />
        <StatCard label="Net Pay" value={formatMoney(totals.netPay)} tone="text-[#7CFFB2]" />
        <StatCard label="Compliance" value={`${complianceSummary.passed}/${complianceSummary.total}`} tone={complianceSummary.failed ? "text-[#FFB86B]" : "text-[#C77DFF]"} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">{formatPayrollPeriod(selectedRun)}</h3>
              <p className="mt-1 text-sm text-[#d8c6e8]">Finance review, approval, payment and accounting workflow.</p>
            </div>
            <RunSelector payrollRuns={payrollRuns} selectedRunId={selectedRun?.id} onSelectRun={onSelectRun} />
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {workflowSteps.map((step) => (
              <WorkflowCard key={step.key} run={selectedRun} step={step} />
            ))}
          </div>
        </div>

        <aside className="neon-glass neon-border rounded-2xl p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#7B2FF7]/20 text-[#C77DFF]">
              <ShieldCheck size={21} />
            </div>
            <div>
              <h3 className="font-semibold text-white">Finance Deliverable</h3>
              <p className="text-sm text-[#d8c6e8]">Status for {formatPayrollPeriod(selectedRun)}.</p>
            </div>
          </div>
          <div className="mt-6 space-y-3 text-sm text-[#d8c6e8]">
            {[
              "Payroll reviewed and approved",
              "Payment processed",
              "Payroll recorded in internal ledger",
              "Payslips sent to employees",
              "Reports generated"
            ].map((item, index) => (
              <div key={item} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3">
                <CheckCircle2 size={17} className={index < completedSteps ? "text-[#7CFFB2]" : "text-[#d8c6e8]/50"} />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </aside>
      </div>

      <div className="mt-6">
        <AdminCpfConfigPanel />
      </div>

      <div className="mt-6">
        <CompliancePanel run={selectedRun} />
      </div>

      <div className="mt-6">
        <ExceptionPanel run={selectedRun} />
      </div>

      <div className="mt-6">
        <AccountingImpact run={selectedRun} />
      </div>

      <div className="mt-6">
        <AuditTrailPanel run={selectedRun} />
      </div>
    </PageShell>
  );
}

function PayrollRunsView({ onAdvanceRun, onGeneratePaymentFile, onSelectRun, payrollRuns, selectedRun }) {
  const steps = getCompletedSteps(selectedRun);
  const canApprove = canApprovePayrollRun(selectedRun);
  const exceptionCount = getRunExceptions(selectedRun).length;

  return (
    <PageShell
      heading="Payroll Runs"
      actions={
        <>
          <RunSelector payrollRuns={payrollRuns} selectedRunId={selectedRun?.id} onSelectRun={onSelectRun} />
          <ActionButton icon={ClipboardCheck} disabled={steps.reviewed} onClick={() => onAdvanceRun("reviewed")}>
            Review Payroll
          </ActionButton>
          <ActionButton icon={ShieldCheck} disabled={!steps.reviewed || !canApprove || steps.approved} onClick={() => onAdvanceRun("approved")}>
            Approve
          </ActionButton>
        </>
      }
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="neon-glass neon-border overflow-hidden rounded-2xl">
            <div className="grid grid-cols-5 gap-4 border-b border-white/10 px-6 py-4 text-xs font-semibold uppercase tracking-wide text-[#C77DFF]/80">
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
                  className={`grid w-full grid-cols-5 gap-4 border-b border-white/10 px-6 py-4 text-left text-sm last:border-b-0 ${run.id === selectedRun?.id ? "bg-[#C77DFF]/10" : "hover:bg-white/[0.04]"}`}
                  onClick={() => onSelectRun(run.id)}
                >
                  <span className="font-semibold text-white">{formatPayrollPeriod(run)}</span>
                  <span>
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${getStatusClass(run.status)}`}>
                      {run.status}
                    </span>
                  </span>
                  <span className="text-[#d8c6e8]">{run.employees.length}</span>
                  <span className="font-semibold text-white">{formatMoney(totals.netPay)}</span>
                  <span className="text-[#d8c6e8]">{formatDateTime(run.submittedAt)}</span>
                </button>
              );
            })}
          </div>
        </div>

        <aside className="neon-glass neon-border rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white">{formatPayrollPeriod(selectedRun)}</h3>
          <p className="mt-1 text-sm text-[#d8c6e8]">Process the selected pay run in order.</p>
          <div className="mt-4 grid gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[#d8c6e8]">Exceptions</span>
              <span className={exceptionCount ? "font-semibold text-[#FFE2B8]" : "font-semibold text-[#7CFFB2]"}>
                {exceptionCount}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[#d8c6e8]">Staff approvals</span>
              <span className="font-semibold text-white">
                {selectedRun.employees.filter((employee) => getEmployeeFinanceStatus(employee) === "Approved").length}/{selectedRun.employees.length}
              </span>
            </div>
          </div>
          <div className="mt-5 grid gap-3">
            <ActionButton icon={Download} disabled={!steps.approved || selectedRun.paymentFileGeneratedAt} onClick={onGeneratePaymentFile}>
              Generate Payment PDF
            </ActionButton>
            <ActionButton icon={Banknote} disabled={!selectedRun.paymentFileGeneratedAt || steps.paid} onClick={() => onAdvanceRun("paid")}>
              Confirm Payment
            </ActionButton>
            <ActionButton icon={Mail} variant="secondary" disabled={!steps.paid || steps.payslipsSent} onClick={() => onAdvanceRun("payslipsSent")}>
              Send Payslips
            </ActionButton>
            <ActionButton icon={Building2} variant="secondary" disabled={!steps.payslipsSent || steps.ledgerRecorded} onClick={() => onAdvanceRun("ledgerRecorded")}>
              Record in Ledger
            </ActionButton>
            <ActionButton icon={FileBarChart} variant="secondary" disabled={!steps.ledgerRecorded || steps.reconciled} onClick={() => onAdvanceRun("reconciled")}>
              Reconcile
            </ActionButton>
          </div>
          <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm text-[#d8c6e8]">
            Bank reference: <span className="font-semibold text-white">{selectedRun.bankReference || "Pending payment"}</span>
          </div>
        </aside>
      </div>

      <div className="mt-6">
        <CompliancePanel run={selectedRun} />
      </div>

      <div className="mt-6">
        <AuditTrailPanel run={selectedRun} />
      </div>
    </PageShell>
  );
}

function PayrollItemList({ items, title }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
      <h4 className="text-sm font-semibold text-white">{title}</h4>
      <div className="mt-3 space-y-2">
        {items.length ? (
          items.map((item, index) => (
            <div key={`${item.label}-${index}`} className="grid grid-cols-[1fr_5rem_7rem] gap-3 text-sm">
              <span className="text-[#d8c6e8]">{item.label}</span>
              <span className="text-[#d8c6e8]">{item.rate || "-"}</span>
              <span className="text-right font-semibold text-white">{formatMoney(item.amount)}</span>
            </div>
          ))
        ) : (
          <p className="text-sm text-[#d8c6e8]">No items recorded.</p>
        )}
      </div>
    </div>
  );
}

function StaffPayrollDetailModal({ employee, isLocked, onClose, onSave }) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(employee);
  const exceptions = getEmployeeExceptions(draft);
  const cpfTier = getEmployeeCpfRateTier(draft);
  const numberFields = ["workingDays", "noPayLeave", "previousGrossPay"];

  const updateField = (field, value) => {
    setDraft((current) => ({
      ...current,
      [field]: numberFields.includes(field) ? Number(value || 0) : value
    }));
  };

  const addPayrollItem = (collection, label) => {
    const itemLabel = window.prompt(`${label} name`);
    if (!itemLabel) return;

    const amount = Number(window.prompt(`${label} amount`, "0") || 0);
    const rate = window.prompt(`${label} rate`, "-") || "-";

    setDraft((current) => ({
      ...current,
      [collection]: [
        ...(current[collection] || []),
        {
          label: itemLabel,
          rate,
          amount
        }
      ]
    }));
  };

  const handleSave = () => {
    onSave(draft);
    setIsEditing(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#090014]/80 px-4 backdrop-blur-sm">
      <section className="neon-glass neon-border max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-2xl p-6">
        <div className="flex flex-col gap-4 border-b border-white/10 pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#C77DFF]/80">Staff Payroll Details</p>
            <h3 className="mt-2 text-xl font-semibold text-white">{draft.name}</h3>
            <p className="mt-1 text-sm text-[#d8c6e8]">
              {draft.department || "Missing department"} / {draft.workLocation || "No work location"} / CPF tier: {cpfTier.ageGroup}
            </p>
          </div>
          <button
            type="button"
            className="rounded-xl border border-white/10 bg-white/[0.06] p-2 text-white hover:bg-white/10"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total Earnings" value={formatMoney(getEmployeeTotalEarnings(draft))} />
          <StatCard label="Total Deductions" value={formatMoney(getEmployeeTotalDeductions(draft))} tone="text-[#FFB86B]" />
          <StatCard label="Net Pay" value={formatMoney(getEmployeeNetPay(draft))} tone="text-[#7CFFB2]" />
          <StatCard label="Other Deductions" value={formatMoney(getEmployeeOtherDeductions(draft))} tone="text-[#C77DFF]" />
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
            <h4 className="text-sm font-semibold text-white">Employee & Payment Details</h4>
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
                  <span className="text-xs font-semibold uppercase tracking-wide text-[#C77DFF]/80">{label}</span>
                  {isEditing ? (
                    field === "cpfAgeGroup" ? (
                      <select
                        value={draft.cpfAgeGroup || adminCpfConfiguration.rateTiers[0].ageGroup}
                        onChange={(event) => updateField(field, event.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-[#1d0b2f] px-3 py-2.5 text-sm font-semibold text-white outline-none"
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
                        className="w-full rounded-xl border border-white/10 bg-[#1d0b2f] px-3 py-2.5 text-sm font-semibold text-white outline-none"
                      />
                    )
                  ) : (
                    <p className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm font-semibold text-white">
                      {draft[field] || "Not recorded"}
                    </p>
                  )}
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
            <h4 className="text-sm font-semibold text-white">Automated Checks</h4>
            <div className="mt-4 grid gap-2">
              {exceptions.length ? (
                exceptions.map((exception) => (
                  <div key={exception} className="rounded-lg border border-[#FFB86B]/20 bg-[#FFB86B]/10 p-3 text-sm text-[#FFE2B8]">
                    {exception}
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-[#7CFFB2]/20 bg-[#7CFFB2]/10 p-3 text-sm text-[#7CFFB2]">
                  No exceptions detected for this staff payroll record.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <PayrollItemList title="Earnings" items={getEmployeeEarningItems(draft)} />
          <PayrollItemList title="Deductions" items={getEmployeeDeductionItems(draft)} />
          <PayrollItemList title="Employer Expenses" items={getEmployeeEmployerItems(draft)} />
        </div>

        <div className="mt-5 flex flex-wrap gap-3 border-t border-white/10 pt-5">
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
              <ActionButton icon={X} variant="secondary" onClick={() => {
                setDraft(employee);
                setIsEditing(false);
              }}>
                Cancel
              </ActionButton>
            </>
          ) : (
            <ActionButton icon={Edit3} disabled={isLocked} onClick={() => setIsEditing(true)}>
              Edit Details
            </ActionButton>
          )}
        </div>
      </section>
    </div>
  );
}

function StaffPayrollDetailsView({ onUpdateEmployee, onUpdateStaffStatus, selectedRun }) {
  const totals = getRunTotals(selectedRun);
  const isLocked = getCompletedSteps(selectedRun).approved;
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const selectedEmployee = selectedRun.employees.find((employee) => employee.id === selectedEmployeeId);

  return (
    <PageShell heading="Staff Payroll Details">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Gross Pay" value={formatMoney(totals.grossPay)} />
        <StatCard label="Other Earnings" value={formatMoney(totals.allowances)} tone="text-[#7DD3FC]" />
        <StatCard label="Employee CPF" value={formatMoney(totals.employeeCpf)} tone="text-[#FFB86B]" />
        <StatCard label="Total Deductions" value={formatMoney(totals.deductions)} tone="text-[#C77DFF]" />
      </div>
      <div className="mt-6">
        <ExceptionPanel run={selectedRun} />
      </div>
      <div className="mt-6">
        <AdminCpfConfigPanel />
      </div>
      <div className="neon-glass neon-border mt-6 overflow-hidden rounded-2xl">
        <div className="grid grid-cols-8 gap-4 border-b border-white/10 px-6 py-4 text-xs font-semibold uppercase tracking-wide text-[#C77DFF]/80">
          <span>Employee</span>
          <span>Work Info</span>
          <span>Earnings</span>
          <span>Deductions</span>
          <span>Net Pay</span>
          <span>Bank Account</span>
          <span>Status</span>
          <span>Action</span>
        </div>
        {selectedRun.employees.map((employee) => {
          const netPay = getEmployeeNetPay(employee);
          const exceptions = getEmployeeExceptions(employee);
          const status = getEmployeeFinanceStatus(employee);
          const earningSummary = getEmployeeEarningItems(employee)
            .map((item) => `${item.label}: ${formatMoney(item.amount)}`)
            .join(", ");
          const deductionSummary = getEmployeeDeductionItems(employee)
            .map((item) => `${item.label}: ${formatMoney(item.amount)}`)
            .join(", ");

          return (
            <div key={employee.id} className="grid grid-cols-8 gap-4 border-b border-white/10 px-6 py-4 text-sm last:border-b-0">
              <span>
                <button
                  type="button"
                  className="block text-left font-semibold text-white underline-offset-4 hover:underline"
                  onClick={() => setSelectedEmployeeId(employee.id)}
                >
                  {employee.name}
                </button>
                {exceptions.length ? <span className="mt-1 block text-xs text-[#FFE2B8]">{exceptions.join(", ")}</span> : null}
              </span>
              <span className="text-[#d8c6e8]">
                <span className="block">{employee.department}</span>
                <span className="block text-xs">{employee.workLocation || "No location"}</span>
                <span className="block text-xs">{employee.workingDays ?? "-"} days / NPL {employee.noPayLeave ?? 0}</span>
              </span>
              <span className="text-white">
                <span className="block font-semibold">{formatMoney(getEmployeeTotalEarnings(employee))}</span>
                <span className="block text-xs text-[#d8c6e8]">{earningSummary}</span>
              </span>
              <span className="text-[#d8c6e8]">
                <span className="block font-semibold text-white">{formatMoney(getEmployeeTotalDeductions(employee))}</span>
                <span className="block text-xs">{deductionSummary}</span>
              </span>
              <span className="font-semibold text-[#7CFFB2]">{formatMoney(netPay)}</span>
              <span className={employee.bankAccount ? "text-[#d8c6e8]" : "text-[#FFE2B8]"}>
                <span className="block">{employee.bankType || "Missing bank"}</span>
                <span className="block text-xs">{employee.bankAccount || "Missing account"}</span>
              </span>
              <span>
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${status === "Approved" ? "border-[#7CFFB2]/25 bg-[#7CFFB2]/10 text-[#7CFFB2]" : status === "Hold" ? "border-[#FFB86B]/25 bg-[#FFB86B]/10 text-[#FFE2B8]" : "border-white/10 bg-white/[0.06] text-[#d8c6e8]"}`}>
                  {status}
                </span>
              </span>
              <span className="flex flex-wrap gap-2">
                {isLocked ? (
                  <span className="inline-flex items-center gap-2 text-xs font-semibold text-[#d8c6e8]">
                    <Lock size={14} />
                    Locked
                  </span>
                ) : (
                  <>
                    <button
                      type="button"
                      className="rounded-lg border border-[#7CFFB2]/25 bg-[#7CFFB2]/10 px-3 py-1 text-xs font-semibold text-[#7CFFB2] disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() => onUpdateStaffStatus(employee.id, "Approved")}
                      disabled={status === "Approved"}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-[#FFB86B]/25 bg-[#FFB86B]/10 px-3 py-1 text-xs font-semibold text-[#FFE2B8] disabled:cursor-not-allowed disabled:opacity-50"
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
    <PageShell heading="Notification Records">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {notifications.map((notification) => (
          <article key={notification.id} className="neon-glass neon-border rounded-2xl p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#C77DFF]/12 text-[#C77DFF]">
                <Send size={21} />
              </div>
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${notification.status === "Sent" ? "border-[#7CFFB2]/25 bg-[#7CFFB2]/10 text-[#7CFFB2]" : "border-white/10 bg-white/[0.06] text-[#d8c6e8]"}`}>
                {notification.status}
              </span>
            </div>
            <h3 className="mt-5 font-semibold text-white">{notification.employee}</h3>
            <p className="mt-2 text-sm text-[#d8c6e8]">{notification.type} for {formatPayrollPeriod(selectedRun)}</p>
            <p className="mt-4 text-sm text-[#d8c6e8]">Sent at: <span className="font-semibold text-white">{formatDateTime(notification.sentAt)}</span></p>
          </article>
        ))}
      </div>
      {!notifications.length ? <EmptyState message="No notification records found." /> : null}
    </PageShell>
  );
}

function buildReportRows(selectedRun) {
  const totals = getRunTotals(selectedRun);
  const exceptionCount = getRunExceptions(selectedRun).length;
  const approvedStaffCount = selectedRun.employees.filter((employee) => getEmployeeFinanceStatus(employee) === "Approved").length;

  return [
    ["Payroll Summary", `${selectedRun.employees.length} employees`, formatMoney(totals.netPay)],
    ["Pay Run Summary", selectedRun.status, formatPayrollPeriod(selectedRun)],
    ["Exception Summary", `${exceptionCount} system exception(s)`, `${approvedStaffCount}/${selectedRun.employees.length} staff approved`],
    ["CPF Summary", `Employee ${formatMoney(totals.employeeCpf)}`, `Employer ${formatMoney(totals.employerCpf)}`],
    ["Deduction Summary", `Total ${formatMoney(totals.deductions)}`, "CPF, loans and funds"],
    ["Compliance Checklist", `${getComplianceSummary(selectedRun).passed}/${getComplianceSummary(selectedRun).total} passed`, `${getComplianceSummary(selectedRun).failed} issue(s)`],
    ["Audit Trail", `${getAuditEntries(selectedRun).length} event(s)`, "Workflow history"],
    ["Payment File", selectedRun.paymentFileGeneratedAt ? "Generated" : "Not generated", formatDateTime(selectedRun.paymentFileGeneratedAt)],
    ["Cost to Company", formatMoney(totals.salaryExpense + totals.employerCpf), selectedRun.bankReference || "Pending bank reference"]
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
    ["Employee", "CPF Tier", "CPF Wage", "Employee CPF", "Employer CPF", "Admin Rate"],
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
      getEmployeeDeductionItems(employee).map((item) => [
        employee.name,
        item.label,
        item.rate || "-",
        formatMoney(item.amount),
        formatMoney(getEmployeeNetPay(employee))
      ])
    )
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
    ["Department", "Gross Pay", "Allowances", "Employer CPF", "Cost"],
    ...Object.values(
      selectedRun.employees.reduce((groups, employee) => {
        const key = employee.department || "Missing";
        const current = groups[key] || {
          department: key,
          grossPay: 0,
          allowances: 0,
          employerCpf: 0
        };

        const totalEarnings = getEmployeeTotalEarnings(employee);
        const basicPay = getEmployeeEarningItems(employee)
          .filter((item) => item.label.toLowerCase().includes("basic"))
          .reduce((total, item) => total + Number(item.amount || 0), 0);

        current.grossPay += basicPay;
        current.allowances += totalEarnings - basicPay;
        current.employerCpf += getEmployerCpfAmount(employee);
        groups[key] = current;
        return groups;
      }, {})
    ).map((department) => [
      department.department,
      formatMoney(department.grossPay),
      formatMoney(department.allowances),
      formatMoney(department.employerCpf),
      formatMoney(department.grossPay + department.allowances + department.employerCpf)
    ])
  ];
}

function downloadReport(selectedRun, reportTitle) {
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
        ["Gross Pay", formatMoney(totals.grossPay), "Before deductions"],
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
        ["CPF Source", adminCpfConfiguration.source, "Admin controlled"],
        ["Payroll Lock", selectedRun.approvedAt ? "Locked" : "Unlocked", formatDateTime(selectedRun.approvedAt)]
      ],
      tableRows: getExceptionReportRows(selectedRun),
      footer: "Exception checks are automated. Finance approves or holds affected staff records."
    },
    "CPF Summary": {
      filename: "cpf-summary",
      summaryRows: [
        ["Employee CPF", formatMoney(totals.employeeCpf), "Admin age tier rates"],
        ["Employer CPF", formatMoney(totals.employerCpf), "Admin age tier rates"],
        ["CPF Wage Basis", "CPF-applicable earnings only", "Admin component rules"],
        ["CPF Rate Tiers", `${adminCpfConfiguration.rateTiers.length} age group(s)`, "Read-only from Admin"],
        ["Wage Ceiling", formatMoney(adminCpfConfiguration.monthlyWageCeiling), adminCpfConfiguration.effectiveFrom],
        ["Payment Due", adminCpfConfiguration.paymentDue, "Admin controlled"]
      ],
      tableRows: getCpfReportRows(selectedRun),
      footer: "CPF validation uses Admin component classification before applying CPF rates."
    },
    "Deduction Summary": {
      filename: "deduction-summary",
      summaryRows: [
        ["Total Deductions", formatMoney(totals.deductions), "CPF, loans and funds"],
        ["Employee CPF", formatMoney(totals.employeeCpf), "Admin CPF settings"],
        ["Other Deductions", formatMoney(totals.deductions - totals.employeeCpf), "Loans, funds and recoveries"],
        ["Net Pay After Deductions", formatMoney(totals.netPay), "Payment amount"]
      ],
      tableRows: getDeductionReportRows(selectedRun),
      footer: "Deduction summary itemises employee CPF, loans, funds and salary recoveries."
    },
    "Compliance Checklist": {
      filename: "compliance-checklist",
      summaryRows: [
        ["Compliance Status", `${complianceSummary.passed}/${complianceSummary.total} checks passed`, complianceSummary.failed ? `${complianceSummary.failed} action required` : "Ready"],
        ["CPF Source", adminCpfConfiguration.source, "Admin controlled"],
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
        ["Payment Method", selectedRun.paymentMethod, selectedRun.bankReference || "Pending bank reference"],
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
        ["Total Cost", formatMoney(totals.salaryExpense + totals.employerCpf), formatPayrollPeriod(selectedRun)],
        ["Ledger Status", getCompletedSteps(selectedRun).ledgerRecorded ? "Posted" : "Pending", formatDateTime(selectedRun.ledgerRecordedAt)]
      ],
      tableRows: getCostReportRows(selectedRun),
      footer: "Cost to company report groups payroll cost by department."
    }
  };
  const config = reportConfig[reportTitle];

  if (!config) return;

  downloadPdf(
    `${selectedRun.id.toLowerCase()}-${config.filename}.pdf`,
    createPdfBlob({
      title: reportTitle,
      subtitle: `${formatPayrollPeriod(selectedRun)} / ${selectedRun.status}`,
      summaryRows: config.summaryRows,
      tableRows: config.tableRows,
      footer: config.footer
    })
  );
}

function PayrollReportsView({ selectedRun }) {
  const reportCards = buildReportRows(selectedRun);

  return (
    <PageShell heading="Payroll Reports">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {reportCards.map(([title, detail, value]) => (
          <article key={title} className="neon-glass neon-border rounded-2xl p-6">
            <FileBarChart size={24} className="text-[#C77DFF]" />
            <h3 className="mt-4 font-semibold text-white">{title}</h3>
            <p className="mt-2 text-sm text-[#d8c6e8]">{detail}</p>
            <p className="mt-5 text-sm font-semibold text-white">{value}</p>
            <button
              type="button"
              className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
              onClick={() => downloadReport(selectedRun, title)}
            >
              <Download size={16} />
              Download PDF
            </button>
          </article>
        ))}
      </div>
    </PageShell>
  );
}

function PayrollSummariesView({ selectedRun }) {
  const totals = getRunTotals(selectedRun);
  const summaryRows = [
    ["Gross Pay", totals.grossPay],
    ["Other Earnings", totals.allowances],
    ["Deductions", totals.deductions],
    ["Employee CPF", totals.employeeCpf],
    ["Employer CPF", totals.employerCpf],
    ["Net Pay", totals.netPay]
  ];

  return (
    <PageShell heading="Payroll Summaries">
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="neon-glass neon-border rounded-2xl p-6">
          <div className="flex items-center gap-3">
            <ReceiptText size={24} className="text-[#C77DFF]" />
            <div>
              <h3 className="font-semibold text-white">{formatPayrollPeriod(selectedRun)}</h3>
              <p className="text-sm text-[#d8c6e8]">{selectedRun.status}</p>
            </div>
          </div>
          <div className="mt-6 space-y-3">
            {summaryRows.map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm">
                <span className="text-[#d8c6e8]">{label}</span>
                <span className="font-semibold text-white">{formatMoney(value)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="lg:col-span-2">
          <AccountingImpact run={selectedRun} />
        </div>
      </div>
    </PageShell>
  );
}

function FinancePayrollContent({ onAdvanceRun, onGeneratePaymentFile, onSelectRun, onUpdateEmployee, onUpdateStaffStatus, pathname, payrollRuns, selectedRun }) {
  if (pathname.endsWith("/payroll-runs")) {
    return (
      <PayrollRunsView
        payrollRuns={payrollRuns}
        selectedRun={selectedRun}
        onAdvanceRun={onAdvanceRun}
        onGeneratePaymentFile={onGeneratePaymentFile}
        onSelectRun={onSelectRun}
      />
    );
  }

  if (pathname.endsWith("/staff-payroll-details")) {
    return (
      <StaffPayrollDetailsView
        selectedRun={selectedRun}
        onUpdateEmployee={onUpdateEmployee}
        onUpdateStaffStatus={onUpdateStaffStatus}
      />
    );
  }
  if (pathname.endsWith("/notification-records")) return <NotificationRecordsView selectedRun={selectedRun} />;
  if (pathname.endsWith("/payroll-reports")) return <PayrollReportsView selectedRun={selectedRun} />;
  if (pathname.endsWith("/payroll-summaries")) return <PayrollSummariesView selectedRun={selectedRun} />;

  return (
    <DashboardView
      payrollRuns={payrollRuns}
      selectedRun={selectedRun}
      onSelectRun={onSelectRun}
    />
  );
}

export default function FinancePayrollPage() {
  const session = getStoredSession();
  const location = useLocation();
  const heading = routeHeadings[location.pathname] || "Dashboard";
  const [payrollRuns, setPayrollRuns] = useState(getInitialPayrollRuns);
  const [selectedRunId, setSelectedRunId] = useState(() => getInitialPayrollRuns()[0]?.id || "");

  useEffect(() => {
    localStorage.setItem(FINANCE_PAYROLL_STORAGE_KEY, JSON.stringify(payrollRuns));
  }, [payrollRuns]);

  const selectedRun = useMemo(
    () => payrollRuns.find((run) => run.id === selectedRunId) || payrollRuns[0],
    [payrollRuns, selectedRunId]
  );

  const updateSelectedRun = (updater) => {
    setPayrollRuns((currentRuns) =>
      currentRuns.map((run) => (run.id === selectedRun.id ? updater(run) : run))
    );
  };

  const handleUpdateStaffStatus = (employeeId, financeStatus) => {
    updateSelectedRun((run) => ({
      ...run,
      employees: run.employees.map((employee) =>
        employee.id === employeeId
          ? {
              ...employee,
              financeStatus
            }
          : employee
      ),
      timeline: [
        createTimelineEntry(`Staff payment ${financeStatus.toLowerCase()} for ${employeeId}`),
        ...(run.timeline || [])
      ]
    }));
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

  const handleGeneratePaymentFile = () => {
    const now = new Date().toISOString();
    const totals = getRunTotals(selectedRun);

    downloadPdf(
      `${selectedRun.id.toLowerCase()}-payment-file.pdf`,
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
    updateSelectedRun((run) => ({
      ...run,
      paymentFileGeneratedAt: now,
      status: "Payment File Generated",
      timeline: [
        createTimelineEntry("Bank payment file generated", "System"),
        ...(run.timeline || [])
      ]
    }));
  };

  const handleAdvanceRun = (stepKey) => {
    const now = new Date().toISOString();
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
          bankReference:
            window.prompt("Bank confirmation reference", selectedRun.bankReference || `GIRO-${selectedRun.year}${String(selectedRun.month).padStart(2, "0")}-${Math.floor(1000 + Math.random() * 9000)}`) ||
            selectedRun.bankReference ||
            `GIRO-${selectedRun.year}${String(selectedRun.month).padStart(2, "0")}-${Math.floor(1000 + Math.random() * 9000)}`
        },
        timeline: createTimelineEntry("Payment file uploaded and confirmed")
      },
      payslipsSent: {
        status: "Payslips Sent",
        fields: { payslipsSentAt: now },
        timeline: createTimelineEntry("Final payslips sent to employees", "System")
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
    if (stepKey === "approved" && !canApprovePayrollRun(selectedRun)) return;

    updateSelectedRun((run) => ({
      ...run,
      ...transition.fields,
      employees:
        stepKey === "reviewed"
          ? run.employees.map((employee) => ({
              ...employee,
              financeStatus: employee.financeStatus || (getEmployeeExceptions(employee).length ? "Hold" : "Approved")
            }))
          : run.employees,
      status: transition.status,
      timeline: [transition.timeline, ...(run.timeline || [])]
    }));
  };

  return (
    <DashboardLayout
      pageTitle={pageTitle}
      user={session?.user}
      sidebarSections={payrollSidebarSections}
      sidebarTitle="Automated Invoicing & Payroll System"
      searchPlaceholder="Search payroll runs, staff, reports..."
    >
      {selectedRun ? (
        <FinancePayrollContent
          heading={heading}
          pathname={location.pathname}
          payrollRuns={payrollRuns}
          selectedRun={selectedRun}
          onAdvanceRun={handleAdvanceRun}
          onGeneratePaymentFile={handleGeneratePaymentFile}
          onSelectRun={setSelectedRunId}
          onUpdateEmployee={handleUpdateEmployee}
          onUpdateStaffStatus={handleUpdateStaffStatus}
        />
      ) : (
        <PageShell heading={heading}>
          <EmptyState message="No payroll runs are ready for Finance review." />
        </PageShell>
      )}
    </DashboardLayout>
  );
}
