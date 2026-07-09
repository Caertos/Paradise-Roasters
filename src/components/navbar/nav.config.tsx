import type { ReactNode } from "react";
import { HomeIcon, CartIcon } from "@/assets/Icons";

export interface NavItem {
  label: ReactNode;
  href: string;
}

export const navItems: NavItem[] = [
  {
    label: (
      <>
        <HomeIcon />
        <span className="home-text">Home</span>
      </>
    ),
    href: "/",
  },
  { label: "Products", href: "/products" },
  { label: "About us", href: "/about" },
  { label: "Blogs", href: "/blogs" },
  { label: "User", href: "/user" },
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