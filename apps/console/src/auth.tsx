import type { StaffUser } from "@mycare/api-client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, onUnauthenticated } from "./api";

interface AuthState {
  user: StaffUser | null;
  checking: boolean;
  login: (email: string, password: string) => Promise<StaffUser>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

/**
 * Session state for the console. The browser holds the session cookie; this
 * only remembers who it belongs to. On load it asks /staff/me, so a refresh
 * keeps the person signed in for as long as the server session lasts — there is
 * no remember-me (ADR-0004).
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<StaffUser | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    api.auth
      .me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setChecking(false));
    return onUnauthenticated(() => setUser(null));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const signedIn = await api.auth.login(email, password);
    setUser(signedIn);
    return signedIn;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo(() => ({ user, checking, login, logout }), [user, checking, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const state = useContext(AuthContext);
  if (!state) throw new Error("useAuth must be used inside AuthProvider");
  return state;
}
