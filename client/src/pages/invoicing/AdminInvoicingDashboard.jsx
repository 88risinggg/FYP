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
import AdminRoleActionPage from "./AdminRoleActionPage.jsx";
import AdminRolesPermissionsPage from "./AdminRolesPermissionsPage.jsx";
import AdminReminderSettingsPage from "./AdminReminderSettingsPage.jsx";
import AdminUserManagementPage from "./AdminUserManagementPage.jsx";
import AdminUserProfilePage from "./AdminUserProfilePage.jsx";

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
  "/dashboard/invoicing/admin/invoice-settings/general": "Invoice Settings",
  "/dashboard/invoicing/admin/invoice-settings/numbering": "Invoice Settings",
  "/dashboard/invoicing/admin/invoice-settings/template": "Invoice Settings",
  "/dashboard/invoicing/admin/invoice-settings/email": "Invoice Settings",
  "/dashboard/invoicing/admin/invoice-settings/reminders": "Invoice Settings",
  "/dashboard/invoicing/admin/invoice-settings/payments": "Invoice Settings",
  "/dashboard/invoicing/admin/invoice-settings/bulk-upload": "Invoice Settings",
  "/dashboard/invoicing/admin/invoice-settings/automation": "Invoice Settings",
  "/dashboard/invoicing/admin/reminder-settings": "Reminder Settings",
  "/dashboard/invoicing/admin/audit-logs": "Audit Logs",
  "/dashboard/invoicing/admin/reports": "Reports"
};

export default function AdminInvoicingDashboard() {
  const session = getStoredSession();
  const location = useLocation();
  const normalizedPath = location.pathname.startsWith("/admin")
    ? `/dashboard/invoicing/admin${location.pathname.slice("/admin".length)}`
    : location.pathname;
  const heading = routeHeadings[normalizedPath] || "Dashboard";
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
  const isAuditLogs = normalizedPath === "/dashboard/invoicing/admin/audit-logs";
  const currentPageTitle = isUserManagement || userProfileMatch
    ? "Automated Invoicing System - User Management"
    : isRolesManagement || roleCreateMatch || roleActionMatch
      ? "Automated Invoicing System - Roles & Permissions"
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
      {normalizedPath === "/dashboard/invoicing/admin" ? (
        <AdminDashboardHomePage />
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
