import { Link, useNavigate } from "react-router-dom";
import {
  Mail,
  Lock,
  AtSign,
  Eye,
  EyeOff,
  Check,
  X,
  LoaderCircle,
} from "lucide-react";
import { useEffect, useState } from "react";

import { useAuth } from "../context/useAuth";
import { checkUsername } from "../services/authService";

import AuthLayout from "../components/AuthLayout";

function Signup() {
  const navigate = useNavigate();
  const { signup } = useAuth();

  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
  });

  const [showPassword, setShowPassword] = useState(false);

  const [usernameStatus, setUsernameStatus] = useState("idle");
  const [usernameMessage, setUsernameMessage] = useState("");

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { id, value } = e.target;

    setFormData((previous) => ({
      ...previous,
      [id]: value,
    }));

    if (id === "username") {
      setUsernameStatus("idle");
      setUsernameMessage("");
    }
  };

useEffect(() => {
  const username =
    formData.username.trim();

  const timer = setTimeout(
    async () => {
      if (!username) {
        setUsernameStatus("idle");
        setUsernameMessage("");
        return;
      }

      if (username.length < 3) {
        setUsernameStatus("invalid");
        setUsernameMessage(
          "Username must be at least 3 characters."
        );
        return;
      }

      try {
        setUsernameStatus("checking");

        const data =
          await checkUsername(
            username
          );

        if (data.available) {
          setUsernameStatus(
            "available"
          );

          setUsernameMessage(
            "Username is available."
          );
        } else {
          setUsernameStatus("taken");

          setUsernameMessage(
            data.message ||
              "Username is already taken."
          );
        }
      } catch {
        setUsernameStatus("error");

        setUsernameMessage(
          "Unable to check username."
        );
      }
    },
    username ? 500 : 0
  );

  return () => {
    clearTimeout(timer);
  };
}, [formData.username]);
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (usernameStatus !== "available") {
      setMessage("Please choose an available username.");
      return;
    }

    try {
      setLoading(true);
      setMessage("");

      await signup(formData);

      navigate("/onboarding");
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
            Join CoChat
          </span>

          <h1>Let's get started.</h1>

          <p>
            Create your account and start meeting
            people who share your interests.
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
          {/* Username */}

          <div className="input-group">
            <label htmlFor="username">
              Username
            </label>

            <div
              className={`input-wrapper username-wrapper ${
                usernameStatus === "available"
                  ? "input-success"
                  : usernameStatus === "taken" ||
                    usernameStatus === "invalid"
                  ? "input-error"
                  : ""
              }`}
            >
              <AtSign size={18} />

              <input
                id="username"
                type="text"
                placeholder="Choose a username"
                value={formData.username}
                onChange={handleChange}
                required
                autoComplete="username"
              />

              {usernameStatus === "checking" && (
                <LoaderCircle
                  size={18}
                  className="username-spinner"
                />
              )}

              {usernameStatus === "available" && (
                <Check
                  size={19}
                  className="username-success-icon"
                />
              )}

              {(usernameStatus === "taken" ||
                usernameStatus === "invalid") && (
                <X
                  size={19}
                  className="username-error-icon"
                />
              )}
            </div>

            {usernameMessage && (
              <p
                className={`username-feedback ${
                  usernameStatus === "available"
                    ? "feedback-success"
                    : usernameStatus === "taken" ||
                      usernameStatus === "invalid"
                    ? "feedback-error"
                    : ""
                }`}
              >
                {usernameMessage}
              </p>
            )}
          </div>

          {/* Email */}

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

          {/* Password */}

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
                placeholder="Create a password"
                value={formData.password}
                onChange={handleChange}
                required
                minLength={6}
                autoComplete="new-password"
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

          {/* Submit */}

          <button
            type="submit"
            className="auth-submit"
            disabled={
              loading ||
              usernameStatus !== "available"
            }
          >
            {loading
              ? "Creating account..."
              : "Create account"}
          </button>
        </form>

        {message && (
          <p className="auth-message">
            {message}
          </p>
        )}

        <p className="auth-terms">
          By creating an account, you agree to our
          <span> Terms</span> and{" "}
          <span> Privacy Policy</span>.
        </p>

        <p className="auth-switch">
          Already have an account?{" "}
          <Link to="/login">
            Log in
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}

export default Signup;