import { Link, useNavigate } from "react-router-dom";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
} from "lucide-react";
import { useState } from "react";
import { GoogleLogin } from "@react-oauth/google";

import { useAuth } from "../context/useAuth";
import AuthLayout from "../components/AuthLayout";

function Login() {
  const navigate = useNavigate();

  const { login, loginWithGoogle } = useAuth();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.id]: e.target.value,
    });
  };

  // ==========================================
  // EMAIL / PASSWORD LOGIN
  // ==========================================

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setLoading(true);
      setMessage("");

      const data = await login(formData);

      if (data.user.profileCompleted) {
        navigate("/dashboard");
      } else {
        navigate("/onboarding");
      }
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // GOOGLE LOGIN
  // ==========================================

  const handleGoogleSuccess = async (credentialResponse) => {
    if (!credentialResponse?.credential) {
      setMessage("Google login failed. Please try again.");
      return;
    }

    try {
      setGoogleLoading(true);
      setMessage("");

      const data = await loginWithGoogle(
        credentialResponse.credential
      );

      if (data.user.profileCompleted) {
        navigate("/dashboard");
      } else {
        navigate("/onboarding");
      }
    } catch (error) {
      setMessage(
        error.message || "Unable to sign in with Google."
      );
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGoogleError = () => {
    setGoogleLoading(false);
    setMessage("Google login failed. Please try again.");
  };

  return (
    <AuthLayout>
      <div className="auth-card">

        {/* ==========================================
            HEADING
        ========================================== */}

        <div className="auth-heading">
          <span className="auth-badge">
            Welcome back
          </span>

          <h1>Good to see you.</h1>

          <p>
            Log in to continue meeting people
            and starting conversations.
          </p>
        </div>

        {/* ==========================================
            GOOGLE LOGIN
        ========================================== */}

        <div className="google-login-wrapper">
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={handleGoogleError}
            useOneTap={false}
            theme="outline"
            size="large"
            text="continue_with"
            shape="rectangular"
            width="100%"
          />

          {googleLoading && (
            <p className="google-loading">
              Signing in with Google...
            </p>
          )}
        </div>

        {/* ==========================================
            DIVIDER
        ========================================== */}

        <div className="auth-divider">
          <span>or</span>
        </div>

        {/* ==========================================
            EMAIL / PASSWORD FORM
        ========================================== */}

        <form
          className="auth-form"
          onSubmit={handleSubmit}
        >

          {/* EMAIL */}

          <div className="input-group">
            <label htmlFor="email">
              Email
            </label>

            <div className="input-wrapper">
              <Mail size={18} />

              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={formData.email}
                onChange={handleChange}
                required
                autoComplete="email"
              />
            </div>
          </div>

          {/* PASSWORD */}

          <div className="input-group">
            <label htmlFor="password">
              Password
            </label>

            <div className="input-wrapper password-wrapper">
              <Lock size={18} />

              <input
                id="password"
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
                placeholder="Enter your password"
                value={formData.password}
                onChange={handleChange}
                required
                autoComplete="current-password"
              />

              <button
                type="button"
                className="password-toggle"
                onClick={() =>
                  setShowPassword(!showPassword)
                }
                aria-label={
                  showPassword
                    ? "Hide password"
                    : "Show password"
                }
              >
                {showPassword ? (
                  <EyeOff size={18} />
                ) : (
                  <Eye size={18} />
                )}
              </button>
            </div>
          </div>

          {/* LOGIN BUTTON */}

          <button
            type="submit"
            className="auth-submit"
            disabled={loading || googleLoading}
          >
            {loading
              ? "Logging in..."
              : "Log in"}
          </button>
        </form>

        {/* ==========================================
            MESSAGE
        ========================================== */}

        {message && (
          <p className="auth-message">
            {message}
          </p>
        )}

        {/* ==========================================
            SIGNUP LINK
        ========================================== */}

        <p className="auth-switch">
          Don't have an account?{" "}
          <Link to="/signup">
            Create one
          </Link>
        </p>

      </div>
    </AuthLayout>
  );
}

export default Login;