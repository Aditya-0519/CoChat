import {
  GraduationCap,
  MapPin,
  Pencil,
  UserRound,
  X,
  Loader2,
  Plus,
  Camera,
} from "lucide-react";

import { useRef, useState } from "react";

import { useAuth } from "../context/useAuth";
import AppShell from "../components/AppShell";

function Profile() {
  const {
    user,
    updateProfile,
    uploadAvatar,
  } = useAuth();

  const avatarInputRef = useRef(null);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] =
    useState(false);

  const [error, setError] = useState("");
  const [avatarError, setAvatarError] = useState("");

  const [formData, setFormData] = useState({
    bio: "",
    college: "",
    branch: "",
    semester: "",
    interests: [],
  });

  const [interestInput, setInterestInput] = useState("");
  /*
   * Open avatar picker
   */
  const handleAvatarClick = () => {
    if (isUploadingAvatar) return;

    setAvatarError("");

    avatarInputRef.current?.click();
  };

  /*
   * Handle selected avatar
   */
  const handleAvatarChange = async (event) => {
    const file = event.target.files?.[0];

    // Reset input so selecting the same image again works.
    event.target.value = "";

    if (!file) return;

    setAvatarError("");

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.type)) {
      setAvatarError(
        "Please choose a JPG, PNG, or WebP image."
      );
      return;
    }

    const maxSize = 5 * 1024 * 1024;

    if (file.size > maxSize) {
      setAvatarError(
        "Image must be smaller than 5 MB."
      );
      return;
    }

    try {
      setIsUploadingAvatar(true);

      await uploadAvatar(file);
    } catch (err) {
      console.error("Avatar upload error:", err);

      setAvatarError(
        err.message ||
          "Something went wrong while uploading your avatar."
      );
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const openEditProfile = () => {
    setError("");

    setFormData({
      bio: user?.bio || "",
      college: user?.college || "",
      branch: user?.branch || "",
      semester: user?.semester || "",
      interests: Array.isArray(user?.interests)
        ? [...user.interests]
        : [],
    });

    setInterestInput("");
    setIsEditOpen(true);
  };

  const closeEditProfile = () => {
    if (isSaving) return;

    setIsEditOpen(false);
    setError("");
    setInterestInput("");
  };

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const addInterest = () => {
    const trimmedInterest =
      interestInput.trim();

    if (!trimmedInterest) return;

    const alreadyExists =
      formData.interests.some(
        (interest) =>
          interest.toLowerCase() ===
          trimmedInterest.toLowerCase()
      );

    if (alreadyExists) {
      setInterestInput("");
      return;
    }

    if (formData.interests.length >= 10) {
      setError(
        "You can add up to 10 interests."
      );
      return;
    }

    setFormData((previous) => ({
      ...previous,
      interests: [
        ...previous.interests,
        trimmedInterest,
      ],
    }));

    setInterestInput("");
    setError("");
  };

  const removeInterest = (
    interestToRemove
  ) => {
    setFormData((previous) => ({
      ...previous,
      interests:
        previous.interests.filter(
          (interest) =>
            interest !== interestToRemove
        ),
    }));
  };

  const handleInterestKeyDown = (
    event
  ) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addInterest();
    }
  };

  const handleSave = async (event) => {
    event.preventDefault();

    setError("");
    setIsSaving(true);

    try {
      await updateProfile({
        bio: formData.bio.trim(),
        college: formData.college.trim(),
        branch: formData.branch.trim(),
        semester: formData.semester,
        interests: formData.interests,
      });

      setIsEditOpen(false);
      setInterestInput("");
    } catch (err) {
      console.error(
        "Profile update error:",
        err
      );

      setError(
        err.message ||
          "Something went wrong while updating your profile."
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AppShell>
      <div className="profile-page">
        <div className="profile-identity-hero">
          <div className="profile-hero-copy">
            <span className="profile-hero-eyebrow">
              <UserRound size={14} />
              Your CoChat identity
            </span>
            <h1>
              This is <span>your space.</span>
            </h1>
            <p>
              Shape the profile people see when they discover you,
              connect with you, or start a conversation.
            </p>
          </div>

          <div className="profile-hero-orb" aria-hidden="true">
            <div className="profile-orb-ring profile-orb-ring-one" />
            <div className="profile-orb-ring profile-orb-ring-two" />
            <div className="profile-orb-glow" />
            <div className="profile-orb-avatar">
              {user?.avatar ? (
                <img src={user.avatar} alt="" />
              ) : (
                <UserRound size={44} />
              )}
              <span className="profile-orb-status" />
            </div>
          </div>
        </div>

        <div className="profile-card profile-card-new">
          <div className="profile-cover profile-cover-new">
            <div className="profile-cover-grid" />
            <div className="profile-cover-glow" />
            <span className="profile-cover-label">PROFILE / 01</span>
          </div>

          <div className="profile-content">
            <div className="profile-top">
              <div className="profile-avatar-wrapper">
                <button
                  type="button"
                  className="profile-avatar"
                  onClick={handleAvatarClick}
                  disabled={isUploadingAvatar}
                  aria-label="Change profile picture"
                >
                  {user?.avatar ? (
                    <img src={user.avatar} alt={`@${user.username}`} />
                  ) : (
                    <UserRound size={40} />
                  )}
                  <span className="profile-avatar-overlay">
                    {isUploadingAvatar ? (
                      <Loader2 size={20} className="profile-spinner" />
                    ) : (
                      <Camera size={20} />
                    )}
                  </span>
                </button>

                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleAvatarChange}
                  hidden
                />

                {isUploadingAvatar && (
                  <span className="profile-avatar-uploading">Uploading...</span>
                )}
              </div>

              <button
                type="button"
                className="profile-edit-button"
                onClick={openEditProfile}
              >
                <Pencil size={16} />
                Edit profile
              </button>
            </div>

            {avatarError && <div className="profile-avatar-error">{avatarError}</div>}

            <div className="profile-identity">
              <span className="profile-handle">@{user?.username}</span>
              <h2>{user?.bio || "Tell people a little about yourself."}</h2>
            </div>

            <div className="profile-details profile-details-new">
              {user?.college && (
                <div className="profile-detail profile-detail-card">
                  <span className="profile-detail-icon"><GraduationCap size={17} /></span>
                  <span><small>COLLEGE</small>{user.college}</span>
                </div>
              )}
              {user?.branch && (
                <div className="profile-detail profile-detail-card">
                  <span className="profile-detail-icon"><MapPin size={17} /></span>
                  <span><small>FIELD</small>{user.branch}{user.semester ? ` · Semester ${user.semester}` : ""}</span>
                </div>
              )}
            </div>

            {user?.interests?.length > 0 && (
              <section className="profile-section profile-section-new">
                <div className="profile-section-heading">
                  <div>
                    <span className="profile-section-kicker">INTERESTS</span>
                    <h2>Things I'm into</h2>
                  </div>
                  <span className="profile-interest-count">{user.interests.length} topics</span>
                </div>
                <div className="profile-interests">
                  {user.interests.map((interest, index) => (
                    <span key={interest} className="profile-interest">
                      <i>{String(index + 1).padStart(2, "0")}</i>
                      {interest}
                    </span>
                  ))}
                </div>
              </section>
            )}

            <div className="profile-footer-note">
              <span className="profile-footer-dot" />
              Your profile is visible to people you choose to connect with.
            </div>
          </div>
        </div>
      </div>

      {isEditOpen && (
        <div
          className="profile-edit-overlay"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeEditProfile();
            }
          }}
        >
          <div className="profile-edit-modal">
            <div className="profile-edit-header">
              <div>
                <span className="profile-edit-eyebrow">
                  Profile
                </span>

                <h2>Edit profile</h2>

                <p>
                  Keep your profile up to date
                  so people know who you are.
                </p>
              </div>

              <button
                type="button"
                className="profile-edit-close"
                onClick={closeEditProfile}
                disabled={isSaving}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <form
              className="profile-edit-form"
              onSubmit={handleSave}
            >
              {error && (
                <div className="profile-edit-error">
                  {error}
                </div>
              )}

              <div className="profile-edit-field">
                <label htmlFor="profile-bio">
                  Bio
                </label>

                <textarea
                  id="profile-bio"
                  name="bio"
                  value={formData.bio}
                  onChange={handleChange}
                  placeholder="Tell people a little about yourself..."
                  rows={4}
                  maxLength={160}
                />

                <span className="profile-field-count">
                  {formData.bio.length}/160
                </span>
              </div>

              <div className="profile-edit-field">
                <label htmlFor="profile-college">
                  College
                </label>

                <input
                  id="profile-college"
                  name="college"
                  type="text"
                  value={formData.college}
                  onChange={handleChange}
                  placeholder="Your college"
                  maxLength={120}
                />
              </div>

              <div className="profile-edit-row">
                <div className="profile-edit-field">
                  <label htmlFor="profile-branch">
                    Branch
                  </label>

                  <input
                    id="profile-branch"
                    name="branch"
                    type="text"
                    value={formData.branch}
                    onChange={handleChange}
                    placeholder="e.g. Computer Science"
                    maxLength={100}
                  />
                </div>

                <div className="profile-edit-field">
                  <label htmlFor="profile-semester">
                    Semester
                  </label>

                  <select
                    id="profile-semester"
                    name="semester"
                    value={formData.semester}
                    onChange={handleChange}
                  >
                    <option value="">
                      Select
                    </option>

                    <option value="1">
                      1
                    </option>
                    <option value="2">
                      2
                    </option>
                    <option value="3">
                      3
                    </option>
                    <option value="4">
                      4
                    </option>
                    <option value="5">
                      5
                    </option>
                    <option value="6">
                      6
                    </option>
                    <option value="7">
                      7
                    </option>
                    <option value="8">
                      8
                    </option>
                  </select>
                </div>
              </div>

              <div className="profile-edit-field">
                <label htmlFor="profile-interest">
                  Interests
                </label>

                <div className="profile-interest-input">
                  <input
                    id="profile-interest"
                    type="text"
                    value={interestInput}
                    onChange={(event) =>
                      setInterestInput(
                        event.target.value
                      )
                    }
                    onKeyDown={
                      handleInterestKeyDown
                    }
                    placeholder="e.g. Web Development"
                    maxLength={40}
                  />

                  <button
                    type="button"
                    onClick={addInterest}
                    disabled={
                      !interestInput.trim()
                    }
                    aria-label="Add interest"
                  >
                    <Plus size={18} />
                  </button>
                </div>

                {formData.interests.length >
                  0 && (
                  <div className="profile-edit-interests">
                    {formData.interests.map(
                      (interest) => (
                        <span
                          key={interest}
                          className="profile-edit-interest"
                        >
                          {interest}

                          <button
                            type="button"
                            onClick={() =>
                              removeInterest(
                                interest
                              )
                            }
                            aria-label={`Remove ${interest}`}
                          >
                            <X size={13} />
                          </button>
                        </span>
                      )
                    )}
                  </div>
                )}

                <span className="profile-field-help">
                  Press Enter or + to add an
                  interest. Maximum 10.
                </span>
              </div>

              <div className="profile-edit-actions">
                <button
                  type="button"
                  className="profile-cancel-button"
                  onClick={closeEditProfile}
                  disabled={isSaving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="profile-save-button"
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <>
                      <Loader2
                        size={16}
                        className="profile-spinner"
                      />
                      Saving...
                    </>
                  ) : (
                    "Save changes"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}

export default Profile;