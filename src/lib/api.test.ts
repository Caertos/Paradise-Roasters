import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type ApiModule = typeof import("./api");

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
    user: {
      name: "Ada",
      email: "ada@example.com",
      email_verified: true,
      phone: null,
      role: "customer",
      last_login_at: null,
      created_at: "2026-01-01T00:00:00Z",
    },
  };
}

function headerOf(init: RequestInit | undefined, name: string) {
  return new Headers(init?.headers).get(name);
}

let api: ApiModule;
let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;

beforeEach(async () => {
  vi.resetModules();
  api = await import("./api");
  fetchMock = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState({}, "", "/");
});

describe("api client", () => {
  it("sends credentials, the CSRF header and the bearer token", async () => {
    api.setAccessToken("abc");
    fetchMock.mockResolvedValueOnce(json(200, { data: { ok: true } }));

    await expect(api.apiRequest("/auth/me")).resolves.toEqual({
      data: { ok: true },
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/auth/me`);
    expect(init?.credentials).toBe("include");
    expect(headerOf(init, "X-Requested-With")).toBe("XMLHttpRequest");
    expect(headerOf(init, "Accept")).toBe("application/json");
    expect(headerOf(init, "Authorization")).toBe("Bearer abc");
  });

  it("refreshes once for concurrent 401s and retries both requests with the new token", async () => {
    api.setAccessToken("old");

    let releaseRefresh!: () => void;
    const refreshGate = new Promise<void>((resolve) => {
      releaseRefresh = resolve;
    });

    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input);
      if (url === `${BASE}/auth/refresh`) {
        await refreshGate;
        return json(200, tokenPayload("new"));
      }
      const auth = headerOf(init, "Authorization");
      if (auth === "Bearer new") return json(200, { data: url });
      return json(401, { message: "Unauthenticated." });
    });

    const first = api.apiRequest(`/users/me`);
    const second = api.apiRequest(`/auth/me`);

    // Let both requests receive their 401 before the refresh completes.
    await vi.waitFor(() => {
      const refreshCalls = fetchMock.mock.calls.filter(
        ([u]) => String(u) === `${BASE}/auth/refresh`,
      );
      expect(refreshCalls).toHaveLength(1);
    });
    await new Promise((r) => setTimeout(r, 0));
    releaseRefresh();

    await expect(first).resolves.toEqual({ data: `${BASE}/users/me` });
    await expect(second).resolves.toEqual({ data: `${BASE}/auth/me` });

    const refreshCalls = fetchMock.mock.calls.filter(
      ([u]) => String(u) === `${BASE}/auth/refresh`,
    );
    expect(refreshCalls).toHaveLength(1);
    expect(refreshCalls[0][1]?.method).toBe("POST");

    const retried = fetchMock.mock.calls.filter(
      ([, init]) => headerOf(init, "Authorization") === "Bearer new",
    );
    expect(retried).toHaveLength(2);
    expect(api.getAccessToken()).toBe("new");
  });

  it("clears the session and redirects to /login with the intended URL when refresh fails", async () => {
    window.history.replaceState({}, "", "/user?tab=security");
    api.setAccessToken("stale");
    const redirect = vi.fn();
    const onExpired = vi.fn();
    api.setLoginRedirect(redirect);
    api.setSessionExpiredHandler(onExpired);

    fetchMock.mockImplementation(async (input) => {
      if (String(input) === `${BASE}/auth/refresh`) {
        return json(401, { message: "Invalid refresh token." });
      }
      return json(401, { message: "Unauthenticated." });
    });

    const error = await api.apiRequest("/users/me").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(api.ApiError);
    expect((error as InstanceType<ApiModule["ApiError"]>).status).toBe(401);
    expect(api.getAccessToken()).toBeNull();
    expect(onExpired).toHaveBeenCalledTimes(1);
    expect(redirect).toHaveBeenCalledTimes(1);
    expect(redirect).toHaveBeenCalledWith(
      "/login?redirect=%2Fuser%3Ftab%3Dsecurity",
    );
    // Original request + one refresh, no retry.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not try to refresh when the login endpoint returns 401", async () => {
    const redirect = vi.fn();
    api.setLoginRedirect(redirect);
    fetchMock.mockResolvedValueOnce(
      json(401, { message: "Invalid credentials." }),
    );

    const error = await api
      .apiRequest("/auth/login", { method: "POST", body: { email: "a" } })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(api.ApiError);
    expect((error as Error).message).toBe("Invalid credentials.");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(redirect).not.toHaveBeenCalled();
  });

  it("parses a 422 response into a typed ApiError with field errors", async () => {
    fetchMock.mockResolvedValueOnce(
      json(422, {
        message: "The email field is required.",
        errors: {
          email: ["The email field is required."],
          password: ["The password field must be at least 8 characters."],
        },
      }),
    );

    const error = await api
      .apiRequest("/auth/register", { method: "POST", body: {} })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(api.ApiError);
    const apiError = error as InstanceType<ApiModule["ApiError"]>;
    expect(apiError.status).toBe(422);
    expect(apiError.message).toBe("The email field is required.");
    expect(apiError.errors).toEqual({
      email: ["The email field is required."],
      password: ["The password field must be at least 8 characters."],
    });
  });

  it("sends JSON bodies and resolves 204 responses to undefined", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    await expect(
      api.apiRequest("/auth/logout", { method: "POST", body: { a: 1 } }),
    ).resolves.toBeUndefined();

    const [, init] = fetchMock.mock.calls[0];
    expect(init?.body).toBe(JSON.stringify({ a: 1 }));
    expect(headerOf(init, "Content-Type")).toBe("application/json");
  });
});
