import { createBrowserRouter, Navigate } from "react-router-dom";
import AppLayout from "../layouts/AppLayout.jsx";
import ProtectedRoute from "../components/ProtectedRoute.jsx";
import Login from "../pages/Login.jsx";
import AdminDashboard from "../pages/AdminDashboard.jsx";
import FinanceDashboard from "../pages/FinanceDashboard.jsx";
import FinanceInvoices from "../pages/FinanceInvoices.jsx";
import FinancePayments from "../pages/FinancePayments.jsx";
import FinancePayroll from "../pages/FinancePayroll.jsx";
import FinanceTemplates from "../pages/FinanceTemplates.jsx";
import FinanceReports from "../pages/FinanceReports.jsx";
import HRDashboard from "../pages/HRDashboard.jsx";
import StaffDashboard from "../pages/StaffDashboard.jsx";
import CustomerDashboard from "../pages/CustomerDashboard.jsx";
import InvoicePublicView from "../pages/InvoicePublicView.jsx";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/login" replace /> },
      { path: "login", element: <Login /> },

      // Admin
      { path: "admin", element: <ProtectedRoute allowedRoles={["Admin"]}><AdminDashboard /></ProtectedRoute> },

      // Finance
      { path: "finance", element: <ProtectedRoute allowedRoles={["Finance"]}><FinanceDashboard /></ProtectedRoute> },
      { path: "finance/invoices", element: <ProtectedRoute allowedRoles={["Finance"]}><FinanceInvoices /></ProtectedRoute> },
      { path: "finance/payments", element: <ProtectedRoute allowedRoles={["Finance"]}><FinancePayments /></ProtectedRoute> },
      { path: "finance/payroll", element: <ProtectedRoute allowedRoles={["Finance"]}><FinancePayroll /></ProtectedRoute> },
      { path: "finance/templates", element: <ProtectedRoute allowedRoles={["Finance"]}><FinanceTemplates /></ProtectedRoute> },
      { path: "finance/reports", element: <ProtectedRoute allowedRoles={["Finance"]}><FinanceReports /></ProtectedRoute> },

      // HR
      { path: "hr", element: <ProtectedRoute allowedRoles={["HR"]}><HRDashboard /></ProtectedRoute> },

      // Staff
      { path: "staff", element: <ProtectedRoute allowedRoles={["Staff"]}><StaffDashboard /></ProtectedRoute> },

      // Customer
      { path: "customer", element: <ProtectedRoute allowedRoles={["Customer"]}><CustomerDashboard /></ProtectedRoute> }
    ]
  },
  { path: "invoice/view/:token", element: <InvoicePublicView /> }
]);
