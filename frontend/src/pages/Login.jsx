import { Link, useNavigate } from "react-router-dom";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
} from "lucide-react";
import { useState } from "react";

import { useAuth } from "../context/AuthContext";
import AuthLayout from "../components/AuthLayout";

function Login() {
  const navigate = useNavigate();

  const { login } = useAuth();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [showPassword, setShowPassword] =
    useState(false);

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.id]: e.target.value,
    });
  };

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

  return (
    <AuthLayout>
      <div className="auth-card">
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

        <button
          type="button"
          className="auth-google-btn"
        >
          <span className="google-icon">G</span>
          Continue with Google
        </button>

        <div className="auth-divider">
          <span>or</span>
        </div>

        <form
          className="auth-form"
          onSubmit={handleSubmit}
        >
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

          <button
            type="submit"
            className="auth-submit"
            disabled={loading}
          >
            {loading
              ? "Logging in..."
              : "Log in"}
          </button>
        </form>

        {message && (
          <p className="auth-message">
            {message}
          </p>
        )}

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