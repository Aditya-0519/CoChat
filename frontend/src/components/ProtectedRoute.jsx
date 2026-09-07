import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "../context/useAuth";

function ProtectedRoute() {
  const {
    user,
    loading,
    isAuthenticated,
  } = useAuth();

  const location = useLocation();

  // Wait until authentication is checked
  if (loading) {
    return (
      <div className="auth-loading">

        <div className="auth-loading-spinner" />

        <p>Loading CoChat...</p>

      </div>
    );
  }

  // Not logged in
  if (!isAuthenticated || !user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: location.pathname,
        }}
      />
    );
  }

  // Logged in but profile is incomplete
  if (
    !user.profileCompleted &&
    location.pathname !== "/onboarding"
  ) {
    return <Navigate to="/onboarding" replace />;
  }

  // Profile already completed
  // Don't allow completed users to go back to onboarding
  if (
    user.profileCompleted &&
    location.pathname === "/onboarding"
  ) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}

export default ProtectedRoute;