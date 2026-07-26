import {
  Bell,
  CalendarClock,
  FileBarChart,
  LayoutDashboard,
  MessageSquare,
  Settings
} from "lucide-react";
import { Navigate, useLocation } from "react-router-dom";

import DashboardLayout from "../../components/layout/DashboardLayout.jsx";
import { getStoredSession } from "../../services/sessionService.js";
import AdminAuditLogsPage from "./AdminAuditLogsPage.jsx";
import AdminDashboardHomePage from "./AdminDashboardHomePage.jsx";
import AdminInvoicePerformancePage from "./AdminInvoicePerformancePage.jsx";
import AdminInvoiceListPage from "./AdminInvoiceListPage.jsx";
import AdminInvoiceSettingsPage, { AdminGstManagementPage } from "./AdminInvoiceSettingsPage.jsx";
import AdminPaymentReminderSummaryPage from "./AdminPaymentReminderSummaryPage.jsx";
import AdminReportsPage from "./AdminReportsPage.jsx";
import AdminReminderSettingsPage from "./AdminReminderSettingsPage.jsx";
import AdminValidationSummaryPage from "./AdminValidationSummaryPage.jsx";
import AdminTemplatePreviewPage from "./AdminTemplatePreviewPage.jsx";
import AdminSubscriptionSettingsPage from "./AdminSubscriptionSettingsPage.jsx";
import AdminWhatsAppIntegrationPage from "./AdminWhatsAppIntegrationPage.jsx";

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
            label: "GST Management",
            path: "/dashboard/invoicing/admin/gst-management",
            end: true
          },
          {
            label: "Settings",
            path: "/dashboard/invoicing/admin/invoice-settings",
            end: true
          },
          {
            label: "Template Preview",
            path: "/dashboard/invoicing/admin/template-preview",
            end: true
          }
        ]
      },
      {
        label: "Subscription Settings",
        icon: CalendarClock,
        path: "/dashboard/invoicing/admin/subscription-settings",
        children: [
          {
            label: "Settings",
            path: "/dashboard/invoicing/admin/subscription-settings"
          }
        ]
      },
      {
        label: "Reminder Settings",
        icon: Bell,
        path: "/dashboard/invoicing/admin/reminder-settings"
      },
      {
        label: "Integrations",
        icon: MessageSquare,
        path: "/dashboard/invoicing/admin/integrations/whatsapp",
        children: [
          {
            label: "WhatsApp",
            path: "/dashboard/invoicing/admin/integrations/whatsapp",
            end: true
          }
        ]
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
  "/dashboard/invoicing/admin/dashboard/invoice-performance/status-changes": "Recent Status Changes",
  "/dashboard/invoicing/admin/dashboard/payment-reminder-summary": "Payment & Reminder Summary",
  "/dashboard/invoicing/admin/dashboard/validation-summary": "Validation Summary",
  "/dashboard/invoicing/admin/dashboard/validation-summary/upload-history": "Invoice Upload History",
  "/dashboard/invoicing/admin/dashboard/validation-errors": "All Validation Errors",
  "/dashboard/invoicing/admin/invoices": "Invoices",
  "/dashboard/invoicing/admin/invoices/create": "Create Invoice",
  "/dashboard/invoicing/admin/customers": "Customers",
  "/dashboard/invoicing/admin/customers/create": "New Customer",
  "/dashboard/invoicing/admin/payments": "Payments",
  "/dashboard/invoicing/admin/payments/record": "Record Payment",
  "/dashboard/invoicing/admin/gst-management": "GST Management",
  "/dashboard/invoicing/admin/invoice-settings": "Invoice Settings",
  "/dashboard/invoicing/admin/invoice-settings/general": "Invoice Settings",
  "/dashboard/invoicing/admin/invoice-settings/numbering": "Invoice Settings",
  "/dashboard/invoicing/admin/invoice-settings/numbering/history": "Numbering Settings History",
  "/dashboard/invoicing/admin/invoice-settings/email": "Invoice Settings",
  "/dashboard/invoicing/admin/invoice-settings/payments": "Invoice Settings",
  "/dashboard/invoicing/admin/reminder-settings": "Reminder Settings",
  "/dashboard/invoicing/admin/integrations/whatsapp": "WhatsApp Integration",
  "/dashboard/invoicing/admin/template-preview": "Template Preview",
  "/dashboard/invoicing/admin/subscription-settings": "Subscription Settings",
  "/dashboard/invoicing/admin/subscription-settings/plans": "Plans & Pricing",
  "/dashboard/invoicing/admin/subscription-settings/billing-rules": "Billing Rules",
  "/dashboard/invoicing/admin/subscription-settings/automation": "Automation Settings",
  "/dashboard/invoicing/admin/audit-logs": "Audit Logs",
  "/dashboard/invoicing/admin/reports": "Reports"
};

export default function AdminInvoicingDashboard() {
  const session = getStoredSession();
  const location = useLocation();
  const normalizedPath = location.pathname.startsWith("/admin")
    ? `/dashboard/invoicing/admin${location.pathname.slice("/admin".length)}`
    : location.pathname;
  const removedAdminAccessPath =
    normalizedPath.startsWith("/dashboard/invoicing/admin/users") ||
    normalizedPath.startsWith("/dashboard/invoicing/admin/roles") ||
    normalizedPath.startsWith("/dashboard/invoicing/admin/vaniday-mapping");
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
  const invoiceSettingsMatch = normalizedPath.match(
    /^\/dashboard\/invoicing\/admin\/invoice-settings(?:\/([a-z-]+))?$/
  );
  const isGstManagement = normalizedPath === "/dashboard/invoicing/admin/gst-management";
  const isInvoiceSettings = Boolean(invoiceSettingsMatch) && !isGstManagement;
  const isReminderSettings = normalizedPath === "/dashboard/invoicing/admin/reminder-settings";
  const isWhatsAppSettings = normalizedPath === "/dashboard/invoicing/admin/integrations/whatsapp";
  const isTemplatePreview = normalizedPath === "/dashboard/invoicing/admin/template-preview";
  const subscriptionSettingsMatch = normalizedPath.match(
    /^\/dashboard\/invoicing\/admin\/subscription-settings(?:\/(plans|billing-rules|automation))?$/
  );
  const isSubscriptionSettings = Boolean(subscriptionSettingsMatch);
  const isAuditLogs = normalizedPath === "/dashboard/invoicing/admin/audit-logs";
  const isInvoicePerformance = normalizedPath === "/dashboard/invoicing/admin/dashboard/invoice-performance";
  const isInvoiceList = normalizedPath === "/dashboard/invoicing/admin/invoices";
  const isPaymentReminderSummary = normalizedPath === "/dashboard/invoicing/admin/dashboard/payment-reminder-summary";
  const isValidationSummary = normalizedPath === "/dashboard/invoicing/admin/dashboard/validation-summary";
  const isReports = normalizedPath === "/dashboard/invoicing/admin/reports";
  const currentPageTitle = isInvoicePerformance
      ? "Automated Invoicing System - Invoice Performance"
    : isPaymentReminderSummary
      ? "Automated Invoicing System - Payment & Reminder Summary"
    : isValidationSummary
      ? "Automated Invoicing System - Validation Summary"
      : isGstManagement
      ? "Automated Invoicing System - GST Management"
      : isInvoiceSettings
      ? "Automated Invoicing System - Invoice Settings"
    : isSubscriptionSettings
      ? "Automated Invoicing System - Subscription Settings"
    : isReminderSettings
      ? "Automated Invoicing System - Reminder Settings"
    : isWhatsAppSettings
      ? "Automated Invoicing System - WhatsApp Settings"
    : isReports
      ? "Automated Invoicing System - Reports"
      : isAuditLogs
        ? "Automated Invoicing System - Audit Logs"
      : pageTitle;

  if (removedAdminAccessPath) {
    return <Navigate to="/dashboard/invoicing/admin" replace />;
  }

  return (
    <DashboardLayout
      pageTitle={currentPageTitle}
      user={session?.user}
      sidebarSections={invoicingSidebarSections}
      sidebarTitle="Automated Invoicing & Payroll System"
      homePath="/dashboard/invoicing/admin"
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
      ) : isGstManagement ? (
        <AdminGstManagementPage />
      ) : isInvoiceSettings ? (
        <AdminInvoiceSettingsPage activeTab={invoiceSettingsMatch?.[1] || "general"} />
      ) : isSubscriptionSettings ? (
        <AdminSubscriptionSettingsPage activeSection={subscriptionSettingsMatch?.[1] || "plans"} />
      ) : isReminderSettings ? (
        <AdminReminderSettingsPage />
      ) : isWhatsAppSettings ? (
        <AdminWhatsAppIntegrationPage />
      ) : isTemplatePreview ? (
        <AdminTemplatePreviewPage />
      ) : isAuditLogs ? (
        <AdminAuditLogsPage />
      ) : isReports ? (
        <AdminReportsPage />
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
