import { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  Bell,
  Briefcase,
  CalendarDays,
  DollarSign,
  Download,
  FileText,
  HandCoins,
  LayoutDashboard,
  Printer,
  TrendingUp,
  UserCog,
  Wallet
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import DashboardLayout from "../../components/layout/DashboardLayout.jsx";
import { apiRequest } from "../../services/apiClient.js";
import { getStoredSession, clearSession } from "../../services/sessionService.js";
import { buildVanidayPayslipHtml } from "../../utils/vanidayPayslipTemplate.js";
import StaffProfile from "./StaffProfile.jsx";
import StaffLeaveView from "./StaffLeaveView.jsx";
import StaffLoanPage from "./StaffLoanPage.jsx";
import StaffClaimsPage from "./StaffClaimsPage.jsx";

const pageTitle = "PayNivo - My Payroll";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

const payrollSidebarSections = [
  {
    label: "MAIN",
    items: [
      { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard/payroll/staff", end: true }
    ]
  },
  {
    label: "PAY",
    items: [
      { label: "Payslips", icon: FileText, path: "/dashboard/payroll/staff/payslips" },
      { label: "Payroll Info", icon: Wallet, path: "/dashboard/payroll/staff/payroll-info" },
      { label: "Advance Payment", icon: DollarSign, path: "/dashboard/payroll/staff/advance-payment" },
      { label: "Claims", icon: Briefcase, path: "/dashboard/payroll/staff/claims" },
      { label: "Loans", icon: HandCoins, path: "/dashboard/payroll/staff/loans" }
    ]
  },
  {
    label: "LEAVE",
    items: [
      { label: "Leave", icon: CalendarDays, path: "/dashboard/payroll/staff/leave" }
    ]
  },
  {
    label: "ACCOUNT",
    items: [
      { label: "Profile", icon: UserCog, path: "/dashboard/payroll/staff/profile" },
      { label: "Notifications", icon: Bell, path: "/dashboard/payroll/staff/notifications" }
    ]
  }
];

function getAuthHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const SkeletonBar = ({ width = "100%", height = "h-4" }) => (
  <div className={`${height} rounded-lg bg-white/80 animate-pulse`} style={{ width }} />
);

export default function StaffPayrollPage() {
  const session = getStoredSession();
  const location = useLocation();
  const headingMap = {
    "/dashboard/payroll/staff/payslips": "Payslips",
    "/dashboard/payroll/staff/payroll-info": "Payroll Info",
    "/dashboard/payroll/staff/advance-payment": "Advance Payment",
    "/dashboard/payroll/staff/claims": "Claims",
    "/dashboard/payroll/staff/loans": "Loans",
    "/dashboard/payroll/staff/leave": "Leave",
    "/dashboard/payroll/staff/profile": "Profile",
    "/dashboard/payroll/staff/notifications": "Notifications"
  };
  const heading = headingMap[location.pathname] || "Dashboard";

  const [profile, setProfile] = useState(null);
  const [payslips, setPayslips] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState(null);
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);

  // Inactivity session timeout
  const warningTimerRef = useRef(null);
  const logoutTimerRef = useRef(null);
  const lastActivityRef = useRef(Date.now());

  useEffect(() => {
    const WARN_MS = 13 * 60 * 1000;   // 13 minutes
    const LOGOUT_MS = 15 * 60 * 1000;  // 15 minutes

    function performLogout() {
      clearSession();
      window.location.replace("/login?reason=inactivity");
    }

    function resetTimers() {
      lastActivityRef.current = Date.now();
      setShowTimeoutWarning(false);
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
      warningTimerRef.current = setTimeout(() => setShowTimeoutWarning(true), WARN_MS);
      logoutTimerRef.current = setTimeout(performLogout, LOGOUT_MS);
    }

    // Throttled activity handler (max once per second)
    let throttled = false;
    function onActivity() {
      if (throttled) return;
      throttled = true;
      resetTimers();
      setTimeout(() => { throttled = false; }, 1000);
    }

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach(evt => window.addEventListener(evt, onActivity));
    resetTimers();

    return () => {
      events.forEach(evt => window.removeEventListener(evt, onActivity));
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const userId = session?.user?.userId;
    const token = session?.token;

    if (!userId || !token) {
      setLoading(false);
      return;
    }

    const headers = { Authorization: `Bearer ${token}` };

    async function loadAll() {
      try {
        setError(null);
        const [profileData, payslipData, summaryData, unreadData] = await Promise.all([
          apiRequest(`/api/profile/${userId}`, { headers }),
          apiRequest(`/api/payslips/user/${userId}`, { headers }).catch(() => []),
          apiRequest(`/api/payslips/user/${userId}/summary`, { headers }).catch(() => null),
          apiRequest(`/api/notifications/user/${userId}`, { headers }).catch(() => [])
        ]);

        if (mounted) {
          setProfile(profileData);
          setPayslips(payslipData);
          setSummary(summaryData);
          // Count unread notifications from the notification table
          const unread = Array.isArray(unreadData) ? unreadData.filter(n => !n.is_read).length : 0;
          setUnreadCount(unread);
        }
      } catch (err) {
        console.error(err);
        if (mounted) setError("Failed to load payroll data. Please try again.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadAll();
    return () => { mounted = false; };
  }, [session?.token, session?.user?.userId]);

  const payrollInfo = useMemo(() => {
    const salary = Number(profile?.salary || 0);
    return {
      salary,
      department: profile?.department || "Unassigned",
      dob: profile?.date_of_birth ? new Date(profile.date_of_birth).toLocaleDateString() : "Not set",
      hireDate: profile?.hire_date ? new Date(profile.hire_date).toLocaleDateString() : "Not set",
      phone: profile?.phone || "Not set",
      address: profile?.address || "Not set",
      bank: profile?.bank || "Not set",
      accountNo: profile?.account_no || "Not set",
      employeeCode: profile?.employee_code || "-"
    };
  }, [profile]);

  function formatCurrency(value) {
    return `$${Number(value || 0).toFixed(2)}`;
  }

  function getMonthLabel(month, year) {
    if (!month || !year) return "—";
    return new Date(year, month - 1, 1).toLocaleDateString("en-SG", { month: "long", year: "numeric" });
  }

  async function downloadPayslip(payslip) {
    const id = payslip.payslip_id || payslip.payroll_id;
    if (!id) return;
    try {
      const session = getStoredSession();
      const token = session?.token;
      const url = `${import.meta.env.VITE_API_BASE_URL || ""}/api/payslips/${id}/pdf`;
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        console.error("PDF download failed:", body.message || res.status);
        return;
      }
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `payslip-${payslip.period_month || ""}-${payslip.period_year || ""}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      console.error("PDF download error:", err);
    }
  }

  function printStaffPayslip(payslip) {
    const html = buildVanidayPayslipHtml(payslip);
    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
    w.close();
  }

  return (
    <DashboardLayout
      moduleClassName="payroll-module"
      pageTitle={pageTitle}
      user={session?.user}
      sidebarSections={payrollSidebarSections}
      sidebarTitle="Automated Payroll System"
      searchPlaceholder="Search payslips, payroll info..."
      profilePath="/dashboard/payroll/staff/profile"
      notificationsPath="/dashboard/payroll/staff/notifications"
      notificationBadgeCount={unreadCount}
    >
      <section>
        <h2 className="text-2xl font-semibold text-[#251E1F]">{heading}</h2>

        <div className="app-panel mt-6 max-h-[calc(100vh-12rem)] overflow-y-auto rounded-2xl p-6">
          {error ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="rounded-xl border border-red-400/20 bg-red-400/5 px-6 py-5">
                <p className="text-sm text-red-700">{error}</p>
                <button
                  type="button"
                  onClick={() => { setLoading(true); setError(null); window.location.reload(); }}
                  className="mt-3 rounded-lg bg-red-500/20 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-500/30"
                >
                  Try Again
                </button>
              </div>
            </div>
          ) : loading ? (
            <div className="space-y-6">
              {/* Skeleton: stat cards */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[1,2,3,4].map(i => (
                  <div key={i} className="rounded-xl border border-[#f0d2ca] bg-white/80 p-4 space-y-3">
                    <SkeletonBar width="60%" height="h-3" />
                    <SkeletonBar width="80%" height="h-6" />
                  </div>
                ))}
              </div>
              {/* Skeleton: panels */}
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-[#f0d2ca] bg-white/80 p-5 space-y-3">
                  <SkeletonBar width="40%" height="h-4" />
                  <SkeletonBar width="100%" height="h-3" />
                  <SkeletonBar width="70%" height="h-3" />
                  <SkeletonBar width="30%" height="h-8" />
                </div>
                <div className="rounded-xl border border-[#f0d2ca] bg-white/80 p-5 space-y-3">
                  <SkeletonBar width="40%" height="h-4" />
                  <div className="grid grid-cols-2 gap-3">
                    <SkeletonBar height="h-10" />
                    <SkeletonBar height="h-10" />
                    <SkeletonBar height="h-10" />
                    <SkeletonBar height="h-10" />
                  </div>
                </div>
              </div>
              {/* Skeleton: recent payslips */}
              <div className="rounded-xl border border-[#f0d2ca] bg-white/80 p-5 space-y-3">
                <SkeletonBar width="30%" height="h-4" />
                {[1,2,3].map(i => <SkeletonBar key={i} height="h-12" />)}
              </div>
            </div>
          ) : (
            <div className="space-y-6">

              {heading === "Dashboard" && (
                <DashboardView
                  profile={profile}
                  session={session}
                  payrollInfo={payrollInfo}
                  summary={summary}
                  payslips={payslips}
                  formatCurrency={formatCurrency}
                  downloadPayslip={downloadPayslip}
                  getMonthLabel={getMonthLabel}
                />
              )}

              {heading === "Payslips" && (
                <PayslipsView
                  payslips={payslips}
                  formatCurrency={formatCurrency}
                  getMonthLabel={getMonthLabel}
                  downloadPayslip={downloadPayslip}
                  printStaffPayslip={printStaffPayslip}
                  setUnreadCount={setUnreadCount}
                  session={session}
                />
              )}

              {heading === "Payroll Info" && (
                <PayrollInfoView payrollInfo={payrollInfo} formatCurrency={formatCurrency} />
              )}

              {heading === "Advance Payment" && (
                <AdvancePaymentView session={session} payrollInfo={payrollInfo} profile={profile} formatCurrency={formatCurrency} />
              )}

              {heading === "Claims" && <StaffClaimsPage />}

              {heading === "Profile" && <StaffProfile onProfileSaved={() => setUnreadCount(prev => prev + 1)} />}

              {heading === "Notifications" && (
                <NotificationsView payslips={payslips} getMonthLabel={getMonthLabel} />
              )}

              {heading === "Leave" && (
                <StaffLeaveView />
              )}

              {heading === "Loans" && (
                <StaffLoanPage embedded />
              )}
            </div>
          )}
        </div>
      </section>

      {/* Inactivity warning modal */}
      {showTimeoutWarning && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#251E1F]/60 backdrop-blur-sm">
          <div className="rounded-2xl border border-amber-400/30 bg-[#fff3ee] p-6 shadow-2xl w-full max-w-sm mx-4">
            <p className="text-lg font-semibold text-[#251E1F]">Session Expiring</p>
            <p className="mt-2 text-sm text-[#7b6660]">
              Your session will expire in 2 minutes due to inactivity.
            </p>
            <button
              type="button"
              onClick={() => {
                setShowTimeoutWarning(false);
                // Trigger a synthetic activity event to reset timers
                window.dispatchEvent(new Event('mousemove'));
              }}
              className="mt-4 w-full rounded-lg bg-[#F38978] px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110"
            >
              Stay Logged In
            </button>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

/* ─── Dashboard ─── */
function DashboardView({ profile, session, payrollInfo, summary, payslips, formatCurrency, downloadPayslip, getMonthLabel }) {
  const navigate = useNavigate();
  const ytd = summary?.ytd;
  const latest = summary?.latest;

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="rounded-xl border border-[#f0d2ca] bg-gradient-to-r from-[#F38978]/10 to-[#F38978]/10 p-5">
        <p className="text-lg font-semibold text-[#251E1F]">
          Welcome back, {profile?.name || session?.user?.name || "Staff"}
        </p>
        <p className="mt-1 text-sm text-[#7b6660]">
          {payrollInfo.department} • {payrollInfo.employeeCode}
        </p>
      </div>

      {/* Key stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={DollarSign} label="Base Salary" value={formatCurrency(payrollInfo.salary)} accent="text-emerald-400" />
        <StatCard icon={TrendingUp} label="Year-To-Date Net Pay" value={formatCurrency(ytd?.ytd_net_pay)} accent="text-[#2D7C83]" />
        <StatCard icon={FileText} label="Payslips This Year" value={ytd?.total_payslips ?? 0} accent="text-[#F38978]" />
        <StatCard icon={Briefcase} label="Hire Date" value={payrollInfo.hireDate} accent="text-amber-400" />
      </div>

      {/* Quick Actions */}
      <div className="grid gap-3 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => navigate("/dashboard/payroll/staff/payslips")}
          className="flex items-center gap-3 rounded-xl border border-[#f0d2ca] bg-white/80 p-4 text-left transition hover:bg-[#FDD9CD]/45"
        >
          <FileText size={20} className="text-[#F38978]" />
          <div>
            <p className="text-sm font-medium text-[#251E1F]">View Payslips</p>
            <p className="text-xs text-[#7b6660]/60">Download your pay history</p>
          </div>
        </button>
        <button
          type="button"
          onClick={() => navigate("/dashboard/payroll/staff/advance-payment")}
          className="flex items-center gap-3 rounded-xl border border-[#f0d2ca] bg-white/80 p-4 text-left transition hover:bg-[#FDD9CD]/45"
        >
          <DollarSign size={20} className="text-emerald-400" />
          <div>
            <p className="text-sm font-medium text-[#251E1F]">Request Advance</p>
            <p className="text-xs text-[#7b6660]/60">Apply for salary advance</p>
          </div>
        </button>
        <button
          type="button"
          onClick={() => navigate("/dashboard/payroll/staff/profile")}
          className="flex items-center gap-3 rounded-xl border border-[#f0d2ca] bg-white/80 p-4 text-left transition hover:bg-[#FDD9CD]/45"
        >
          <UserCog size={20} className="text-amber-400" />
          <div>
            <p className="text-sm font-medium text-[#251E1F]">Edit Profile</p>
            <p className="text-xs text-[#7b6660]/60">Update personal & bank details</p>
          </div>
        </button>
      </div>

      {/* Latest payslip + Year-To-Date Breakdown */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Latest Payslip">
          {latest ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#7b6660]">{getMonthLabel(latest.payroll_month, latest.payroll_year)}</span>
                <StatusBadge status={latest.run_status} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <MiniStat label="Base Salary" value={formatCurrency(latest.base_salary)} />
                <MiniStat label="Allowances" value={`+${formatCurrency(latest.total_allowances)}`} />
                <MiniStat label="Deductions" value={`-${formatCurrency(latest.total_deductions)}`} />
                <MiniStat label="Net Pay" value={formatCurrency(latest.net_salary)} highlight />
              </div>
              {latest.file_path ? (
                <button
                  type="button"
                  onClick={() => downloadPayslip(latest)}
                  className="mt-2 inline-flex items-center gap-2 rounded-lg bg-[#F38978] px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
                >
                  <Download size={16} />
                  Download PDF
                </button>
              ) : (
                <p className="mt-2 text-xs text-[#251E1F]/30">PDF not yet available</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-[#7b6660]">No payslips available yet.</p>
          )}
        </Panel>

        <Panel title="Year-To-Date Breakdown">
          {ytd && ytd.total_payslips > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              <MiniStat label="Gross Earned" value={formatCurrency(ytd.ytd_gross)} />
              <MiniStat label="Allowances" value={formatCurrency(ytd.ytd_allowances)} />
              <MiniStat label="Deductions" value={`-${formatCurrency(ytd.ytd_deductions)}`} />
              <MiniStat label="Net Pay" value={formatCurrency(ytd.ytd_net_pay)} highlight />
            </div>
          ) : (
            <p className="text-sm text-[#7b6660]">No payroll data for this year yet.</p>
          )}
        </Panel>
      </div>

      {/* Recent payslips — view only with download */}
      <Panel title="Recent Payslips">
        {payslips.length > 0 ? (
          <div className="space-y-2">
            {payslips.slice(0, 3).map((p) => (
              <div key={p.payroll_id} className="flex items-center justify-between rounded-lg border border-[#f0d2ca] bg-[#251E1F]/10 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-[#251E1F]">{getMonthLabel(p.payroll_month, p.payroll_year)}</p>
                  <p className="text-xs text-[#7b6660]">Net: {formatCurrency(p.net_salary)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={p.run_status} />
                  {p.file_path && (
                    <button
                      type="button"
                      onClick={() => downloadPayslip(p)}
                      className="flex items-center gap-1.5 rounded-lg border border-[#f0d2ca] bg-white/80 px-3 py-1.5 text-xs font-medium text-[#251E1F] hover:bg-[#FDD9CD]/45"
                    >
                      <Download size={14} />
                      PDF
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[#7b6660]">No recent payslips</p>
        )}
      </Panel>
    </div>
  );
}

/* ─── Payslips ─── */
function PayslipsView({ payslips, formatCurrency, getMonthLabel, downloadPayslip, printStaffPayslip, setUnreadCount, session }) {
  useEffect(() => {
    const token = session?.token;
    if (!token || !payslips.length) return;

    const unreadPayslips = payslips.filter(p => p.is_read_by_staff === 0 && p.payslip_id);
    if (unreadPayslips.length === 0) return;

    const headers = { Authorization: `Bearer ${token}` };

    Promise.allSettled(
      unreadPayslips.map(p =>
        apiRequest(`/api/payslips/${p.payslip_id}/read`, { method: 'PATCH', headers })
      )
    ).then(() => {
      setUnreadCount(0);
    }).catch(() => {});
  }, [payslips, session?.token]);

  if (payslips.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <FileText size={48} className="text-[#F38978]/40" />
        <p className="mt-4 text-lg font-semibold text-[#251E1F]">No payslips yet</p>
        <p className="mt-1 text-sm text-[#7b6660]">Payslips will appear here after your first payroll run.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {payslips.map((p) => (
        <div key={p.payroll_id} className="flex flex-col gap-3 rounded-xl border border-[#f0d2ca] bg-white/80 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-[#251E1F]">{getMonthLabel(p.payroll_month, p.payroll_year)}</p>
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-[#7b6660]">
              <span>Gross: {formatCurrency(p.base_salary)}</span>
              <span>Allowances: {formatCurrency(p.total_allowances)}</span>
              <span>Deductions: -{formatCurrency(p.total_deductions)}</span>
              <span className="font-semibold text-[#251E1F]">Net: {formatCurrency(p.net_salary)}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={p.run_status} />
            <button
              type="button"
              onClick={() => printStaffPayslip(p)}
              className="inline-flex items-center gap-2 rounded-lg border border-[#f0d2ca] bg-white/80 px-4 py-2 text-sm font-semibold text-[#251E1F] hover:bg-[#FDD9CD]/60"
            >
              <Printer size={16} />
              Print
            </button>
            {p.file_path ? (
              <button
                type="button"
                onClick={() => downloadPayslip(p)}
                className="inline-flex items-center gap-2 rounded-lg border border-[#F38978]/30 bg-white/80 px-4 py-2 text-sm font-semibold text-[#251E1F] hover:bg-[#FDD9CD]/60"
              >
                <Download size={16} />
                PDF
              </button>
            ) : (
              <span className="text-xs text-[#251E1F]/30">Not yet available</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Payroll Info ─── */
function PayrollInfoView({ payrollInfo, formatCurrency }) {
  return (
    <div className="space-y-4">
      <Panel title="Compensation">
        <div className="grid gap-3 sm:grid-cols-2">
          <InfoRow label="Base Salary" value={formatCurrency(payrollInfo.salary)} />
          <InfoRow label="Department" value={payrollInfo.department} />
          <InfoRow label="Employee Code" value={payrollInfo.employeeCode} />
          <InfoRow label="Hire Date" value={payrollInfo.hireDate} />
        </div>
      </Panel>

      <Panel title="Personal">
        <div className="grid gap-3 sm:grid-cols-2">
          <InfoRow label="Date of Birth" value={payrollInfo.dob} />
          <InfoRow label="Phone" value={payrollInfo.phone} />
          <InfoRow label="Address" value={payrollInfo.address} />
        </div>
      </Panel>
    </div>
  );
}

/* ─── Advance Payment ─── */
function AdvancePaymentView({ session, payrollInfo, profile, formatCurrency }) {
  const token = session?.token;
  const [requests, setRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [evidence, setEvidence] = useState([]);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  const maxAdvance = Math.floor((payrollInfo.salary || 0) * 0.5);
  const salaryAvailable = payrollInfo.salary > 0;

  useEffect(() => {
    fetchRequests();
  }, [token]);

  async function fetchRequests() {
    if (!token) return;
    setLoadingRequests(true);
    try {
      const data = await apiRequest("/api/hr/advance-requests", {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRequests(Array.isArray(data) ? data : []);
    } catch {
      setRequests([]);
    } finally {
      setLoadingRequests(false);
    }
  }

  function showToast(message, type = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }

  function validate() {
    const newErrors = {};
    const numAmount = Number(amount);

    if (!amount) {
      newErrors.amount = "Amount is required";
    } else if (numAmount < 100) {
      newErrors.amount = "Minimum amount is $100";
    } else if (numAmount > maxAdvance) {
      newErrors.amount = `Maximum amount is ${formatCurrency(maxAdvance)} (50% of base salary)`;
    }

    if (!reason?.trim()) {
      newErrors.reason = "Reason is required";
    } else if (reason.trim().length < 10) {
      newErrors.reason = "Please provide a more detailed reason (at least 10 characters)";
    }
    if (!evidence.length) newErrors.evidence = "At least one supporting document is required";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;

    setSubmitting(true);
    try {
      const data = new FormData(); data.append("requestType","salary_advance"); data.append("purpose",reason.trim()); data.append("description",reason.trim()); data.append("amount",Number(amount)); evidence.forEach(file=>data.append("evidence",file));
      await apiRequest("/api/payroll-requests", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": undefined }, body: data });

      showToast("Advance payment request submitted successfully");
      setAmount("");
      setReason("");
      setEvidence([]);
      setErrors({});
      fetchRequests();
    } catch (err) {
      console.error(err);
      showToast(err.message || "Failed to submit request. Please try again.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  const advanceStatusStyles = {
    pending: "border-amber-300/30 bg-amber-300/10 text-amber-700",
    hr_approved: "border-emerald-300/30 bg-emerald-300/10 text-emerald-700",
    hr_rejected: "border-red-300/30 bg-red-300/10 text-red-700",
    finance_approved: "border-emerald-300/30 bg-emerald-300/10 text-emerald-700"
  };

  const statusLabels = {
    pending: "Pending",
    hr_approved: "HR Approved",
    hr_rejected: "HR Rejected",
    finance_approved: "Released by Finance"
  };

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-24 left-1/2 -translate-x-1/2 z-[70] w-full max-w-md rounded-xl border px-5 py-4 shadow-2xl backdrop-blur-sm animate-[slideDown_0.3s_ease-out] ${
          toast.type === "error"
            ? "border-red-400/30 bg-[#FDD9CD] text-red-700"
            : "border-emerald-400/30 bg-[#FFF6F2] text-emerald-700"
        }`}>
          <div className="flex items-center gap-3">
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
              toast.type === "error" ? "bg-red-500/20 text-red-700" : "bg-emerald-500/20 text-emerald-700"
            }`}>
              {toast.type === "error" ? "✕" : "✓"}
            </span>
            <p className="text-sm font-medium">{toast.message}</p>
          </div>
        </div>
      )}

      {/* Request Form */}
      <Panel title="Request Advance Payment">
        {!salaryAvailable ? (
          <div className="rounded-lg border border-amber-400/20 bg-amber-400/5 p-4">
            <p className="text-sm text-amber-700">Salary information not available. Please contact HR before requesting an advance.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-[#7b6660]">Amount ($)</label>
              <input
                type="number"
                min="100"
                max={maxAdvance}
                value={amount}
                onChange={(e) => { setAmount(e.target.value); if (errors.amount) setErrors(prev => ({ ...prev, amount: undefined })); }}
                placeholder={`Min $100 — Max ${formatCurrency(maxAdvance)}`}
                className={`mt-1 w-full rounded-md border px-3 py-2 text-[#251E1F] bg-transparent placeholder:text-[#251E1F]/20 ${
                  errors.amount ? "border-red-400/60" : "border-[#f0d2ca]"
                }`}
              />
              <p className="mt-1 text-xs text-[#7b6660]/60">Maximum: {formatCurrency(maxAdvance)} (50% of base salary)</p>
              {errors.amount && <p className="mt-1 text-xs text-red-400">{errors.amount}</p>}
            </div>

            <div>
              <label className="block text-xs text-[#7b6660]">Reason</label>
              <textarea
                value={reason}
                onChange={(e) => { setReason(e.target.value); if (errors.reason) setErrors(prev => ({ ...prev, reason: undefined })); }}
                placeholder="Explain why you need an advance payment..."
                rows={3}
                className={`mt-1 w-full resize-none rounded-md border px-3 py-2 text-[#251E1F] bg-transparent placeholder:text-[#251E1F]/20 ${
                  errors.reason ? "border-red-400/60" : "border-[#f0d2ca]"
                }`}
              />
              {errors.reason && <p className="mt-1 text-xs text-red-400">{errors.reason}</p>}
            </div>

            <div><label className="block text-xs text-[#7b6660]">Supporting documents (up to 5)</label><input type="file" multiple accept=".pdf,.jpg,.jpeg,.png" onChange={e=>{setEvidence(Array.from(e.target.files||[]).slice(0,5));setErrors(prev=>({...prev,evidence:undefined}));}} className="mt-1 w-full rounded-md border border-[#f0d2ca] p-2 text-sm"/>{errors.evidence&&<p className="mt-1 text-xs text-red-400">{errors.evidence}</p>}</div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="rounded-lg bg-[#F38978] px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60"
            >
              {submitting ? "Submitting…" : "Submit Request"}
            </button>
          </div>
        )}
      </Panel>

      {/* Request History */}
      <Panel title="Your Requests">
        {loadingRequests ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <SkeletonBar key={i} height="h-14" />)}
          </div>
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <DollarSign size={48} className="text-[#F38978]/30" />
            <p className="mt-4 text-sm text-[#7b6660]">No advance payment requests yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((r) => (
              <div key={r.request_id} className="rounded-xl border border-[#f0d2ca] bg-[#251E1F]/10 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <p className="text-sm font-semibold text-[#251E1F]">{formatCurrency(r.requested_amount)}</p>
                      <span className={`rounded-full border px-3 py-0.5 text-xs font-semibold whitespace-nowrap ${advanceStatusStyles[r.status] || "border-[#F0D2CA]/30 bg-[#FFF6F2]/10 text-[#7B6660]"}`}>
                        {statusLabels[r.status] || r.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[#7b6660] line-clamp-1">{r.reason || "—"}</p>
                  </div>
                  <p className="text-xs text-[#251E1F]/30 whitespace-nowrap">
                    {r.created_at ? new Date(r.created_at).toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                  </p>
                </div>
                {r.hr_comments && (
                  <div className="mt-2 rounded-lg border border-[#f0d2ca] bg-[#fff3ee]/50 px-3 py-2">
                    <p className="text-xs text-[#7b6660]/70"><span className="font-medium text-[#7b6660]">HR:</span> {r.hr_comments}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

/* ─── Notifications ─── */
function NotificationsView({ payslips, getMonthLabel }) {
  const session = getStoredSession();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userId = session?.user?.userId;
    const token = session?.token;
    if (!userId || !token) { setLoading(false); return; }

    async function loadNotifications() {
      try {
        const data = await apiRequest(`/api/notifications/user/${userId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setNotifications(Array.isArray(data) ? data : []);
      } catch {
        // Fallback to client-side notifications if endpoint not available yet
        const fallback = [];
        if (payslips.length > 0) {
          const latest = payslips[0];
          fallback.push({
            notification_id: "latest-payslip",
            title: `Your ${getMonthLabel(latest.pay_period_end)} payslip is available.`,
            type: "payslip_available",
            is_read: 0,
            created_at: latest.created_at
          });
        }
        setNotifications(fallback);
      } finally {
        setLoading(false);
      }
    }

    loadNotifications();
  }, [session?.token, session?.user?.userId]);

  const handleMarkAllRead = async () => {
    const userId = session?.user?.userId;
    const token = session?.token;
    if (!userId || !token) return;
    try {
      await apiRequest("/api/notifications/read-all", {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
    } catch {}
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  if (loading) return (
    <div className="space-y-3">
      {[1,2,3].map(i => <SkeletonBar key={i} height="h-14" />)}
    </div>
  );

  return (
    <div className="space-y-4">
      {unreadCount > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-[#7b6660]">{unreadCount} unread notification{unreadCount > 1 ? 's' : ''}</p>
          <button
            type="button"
            onClick={handleMarkAllRead}
            className="rounded-lg border border-[#f0d2ca] bg-white/80 px-3 py-1.5 text-xs text-[#251E1F] hover:bg-[#FDD9CD]/45"
          >
            Mark all as read
          </button>
        </div>
      )}

      {notifications.length === 0 ? (
        <div className="rounded-xl border border-[#f0d2ca] bg-white/80 p-6 text-center">
          <Bell size={32} className="mx-auto text-[#F38978]/30" />
          <p className="mt-3 text-sm text-[#7b6660]">No notifications at this time.</p>
          <p className="mt-1 text-xs text-[#251E1F]/30">You'll be notified when a new payslip is available.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <div
              key={n.notification_id}
              className={`rounded-xl border p-4 text-sm transition ${
                n.is_read
                  ? "border-[#f0d2ca] bg-[#fff3ee]/50 text-[#7b6660]/60"
                  : n.type === "payslip_available"
                    ? "border-emerald-400/20 bg-emerald-400/5 text-emerald-700"
                    : "border-[#f0d2ca] bg-white/80 text-[#7b6660]"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className={`font-medium ${n.is_read ? "" : "text-[#251E1F]"}`}>{n.title}</p>
                  {n.message && <p className="mt-1 text-xs text-[#251E1F]/40">{n.message}</p>}
                </div>
                {!n.is_read && (
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
                )}
              </div>
              {n.created_at && (
                <p className="mt-2 text-xs text-[#251E1F]/20">
                  {new Date(n.created_at).toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Shared Components ─── */
function Panel({ title, children }) {
  return (
    <div className="rounded-xl border border-[#f0d2ca] bg-white/80 p-5">
      <h3 className="mb-3 text-lg font-semibold text-[#251E1F]">{title}</h3>
      {children}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent = "text-[#F38978]" }) {
  return (
    <div className="rounded-xl border border-[#f0d2ca] bg-white/80 p-4">
      <div className="flex items-center gap-2">
        <Icon size={16} className={accent} />
        <p className="text-xs uppercase tracking-wide text-[#7b6660]">{label}</p>
      </div>
      <p className="mt-2 text-lg font-semibold text-[#251E1F]">{value}</p>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="rounded-lg border border-[#f0d2ca] bg-[#251E1F]/10 px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-[#7b6660]">{label}</p>
      <p className="mt-1 text-sm font-medium text-[#251E1F]">{value}</p>
    </div>
  );
}

function MiniStat({ label, value, highlight }) {
  return (
    <div className="rounded-lg bg-[#251E1F]/20 px-3 py-2">
      <p className="text-xs text-[#7b6660]">{label}</p>
      <p className={`mt-0.5 text-sm font-semibold ${highlight ? "text-emerald-400" : "text-[#251E1F]"}`}>{value}</p>
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    "Closed": "border-emerald-300/30 bg-emerald-300/10 text-emerald-700",
    "Payslips Generated": "border-[#2D7C83]/30 bg-[#2D7C83]/10 text-[#2D7C83]",
    "Processing": "border-amber-300/30 bg-amber-300/10 text-amber-700",
    "Draft": "border-[#F0D2CA]/30 bg-[#FFF6F2]/10 text-[#7B6660]"
  };

  const label = status || "Unknown";

  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-semibold whitespace-nowrap ${styles[label] || styles["Draft"]}`}>
      {label}
    </span>
  );
}
