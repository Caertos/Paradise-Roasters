import { act, cleanup, render, screen } from "@testing-library/react";
import { StrictMode, useEffect } from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearAccessToken, getAccessToken } from "../lib/api";
import { AuthProvider } from "./AuthProvider";
import ProtectedRoute from "./ProtectedRoute";
import { testUser } from "./testAuth";
import { FakeBroadcastChannel } from "./testBroadcastChannel";
import { useAuth } from "./useAuth";

const BASE = "http://api.test/api";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function tokenPayload(token: string) {
  return {
    access_token: token,
    token_type: "Bearer",
    expires_in: 900,
    user: testUser,
  };
}

let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;
/** The latest context value, published after each commit. */
const probe: { auth?: ReturnType<typeof useAuth> } = {};

function AuthProbe() {
  const value = useAuth();
  useEffect(() => {
    probe.auth = value;
  });
  return <p data-testid="status">{value.status}</p>;
}

function LoginProbe() {
  const location = useLocation();
  return (
    <p data-testid="login-location">{`${location.pathname}${location.search}`}</p>
  );
}

function renderProvider(path = "/") {
  return render(
    <AuthProvider>
      <AuthProbe />
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/" element={null} />
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
      </MemoryRouter>
    </AuthProvider>,
  );
}

/** Another tab's end of the auth channel. */
function otherTab() {
  return new FakeBroadcastChannel("paradise-auth");
}

function refreshCalls() {
  return fetchMock.mock.calls.filter(
    ([url]) => String(url) === `${BASE}/auth/refresh`,
  );
}

beforeEach(() => {
  clearAccessToken();
  fetchMock = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("BroadcastChannel", FakeBroadcastChannel);
});

afterEach(() => {
  cleanup();
  FakeBroadcastChannel.reset();
  vi.unstubAllGlobals();
  clearAccessToken();
});

describe("AuthProvider cross-tab sync", () => {
  it("goes to guest without any request when another tab logs out", async () => {
    fetchMock.mockResolvedValueOnce(json(200, tokenPayload("tab-token")));
    renderProvider("/user?tab=security");
    expect(await screen.findByText("Secret profile")).toBeInTheDocument();
    expect(getAccessToken()).toBe("tab-token");
    const tab = otherTab();

    act(() => tab.postMessage({ type: "logout" }));

    await vi.waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("guest"),
    );
    expect(getAccessToken()).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // ProtectedRoute sends the tab to the login page with its intended URL.
    expect(screen.queryByText("Secret profile")).not.toBeInTheDocument();
    expect(screen.getByTestId("login-location")).toHaveTextContent(
      `/login?redirect=${encodeURIComponent("/user?tab=security")}`,
    );
  });

  it("broadcasts logout to other tabs and does not react to its own message", async () => {
    fetchMock
      .mockResolvedValueOnce(json(200, tokenPayload("tab-token")))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    renderProvider();
    await vi.waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("authenticated"),
    );
    const tab = otherTab();
    const received = vi.fn();
    tab.onmessage = (event) => received(event.data);

    await act(() => probe.auth!.logout());

    await vi.waitFor(() =>
      expect(received).toHaveBeenCalledWith({ type: "logout" }),
    );
    expect(screen.getByTestId("status")).toHaveTextContent("guest");
    // Initial refresh + logout; nothing triggered by its own broadcast.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("broadcasts logout from logoutAll", async () => {
    fetchMock
      .mockResolvedValueOnce(json(200, tokenPayload("tab-token")))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    renderProvider();
    await vi.waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("authenticated"),
    );
    const tab = otherTab();
    const received = vi.fn();
    tab.onmessage = (event) => received(event.data);

    await act(() => probe.auth!.logoutAll());

    await vi.waitFor(() =>
      expect(received).toHaveBeenCalledWith({ type: "logout" }),
    );
  });

  it("broadcasts login and restores the session in a guest tab via refresh", async () => {
    fetchMock.mockResolvedValueOnce(json(401, { message: "No session." }));
    renderProvider();
    await vi.waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("guest"),
    );
    fetchMock.mockResolvedValueOnce(json(200, tokenPayload("restored")));
    const tab = otherTab();

    act(() => tab.postMessage({ type: "login" }));

    await vi.waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("authenticated"),
    );
    expect(getAccessToken()).toBe("restored");
    expect(refreshCalls()).toHaveLength(2);
  });

  it("does not refresh on a login broadcast when already authenticated", async () => {
    fetchMock.mockResolvedValueOnce(json(200, tokenPayload("tab-token")));
    renderProvider();
    await vi.waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("authenticated"),
    );

    act(() => otherTab().postMessage({ type: "login" }));
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(refreshCalls()).toHaveLength(1);
  });

  it("broadcasts login after a successful login", async () => {
    fetchMock
      .mockResolvedValueOnce(json(401, { message: "No session." }))
      .mockResolvedValueOnce(json(200, tokenPayload("fresh")));
    renderProvider();
    await vi.waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("guest"),
    );
    const tab = otherTab();
    const received = vi.fn();
    tab.onmessage = (event) => received(event.data);

    await act(() => probe.auth!.login("ada@example.com", "secret-password"));

    await vi.waitFor(() =>
      expect(received).toHaveBeenCalledWith({ type: "login" }),
    );
    expect(screen.getByTestId("status")).toHaveTextContent("authenticated");
    expect(refreshCalls()).toHaveLength(1);
  });

  it("keeps exactly one channel under StrictMode and closes it on unmount", async () => {
    fetchMock.mockResolvedValue(json(401, { message: "No session." }));
    const { unmount } = render(
      <StrictMode>
        <AuthProvider>
          <AuthProbe />
        </AuthProvider>
      </StrictMode>,
    );
    await vi.waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("guest"),
    );

    expect(FakeBroadcastChannel.open()).toHaveLength(1);

    unmount();

    expect(FakeBroadcastChannel.open()).toHaveLength(0);
  });

  it("works without BroadcastChannel", async () => {
    vi.stubGlobal("BroadcastChannel", undefined);
    fetchMock
      .mockResolvedValueOnce(json(200, tokenPayload("tab-token")))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    renderProvider();
    await vi.waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("authenticated"),
    );

    await act(() => probe.auth!.logout());

    expect(screen.getByTestId("status")).toHaveTextContent("guest");
    expect(getAccessToken()).toBeNull();
  });
});
