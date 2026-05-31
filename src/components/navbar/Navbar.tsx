import { NavLink } from "react-router-dom";
import { HomeIcon, CartIcon } from "@/assets/Icons";

import "./navbar.css";

interface NavItem {
  label: React.ReactNode;
  href: string;
}

const navItems: NavItem[] = [
  { label: <HomeIcon />, href: "/" },
  { label: "Products", href: "/products" },
  { label: "About us", href: "/about" },
  { label: "Blogs", href: "/blogs" },
  { label: (<span className="cart-label">
              <CartIcon />
              <span>Cart</span>
           </span>
           ),
           href: "/cart" },
];

const Navbar: React.FC = () => {
  return (
    <nav className="navbar">
      <ul className="nav-list">
        {navItems.map((item) => (
          <li key={item.href} className="nav-item">
            <NavLink to={item.href} className="nav-link">
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
};

export default Navbar;
