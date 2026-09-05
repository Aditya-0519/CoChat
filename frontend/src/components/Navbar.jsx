import { Link } from "react-router-dom";

function Navbar() {
  return (
    <nav className="navbar">
      <Link to="/" className="logo">
        CoChat
      </Link>

      <Link to="/login" className="login-btn">
        Log in
      </Link>
    </nav>
  );
}

export default Navbar;