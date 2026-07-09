import type { ButtonHTMLAttributes } from "react";

import "./button.css";

type ButtonVariant = "default" | "join" | "products";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export default function Button({
  variant = "default",
  className = "",
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  const variantClass = variant !== "default" ? `button--${variant}` : "";
  const combined = `button ${variantClass} ${className}`.replace(/\s+/g, " ").trim();

  return (
    <button className={combined} type={type} {...rest}>
      {children}
    </button>
  );
}