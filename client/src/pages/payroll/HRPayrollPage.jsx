import {
  Bell,
  ClipboardList,
  FileText,
  LayoutDashboard,
  Upload,
  Users
} from "lucide-react";
import { useLocation } from "react-router-dom";

import DashboardLayout from "../../components/layout/DashboardLayout.jsx";
import { getStoredSession } from "../../services/sessionService.js";

const pageTitle = "Automated Payroll System – HR Payroll Upload & Payslip Generation";

const payrollSidebarSections = [
  {
    label: "HR",
    items: [
      {
        label: "Dashboard",
        icon: LayoutDashboard,
        path: "/dashboard/payroll/hr",
        end: true
      },
      {
        label: "Staff Records",
        icon: Users,
        path: "/dashboard/payroll/hr/staff-records"
      },
      {
        label: "Payroll Upload",
        icon: Upload,
        path: "/dashboard/payroll/hr/payroll-upload"
      },
      {
        label: "Payroll Runs",
        icon: ClipboardList,
        path: "/dashboard/payroll/hr/payroll-runs"
      },
      {
        label: "Payslips",
        icon: FileText,
        path: "/dashboard/payroll/hr/payslips"
      },
      {
        label: "Notifications",
        icon: Bell,
        path: "/dashboard/payroll/hr/notifications"
      }
    ]
  }
];

const routeHeadings = {
  "/dashboard/payroll/hr": "Dashboard",
  "/dashboard/payroll/hr/staff-records": "Staff Records",
  "/dashboard/payroll/hr/payroll-upload": "Payroll Upload",
  "/dashboard/payroll/hr/payroll-runs": "Payroll Runs",
  "/dashboard/payroll/hr/payslips": "Payslips",
  "/dashboard/payroll/hr/notifications": "Notifications"
};

export default function HRPayrollPage() {
  const session = getStoredSession();
  const location = useLocation();
  const heading = routeHeadings[location.pathname] || "Dashboard";

  return (
    <DashboardLayout
      pageTitle={pageTitle}
      user={session?.user}
      sidebarSections={payrollSidebarSections}
      sidebarTitle="Automated Invoicing & Payroll System"
      searchPlaceholder="Search staff, payroll runs, payslips..."
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
