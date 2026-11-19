import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";
import { cartItem, navItems, type NavItem } from "./nav.config";

import "./navbar.css";

const guestItems: NavItem[] = [
  { label: "Login", href: "/login" },
  { label: "Register", href: "/register" },
];

const Navbar = () => {
  const [open, setOpen] = useState(false);
  const { status, user, logout } = useAuth();
  const navigate = useNavigate();

  const close = () => setOpen(false);

  const renderLink = (item: NavItem) => (
    <li key={item.href} className="nav-item">
      <NavLink to={item.href} className="nav-link" onClick={close}>
        {item.label}
      </NavLink>
    </li>
  );

  async function handleLogout() {
    close();
    await logout();
    navigate("/");
  }

  return (
    <nav className="navbar">
      <button
        className={`hamburger ${open ? "hamburger--open" : ""}`}
        onClick={() => setOpen(!open)}
        aria-label="Toggle menu"
        type="button"
      >
        <span />
        <span />
        <span />
      </button>
      <button
        type="button"
        className={`nav-backdrop ${open ? "nav-backdrop--visible" : ""}`}
        onClick={close}
        aria-label="Close menu"
      />
      <ul className={`nav-list ${open ? "nav-list--open" : ""}`}>
        {navItems.map(renderLink)}
        {status === "guest" && guestItems.map(renderLink)}
        {status === "authenticated" && user && (
          <>
            <li className="nav-item">
              <NavLink
                to="/user"
                className="nav-link nav-link--user"
                onClick={close}
                title={user.name}
              >
                <span className="nav-link__name">{user.name}</span>
              </NavLink>
            </li>
            <li className="nav-item">
              <button
                type="button"
                className="nav-link nav-link--button"
                onClick={handleLogout}
              >
                Logout
              </button>
            </li>
          </>
        )}
        {renderLink(cartItem)}
      </ul>
    </nav>
  );
};

export default Navbar;
