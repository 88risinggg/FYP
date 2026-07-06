import {
  Bell,
  FileText,
  LayoutDashboard,
  UserCog,
  Wallet
} from "lucide-react";
import { useLocation } from "react-router-dom";

import DashboardLayout from "../../components/layout/DashboardLayout.jsx";
import { getStoredSession } from "../../services/sessionService.js";

const pageTitle = "Automated Payroll System – Staff Payroll Portal";

const payrollSidebarSections = [
  {
    label: "MAIN",
    items: [
      {
        label: "Dashboard",
        icon: LayoutDashboard,
        path: "/dashboard/payroll/staff",
        end: true
      },
      {
        label: "Payslips",
        icon: FileText,
        path: "/dashboard/payroll/staff/payslips"
      },
      {
        label: "Payroll Info",
        icon: Wallet,
        path: "/dashboard/payroll/staff/payroll-info"
      },
      {
        label: "Profile",
        icon: UserCog,
        path: "/dashboard/payroll/staff/profile"
      },
      {
        label: "Notifications",
        icon: Bell,
        path: "/dashboard/payroll/staff/notifications"
      }
    ]
  }
];

const routeHeadings = {
  "/dashboard/payroll/staff": "Dashboard",
  "/dashboard/payroll/staff/payslips": "Payslips",
  "/dashboard/payroll/staff/payroll-info": "Payroll Info",
  "/dashboard/payroll/staff/profile": "Profile",
  "/dashboard/payroll/staff/notifications": "Notifications"
};

export default function StaffPayrollPage() {
  const session = getStoredSession();
  const location = useLocation();
  const heading = routeHeadings[location.pathname] || "Dashboard";

  return (
    <DashboardLayout
      pageTitle={pageTitle}
      user={session?.user}
      sidebarSections={payrollSidebarSections}
      sidebarTitle="Automated Payroll System"
      searchPlaceholder="Search payslips, payroll info..."
    >
      <section>
        <h2 className="text-2xl font-semibold text-white">{heading}</h2>
        <div className="neon-glass neon-border mt-6 min-h-[calc(100vh-12rem)] rounded-2xl border-dashed p-8">
          <p className="text-sm text-[#d8c6e8]">
            This page is reserved for module development.
          </p>
        </div>
      </section>
    </DashboardLayout>
  );
}
