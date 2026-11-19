import type { ReactNode } from "react";

import "./form.css";

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  className?: string;
}

/** Shared hero + card shell for the guest auth pages. */
export default function AuthLayout({
  title,
  subtitle,
  children,
  className = "",
}: AuthLayoutProps) {
  return (
    <div className={`auth-page page-bg ${className}`.trim()}>
      <section className="page-hero">
        <div className="container">
          <h1 className="page-hero__title">{title}</h1>
          <p className="page-hero__subtitle">{subtitle}</p>
        </div>
      </section>
      <section className="auth-page__body">
        <div className="container">
          <div className="form-card">{children}</div>
        </div>
      </section>
    </div>
  );
}
