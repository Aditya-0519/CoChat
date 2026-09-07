import {
  ArrowRight,
  Compass,
  MessageCircle,
  Sparkles,
  UserRound,
  Users,
  Heart,
} from "lucide-react";

import { Link } from "react-router-dom";

import { useAuth } from "../context/useAuth";
import AppShell from "../components/AppShell";

function Dashboard() {
  const { user } = useAuth();
  const username = user?.username || "there";

return (
    <AppShell>
      <div className="dashboard-page">

        {/* =========================================
            DECORATIVE BACKGROUND
        ========================================= */}

        <div className="dashboard-glow dashboard-glow-left" />
        <div className="dashboard-glow dashboard-glow-right" />

        <div className="dashboard-orb dashboard-orb-large" />
        <div className="dashboard-orb dashboard-orb-small" />

        {/* =========================================
            HERO
        ========================================= */}

        <section className="dashboard-hero">

          <div className="dashboard-hero-content">

            <div className="dashboard-eyebrow">
              <Sparkles size={15} />
              <span>Your college space</span>
            </div>

            <p className="dashboard-greeting">
              Welcome back, @{username}
            </p>

            <h1>
              Meet your people.
              <br />
              <span>
                Start something meaningful.
              </span>
            </h1>

            <p className="dashboard-description">
              Discover interesting college
              students through shared interests,
              personality, and the things that
              make you who you are.
            </p>

            <div className="dashboard-actions">

              <Link
                to="/discover"
                className="dashboard-primary-button"
              >
                <Compass size={18} />
                <span>
                  Discover people
                </span>
                <ArrowRight size={17} />
              </Link>

              <Link
                to="/profile"
                className="dashboard-secondary-button"
              >
                <UserRound size={17} />
                <span>
                  View profile
                </span>
              </Link>

            </div>

            <div className="dashboard-note">
              <span>
                No pressure. No awkward
                introductions.
              </span>

              <Heart
                size={13}
                fill="currentColor"
              />
            </div>

          </div>

          {/* HERO VISUAL */}

          <div className="dashboard-visual">

            <div className="dashboard-visual-ring ring-one" />
            <div className="dashboard-visual-ring ring-two" />
            <div className="dashboard-visual-ring ring-three" />

            <div className="dashboard-sparkle sparkle-one">
              ✦
            </div>

            <div className="dashboard-sparkle sparkle-two">
              ✧
            </div>

            <div className="dashboard-interest-card interest-one">

              <div className="dashboard-interest-icon">
                💻
              </div>

              <div>
                <strong>Coding</strong>
                <span>
                  Find your people
                </span>
              </div>

            </div>

            <div className="dashboard-interest-card interest-two">

              <div className="dashboard-interest-icon">
                🎵
              </div>

              <div>
                <strong>Music</strong>
                <span>
                  Shared interests
                </span>
              </div>

            </div>

            <div className="dashboard-avatar-wrapper">

              <div className="dashboard-avatar-glow" />

              <div className="dashboard-avatar">

                {user?.avatar ? (
                  <img
                    src={user.avatar}
                    alt="Your profile"
                  />
                ) : (
                  <UserRound
                    size={42}
                    strokeWidth={1.8}
                  />
                )}

              </div>

            </div>

            <div className="dashboard-person person-one">
              <span>👨🏻‍💻</span>
            </div>

            <div className="dashboard-person person-two">
              <span>👩🏻‍🎨</span>
            </div>

            <div className="dashboard-person person-three">
              <span>🧑🏻‍🎧</span>
            </div>

          </div>

        </section>

        {/* =========================================
            QUICK ACTIONS
        ========================================= */}

        <section className="dashboard-actions-panel">

          <Link
            to="/discover"
            className="dashboard-action-card"
          >

            <div className="dashboard-action-icon">
              <Users size={21} />
            </div>

            <div className="dashboard-action-content">

              <h2>
                Discover people
              </h2>

              <p>
                Find students who share your
                interests and personality.
              </p>

            </div>

            <ArrowRight
              className="dashboard-action-arrow"
              size={19}
            />

          </Link>

          <div className="dashboard-action-divider" />

          <Link
            to="/messages"
            className="dashboard-action-card"
          >

            <div className="dashboard-action-icon">
              <MessageCircle size={21} />
            </div>

            <div className="dashboard-action-content">

              <h2>
                Start conversations
              </h2>

              <p>
                Connect with people and start
                meaningful conversations.
              </p>

            </div>

            <ArrowRight
              className="dashboard-action-arrow"
              size={19}
            />

          </Link>

          <div className="dashboard-action-divider" />

          <Link
            to="/profile"
            className="dashboard-action-card"
          >

            <div className="dashboard-action-icon">
              <Sparkles size={21} />
            </div>

            <div className="dashboard-action-content">

              <h2>
                Complete your profile
              </h2>

              <p>
                Tell people a little more about
                yourself and your interests.
              </p>

            </div>

            <ArrowRight
              className="dashboard-action-arrow"
              size={19}
            />

          </Link>

        </section>

        {/* =========================================
            BOTTOM INTRO
        ========================================= */}

        <section className="dashboard-bottom">

          <div>

            <span className="dashboard-bottom-eyebrow">
              <Sparkles size={14} />
              Made for college life
            </span>

            <h2>
              There's more to college
              <br />
              than just classrooms.
            </h2>

            <p>
              Find people to talk to, share
              interests, discover new
              perspectives, and make your
              college experience a little more
              interesting.
            </p>

          </div>

          <div className="dashboard-bottom-decoration">

            <div className="dashboard-decoration-circle circle-one" />
            <div className="dashboard-decoration-circle circle-two" />

            <div className="dashboard-chat-bubble">

              <MessageCircle size={27} />

              <span>...</span>

            </div>

          </div>

        </section>
</div>
    </AppShell>
  );
}

export default Dashboard;
