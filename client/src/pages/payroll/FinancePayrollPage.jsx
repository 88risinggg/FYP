import {
  Bell,
  ClipboardList,
  FileBarChart,
  LayoutDashboard,
  ListChecks,
  Users
} from "lucide-react";
import { useLocation } from "react-router-dom";

import DashboardLayout from "../../components/layout/DashboardLayout.jsx";
import { getStoredSession } from "../../services/sessionService.js";

const pageTitle = "Automated Payroll System – Finance Payroll Dashboard";

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

export default function FinancePayrollPage() {
  const session = getStoredSession();
  const location = useLocation();
  const heading = routeHeadings[location.pathname] || "Dashboard";

  return (
    <DashboardLayout
      pageTitle={pageTitle}
      user={session?.user}
      sidebarSections={payrollSidebarSections}
      sidebarTitle="Automated Invoicing & Payroll System"
      searchPlaceholder="Search payroll runs, staff, reports..."
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
