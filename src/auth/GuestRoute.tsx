import type { ReactNode } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { safeRedirect } from "./redirect";
import { useAuth } from "./useAuth";

/** Keeps authenticated users away from guest-only pages (login, register). */
export default function GuestRoute({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const [params] = useSearchParams();

  if (status === "loading") return null;
  if (status === "authenticated") {
    // Honour ?redirect= so this agrees with the login form's own navigation.
    return <Navigate to={safeRedirect(params.get("redirect"))} replace />;
  }
  return children;
}
