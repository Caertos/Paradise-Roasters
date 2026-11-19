import { createElement, type ReactNode } from "react";
import { vi } from "vitest";
import type { User } from "../lib/api";
import { AuthContext, type AuthContextValue } from "./authContext";

export const testUser: User = {
  name: "Ada Lovelace",
  email: "ada@example.com",
  email_verified: true,
  phone: null,
  role: "customer",
  last_login_at: null,
  created_at: "2026-01-01T00:00:00Z",
};

/** Builds an auth context value for tests; every action is a mock. */
export function makeAuth(
  overrides: Partial<AuthContextValue> = {},
): AuthContextValue {
  return {
    user: null,
    status: "guest",
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    logoutAll: vi.fn(),
    refreshUser: vi.fn(),
    setUser: vi.fn(),
    applySession: vi.fn(),
    ...overrides,
  };
}

/** Wraps `children` in an AuthContext provider holding `value`. */
export function withAuth(value: AuthContextValue, children: ReactNode) {
  return createElement(AuthContext.Provider, { value }, children);
}
