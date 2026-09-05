import { useAuth } from "../context/AuthContext";

function Dashboard() {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <div className="dashboard-page">
      <div className="dashboard-card">
        <span className="dashboard-badge">
          You're in
        </span>

        <h1>
          Hey, @{user.username} 👋
        </h1>

        <p>
          Welcome to CoChat. Your account is authenticated.
        </p>

        <div className="dashboard-user">
          <p>
            <strong>Username:</strong> @{user.username}
          </p>

          <p>
            <strong>Email:</strong> {user.email}
          </p>
        </div>

        <button
          className="auth-submit"
          onClick={handleLogout}
        >
          Log out
        </button>
      </div>
    </div>
  );
}

export default Dashboard;