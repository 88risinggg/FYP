import {
  FileBarChart,
  History,
  LayoutDashboard,
  Settings,
  UserCog,
  Users
} from "lucide-react";
import { useLocation } from "react-router-dom";

import DashboardLayout from "../../components/layout/DashboardLayout.jsx";
import { getStoredSession } from "../../services/sessionService.js";

const pageTitle = "Automated Payroll System – Admin Dashboard";

const payrollSidebarSections = [
  {
    label: "MAIN",
    items: [
      {
        label: "Dashboard",
        icon: LayoutDashboard,
        path: "/dashboard/payroll/admin",
        end: true
      },
      {
        label: "Users & Roles",
        icon: Users,
        path: "/dashboard/payroll/admin/users-roles"
      },
      {
        label: "Payroll Settings",
        icon: Settings,
        path: "/dashboard/payroll/admin/settings"
      },
      {
        label: "Pending Payroll Runs",
        icon: UserCog,
        path: "/dashboard/payroll/admin/pending-runs"
      },
      {
        label: "Audit Logs",
        icon: History,
        path: "/dashboard/payroll/admin/audit-logs"
      },
      {
        label: "Reports",
        icon: FileBarChart,
        path: "/dashboard/payroll/admin/reports"
      }
    ]
  }
];

const routeHeadings = {
  "/dashboard/payroll/admin": "Dashboard",
  "/dashboard/payroll/admin/users-roles": "Users & Roles",
  "/dashboard/payroll/admin/settings": "Payroll Settings",
  "/dashboard/payroll/admin/pending-runs": "Pending Payroll Runs",
  "/dashboard/payroll/admin/audit-logs": "Audit Logs",
  "/dashboard/payroll/admin/reports": "Reports"
};

export default function AdminPayrollPage() {
  const session = getStoredSession();
  const location = useLocation();
  const heading = routeHeadings[location.pathname] || "Dashboard";

  return (
    <DashboardLayout
      pageTitle={pageTitle}
      user={session?.user}
      sidebarSections={payrollSidebarSections}
      sidebarTitle="Automated Payroll System"
      searchPlaceholder="Search payroll runs, employees, settings..."
    >
      <section>
        <h2 className="text-2xl font-semibold text-slate-950">{heading}</h2>
        <div className="mt-6 min-h-[calc(100vh-12rem)] rounded-xl border border-dashed border-slate-300 bg-white p-8 shadow-sm">
          <p className="text-sm text-slate-500">
            This page is reserved for module development.
          </p>
        </div>
      </section>
    </DashboardLayout>
  );
}
