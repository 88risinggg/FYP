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
import AdminInvoiceSettingsPage from "./AdminInvoiceSettingsPage.jsx";
import AdminReminderSettingsPage from "./AdminReminderSettingsPage.jsx";
import AdminUserManagementPage from "./AdminUserManagementPage.jsx";

const pageTitle = "Automated Invoicing System - Admin Dashboard";

const invoicingSidebarSections = [
  {
    label: "MAIN",
    items: [
      {
        label: "Dashboard",
        icon: LayoutDashboard,
        path: "/dashboard/invoicing/admin",
        end: true
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
        path: "/dashboard/invoicing/admin/invoice-settings"
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
  "/dashboard/invoicing/admin/users": "Users",
  "/dashboard/invoicing/admin/roles": "Roles",
  "/dashboard/invoicing/admin/invoice-settings": "Invoice Settings",
  "/dashboard/invoicing/admin/reminder-settings": "Reminder Settings",
  "/dashboard/invoicing/admin/audit-logs": "Audit Logs",
  "/dashboard/invoicing/admin/reports": "Reports"
};

export default function AdminInvoicingDashboard() {
  const session = getStoredSession();
  const location = useLocation();
  const heading = routeHeadings[location.pathname] || "Dashboard";
  const isUserManagement = location.pathname === "/dashboard/invoicing/admin/users";
  const isInvoiceSettings = location.pathname === "/dashboard/invoicing/admin/invoice-settings";
  const isReminderSettings = location.pathname === "/dashboard/invoicing/admin/reminder-settings";
  const isAuditLogs = location.pathname === "/dashboard/invoicing/admin/audit-logs";
  const currentPageTitle = isUserManagement
    ? "Automated Invoicing System - User Management"
    : isInvoiceSettings
      ? "Automated Invoicing System - Invoice Settings"
    : isReminderSettings
      ? "Automated Invoicing System - Reminder Settings"
      : isAuditLogs
        ? "Automated Invoicing System - Audit Logs"
      : pageTitle;

  return (
    <DashboardLayout
      pageTitle={currentPageTitle}
      user={session?.user}
      sidebarSections={invoicingSidebarSections}
      sidebarTitle="Automated Invoicing & Payroll System"
      searchPlaceholder="Search invoices, users, settings..."
    >
      {location.pathname === "/dashboard/invoicing/admin" ? (
        <AdminDashboardHomePage />
      ) : isUserManagement ? (
        <AdminUserManagementPage />
      ) : isInvoiceSettings ? (
        <AdminInvoiceSettingsPage />
      ) : isReminderSettings ? (
        <AdminReminderSettingsPage />
      ) : isAuditLogs ? (
        <AdminAuditLogsPage />
      ) : (
        <section>
          <h2 className="text-2xl font-semibold text-white">{heading}</h2>
          <div className="neon-glass neon-border mt-6 min-h-[calc(100vh-12rem)] rounded-2xl border-dashed p-8">
            <p className="text-sm text-[#d8c6e8]">
              This page is reserved for module development.
            </p>
          </div>
        </section>
      )}
    </DashboardLayout>
  );
}
