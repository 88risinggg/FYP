import { Navigate, Route, Routes } from "react-router-dom";

import LoginPage from "./pages/LoginPage.jsx";
import ModuleSelectionPage from "./pages/ModuleSelectionPage.jsx";
import AdminInvoicingDashboard from "./pages/invoicing/AdminInvoicingDashboard.jsx";
import FinanceInvoicingPage from "./pages/invoicing/FinanceInvoicingPage.jsx";
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

export default function App() {
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
        path="/dashboard/invoicing/admin"
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
    </Routes>
  );
}
