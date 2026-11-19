/**
 * Minimal fetch wrapper for the Paradise API.
 *
 * - The access token lives only in this module's memory (never in Web Storage).
 * - The refresh token is an HttpOnly cookie, so every request uses
 *   `credentials: "include"` plus the `X-Requested-With` CSRF header.
 * - A 401 triggers a single-flight `POST /auth/refresh` and one retry.
 */

const API_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "");

/** Endpoints whose 401 must never trigger a refresh-and-retry. */
const NO_REFRESH_PATHS = new Set([
  "/auth/login",
  "/auth/register",
  "/auth/refresh",
  "/auth/logout",
]);

export type FieldErrors = Record<string, string[]>;

export class ApiError extends Error {
  readonly status: number;
  readonly errors?: FieldErrors;

  constructor(status: number, message: string, errors?: FieldErrors) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errors = errors;
  }
}

export interface User {
  name: string;
  email: string;
  email_verified: boolean;
  phone: string | null;
  role: string;
  last_login_at: string | null;
  created_at: string;
}

export interface TokenPayload {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  user: User;
}

// --- In-memory session -------------------------------------------------------

let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function clearAccessToken(): void {
  accessToken = null;
}

let sessionExpiredHandler: (() => void) | null = null;

/** Registers the callback the auth state uses to learn the session is gone. */
export function setSessionExpiredHandler(handler: (() => void) | null): void {
  sessionExpiredHandler = handler;
}

export function buildLoginUrl(intended: string): string {
  return `/login?redirect=${encodeURIComponent(intended)}`;
}

const assignLocation = (url: string) => {
  window.location.assign(url);
};

let loginRedirect: (url: string) => void = assignLocation;

/**
 * Overrides how the client navigates to the login page (tests, router).
 * Passing `null` restores the default full-page navigation.
 */
export function setLoginRedirect(
  redirect: ((url: string) => void) | null,
): void {
  loginRedirect = redirect ?? assignLocation;
}

function expireSession(): void {
  clearAccessToken();
  sessionExpiredHandler?.();
  const { pathname, search } = window.location;
  loginRedirect(buildLoginUrl(`${pathname}${search}`));
}

// --- Requests ----------------------------------------------------------------

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: HeadersInit;
  signal?: AbortSignal;
}

async function send(
  path: string,
  options: RequestOptions,
  token: string | null,
): Promise<Response> {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  headers.set("X-Requested-With", "XMLHttpRequest");
  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return fetch(`${API_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    credentials: "include",
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
  });
}

async function parseBody(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function toResult<T>(response: Response): Promise<T> {
  const body = await parseBody(response);
  if (response.ok) return body as T;

  const shape =
    body && typeof body === "object"
      ? (body as { message?: unknown; errors?: unknown })
      : {};
  const message =
    typeof shape.message === "string" && shape.message
      ? shape.message
      : response.statusText || `Request failed with status ${response.status}`;
  const errors =
    shape.errors && typeof shape.errors === "object"
      ? (shape.errors as FieldErrors)
      : undefined;
  throw new ApiError(response.status, message, errors);
}

let refreshPromise: Promise<TokenPayload> | null = null;

/**
 * Exchanges the refresh cookie for a new token pair. Single-flight: concurrent
 * callers share one request, because the backend treats reuse of a rotated
 * refresh token as theft and revokes the whole family.
 */
export function refreshSession(): Promise<TokenPayload> {
  if (!refreshPromise) {
    refreshPromise = send("/auth/refresh", { method: "POST" }, null)
      .then((response) => toResult<TokenPayload>(response))
      .then((payload) => {
        setAccessToken(payload.access_token);
        return payload;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

export async function apiRequest<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const tokenUsed = accessToken;
  const response = await send(path, options, tokenUsed);

  if (response.status !== 401 || NO_REFRESH_PATHS.has(path)) {
    return toResult<T>(response);
  }

  // Another request may already have refreshed while this one was in flight.
  if (accessToken === tokenUsed || accessToken === null) {
    try {
      await refreshSession();
    } catch {
      expireSession();
      return toResult<T>(response);
    }
  }

  return toResult<T>(await send(path, options, accessToken));
}
