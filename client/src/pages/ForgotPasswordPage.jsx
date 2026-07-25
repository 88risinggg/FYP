import { Link } from "react-router-dom";
import AuthLayout from "../components/auth/AuthLayout.jsx";

export default function ForgotPasswordPage() {
  return (
    <AuthLayout title="Forgot your password?" description="Password resets are managed by your organisation administrator.">
      <p className="text-sm leading-6 text-[#6f5b55]">
        Contact your Admin to reset your password through User Management. This keeps account recovery inside the existing approval process.
      </p>
      <Link
        to="/login"
        className="mt-6 inline-flex w-full justify-center rounded-lg bg-[#F38978] px-4 py-3 font-semibold text-[#251E1F] hover:brightness-105"
      >
        Return to Log In
      </Link>
    </AuthLayout>
  );
}
