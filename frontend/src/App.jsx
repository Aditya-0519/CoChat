function App() {
  return (
    <div className="landing-page">
      <nav className="navbar">
        <div className="logo">CoChat</div>

        <button className="login-btn">
          Log in
        </button>
      </nav>

      <section className="hero">
        <div className="hero-content">
          <span className="badge">🎓 College students only</span>

          <h1>
            Meet people.
            <br />
            <span>Start conversations.</span>
          </h1>

          <p>
            Discover interesting college students through
            interests and personality — not appearances.
          </p>

          <div className="hero-buttons">
            <button className="google-btn">
              Continue with Google
            </button>

            <button className="signup-btn">
              Create an account
            </button>
          </div>

          <small>
            No pressure. No awkward introductions.
          </small>
        </div>
      </section>
    </div>
  );
}

export default App;