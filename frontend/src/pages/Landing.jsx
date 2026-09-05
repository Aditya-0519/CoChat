import { Link } from "react-router-dom";
import {
  GraduationCap,
  ArrowRight,
  Users,
  MessageCircle,
  ShieldCheck,
} from "lucide-react";

import Navbar from "../components/Navbar";
import BackgroundEffects from "../components/BackgroundEffects";

function Landing() {
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
            <button className="google-btn">
              <span className="google-icon">G</span>
              Continue with Google
            </button>

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