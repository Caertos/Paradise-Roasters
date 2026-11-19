import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  clearAccessToken,
  getAccessToken,
  setAccessToken,
  setSessionExpiredHandler,
} from "../lib/api";
import * as authApi from "../lib/authApi";
import type { RegisterInput, TokenPayload, User } from "../lib/authApi";
import { openAuthChannel, type AuthChannel } from "../lib/crossTab";
import { AuthContext, type AuthStatus } from "./authContext";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const channelRef = useRef<AuthChannel | null>(null);

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

    // Other tabs share the refresh cookie but not the in-memory access token.
    const channel = openAuthChannel((message) => {
      if (!active) return;
      if (message.type === "logout") {
        // The server session is already gone: drop local state, no request.
        clearAccessToken();
        clearSession();
        return;
      }
      // Another tab logged in: a guest tab restores the session from the new
      // cookie through the single-flight, cross-tab-locked refresh.
      if (getAccessToken() !== null) return;
      authApi
        .refresh()
        .then((payload) => {
          if (active) applySession(payload);
        })
        .catch(() => {
          // Stay a guest; the cookie may have been revoked meanwhile.
        });
    });
    channelRef.current = channel;

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
      channel.close();
      if (channelRef.current === channel) channelRef.current = null;
    };
  }, [applySession, clearSession]);

  const startSession = useCallback(
    (payload: TokenPayload) => {
      applySession(payload);
      channelRef.current?.post({ type: "login" });
      return payload.user;
    },
    [applySession],
  );

  /** Ends this tab's session and tells the other tabs to do the same. */
  const endSession = useCallback(() => {
    clearSession();
    channelRef.current?.post({ type: "logout" });
  }, [clearSession]);

  const login = useCallback(
    (email: string, password: string) =>
      authApi.login(email, password).then(startSession),
    [startSession],
  );

  const register = useCallback(
    (input: RegisterInput) => authApi.register(input).then(startSession),
    [startSession],
  );

  // Promise `.finally()` instead of `try/finally`, which the React Compiler
  // cannot lower: the session ends whether or not the request succeeds.
  const logout = useCallback(
    () => authApi.logout().finally(endSession),
    [endSession],
  );

  const logoutAll = useCallback(
    () => authApi.logoutAll().finally(endSession),
    [endSession],
  );

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
