import { Loader2, FileText, LayoutDashboard } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

import DashboardLayout from "../../components/layout/DashboardLayout.jsx";
import { getStoredSession } from "../../services/sessionService.js";

const pageTitle = "Automated Payroll System – Staff Payroll Portal";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

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
      }
    ]
  }
];

function getAuthHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function StaffPayrollPage() {
  const session = getStoredSession();
  const location = useLocation();
  const heading = location.pathname === "/dashboard/payroll/staff/payslips" ? "Payslips" : "Dashboard";

  const [payslips, setPayslips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchPayslips = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await fetch(`${API_BASE_URL}/api/hr/payslips`, {
        headers: {
          ...getAuthHeaders(session?.token)
        }
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || "Failed to load payslips");
      }

      const data = await response.json();
      setPayslips(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Failed to load payslips");
      setPayslips([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayslips();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.token]);

  return (
    <DashboardLayout
      pageTitle={pageTitle}
      user={session?.user}
      sidebarSections={payrollSidebarSections}
      sidebarTitle="Automated Payroll System"
      searchPlaceholder="Search payslips..."
    >
      <section>
        <h2 className="text-2xl font-semibold text-white">{heading}</h2>

        <div className="neon-glass neon-border mt-6 rounded-2xl p-6">
          <p className="text-sm text-[#d8c6e8]">Only payslips that have been approved and released to staff will appear here.</p>
        </div>

        <div className="neon-glass neon-border mt-4 rounded-2xl overflow-hidden">
          {loading ? (
            <div className="flex items-center gap-3 p-6 text-[#d8c6e8]">
              <Loader2 className="animate-spin" size={18} />
              Loading payslips...
            </div>
          ) : error ? (
            <div className="p-6 text-sm text-red-300">{error}</div>
          ) : payslips.length === 0 ? (
            <div className="p-6 text-sm text-[#d8c6e8]">No payslips available.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-white/10 bg-white/5 text-[#d8c6e8]">
                  <tr>
                    <th className="px-4 py-3 font-medium">Payslip ID</th>
                    <th className="px-4 py-3 font-medium">Period</th>
                    <th className="px-4 py-3 font-medium">Gross</th>
                    <th className="px-4 py-3 font-medium">Deductions</th>
                    <th className="px-4 py-3 font-medium">Net Pay</th>
                    <th className="px-4 py-3 font-medium">View</th>
                  </tr>
                </thead>
                <tbody>
                  {payslips.map(p => (
                    <tr key={p.payslip_id} className="border-b border-white/5 text-white">
                      <td className="px-4 py-3 text-[#d8c6e8]">{p.payslip_id}</td>
                      <td className="px-4 py-3 text-[#d8c6e8]">{p.period_month} {p.period_year}</td>
                      <td className="px-4 py-3 text-[#d8c6e8]">${p.gross_salary?.toFixed(2) || "0.00"}</td>
                      <td className="px-4 py-3 text-red-300">${p.total_deductions?.toFixed(2) || "0.00"}</td>
                      <td className="px-4 py-3 text-emerald-300">${p.net_pay?.toFixed(2) || "0.00"}</td>
                      <td className="px-4 py-3">
                        <button className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs text-white hover:bg-white/10">View</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </DashboardLayout>
  );
}
