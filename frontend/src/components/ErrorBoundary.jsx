import { Component } from "react";
import { Link } from "react-router-dom";

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("CoChat UI error:", error, errorInfo);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="cochat-error-page">
        <div className="cochat-error-card">
          <span className="cochat-eyebrow">COCHAT</span>
          <h1>Something went wrong.</h1>
          <p>We couldn't load this screen. Try again or head back to your space.</p>
          <div className="cochat-error-actions">
            <button type="button" onClick={() => window.location.reload()}>
              Try again
            </button>
            <Link to="/dashboard">Back to dashboard</Link>
          </div>
        </div>
      </main>
    );
  }
}

export default ErrorBoundary;
