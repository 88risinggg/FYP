/**
 * EVALUATION HEADER
 * FEATURE: SHARED / APPLICATION CORE
 * PURPOSE: Implements the Organisation Setup Page screen and its page-level interactions.
 * LAYER: Frontend page - renders a complete screen and coordinates its user interactions.
 * FIND RELATED CODE: Trace its imports for UI components and frontend services used by this screen.
 */
import { Navigate } from "react-router-dom";

export default function OrganisationSetupPage() {
  return <Navigate to="/register" replace />;
}
