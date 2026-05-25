import {
  Building2,
  CreditCard,
  FileBarChart,
  LayoutDashboard,
  ReceiptText,
  Upload
} from "lucide-react";

import DashboardLayout from "../../components/layout/DashboardLayout.jsx";
import { getStoredSession } from "../../services/sessionService.js";

const financeSidebarSections = [
  {
    label: "MAIN",
    items: [
      {
        label: "Dashboard",
        icon: LayoutDashboard,
        path: "/dashboard/invoicing/finance",
        end: true
      }
    ]
  },
  {
    label: "INVOICING",
    items: [
      {
        label: "Customers",
        icon: Building2,
        path: "/dashboard/invoicing/finance/customers"
      },
      {
        label: "Invoices",
        icon: ReceiptText,
        path: "/dashboard/invoicing/finance/invoices"
      },
      {
        label: "Bulk Upload",
        icon: Upload,
        path: "/dashboard/invoicing/finance/bulk-upload"
      },
      {
        label: "Payments",
        icon: CreditCard,
        path: "/dashboard/invoicing/finance/payments"
      }
    ]
  },
  {
    label: "REPORTS",
    items: [
      {
        label: "Reports",
        icon: FileBarChart,
        path: "/dashboard/invoicing/finance/reports"
      }
    ]
  }
];

export default function FinanceInvoicingPage() {
  const session = getStoredSession();

  return (
    <DashboardLayout
      pageTitle="Automated Invoicing System - Finance Invoice Management"
      user={session?.user}
      sidebarSections={financeSidebarSections}
      searchPlaceholder="Search invoices, customers, payments..."
    >
      <div className="min-h-[calc(100vh-8rem)] rounded-xl border border-dashed border-slate-300 bg-white p-8 shadow-sm">
        <p className="text-sm text-slate-500">
          This page is reserved for module development.
        </p>
      </div>
    </DashboardLayout>
  );
}
