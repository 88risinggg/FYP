import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import LandingPage from "./pages/LoginPage.jsx";
import ForgotPasswordPage from "./pages/ForgotPasswordPage.jsx";
import ModuleSelectionPage from "./pages/ModuleSelectionPage.jsx";
import PublicInvoiceViewPage from "./pages/PublicInvoiceViewPage.jsx";
import PaymentSuccessPage from "./pages/PaymentSuccessPage.jsx";
import PaymentCancelledPage from "./pages/PaymentCancelledPage.jsx";
import AdminInvoicingDashboard from "./pages/invoicing/AdminInvoicingDashboard.jsx";
import { AdminGstHistoryPage } from "./pages/invoicing/AdminInvoiceSettingsPage.jsx";
import AdminReminderCategoryPage from "./pages/invoicing/AdminReminderCategoryPage.jsx";
import AdminEmailDeliveryPage from "./pages/invoicing/AdminEmailDeliveryPage.jsx";
import AdminPaymentUpdatesPage from "./pages/invoicing/AdminPaymentUpdatesPage.jsx";
import AdminInvoiceUploadHistoryPage from "./pages/invoicing/AdminInvoiceUploadHistoryPage.jsx";
import AdminValidationErrorsPage from "./pages/invoicing/AdminValidationErrorsPage.jsx";
import AdminRecentStatusChangesPage from "./pages/invoicing/AdminRecentStatusChangesPage.jsx";
import AdminInvoicingRecordPage from "./pages/invoicing/AdminInvoicingRecordPage.jsx";
import AdminInvoiceAuditTrailPage from "./pages/invoicing/AdminInvoiceAuditTrailPage.jsx";
import FinanceInvoicingPage from "./pages/invoicing/FinanceInvoicingPage.jsx";
import AdminPayrollPage from "./pages/payroll/AdminPayrollPage.jsx";
import FinancePayrollPage from "./pages/payroll/FinancePayrollPage.jsx";
import HRPayrollPage from "./pages/payroll/HRPayrollPage.jsx";
import StaffPayrollPage from "./pages/payroll/StaffPayrollPage.jsx";
import { startHealthCheck, stopHealthCheck } from "./services/apiClient.js";
import { applyAppearance, readCachedAppearance } from "./services/appearanceService.js";
import { fetchAppearance } from "./services/settingsService.js";
import { getPostAuthDestination, getStoredSession } from "./services/sessionService.js";
import PlatformCompaniesPage from "./pages/platform/PlatformCompaniesPage.jsx";

function ProtectedRoute({ children }) {
  const session = getStoredSession();

  if (!session?.token) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function ModuleSelectionRoute() {
  const session = getStoredSession();
  if (!session?.token) return <Navigate to="/login" replace />;
  const destination = getPostAuthDestination(session.user);
  if (destination !== "/module-selection") return <Navigate to={destination} replace />;
  return <ModuleSelectionPage />;
}

function PlatformOperatorRoute({ children }) {
  const session = getStoredSession();
  if (!session?.token) return <Navigate to="/login" replace />;
  if (session.user?.role !== "PlatformOperator") return <Navigate to="/module-selection" replace />;
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

function StaffOrHRPayrollRoute({ children }) {
  const session = getStoredSession();
  const user = session?.user;
  const canAccessPayroll = user?.allowedModules?.includes("payroll");

  if (!session?.token) {
    return <Navigate to="/login" replace />;
  }

  if ((user?.role !== "Staff" && user?.role !== "HR") || !canAccessPayroll) {
    return <Navigate to="/module-selection" replace />;
  }

  return children;
}

export default function App() {
  useEffect(() => {
    const session = getStoredSession();
    let active = true;
    const systemTheme = window.matchMedia?.("(prefers-color-scheme: dark)");
    const handleSystemThemeChange = () => {
      const cached = readCachedAppearance();
      if (cached.theme === "system") applyAppearance(cached, { persist: false });
    };

    applyAppearance(readCachedAppearance(), { persist: false });

    if (session) {
      startHealthCheck();
      fetchAppearance()
        .then((appearance) => {
          if (active) applyAppearance(appearance);
        })
        .catch(() => {
          // Cached settings remain active when the API is temporarily unavailable.
        });
    }

    systemTheme?.addEventListener?.("change", handleSystemThemeChange);
    return () => {
      active = false;
      systemTheme?.removeEventListener?.("change", handleSystemThemeChange);
      stopHealthCheck();
    };
  }, []);

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LandingPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/register" element={<Navigate to="/" replace />} />
      <Route path="/verify-email" element={<Navigate to="/" replace />} />
      <Route path="/invoice/view/:invoiceId" element={<PublicInvoiceViewPage />} />
      <Route path="/payment/success" element={<PaymentSuccessPage />} />
      <Route path="/payment/cancelled" element={<PaymentCancelledPage />} />
      <Route
        path="/module-selection"
        element={
          <ModuleSelectionRoute />
        }
      />
      <Route path="/platform/companies" element={<PlatformOperatorRoute><PlatformCompaniesPage /></PlatformOperatorRoute>} />
      <Route
        path="/dashboard/invoicing/admin/reminder-summary/:category"
        element={
          <AdminInvoicingRoute>
            <AdminReminderCategoryPage />
          </AdminInvoicingRoute>
        }
      />
      <Route
        path="/dashboard/invoicing/admin/email-delivery/:category"
        element={
          <AdminInvoicingRoute>
            <AdminEmailDeliveryPage />
          </AdminInvoicingRoute>
        }
      />
      <Route
        path="/dashboard/invoicing/admin/payment-updates"
        element={
          <AdminInvoicingRoute>
            <AdminPaymentUpdatesPage />
          </AdminInvoicingRoute>
        }
      />
      <Route
        path="/dashboard/invoicing/admin/payment-updates/:recordId"
        element={
          <AdminInvoicingRoute>
            <AdminInvoicingRecordPage mode="payment" />
          </AdminInvoicingRoute>
        }
      />
      <Route
        path="/dashboard/invoicing/admin/invoice-records/:recordId"
        element={
          <AdminInvoicingRoute>
            <AdminInvoicingRecordPage mode="invoice" />
          </AdminInvoicingRoute>
        }
      />
      <Route
        path="/dashboard/invoicing/admin/audit-trail"
        element={
          <AdminInvoicingRoute>
            <AdminInvoiceAuditTrailPage />
          </AdminInvoicingRoute>
        }
      />
      <Route
        path="/dashboard/invoicing/admin/dashboard/validation-summary/upload-history"
        element={
          <AdminInvoicingRoute>
            <AdminInvoiceUploadHistoryPage />
          </AdminInvoicingRoute>
        }
      />
      <Route
        path="/dashboard/invoicing/admin/dashboard/validation-errors"
        element={
          <AdminInvoicingRoute>
            <AdminValidationErrorsPage />
          </AdminInvoicingRoute>
        }
      />
      <Route
        path="/dashboard/invoicing/admin/dashboard/validation-errors/:uploadId"
        element={
          <AdminInvoicingRoute>
            <AdminValidationErrorsPage />
          </AdminInvoicingRoute>
        }
      />
      <Route
        path="/dashboard/invoicing/admin/dashboard/invoice-performance/status-changes"
        element={
          <AdminInvoicingRoute>
            <AdminRecentStatusChangesPage />
          </AdminInvoicingRoute>
        }
      />
      <Route
        path="/dashboard/invoicing/admin/gst-management/history"
        element={
          <AdminInvoicingRoute>
            <AdminGstHistoryPage />
          </AdminInvoicingRoute>
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
      <Route
        path="/dashboard/settings"
        element={
          <ProtectedRoute>
            <Navigate to="/dashboard/invoicing/finance/settings" replace />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
