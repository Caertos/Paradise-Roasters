import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { buildLoginUrl } from "../lib/api";
import { useAuth } from "./useAuth";

/** Renders its children only for an authenticated user. */
export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();

  if (status === "loading") return null;
  if (status === "guest") {
    return (
      <Navigate
        to={buildLoginUrl(`${location.pathname}${location.search}`)}
        replace
      />
    );
  }
  return children;
}
