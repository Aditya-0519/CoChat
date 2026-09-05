import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

function AuthLayout({ children }) {
  return (
    <div className="auth-page">
      <div className="auth-background">
        <div className="auth-glow auth-glow-one"></div>
        <div className="auth-glow auth-glow-two"></div>
      </div>

      <Link to="/" className="auth-back">
        <ArrowLeft size={16} />
        Back to CoChat
      </Link>

      <div className="auth-container">
        <Link to="/" className="auth-logo">
          CoChat
        </Link>

        {children}
      </div>
    </div>
  );
}

export default AuthLayout;