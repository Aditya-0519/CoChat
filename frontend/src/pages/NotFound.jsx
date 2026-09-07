import { Link } from "react-router-dom";
import { Compass } from "lucide-react";

function NotFound() {
  return (
    <main className="cochat-error-page">
      <div className="cochat-error-orbit" aria-hidden="true">
        <div className="cochat-error-orbit-core">
          <Compass size={32} />
        </div>
      </div>

      <div className="cochat-error-card">
        <span className="cochat-eyebrow">404 · LOST IN THE CHAT</span>
        <h1>This conversation doesn't exist.</h1>
        <p>The page you're looking for may have moved, expired, or never existed.</p>
        <Link className="cochat-error-primary" to="/dashboard">
          Back to CoChat
        </Link>
      </div>
    </main>
  );
}

export default NotFound;
