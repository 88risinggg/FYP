import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  Briefcase,
  DollarSign,
  Download,
  FileText,
  LayoutDashboard,
  Printer,
  TrendingUp,
  UserCog,
  Wallet
} from "lucide-react";
import { useLocation } from "react-router-dom";

import DashboardLayout from "../../components/layout/DashboardLayout.jsx";
import { apiRequest } from "../../services/apiClient.js";
import { getStoredSession, clearSession } from "../../services/sessionService.js";
import StaffProfile from "./StaffProfile.jsx";

const pageTitle = "Automated Payroll System – Staff Payroll Portal";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const payrollSidebarSections = [
  {
    label: null,
    items: [
      { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard/payroll/staff", end: true }
    ]
  },
  {
    label: "Pay",
    items: [
      { label: "Payslips", icon: FileText, path: "/dashboard/payroll/staff/payslips" },
      { label: "Payroll Info", icon: Wallet, path: "/dashboard/payroll/staff/payroll-info" }
    ]
  },
  {
    label: "Account",
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
  <div className={`${height} rounded-lg bg-white/5 animate-pulse`} style={{ width }} />
);

export default function StaffPayrollPage() {
  const session = getStoredSession();
  const location = useLocation();
  const headingMap = {
    "/dashboard/payroll/staff/payslips": "Payslips",
    "/dashboard/payroll/staff/payroll-info": "Payroll Info",
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
          apiRequest(`/api/payslips/user/${userId}/unread-count`, { headers }).catch(() => ({ unread_count: 0 }))
        ]);

        if (mounted) {
          setProfile(profileData);
          setPayslips(payslipData);
          setSummary(summaryData);
          setUnreadCount(Number(unreadData?.unread_count) || 0);
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

  function downloadPayslip(payslip) {
    if (!payslip.file_path) return;
    const url = `${import.meta.env.VITE_API_BASE_URL || "http://localhost:5000"}${payslip.file_path}`;
    window.open(url, "_blank");
  }

  function printStaffPayslip(payslip) {
    const month = getMonthLabel(payslip.payroll_month, payslip.payroll_year);
    const fmt = (v) => `$${Number(v || 0).toFixed(2)}`;
    const html = `<!DOCTYPE html><html><head><title>Payslip - ${payslip.employee_name} - ${month}</title>
<style>body{font-family:Arial,sans-serif;padding:40px;color:#000;font-size:12px}
h1{font-size:20px;margin:0}h2{font-size:14px;color:#444;margin:4px 0 20px}
.info{margin-bottom:20px}.info span{display:inline-block;margin-right:24px}
table{width:100%;border-collapse:collapse;margin-bottom:16px}
th{background:#f5f5f5;padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;border-bottom:2px solid #ddd}
td{padding:8px 12px;border-bottom:1px solid #eee}
.total td{font-weight:bold;background:#f9f9f9;border-top:2px solid #ddd}
.footer{margin-top:40px;text-align:center;color:#999;font-size:10px}
@media print{body{padding:20px}}</style></head><body>
<h1>PayNivo Pte Ltd</h1><h2>PAYSLIP — ${month}</h2>
<div class="info"><span><strong>Name:</strong> ${payslip.employee_name || '-'}</span>
<span><strong>Employee Code:</strong> ${payslip.employee_code || '-'}</span>
<span><strong>Status:</strong> ${payslip.run_status || '-'}</span></div>
<table><tr><th>Description</th><th>Amount</th></tr>
<tr><td>Base Salary</td><td>${fmt(payslip.base_salary)}</td></tr>
<tr><td>Allowances</td><td>${fmt(payslip.total_allowances)}</td></tr>
<tr><td>Deductions</td><td>-${fmt(payslip.total_deductions)}</td></tr>
<tr class="total"><td>Net Pay</td><td>${fmt(payslip.net_salary)}</td></tr></table>
<div class="footer"><p>This is a system-generated payslip.</p>
<p>Generated by PayNivo — Singapore SME Payroll System</p></div></body></html>`;
    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
    w.close();
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
      notificationBadgeCount={unreadCount}
    >
      <section>
        <h2 className="text-2xl font-semibold text-white">{heading}</h2>

        <div className="neon-glass neon-border mt-6 min-h-[calc(100vh-12rem)] rounded-2xl p-6">
          {error ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="rounded-xl border border-red-400/20 bg-red-400/5 px-6 py-5">
                <p className="text-sm text-red-200">{error}</p>
                <button
                  type="button"
                  onClick={() => { setLoading(true); setError(null); window.location.reload(); }}
                  className="mt-3 rounded-lg bg-red-500/20 px-4 py-2 text-sm font-medium text-red-200 hover:bg-red-500/30"
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
                  <div key={i} className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
                    <SkeletonBar width="60%" height="h-3" />
                    <SkeletonBar width="80%" height="h-6" />
                  </div>
                ))}
              </div>
              {/* Skeleton: panels */}
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-3">
                  <SkeletonBar width="40%" height="h-4" />
                  <SkeletonBar width="100%" height="h-3" />
                  <SkeletonBar width="70%" height="h-3" />
                  <SkeletonBar width="30%" height="h-8" />
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-3">
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
              <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-3">
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

              {heading === "Profile" && <StaffProfile />}

              {heading === "Notifications" && (
                <NotificationsView payslips={payslips} getMonthLabel={getMonthLabel} />
              )}
            </div>
          )}
        </div>
      </section>

      {/* Inactivity warning modal */}
      {showTimeoutWarning && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="rounded-2xl border border-amber-400/30 bg-[#12071f] p-6 shadow-2xl w-full max-w-sm mx-4">
            <p className="text-lg font-semibold text-white">Session Expiring</p>
            <p className="mt-2 text-sm text-[#d8c6e8]">
              Your session will expire in 2 minutes due to inactivity.
            </p>
            <button
              type="button"
              onClick={() => {
                setShowTimeoutWarning(false);
                // Trigger a synthetic activity event to reset timers
                window.dispatchEvent(new Event('mousemove'));
              }}
              className="mt-4 w-full rounded-lg bg-[#7B2FF7] px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110"
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
  const ytd = summary?.ytd;
  const latest = summary?.latest;

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="rounded-xl border border-white/10 bg-gradient-to-r from-[#7B2FF7]/10 to-[#FF4DDB]/10 p-5">
        <p className="text-lg font-semibold text-white">
          Welcome back, {profile?.name || session?.user?.name || "Staff"}
        </p>
        <p className="mt-1 text-sm text-[#d8c6e8]">
          {payrollInfo.department} • {payrollInfo.employeeCode}
        </p>
      </div>

      {/* Key stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={DollarSign} label="Base Salary" value={formatCurrency(payrollInfo.salary)} accent="text-emerald-400" />
        <StatCard icon={TrendingUp} label="YTD Net Pay" value={formatCurrency(ytd?.ytd_net_pay)} accent="text-cyan-400" />
        <StatCard icon={FileText} label="Payslips This Year" value={ytd?.total_payslips ?? 0} accent="text-[#C77DFF]" />
        <StatCard icon={Briefcase} label="Hire Date" value={payrollInfo.hireDate} accent="text-amber-400" />
      </div>

      {/* Latest payslip + Quick info */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Latest Payslip">
          {latest ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#d8c6e8]">{getMonthLabel(latest.payroll_month, latest.payroll_year)}</span>
                <StatusBadge status={latest.run_status} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <MiniStat label="Gross" value={formatCurrency(latest.base_salary)} />
                <MiniStat label="Deductions" value={`-${formatCurrency(latest.total_deductions)}`} />
                <MiniStat label="Net Pay" value={formatCurrency(latest.net_salary)} highlight />
              </div>
              {latest.file_path ? (
                <button
                  type="button"
                  onClick={() => downloadPayslip(latest)}
                  className="mt-2 inline-flex items-center gap-2 rounded-lg bg-[#7B2FF7] px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
                >
                  <Download size={16} />
                  Download PDF
                </button>
              ) : (
                <p className="mt-2 text-xs text-white/30">PDF not yet available</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-[#d8c6e8]">No payslips available yet.</p>
          )}
        </Panel>

        <Panel title="YTD Breakdown">
          {ytd && ytd.total_payslips > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              <MiniStat label="Gross Earned" value={formatCurrency(ytd.ytd_gross)} />
              <MiniStat label="Allowances" value={formatCurrency(ytd.ytd_allowances)} />
              <MiniStat label="Deductions" value={`-${formatCurrency(ytd.ytd_deductions)}`} />
              <MiniStat label="Net Pay" value={formatCurrency(ytd.ytd_net_pay)} highlight />
            </div>
          ) : (
            <p className="text-sm text-[#d8c6e8]">No payroll data for this year yet.</p>
          )}
        </Panel>
      </div>

      {/* Recent payslips list */}
      <Panel title="Recent Payslips">
        {payslips.length > 0 ? (
          <div className="space-y-2">
            {payslips.slice(0, 3).map((p) => (
              <div key={p.payroll_id} className="flex items-center justify-between rounded-lg border border-white/10 bg-black/10 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-white">{getMonthLabel(p.payroll_month, p.payroll_year)}</p>
                  <p className="text-xs text-[#d8c6e8]">Net: {formatCurrency(p.net_salary)}</p>
                </div>
                <StatusBadge status={p.run_status} />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[#d8c6e8]">No recent payslips</p>
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
        <FileText size={48} className="text-[#C77DFF]/40" />
        <p className="mt-4 text-lg font-semibold text-white">No payslips yet</p>
        <p className="mt-1 text-sm text-[#d8c6e8]">Payslips will appear here after your first payroll run.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {payslips.map((p) => (
        <div key={p.payroll_id} className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-white">{getMonthLabel(p.payroll_month, p.payroll_year)}</p>
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-[#d8c6e8]">
              <span>Gross: {formatCurrency(p.base_salary)}</span>
              <span>Allowances: {formatCurrency(p.total_allowances)}</span>
              <span>Deductions: -{formatCurrency(p.total_deductions)}</span>
              <span className="font-semibold text-white">Net: {formatCurrency(p.net_salary)}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={p.run_status} />
            <button
              type="button"
              onClick={() => printStaffPayslip(p)}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
            >
              <Printer size={16} />
              Print
            </button>
            {p.file_path ? (
              <button
                type="button"
                onClick={() => downloadPayslip(p)}
                className="inline-flex items-center gap-2 rounded-lg border border-[#C77DFF]/30 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
              >
                <Download size={16} />
                PDF
              </button>
            ) : (
              <span className="text-xs text-white/30">Not yet available</span>
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

      <Panel title="Bank Details">
        <div className="grid gap-3 sm:grid-cols-2">
          <InfoRow label="Bank" value={payrollInfo.bank} />
          <InfoRow label="Account No." value={payrollInfo.accountNo} />
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
      await apiRequest(`/api/notifications/user/${userId}/read-all`, {
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
          <p className="text-sm text-[#d8c6e8]">{unreadCount} unread notification{unreadCount > 1 ? 's' : ''}</p>
          <button
            type="button"
            onClick={handleMarkAllRead}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white hover:bg-white/10"
          >
            Mark all as read
          </button>
        </div>
      )}

      {notifications.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center">
          <Bell size={32} className="mx-auto text-[#C77DFF]/30" />
          <p className="mt-3 text-sm text-[#d8c6e8]">No notifications at this time.</p>
          <p className="mt-1 text-xs text-white/30">You'll be notified when a new payslip is available.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <div
              key={n.notification_id}
              className={`rounded-xl border p-4 text-sm transition ${
                n.is_read
                  ? "border-white/5 bg-white/[0.02] text-[#d8c6e8]/60"
                  : n.type === "payslip_available"
                    ? "border-emerald-400/20 bg-emerald-400/5 text-emerald-200"
                    : "border-white/10 bg-white/5 text-[#d8c6e8]"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className={`font-medium ${n.is_read ? "" : "text-white"}`}>{n.title}</p>
                  {n.message && <p className="mt-1 text-xs text-white/40">{n.message}</p>}
                </div>
                {!n.is_read && (
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
                )}
              </div>
              {n.created_at && (
                <p className="mt-2 text-xs text-white/20">
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
    <div className="rounded-xl border border-white/10 bg-white/5 p-5">
      <h3 className="mb-3 text-lg font-semibold text-white">{title}</h3>
      {children}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent = "text-[#C77DFF]" }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center gap-2">
        <Icon size={16} className={accent} />
        <p className="text-xs uppercase tracking-wide text-[#d8c6e8]">{label}</p>
      </div>
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

function MiniStat({ label, value, highlight }) {
  return (
    <div className="rounded-lg bg-black/20 px-3 py-2">
      <p className="text-xs text-[#d8c6e8]">{label}</p>
      <p className={`mt-0.5 text-sm font-semibold ${highlight ? "text-emerald-400" : "text-white"}`}>{value}</p>
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    "Closed": "border-emerald-300/30 bg-emerald-300/10 text-emerald-200",
    "Payslips Generated": "border-cyan-300/30 bg-cyan-300/10 text-cyan-200",
    "Processing": "border-amber-300/30 bg-amber-300/10 text-amber-200",
    "Draft": "border-gray-300/30 bg-gray-300/10 text-gray-200"
  };

  const label = status || "Unknown";

  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-semibold whitespace-nowrap ${styles[label] || styles["Draft"]}`}>
      {label}
    </span>
  );
}
