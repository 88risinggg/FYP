import {
  Bell,
  FileBarChart,
  LayoutDashboard,
  Settings,
  Shield,
  Users
} from "lucide-react";
import { useLocation } from "react-router-dom";

import DashboardLayout from "../../components/layout/DashboardLayout.jsx";
import { getStoredSession } from "../../services/sessionService.js";
import AdminAuditLogsPage from "./AdminAuditLogsPage.jsx";
import AdminDashboardHomePage from "./AdminDashboardHomePage.jsx";
import AdminInvoicePerformancePage from "./AdminInvoicePerformancePage.jsx";
import AdminInvoiceActivityTrendPage from "./AdminInvoiceActivityTrendPage.jsx";
import AdminInvoiceListPage from "./AdminInvoiceListPage.jsx";
import AdminRecentStatusChangesPage from "./AdminRecentStatusChangesPage.jsx";
import AdminInvoiceSettingsPage from "./AdminInvoiceSettingsPage.jsx";
import AdminPaymentReminderSummaryPage from "./AdminPaymentReminderSummaryPage.jsx";
import AdminRoleActionPage from "./AdminRoleActionPage.jsx";
import AdminRolesPermissionsPage from "./AdminRolesPermissionsPage.jsx";
import AdminReminderSettingsPage from "./AdminReminderSettingsPage.jsx";
import AdminUserManagementPage from "./AdminUserManagementPage.jsx";
import AdminUserProfilePage from "./AdminUserProfilePage.jsx";
import AdminValidationSummaryPage from "./AdminValidationSummaryPage.jsx";
import AdminValidationErrorsPage from "./AdminValidationErrorsPage.jsx";
import AdminTemplatePreviewPage from "./AdminTemplatePreviewPage.jsx";

const pageTitle = "Automated Invoicing System - Admin Dashboard";

const invoicingSidebarSections = [
  {
    label: "MAIN",
    items: [
      {
        label: "Dashboard",
        icon: LayoutDashboard,
        path: "/dashboard/invoicing/admin",
        end: true,
        children: [
          {
            label: "Overview",
            path: "/dashboard/invoicing/admin",
            end: true
          },
          {
            label: "Invoice Performance",
            path: "/dashboard/invoicing/admin/dashboard/invoice-performance"
          },
          {
            label: "Payment & Reminder Summary",
            path: "/dashboard/invoicing/admin/dashboard/payment-reminder-summary"
          },
          {
            label: "Validation Summary",
            path: "/dashboard/invoicing/admin/dashboard/validation-summary"
          }
        ]
      },
      {
        label: "Users",
        icon: Users,
        path: "/dashboard/invoicing/admin/users"
      },
      {
        label: "Roles",
        icon: Shield,
        path: "/dashboard/invoicing/admin/roles"
      }
    ]
  },
  {
    label: "INVOICING",
    items: [
      {
        label: "Invoice Settings",
        icon: Settings,
        path: "/dashboard/invoicing/admin/invoice-settings",
        children: [
          {
            label: "Settings",
            path: "/dashboard/invoicing/admin/invoice-settings"
          },
          {
            label: "Template Preview",
            path: "/dashboard/invoicing/admin/template-preview"
          }
        ]
      },
      {
        label: "Vaniday Mapping",
        icon: Settings,
        path: "/dashboard/invoicing/admin/vaniday-mapping"
      },
      {
        label: "Reminder Settings",
        icon: Bell,
        path: "/dashboard/invoicing/admin/reminder-settings"
      }
    ]
  },
  {
    label: "MONITORING",
    items: [
      {
        label: "Audit Logs",
        icon: FileBarChart,
        path: "/dashboard/invoicing/admin/audit-logs"
      }
    ]
  },
  {
    label: "REPORTS",
    items: [
      {
        label: "Reports",
        icon: FileBarChart,
        path: "/dashboard/invoicing/admin/reports"
      }
    ]
  }
];

const routeHeadings = {
  "/dashboard/invoicing/admin": "Dashboard",
  "/dashboard/invoicing/admin/dashboard/invoice-performance": "Invoice Performance",
  "/dashboard/invoicing/admin/dashboard/invoice-performance/activity-trend": "Invoice Activity Trend",
  "/dashboard/invoicing/admin/dashboard/invoice-performance/status-changes": "Recent Status Changes",
  "/dashboard/invoicing/admin/dashboard/payment-reminder-summary": "Payment & Reminder Summary",
  "/dashboard/invoicing/admin/dashboard/validation-summary": "Validation Summary",
  "/dashboard/invoicing/admin/dashboard/validation-errors": "All Validation Errors",
  "/dashboard/invoicing/admin/invoices": "Invoices",
  "/dashboard/invoicing/admin/invoices/create": "Create Invoice",
  "/dashboard/invoicing/admin/customers": "Customers",
  "/dashboard/invoicing/admin/customers/create": "New Customer",
  "/dashboard/invoicing/admin/payments": "Payments",
  "/dashboard/invoicing/admin/payments/record": "Record Payment",
  "/dashboard/invoicing/admin/users": "Users",
  "/dashboard/invoicing/admin/roles": "Roles",
  "/dashboard/invoicing/admin/invoice-settings": "Invoice Settings",
  "/dashboard/invoicing/admin/invoice-settings/general": "Invoice Settings",
  "/dashboard/invoicing/admin/invoice-settings/numbering": "Invoice Settings",
  "/dashboard/invoicing/admin/invoice-settings/email": "Invoice Settings",
  "/dashboard/invoicing/admin/invoice-settings/payments": "Invoice Settings",
  "/dashboard/invoicing/admin/reminder-settings": "Reminder Settings",
  "/dashboard/invoicing/admin/template-preview": "Template Preview",
  "/dashboard/invoicing/admin/vaniday-mapping": "Vaniday Data Mapping",
  "/dashboard/invoicing/admin/audit-logs": "Audit Logs",
  "/dashboard/invoicing/admin/reports": "Reports"
};

export default function AdminInvoicingDashboard() {
  const session = getStoredSession();
  const location = useLocation();
  const normalizedPath = location.pathname.startsWith("/admin")
    ? `/dashboard/invoicing/admin${location.pathname.slice("/admin".length)}`
    : location.pathname;
  const heading = routeHeadings[normalizedPath] ||
    (normalizedPath.startsWith("/dashboard/invoicing/admin/invoices")
      ? "Invoices"
      : normalizedPath.startsWith("/dashboard/invoicing/admin/customers")
        ? "Customers"
        : normalizedPath.startsWith("/dashboard/invoicing/admin/payments")
          ? "Payments"
          : normalizedPath.startsWith("/dashboard/invoicing/admin/dashboard")
            ? "Dashboard"
            : "Dashboard");
  const isUserManagement = normalizedPath === "/dashboard/invoicing/admin/users";
  const isRolesManagement = normalizedPath === "/dashboard/invoicing/admin/roles";
  const userProfileMatch = normalizedPath.match(
    /^\/dashboard\/invoicing\/admin\/users\/(\d+)$/
  );
  const roleCreateMatch = normalizedPath === "/dashboard/invoicing/admin/roles/create";
  const roleActionMatch = normalizedPath.match(
    /^\/dashboard\/invoicing\/admin\/roles\/(\d+)(?:\/(edit|assign-users|duplicate|deactivate))?$/
  );
  const invoiceSettingsMatch = normalizedPath.match(
    /^\/dashboard\/invoicing\/admin\/invoice-settings(?:\/([a-z-]+))?$/
  );
  const isInvoiceSettings = Boolean(invoiceSettingsMatch);
  const isReminderSettings = normalizedPath === "/dashboard/invoicing/admin/reminder-settings";
  const isTemplatePreview = normalizedPath === "/dashboard/invoicing/admin/template-preview";
  const isVanidayMapping = normalizedPath === "/dashboard/invoicing/admin/vaniday-mapping";
  const isAuditLogs = normalizedPath === "/dashboard/invoicing/admin/audit-logs";
  const isInvoicePerformance = normalizedPath === "/dashboard/invoicing/admin/dashboard/invoice-performance";
  const isInvoiceActivityTrend = normalizedPath === "/dashboard/invoicing/admin/dashboard/invoice-performance/activity-trend";
  const isRecentStatusChanges = normalizedPath === "/dashboard/invoicing/admin/dashboard/invoice-performance/status-changes";
  const isInvoiceList = normalizedPath === "/dashboard/invoicing/admin/invoices";
  const isPaymentReminderSummary = normalizedPath === "/dashboard/invoicing/admin/dashboard/payment-reminder-summary";
  const isValidationSummary = normalizedPath === "/dashboard/invoicing/admin/dashboard/validation-summary";
  const isValidationErrors = normalizedPath === "/dashboard/invoicing/admin/dashboard/validation-errors";
  const currentPageTitle = isUserManagement || userProfileMatch
    ? "Automated Invoicing System - User Management"
    : isRolesManagement || roleCreateMatch || roleActionMatch
      ? "Automated Invoicing System - Roles & Permissions"
    : isInvoicePerformance || isInvoiceActivityTrend || isRecentStatusChanges
      ? "Automated Invoicing System - Invoice Performance"
    : isPaymentReminderSummary
      ? "Automated Invoicing System - Payment & Reminder Summary"
    : isValidationSummary
      ? "Automated Invoicing System - Validation Summary"
    : isValidationErrors
      ? "Automated Invoicing System - All Validation Errors"
    : isInvoiceSettings
      ? "Automated Invoicing System - Invoice Settings"
    : isReminderSettings
      ? "Automated Invoicing System - Reminder Settings"
      : isAuditLogs
        ? "Automated Invoicing System - Audit Logs"
      : pageTitle;

  if (isInvoiceActivityTrend) {
    return <AdminInvoiceActivityTrendPage />;
  }

  if (isRecentStatusChanges) {
    return <AdminRecentStatusChangesPage />;
  }

  return (
    <DashboardLayout
      pageTitle={currentPageTitle}
      user={session?.user}
      sidebarSections={invoicingSidebarSections}
      sidebarTitle="Automated Invoicing & Payroll System"
      searchPlaceholder="Search invoices, customers..."
      theme="adminInvoicing"
    >
      {normalizedPath === "/dashboard/invoicing/admin" ? (
        <AdminDashboardHomePage />
      ) : isInvoicePerformance ? (
        <AdminInvoicePerformancePage />
      ) : isInvoiceList ? (
        <AdminInvoiceListPage />
      ) : isPaymentReminderSummary ? (
        <AdminPaymentReminderSummaryPage />
      ) : isValidationSummary ? (
        <AdminValidationSummaryPage />
      ) : isValidationErrors ? (
        <AdminValidationErrorsPage />
      ) : isUserManagement ? (
        <AdminUserManagementPage />
      ) : userProfileMatch ? (
        <AdminUserProfilePage userId={userProfileMatch[1]} />
      ) : isRolesManagement ? (
        <AdminRolesPermissionsPage />
      ) : roleCreateMatch ? (
        <AdminRoleActionPage action="create" />
      ) : roleActionMatch ? (
        <AdminRoleActionPage roleId={roleActionMatch[1]} action={roleActionMatch[2] || "view"} />
      ) : isInvoiceSettings ? (
        <AdminInvoiceSettingsPage activeTab={invoiceSettingsMatch?.[1] || "general"} />
      ) : isReminderSettings ? (
        <AdminReminderSettingsPage />
      ) : isTemplatePreview ? (
        <AdminTemplatePreviewPage />
      ) : isVanidayMapping ? (
        <section className="p-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Vaniday Data Mapping</h2>
          <p className="text-sm text-gray-500 mb-6">Configure how Vaniday CSV columns map to invoice system fields. Finance users will use these mappings during import.</p>
          <div className="bg-white border rounded-xl p-6">
            <p className="text-sm text-gray-600">Vaniday field mapping is configured here for Finance imports.</p>
          </div>
        </section>
      ) : isAuditLogs ? (
        <AdminAuditLogsPage />
      ) : (
        <section>
          <h2 className="text-2xl font-semibold text-[#251E1F]">{heading}</h2>
          <div className="app-panel mt-6 min-h-[calc(100vh-12rem)] rounded-2xl border-dashed p-8">
            <p className="text-sm text-[#7b6660]">
              This page is reserved for module development.
            </p>
          </div>
        </section>
      )}
    </DashboardLayout>
  );
}
