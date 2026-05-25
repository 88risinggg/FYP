import DashboardLayout from "../../components/layout/DashboardLayout.jsx";
import { getStoredSession } from "../../services/sessionService.js";

export default function AdminInvoicingDashboard() {
  const session = getStoredSession();

  return (
    <DashboardLayout
      pageTitle="Automated Invoicing System – Admin Dashboard"
      user={session?.user}
    >
      <section>
        <h2 className="text-2xl font-semibold text-slate-950">Dashboard</h2>
        <div className="mt-6 min-h-[calc(100vh-12rem)] rounded-xl border border-dashed border-slate-300 bg-white p-8 shadow-sm">
          <p className="text-sm text-slate-500">
            This dashboard is reserved for module development.
          </p>
        </div>
      </section>
    </DashboardLayout>
  );
}
