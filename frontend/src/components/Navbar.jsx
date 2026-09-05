import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

function Navbar() {
  return (
    <nav className="navbar">
      <Link to="/" className="logo">
        CoChat
      </Link>

      <Link to="/login" className="login-btn">
        <span>Log in</span>
        <ArrowRight size={17} />
      </Link>
    </nav>
  );
}

export default Navbar;