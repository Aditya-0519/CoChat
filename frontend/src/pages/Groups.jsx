import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  UsersRound,
  Plus,
  Search,
  X,
  Check,
  LoaderCircle,
  MessageCircle,
  UserRound,
  Compass,
  Sparkles,
} from "lucide-react";

import AppShell from "../components/AppShell";
import { useAuth } from "../context/useAuth";
import {
  createGroup,
  getGroups,
} from "../services/groupService";
import { getConnections } from "../services/connectionService";

function getId(value) {
  if (!value) return "";

  if (typeof value === "string") {
    return value;
  }

  if (value._id) {
    return value._id.toString();
  }

  if (value.id) {
    return value.id.toString();
  }

  return value.toString();
}

function Groups() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [groups, setGroups] = useState([]);
  const [connections, setConnections] = useState([]);

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const [showCreateModal, setShowCreateModal] =
    useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] =
    useState("");

  const [selectedMembers, setSelectedMembers] =
    useState([]);

  const [memberSearch, setMemberSearch] =
    useState("");

  const [error, setError] = useState("");

  const currentUserId = getId(user);

  const heroMembers = useMemo(() => {
    const map = new Map();

    if (user?._id || user?.id) {
      map.set(currentUserId, user);
    }

    groups.forEach((group) => {
      (group?.participants || []).forEach((member) => {
        const id = getId(member);
        if (id && !map.has(id)) {
          map.set(id, member);
        }
      });
    });

    return Array.from(map.values()).slice(0, 5);
  }, [groups, user, currentUserId]);

 useEffect(() => {
  let mounted = true;

  const loadData = async () => {
    try {
      if (mounted) {
        setLoading(true);
        setError("");
      }

      const [
        groupsResponse,
        connectionsResponse,
      ] = await Promise.all([
        getGroups(),
        getConnections(),
      ]);

      if (!groupsResponse?.success) {
        throw new Error(
          groupsResponse?.message ||
            "Unable to load groups."
        );
      }

      if (!connectionsResponse?.success) {
        throw new Error(
          connectionsResponse?.message ||
            "Unable to load connections."
        );
      }

      if (!mounted) return;

      setGroups(
        groupsResponse.groups || []
      );

      setConnections(
        connectionsResponse.connections || []
      );
    } catch (err) {
      if (!mounted) return;

      console.error(
        "Groups load error:",
        err
      );

      setError(
        err.message ||
          "Unable to load groups."
      );
    } finally {
      if (mounted) {
        setLoading(false);
      }
    }
  };

  loadData();

  return () => {
    mounted = false;
  };
}, []);

  const filteredConnections = useMemo(() => {
    const query =
      memberSearch.trim().toLowerCase();

    if (!query) return connections;

    return connections.filter((connection) => {
      const person =
        connection.requester &&
        getId(connection.requester) !==
          currentUserId
          ? connection.requester
          : connection.recipient;

      const username =
        person?.username?.toLowerCase() || "";

      return username.includes(query);
    });
  }, [
    connections,
    memberSearch,
    currentUserId,
  ]);

  const getConnectionUser = (connection) => {
    const requester =
      connection?.requester;

    if (
      requester &&
      getId(requester) !== currentUserId
    ) {
      return requester;
    }

    return connection?.recipient;
  };

  const toggleMember = (userId) => {
    setSelectedMembers((previous) => {
      if (previous.includes(userId)) {
        return previous.filter(
          (id) => id !== userId
        );
      }

      if (previous.length >= 49) {
        return previous;
      }

      return [...previous, userId];
    });
  };

  const resetModal = () => {
    setName("");
    setDescription("");
    setSelectedMembers([]);
    setMemberSearch("");
    setError("");
  };

  const closeModal = () => {
    if (creating) return;

    setShowCreateModal(false);
    resetModal();
  };

  const handleCreate = async (event) => {
    event.preventDefault();

    const cleanName = name.trim();

    if (!cleanName) {
      setError("Please enter a group name.");
      return;
    }

    if (cleanName.length < 2) {
      setError(
        "Group name must contain at least 2 characters."
      );
      return;
    }

    if (cleanName.length > 80) {
      setError(
        "Group name cannot exceed 80 characters."
      );
      return;
    }

    try {
      setCreating(true);
      setError("");

      const response = await createGroup({
        name: cleanName,
        description: description.trim(),
        memberIds: selectedMembers,
      });

      if (!response?.success) {
        throw new Error(
          response?.message ||
            "Unable to create group."
        );
      }

      if (response.group) {
        setGroups((previous) => [
          response.group,
          ...previous,
        ]);

        setShowCreateModal(false);
        resetModal();

        navigate(
          `/groups/${getId(response.group)}`
        );
      }
    } catch (err) {
      console.error(
        "Create group error:",
        err
      );

      setError(
        err.message ||
          "Unable to create group."
      );
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="groups-page">
          <div className="groups-loading">
            <LoaderCircle
              size={28}
              className="spin"
            />

            <span>
              Loading your groups...
            </span>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="groups-page">
        <div className="groups-container">
          <section className="groups-hero">
            <div className="groups-hero-copy">
              <div className="groups-eyebrow">
                <Compass size={14} />
                Your circles
              </div>

              <h1>
                Find your people
                <br />
                <span>and build together.</span>
              </h1>

              <p>
                Create private spaces for the people you actually want to
                talk with, study with, and build memories with.
              </p>

              <button
                type="button"
                className="groups-create-button groups-create-button-hero"
                onClick={() => setShowCreateModal(true)}
              >
                <Plus size={17} />
                Create a group
              </button>
            </div>

            <div className="groups-hero-visual" aria-hidden="true">
              <div className="groups-hero-orbit groups-hero-orbit-one" />
              <div className="groups-hero-orbit groups-hero-orbit-two" />
              <div className="groups-hero-glow" />

              <div className="groups-hero-center">
                {user?.avatar ? (
                  <div
                    className="groups-hero-avatar-image"
                    style={{ backgroundImage: `url(${user.avatar})` }}
                  />
                ) : (
                  <UserRound size={48} strokeWidth={1.8} />
                )}
                <span className="groups-hero-online" />
              </div>

              <div className="groups-hero-member-stack">
                {heroMembers.slice(0, 4).map((member, index) => (
                  <div
                    className={`groups-hero-member groups-hero-member-${index + 1}`}
                    key={getId(member) || index}
                  >
                    {member?.avatar ? (
                      <img src={member.avatar} alt="" />
                    ) : (
                      <UserRound size={17} />
                    )}
                  </div>
                ))}
              </div>

              <div className="groups-hero-floating groups-hero-floating-one">
                <Sparkles size={17} />
              </div>

              <div className="groups-hero-floating groups-hero-floating-two">
                <UsersRound size={18} />
              </div>
            </div>
          </section>

          {error && !showCreateModal && (
            <div className="groups-error">
              {error}
            </div>
          )}

          {groups.length === 0 ? (
            <section className="groups-empty">
              <div className="groups-empty-icon">
                <UsersRound size={30} />
              </div>

              <h2>No groups yet</h2>

              <p>
                Start a private space with your
                connections. Study together, chat,
                plan something, or just hang out.
              </p>

              <button
                type="button"
                className="groups-create-button"
                onClick={() =>
                  setShowCreateModal(true)
                }
              >
                <Plus size={18} />
                Create your first group
              </button>
            </section>
          ) : (
            <section className="groups-section">
              <div className="groups-section-heading">
                <div>
                  <span className="groups-section-kicker">YOUR SPACES</span>
                  <h2>Your groups</h2>
                </div>
                <span className="groups-section-count">
                  {groups.length} {groups.length === 1 ? "group" : "groups"}
                </span>
              </div>

              <div className="groups-grid">
              {groups.map((group) => {
                const groupId =
                  getId(group?._id);

                /*
                 * IMPORTANT:
                 * Remove duplicate participants before
                 * displaying avatars.
                 *
                 * If MongoDB/API accidentally returns:
                 *
                 * [Aditya, Aditya, Aditya, Rahul]
                 *
                 * the UI becomes:
                 *
                 * [Aditya, Rahul]
                 */
                const rawMembers =
                  group?.participants || [];

                const uniqueMembers = Array.from(
                  new Map(
                    rawMembers
                      .filter(Boolean)
                      .map((member) => [
                        getId(member),
                        member,
                      ])
                  ).values()
                );

                const visibleMembers =
                  uniqueMembers.slice(0, 4);

                return (
                  <button
                    key={groupId}
                    type="button"
                    className="group-card"
                    onClick={() =>
                      navigate(
                        `/groups/${groupId}`
                      )
                    }
                  >
                    <div className="group-card-top">
                      <div className="group-card-icon">
                        <UsersRound size={22} />
                      </div>

                      <span className="group-card-arrow">
                        →
                      </span>
                    </div>

                    <div className="group-card-body">
                      <h2>{group.name}</h2>

                      {group.description ? (
                        <p>
                          {group.description}
                        </p>
                      ) : (
                        <p className="group-card-muted">
                          No description
                        </p>
                      )}
                    </div>

                    <div className="group-card-footer">
                      <div className="group-avatar-stack">
                        {visibleMembers.map(
                          (member) => (
                            <div
                              className="group-small-avatar"
                              key={getId(member)}
                            >
                              {member?.avatar ? (
                                <img
                                  src={member.avatar}
                                  alt=""
                                />
                              ) : (
                                <UserRound
                                  size={13}
                                />
                              )}
                            </div>
                          )
                        )}

                        {uniqueMembers.length > 4 && (
                          <div className="group-small-avatar group-more-avatar">
                            +
                            {uniqueMembers.length -
                              4}
                          </div>
                        )}
                      </div>

                      <span className="group-member-count">
                        {uniqueMembers.length}{" "}
                        {uniqueMembers.length === 1
                          ? "member"
                          : "members"}
                      </span>
                    </div>
                  </button>
                );
              })}
              </div>
            </section>
          )}
        </div>

        {showCreateModal && (
          <div
            className="groups-modal-backdrop"
            onMouseDown={(event) => {
              if (
                event.target ===
                event.currentTarget
              ) {
                closeModal();
              }
            }}
          >
            <div className="groups-modal">
              <div className="groups-modal-header">
                <div>
                  <span className="groups-modal-kicker">
                    NEW GROUP
                  </span>

                  <h2>Create a group</h2>

                  <p>
                    Choose the people you want
                    inside your private space.
                  </p>
                </div>

                <button
                  type="button"
                  className="groups-modal-close"
                  onClick={closeModal}
                  disabled={creating}
                >
                  <X size={19} />
                </button>
              </div>

              <form
                onSubmit={handleCreate}
                className="groups-create-form"
              >
                <div className="groups-field">
                  <label htmlFor="group-name">
                    Group name
                  </label>

                  <input
                    id="group-name"
                    type="text"
                    value={name}
                    onChange={(event) =>
                      setName(
                        event.target.value
                      )
                    }
                    placeholder="e.g. DSA Squad"
                    maxLength={80}
                    autoFocus
                    disabled={creating}
                  />
                </div>

                <div className="groups-field">
                  <label htmlFor="group-description">
                    Description{" "}
                    <span>optional</span>
                  </label>

                  <textarea
                    id="group-description"
                    value={description}
                    onChange={(event) =>
                      setDescription(
                        event.target.value
                      )
                    }
                    placeholder="What is this group about?"
                    maxLength={300}
                    rows={3}
                    disabled={creating}
                  />
                </div>

                <div className="groups-member-section">
                  <div className="groups-member-heading">
                    <div>
                      <label>
                        Add connections
                      </label>

                      <span>
                        {
                          selectedMembers.length
                        }{" "}
                        selected
                      </span>
                    </div>

                    <span>
                      Optional
                    </span>
                  </div>

                  {connections.length > 0 && (
                    <div className="groups-search">
                      <Search size={17} />

                      <input
                        type="text"
                        value={memberSearch}
                        onChange={(event) =>
                          setMemberSearch(
                            event.target.value
                          )
                        }
                        placeholder="Search connections..."
                        disabled={creating}
                      />
                    </div>
                  )}

                  <div className="groups-member-list">
                    {filteredConnections.length ===
                    0 ? (
                      <div className="groups-no-connections">
                        <MessageCircle
                          size={20}
                        />

                        <span>
                          {connections.length ===
                          0
                            ? "You don't have any connections yet."
                            : "No connections match your search."}
                        </span>
                      </div>
                    ) : (
                      filteredConnections.map(
                        (connection) => {
                          const person =
                            getConnectionUser(
                              connection
                            );

                          if (!person) return null;

                          const personId =
                            getId(person);

                          const selected =
                            selectedMembers.includes(
                              personId
                            );

                          return (
                            <button
                              type="button"
                              key={personId}
                              className={`groups-member-row ${
                                selected
                                  ? "groups-member-row-selected"
                                  : ""
                              }`}
                              onClick={() =>
                                toggleMember(
                                  personId
                                )
                              }
                              disabled={creating}
                            >
                              <div className="groups-member-avatar">
                                {person.avatar ? (
                                  <img
                                    src={
                                      person.avatar
                                    }
                                    alt=""
                                  />
                                ) : (
                                  <UserRound
                                    size={17}
                                  />
                                )}
                              </div>

                              <div className="groups-member-info">
                                <strong>
                                  {
                                    person.username
                                  }
                                </strong>

                                {person.college && (
                                  <span>
                                    {
                                      person.college
                                    }
                                  </span>
                                )}
                              </div>

                              <div
                                className={`groups-member-check ${
                                  selected
                                    ? "groups-member-check-selected"
                                    : ""
                                }`}
                              >
                                {selected && (
                                  <Check
                                    size={14}
                                  />
                                )}
                              </div>
                            </button>
                          );
                        }
                      )
                    )}
                  </div>
                </div>

                {error && (
                  <div className="groups-form-error">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  className="groups-submit-button"
                  disabled={
                    creating ||
                    !name.trim()
                  }
                >
                  {creating ? (
                    <>
                      <LoaderCircle
                        size={18}
                        className="spin"
                      />
                      Creating...
                    </>
                  ) : (
                    <>
                      <UsersRound size={18} />
                      Create group
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

export default Groups;