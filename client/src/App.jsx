import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import LoginPage from "./pages/LoginPage.jsx";
import ModuleSelectionPage from "./pages/ModuleSelectionPage.jsx";
import AdminInvoicingDashboard from "./pages/invoicing/AdminInvoicingDashboard.jsx";
import FinanceInvoicingPage from "./pages/invoicing/FinanceInvoicingPage.jsx";
import AdminPayrollPage from "./pages/payroll/AdminPayrollPage.jsx";
import FinancePayrollPage from "./pages/payroll/FinancePayrollPage.jsx";
import HRPayrollPage from "./pages/payroll/HRPayrollPage.jsx";
import StaffPayrollPage from "./pages/payroll/StaffPayrollPage.jsx";
import { startHealthCheck, stopHealthCheck } from "./services/apiClient.js";
import { getStoredSession } from "./services/sessionService.js";

function ProtectedRoute({ children }) {
  const session = getStoredSession();

  if (!session?.token) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function AdminInvoicingRoute({ children }) {
  const session = getStoredSession();
  const user = session?.user;
  const canAccessInvoicing = user?.allowedModules?.includes("invoicing");

  if (!session?.token) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role !== "Admin" || !canAccessInvoicing) {
    return <Navigate to="/module-selection" replace />;
  }

  return children;
}

function FinanceInvoicingRoute({ children }) {
  const session = getStoredSession();
  const user = session?.user;
  const canAccessInvoicing = user?.allowedModules?.includes("invoicing");
  const canAccessFinanceLayout = user?.role === "Admin" || user?.role === "Finance";

  if (!session?.token) {
    return <Navigate to="/login" replace />;
  }

  if (!canAccessInvoicing || !canAccessFinanceLayout) {
    return <Navigate to="/module-selection" replace />;
  }

  return children;
}

function AdminPayrollRoute({ children }) {
  const session = getStoredSession();
  const user = session?.user;
  const canAccessPayroll = user?.allowedModules?.includes("payroll");

  if (!session?.token) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role !== "Admin" || !canAccessPayroll) {
    return <Navigate to="/module-selection" replace />;
  }

  return children;
}

function FinancePayrollRoute({ children }) {
  const session = getStoredSession();
  const user = session?.user;
  const canAccessPayroll = user?.allowedModules?.includes("payroll");

  if (!session?.token) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role !== "Finance" || !canAccessPayroll) {
    return <Navigate to="/module-selection" replace />;
  }

  return children;
}

function HRPayrollRoute({ children }) {
  const session = getStoredSession();
  const user = session?.user;
  const canAccessPayroll = user?.allowedModules?.includes("payroll");

  if (!session?.token) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role !== "HR" || !canAccessPayroll) {
    return <Navigate to="/module-selection" replace />;
  }

  return children;
}

function StaffPayrollRoute({ children }) {
  const session = getStoredSession();
  const user = session?.user;
  const canAccessPayroll = user?.allowedModules?.includes("payroll");

  if (!session?.token) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role !== "Staff" || !canAccessPayroll) {
    return <Navigate to="/module-selection" replace />;
  }

  return children;
}

export default function App() {
  useEffect(() => {
    if (getStoredSession()) {
      startHealthCheck();
    }
    return () => stopHealthCheck();
  }, []);

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/module-selection"
        element={
          <ProtectedRoute>
            <ModuleSelectionPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/invoicing/admin/*"
        element={
          <AdminInvoicingRoute>
            <AdminInvoicingDashboard />
          </AdminInvoicingRoute>
        }
      />
      <Route
        path="/dashboard/invoicing/finance/*"
        element={
          <FinanceInvoicingRoute>
            <FinanceInvoicingPage />
          </FinanceInvoicingRoute>
        }
      />
      <Route
        path="/dashboard/payroll/admin/*"
        element={
          <AdminPayrollRoute>
            <AdminPayrollPage />
          </AdminPayrollRoute>
        }
      />
      <Route
        path="/dashboard/payroll/finance/*"
        element={
          <FinancePayrollRoute>
            <FinancePayrollPage />
          </FinancePayrollRoute>
        }
      />
      <Route
        path="/dashboard/payroll/hr/*"
        element={
          <HRPayrollRoute>
            <HRPayrollPage />
          </HRPayrollRoute>
        }
      />
      <Route
        path="/dashboard/payroll/staff/*"
        element={
          <StaffPayrollRoute>
            <StaffPayrollPage />
          </StaffPayrollRoute>
        }
      />
    </Routes>
  );
}
