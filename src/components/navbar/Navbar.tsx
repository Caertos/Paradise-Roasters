import { useState } from "react";
import { NavLink } from "react-router-dom";
import { navItems } from "./nav.config";

import "./navbar.css";

const Navbar = () => {
  const [open, setOpen] = useState(false);

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
        onClick={() => setOpen(false)}
        aria-label="Close menu"
      />
      <ul className={`nav-list ${open ? "nav-list--open" : ""}`}>
        {navItems.map((item) => (
          <li key={item.href} className="nav-item">
            <NavLink
              to={item.href}
              className="nav-link"
              onClick={() => setOpen(false)}
            >
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
};

export default Navbar;