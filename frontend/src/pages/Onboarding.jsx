import { useState } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

const INTERESTS = [
  "Coding",
  "Gaming",
  "Music",
  "Movies",
  "Reading",
  "Sports",
  "Fitness",
  "Photography",
  "Travel",
  "Art",
  "Entrepreneurship",
  "Anime",
  "Books",
  "Technology",
  "Startups",
  "Design",
];

function Onboarding() {
  const navigate = useNavigate();
  const { user, updateProfile } = useAuth();

  const [step, setStep] = useState(1);

  const [formData, setFormData] = useState({
    bio: user?.bio || "",
    interests: user?.interests || [],
    college: user?.college || "",
    branch: user?.branch || "",
    semester: user?.semester || "",
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleBioChange = (e) => {
    setFormData({
      ...formData,
      bio: e.target.value,
    });
  };

  const toggleInterest = (interest) => {
    setFormData((previous) => {
      const alreadySelected =
        previous.interests.includes(interest);

      if (alreadySelected) {
        return {
          ...previous,
          interests: previous.interests.filter(
            (item) => item !== interest
          ),
        };
      }

      if (previous.interests.length >= 10) {
        return previous;
      }

      return {
        ...previous,
        interests: [...previous.interests, interest],
      };
    });
  };

  const handleNext = () => {
    setMessage("");

    if (step === 1) {
      if (formData.bio.trim().length > 160) {
        setMessage(
          "Your bio cannot be longer than 160 characters."
        );
        return;
      }
    }

    if (step === 2) {
      if (formData.interests.length < 3) {
        setMessage(
          "Pick at least 3 interests so people can get to know you."
        );
        return;
      }
    }

    setStep(step + 1);
  };

  const handleBack = () => {
    setMessage("");

    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.college.trim()) {
      setMessage("Please enter your college.");
      return;
    }

    if (!formData.branch.trim()) {
      setMessage("Please enter your branch.");
      return;
    }

    if (!formData.semester) {
      setMessage("Please select your semester.");
      return;
    }

    try {
      setLoading(true);
      setMessage("");

      await updateProfile({
        bio: formData.bio,
        interests: formData.interests,
        college: formData.college,
        branch: formData.branch,
        semester: Number(formData.semester),
      });

      navigate("/dashboard");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="onboarding-page">
      <div className="onboarding-background">
        <div className="onboarding-glow onboarding-glow-one" />
        <div className="onboarding-glow onboarding-glow-two" />
      </div>

      <div className="onboarding-container">
        <div className="onboarding-header">
          <span className="onboarding-logo">
            CoChat
          </span>

          <span className="onboarding-step">
            {step} / 3
          </span>
        </div>

        <div className="onboarding-progress">
          <div
            className="onboarding-progress-bar"
            style={{
              width: `${(step / 3) * 100}%`,
            }}
          />
        </div>

        <div className="onboarding-card">
          {step === 1 && (
            <div className="onboarding-content">
              <span className="onboarding-badge">
                Let's get to know you
              </span>

              <h1>Tell people a little about yourself.</h1>

              <p className="onboarding-description">
                Your bio is a chance to show what kind
                of person you are beyond your username.
              </p>

              <div className="onboarding-field">
                <label htmlFor="bio">Your bio</label>

                <textarea
                  id="bio"
                  value={formData.bio}
                  onChange={handleBioChange}
                  placeholder="I'm into coding, music and late-night conversations..."
                  maxLength={160}
                  rows={5}
                />

                <div className="character-count">
                  {formData.bio.length} / 160
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="onboarding-content">
              <span className="onboarding-badge">
                Find your people
              </span>

              <h1>What are you into?</h1>

              <p className="onboarding-description">
                Pick at least 3 interests. We'll use
                these later to help you discover people
                you might actually want to talk to.
              </p>

              <div className="interest-grid">
                {INTERESTS.map((interest) => {
                  const selected =
                    formData.interests.includes(interest);

                  return (
                    <button
                      key={interest}
                      type="button"
                      className={`interest-option ${
                        selected
                          ? "interest-selected"
                          : ""
                      }`}
                      onClick={() =>
                        toggleInterest(interest)
                      }
                    >
                      {selected && <Check size={15} />}
                      {interest}
                    </button>
                  );
                })}
              </div>

              <p className="interest-count">
                {formData.interests.length} selected
                {formData.interests.length >= 10
                  ? " · Maximum reached"
                  : " · Choose up to 10"}
              </p>
            </div>
          )}

          {step === 3 && (
            <form
              className="onboarding-content"
              onSubmit={handleSubmit}
            >
              <span className="onboarding-badge">
                Your college
              </span>

              <h1>Where do you study?</h1>

              <p className="onboarding-description">
                This helps CoChat build a better college
                community for you.
              </p>

              <div className="onboarding-form">
                <div className="onboarding-field">
                  <label htmlFor="college">
                    College
                  </label>

                  <input
                    id="college"
                    type="text"
                    placeholder="Your college name"
                    value={formData.college}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        college: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="onboarding-field">
                  <label htmlFor="branch">
                    Branch
                  </label>

                  <input
                    id="branch"
                    type="text"
                    placeholder="Computer Engineering"
                    value={formData.branch}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        branch: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="onboarding-field">
                  <label htmlFor="semester">
                    Semester
                  </label>

                  <select
                    id="semester"
                    value={formData.semester}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        semester: e.target.value,
                      })
                    }
                  >
                    <option value="">
                      Select semester
                    </option>

                    {Array.from(
                      { length: 8 },
                      (_, index) => index + 1
                    ).map((semester) => (
                      <option
                        key={semester}
                        value={semester}
                      >
                        Semester {semester}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </form>
          )}

          {message && (
            <p className="onboarding-message">
              {message}
            </p>
          )}

          <div className="onboarding-actions">
            {step > 1 ? (
              <button
                type="button"
                className="onboarding-back"
                onClick={handleBack}
                disabled={loading}
              >
                <ArrowLeft size={17} />
                Back
              </button>
            ) : (
              <div />
            )}

            {step < 3 ? (
              <button
                type="button"
                className="onboarding-next"
                onClick={handleNext}
              >
                Continue
                <ArrowRight size={17} />
              </button>
            ) : (
              <button
                type="button"
                className="onboarding-next"
                onClick={handleSubmit}
                disabled={loading}
              >
                {loading
                  ? "Saving..."
                  : "Complete profile"}
                {!loading && <Check size={17} />}
              </button>
            )}
          </div>
        </div>

        <p className="onboarding-footer">
          You can update your profile later.
        </p>
      </div>
    </div>
  );
}

export default Onboarding;