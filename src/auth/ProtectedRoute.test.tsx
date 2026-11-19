import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import type { AuthContextValue } from "./authContext";
import ProtectedRoute from "./ProtectedRoute";
import { makeAuth, withAuth, testUser } from "./testAuth";

function LoginProbe() {
  const location = useLocation();
  return (
    <p data-testid="login-location">{`${location.pathname}${location.search}`}</p>
  );
}

function renderAt(path: string, auth: AuthContextValue) {
  return render(
    withAuth(
      auth,
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            path="/user"
            element={
              <ProtectedRoute>
                <p>Secret profile</p>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<LoginProbe />} />
        </Routes>
      </MemoryRouter>,
    ),
  );
}

// The Vitest setup does not enable globals, so RTL cannot auto-clean.
afterEach(cleanup);

describe("ProtectedRoute", () => {
  it("renders its children when authenticated", () => {
    renderAt("/user", makeAuth({ status: "authenticated", user: testUser }));

    expect(screen.getByText("Secret profile")).toBeInTheDocument();
  });

  it("redirects guests to /login preserving the intended path and query", () => {
    renderAt("/user?verified=1", makeAuth({ status: "guest" }));

    expect(screen.queryByText("Secret profile")).not.toBeInTheDocument();
    expect(screen.getByTestId("login-location")).toHaveTextContent(
      `/login?redirect=${encodeURIComponent("/user?verified=1")}`,
    );
  });

  it("renders neither the page nor a redirect while the session is loading", () => {
    renderAt("/user", makeAuth({ status: "loading" }));

    expect(screen.queryByText("Secret profile")).not.toBeInTheDocument();
    expect(screen.queryByTestId("login-location")).not.toBeInTheDocument();
  });
});
