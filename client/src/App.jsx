/**
 * EVALUATION HEADER
 * FEATURE: SHARED / APPLICATION CORE
 * PURPOSE: Implements the application's App responsibilities.
 * LAYER: Frontend router - maps browser URLs and access rules to page components.
 * FIND RELATED CODE: Use Find All References on its exports to locate connected features.
 */
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
import AdminNumberingSettingsHistoryPage from "./pages/invoicing/AdminNumberingSettingsHistoryPage.jsx";
import FinanceInvoicingPage from "./pages/invoicing/FinanceInvoicingPage.jsx";
import SettingsPage from "./pages/settings/SettingsPage.jsx";
import RoleSettingsPage from "./pages/settings/RoleSettingsPage.jsx";
import AdminPayrollPage from "./pages/payroll/AdminPayrollPage.jsx";
import FinancePayrollPage from "./pages/payroll/FinancePayrollPage.jsx";
import HRPayrollPage from "./pages/payroll/HRPayrollPage.jsx";
import StaffPayrollPage from "./pages/payroll/StaffPayrollPage.jsx";
import { startHealthCheck, stopHealthCheck } from "./services/apiClient.js";
import { applyAppearance, readCachedAppearance } from "./services/appearanceService.js";
import { fetchAppearance } from "./services/settingsService.js";
import { getPostAuthDestination, getStoredSession } from "./services/sessionService.js";
import PlatformCompaniesPage from "./pages/platform/PlatformCompaniesPage.jsx";

// EVALUATION GUIDE: Search this file for "FEATURE:" to find the frontend entry
// point for each major feature. Routes map browser URLs to their page components.
// Backend API entry points are grouped in server/src/app.js.

// FEATURE: Route protection
// These guards display a page only when the saved session has the required login,
// role, and module access; otherwise, they redirect to a safe page.
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

function SettingsRoute() {
  const session = getStoredSession();

  if (!session?.token) {
    return <Navigate to="/login" replace />;
  }

  if (session.user?.role === "Admin") {
    return <SettingsPage />;
  }

  if (session.user?.role === "HR") {
    return <RoleSettingsPage role="HR" />;
  }

  if (session.user?.role === "Staff") {
    return <RoleSettingsPage role="Staff" />;
  }

  if (session.user?.role === "Finance") {
    return <RoleSettingsPage role="Finance" />;
  }

  return <Navigate to="/module-selection" replace />;
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

function PersonalPayrollRoute({ children }) {
  const session = getStoredSession();
  const user = session?.user;
  const canAccessPayroll = user?.allowedModules?.includes("payroll");

  if (!session?.token) {
    return <Navigate to="/login" replace />;
  }

  if (!["Admin", "Finance", "HR", "Staff"].includes(user?.role) || !canAccessPayroll) {
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
  // FEATURE: Appearance and server health monitoring
  // Runs when the app starts: applies the theme, refreshes logged-in settings,
  // watches system-theme changes, and starts/stops the API health check.
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
      {/* FEATURE: Public authentication, invoice viewing, and payment result pages */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LandingPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/register" element={<Navigate to="/" replace />} />
      <Route path="/verify-email" element={<Navigate to="/" replace />} />
      <Route path="/invoice/view/:invoiceId" element={<PublicInvoiceViewPage />} />
      <Route path="/payment/success" element={<PaymentSuccessPage />} />
      <Route path="/payment/cancelled" element={<PaymentCancelledPage />} />
      {/* FEATURE: Post-login module selection */}
      <Route
        path="/module-selection"
        element={
          <ModuleSelectionRoute />
        }
      />
      <Route path="/platform/companies" element={<PlatformOperatorRoute><PlatformCompaniesPage /></PlatformOperatorRoute>} />
      {/* FEATURE: INVOICE - ADMIN: reports, records, validation, and settings */}
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
        path="/dashboard/invoicing/admin/invoice-settings/numbering/history"
        element={
          <AdminInvoicingRoute>
            <AdminNumberingSettingsHistoryPage />
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
      {/* FEATURE: INVOICE - FINANCE */}
      <Route
        path="/dashboard/invoicing/finance/*"
        element={
          <FinanceInvoicingRoute>
            <FinanceInvoicingPage />
          </FinanceInvoicingRoute>
        }
      />
      {/* FEATURE: PAYROLL - ADMIN */}
      <Route
        path="/dashboard/payroll/admin/*"
        element={
          <AdminPayrollRoute>
            <AdminPayrollPage />
          </AdminPayrollRoute>
        }
      />
      {/* FEATURE: PAYROLL - FINANCE */}
      <Route
        path="/dashboard/payroll/finance/*"
        element={
          <FinancePayrollRoute>
            <FinancePayrollPage />
          </FinancePayrollRoute>
        }
      />
      {/* FEATURE: PAYROLL - HR */}
      <Route
        path="/dashboard/payroll/hr/*"
        element={
          <HRPayrollRoute>
            <HRPayrollPage />
          </HRPayrollRoute>
        }
      />
      {/* FEATURE: PAYROLL - STAFF */}
      <Route
        path="/dashboard/payroll/staff/*"
        element={
          <PersonalPayrollRoute>
            <StaffPayrollPage />
          </PersonalPayrollRoute>
        }
      />
      <Route
        path="/dashboard/settings"
        element={<SettingsRoute />}
      />
    </Routes>
  );
}
