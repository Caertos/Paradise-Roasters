import { useCallback, useEffect, useState, type ReactNode } from "react";
import { setAccessToken, setSessionExpiredHandler } from "../lib/api";
import * as authApi from "../lib/authApi";
import type { RegisterInput, TokenPayload, User } from "../lib/authApi";
import { AuthContext, type AuthStatus } from "./authContext";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  const applySession = useCallback((payload: TokenPayload) => {
    setAccessToken(payload.access_token);
    setUserState(payload.user);
    setStatus("authenticated");
  }, []);

  const clearSession = useCallback(() => {
    setUserState(null);
    setStatus("guest");
  }, []);

  useEffect(() => {
    let active = true;
    setSessionExpiredHandler(clearSession);

    // Restore the session from the refresh cookie. `refresh()` is single-flight,
    // so StrictMode's double effect run shares one request instead of
    // presenting the same (soon rotated) cookie twice.
    authApi
      .refresh()
      .then((payload) => {
        if (active) applySession(payload);
      })
      .catch(() => {
        if (active) clearSession();
      });

    return () => {
      active = false;
      setSessionExpiredHandler(null);
    };
  }, [applySession, clearSession]);

  const login = useCallback(
    async (email: string, password: string) => {
      const payload = await authApi.login(email, password);
      applySession(payload);
      return payload.user;
    },
    [applySession],
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      const payload = await authApi.register(input);
      applySession(payload);
      return payload.user;
    },
    [applySession],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const logoutAll = useCallback(async () => {
    try {
      await authApi.logoutAll();
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const refreshUser = useCallback(async () => {
    const fresh = await authApi.me();
    setUserState(fresh);
    return fresh;
  }, []);

  const setUser = useCallback((next: User) => setUserState(next), []);

  return (
    <AuthContext.Provider
      value={{
        user,
        status,
        login,
        register,
        logout,
        logoutAll,
        refreshUser,
        setUser,
        applySession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
