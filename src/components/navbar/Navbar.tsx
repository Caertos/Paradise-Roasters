import { useState } from "react";
import { NavLink } from "react-router-dom";
import { HomeIcon, CartIcon } from "@/assets/Icons";

import "./navbar.css";

interface NavItem {
  label: React.ReactNode;
  href: string;
}

const navItems: NavItem[] = [
  { label: <><HomeIcon /><span className="home-text">Home</span></>, href: "/" },
  { label: "Products", href: "/products" },
  { label: "About us", href: "/about" },
  { label: "Blogs", href: "/blogs" },
  {
    label: (
      <span className="cart-label">
        <CartIcon />
        <span>Cart</span>
      </span>
    ),
    href: "/cart",
  },
];

const Navbar: React.FC = () => {
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
