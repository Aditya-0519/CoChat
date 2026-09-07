import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  GraduationCap,
  ArrowRight,
  Users,
  MessageCircle,
  ShieldCheck,
} from "lucide-react";
import { GoogleLogin } from "@react-oauth/google";

import Navbar from "../components/Navbar";
import BackgroundEffects from "../components/BackgroundEffects";
import { useAuth } from "../context/useAuth";

function Landing() {
  const { user, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState("");

  const handleGoogleSuccess = async (credentialResponse) => {
    if (!credentialResponse?.credential) {
      setGoogleError("Google sign-in failed. Please try again.");
      return;
    }

    try {
      setGoogleLoading(true);
      setGoogleError("");

      const data = await loginWithGoogle(
        credentialResponse.credential
      );

      const loggedInUser = data?.user || user;

      if (loggedInUser?.profileCompleted) {
        navigate("/dashboard");
      } else {
        navigate("/onboarding");
      }
    } catch (error) {
      console.error("Google login error:", error);

      setGoogleError(
        error.message || "Unable to sign in with Google."
      );
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGoogleError = () => {
    setGoogleError(
      "Google sign-in was cancelled or failed. Please try again."
    );
  };

  return (
    <div className="landing-page">
      <Navbar />

      <BackgroundEffects />

      <main className="hero">
        <div className="hero-content">

          {/* Badge */}
          <div className="badge">
            <GraduationCap size={16} />
            <span>College students</span>
          </div>

          {/* Heading */}
          <h1>
            Meet people.
            <br />
            <span>Start conversations.</span>
          </h1>

          {/* Description */}
          <p>
            Discover interesting college students through
            interests and personality — not appearances.
          </p>

          {/* CTA buttons */}
          <div className="hero-buttons">

            {/* Real Google Login */}
<div className="landing-google-login">
  <div className="google-custom-button">
    <span className="google-custom-icon">G</span>
    <span>Continue with Google</span>
  </div>

  <div className="google-real-login">
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
  </div>

  {googleLoading && (
    <p className="google-loading">
      Signing you in with Google...
    </p>
  )}

  {googleError && (
    <p className="google-error">
      {googleError}
    </p>
  )}
</div>

            {/* Create account */}
            <Link to="/signup" className="signup-btn">
              <span>Create an account</span>
              <ArrowRight size={18} />
            </Link>
          </div>

          <div className="hero-note">
            No pressure. No awkward introductions.
            <span>♥</span>
          </div>

          {/* Feature panel */}
          <section className="features-panel">

            <div className="feature">
              <div className="feature-icon">
                <Users size={22} />
              </div>

              <div>
                <h3>Real connections</h3>
                <p>
                  Meaningful conversations
                  with real college students.
                </p>
              </div>
            </div>

            <div className="feature-divider"></div>

            <div className="feature">
              <div className="feature-icon">
                <MessageCircle size={22} />
              </div>

              <div>
                <h3>Shared interests</h3>
                <p>
                  Find people who vibe
                  with what you love.
                </p>
              </div>
            </div>

            <div className="feature-divider"></div>

            <div className="feature">
              <div className="feature-icon">
                <ShieldCheck size={22} />
              </div>

              <div>
                <h3>Safe & respectful</h3>
                <p>
                  A safe space to be yourself
                  and connect freely.
                </p>
              </div>
            </div>

          </section>
        </div>
      </main>
    </div>
  );
}

export default Landing;