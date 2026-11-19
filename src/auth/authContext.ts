import { createContext } from "react";
import type { RegisterInput, TokenPayload, User } from "../lib/authApi";

export type AuthStatus = "loading" | "authenticated" | "guest";

export interface AuthContextValue {
  user: User | null;
  status: AuthStatus;
  login: (email: string, password: string) => Promise<User>;
  register: (input: RegisterInput) => Promise<User>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  refreshUser: () => Promise<User>;
  /** Replaces the current user, e.g. after a profile edit. */
  setUser: (user: User) => void;
  /** Stores a fresh token pair, e.g. after a password change. */
  applySession: (payload: TokenPayload) => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
