import { createBrowserRouter, Navigate } from "react-router-dom";
import AppLayout from "../layouts/AppLayout.jsx";
import Login from "../pages/Login.jsx";
import AdminDashboard from "../pages/AdminDashboard.jsx";
import FinanceDashboard from "../pages/FinanceDashboard.jsx";
import HRDashboard from "../pages/HRDashboard.jsx";
import StaffDashboard from "../pages/StaffDashboard.jsx";
import CustomerDashboard from "../pages/CustomerDashboard.jsx";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/login" replace /> },
      { path: "login", element: <Login /> },
      { path: "admin", element: <AdminDashboard /> },
      { path: "finance", element: <FinanceDashboard /> },
      { path: "hr", element: <HRDashboard /> },
      { path: "staff", element: <StaffDashboard /> },
      { path: "customer", element: <CustomerDashboard /> }
    ]
  }
]);
