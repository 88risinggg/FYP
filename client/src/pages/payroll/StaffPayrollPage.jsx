import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  Download,
  FileText,
  LayoutDashboard,
  UserCog,
  Wallet
} from "lucide-react";
import { useLocation } from "react-router-dom";

import DashboardLayout from "../../components/layout/DashboardLayout.jsx";
import { apiRequest, downloadPdfLines } from "../../services/apiClient.js";
import { getStoredSession } from "../../services/sessionService.js";
import StaffProfile from "./StaffProfile.jsx";

const pageTitle = "Automated Payroll System – Staff Payroll Portal";

const payrollSidebarSections = [
  {
    label: "MAIN",
    items: [
      { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard/payroll/staff", end: true },
      { label: "Payslips", icon: FileText, path: "/dashboard/payroll/staff/payslips" },
      { label: "Payroll Info", icon: Wallet, path: "/dashboard/payroll/staff/payroll-info" },
      { label: "Profile", icon: UserCog, path: "/dashboard/payroll/staff/profile" },
      { label: "Notifications", icon: Bell, path: "/dashboard/payroll/staff/notifications" }
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

const fallbackPayslips = [
  { id: "SLIP-2026-05", month: "May 2026", netPay: 3200, status: "Available", period: "01 May 2026 - 31 May 2026" },
  { id: "SLIP-2026-04", month: "Apr 2026", netPay: 3195, status: "Available", period: "01 Apr 2026 - 30 Apr 2026" }
];

export default function StaffPayrollPage() {
  const session = getStoredSession();
  const location = useLocation();
  const heading = routeHeadings[location.pathname] || "Dashboard";
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      try {
        const data = await apiRequest(`/api/profile/${session?.user?.userId}`, {
          headers: {
            Authorization: `Bearer ${session?.token}`
          }
        });

        if (mounted) {
          setProfile(data);
        }
      } catch (error) {
        console.error(error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    if (session?.user?.userId && session?.token) {
      loadProfile();
    } else {
      setLoading(false);
    }

    return () => {
      mounted = false;
    };
  }, [session?.token, session?.user?.userId]);

  const payrollSummary = useMemo(() => {
    const salary = Number(profile?.salary || 0);
    return {
      salary,
      department: profile?.department || "Unassigned",
      dob: profile?.date_of_birth || "Not set",
      ssn: profile?.ssn || "Not set"
    };
  }, [profile]);

  function downloadPayslip(payslip) {
    downloadPdfLines(
      [
        `Employee: ${profile?.name || session?.user?.name || "Staff"}`,
        `Email: ${profile?.email || session?.user?.email || ""}`,
        `Month: ${payslip.month}`,
        `Period: ${payslip.period}`,
        `Department: ${payrollSummary.department}`,
        `Salary: $${payrollSummary.salary.toFixed(2)}`,
        `Net Pay: $${payslip.netPay.toFixed(2)}`,
        `Status: ${payslip.status}`,
        "",
        "View only: this payslip is not editable."
      ],
      `${payslip.id}.pdf`,
      "Staff Payslip"
    );
  }

  return (
    <DashboardLayout
      pageTitle={pageTitle}
      user={session?.user}
      sidebarSections={payrollSidebarSections}
      sidebarTitle="Automated Payroll System"
      searchPlaceholder="Search payslips, payroll info..."
      profilePath="/dashboard/payroll/staff/profile"
      notificationsPath="/dashboard/payroll/staff/notifications"
    >
      <section>
        <h2 className="text-2xl font-semibold text-white">{heading}</h2>

        <div className="neon-glass neon-border mt-6 min-h-[calc(100vh-12rem)] rounded-2xl p-6">
          {loading ? (
            <p className="text-sm text-[#d8c6e8]">Loading staff payroll data...</p>
          ) : (
            <div className="space-y-6">
              {(heading === "Dashboard" || heading === "Payroll Info") && (
                <div className="grid gap-4 md:grid-cols-3">
                  <StatCard label="Base Salary" value={`$${payrollSummary.salary.toFixed(2)}`} />
                  <StatCard label="Department" value={payrollSummary.department} />
                  <StatCard label="Date of Birth" value={payrollSummary.dob} />
                </div>
              )}

              {heading === "Dashboard" && (
                <div className="grid gap-4 lg:grid-cols-2">
                  <Panel title="Latest Payslip">
                    <p className="text-sm text-[#d8c6e8]">{fallbackPayslips[0].month} payslip is available for view only and PDF download.</p>
                    <button
                      type="button"
                      onClick={() => downloadPayslip(fallbackPayslips[0])}
                      className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#7B2FF7] px-4 py-2 text-sm font-semibold text-white"
                    >
                      <Download size={16} />
                      Download Latest Payslip
                    </button>
                  </Panel>

                  <Panel title="Employment Snapshot">
                    <div className="space-y-2 text-sm text-[#d8c6e8]">
                      <p><span className="text-white">Name:</span> {profile?.name || session?.user?.name || "Staff"}</p>
                      <p><span className="text-white">Email:</span> {profile?.email || session?.user?.email || "-"}</p>
                      <p><span className="text-white">SSN:</span> {payrollSummary.ssn}</p>
                    </div>
                  </Panel>
                </div>
              )}

              {heading === "Payslips" && (
                <div className="space-y-3">
                  {fallbackPayslips.map((payslip) => (
                    <div key={payslip.id} className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-semibold text-white">{payslip.month}</p>
                        <p className="text-sm text-[#d8c6e8]">Net pay ${payslip.netPay.toFixed(2)} • {payslip.status} • view only</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => downloadPayslip(payslip)}
                        className="inline-flex items-center gap-2 rounded-lg border border-[#C77DFF]/30 bg-white/10 px-4 py-2 text-sm font-semibold text-white"
                      >
                        <Download size={16} />
                        Download
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {heading === "Payroll Info" && (
                <Panel title="Payroll Details">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <InfoRow label="Salary" value={`$${payrollSummary.salary.toFixed(2)}`} />
                    <InfoRow label="Department" value={payrollSummary.department} />
                    <InfoRow label="Date of Birth" value={payrollSummary.dob} />
                    <InfoRow label="SSN" value={payrollSummary.ssn} />
                  </div>
                </Panel>
              )}

              {heading === "Profile" && <StaffProfile />}

              {heading === "Notifications" && (
                <div className="space-y-3">
                  {[
                    "Your May 2026 payslip is available.",
                    "Profile details can now be updated here.",
                    "Contact HR if your salary or department is incorrect."
                  ].map((note) => (
                    <div key={note} className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-[#d8c6e8]">
                      {note}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </DashboardLayout>
  );
}

function Panel({ title, children }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5">
      <h3 className="mb-3 text-lg font-semibold text-white">{title}</h3>
      {children}
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs uppercase tracking-wide text-[#d8c6e8]">{label}</p>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/10 px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-[#d8c6e8]">{label}</p>
      <p className="mt-1 text-sm font-medium text-white">{value}</p>
    </div>
  );
}
