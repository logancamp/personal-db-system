import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { queryClient } from "./query-client";
import { abortAllRequests } from "./api-client";
import { resetSessionState } from "./session-reset";

// Only the base64 Basic-auth token is kept, in sessionStorage (cleared when the tab closes).
// Any script on the page can read it, so keep XSS surface small. See SECURITY.md.
const STORAGE_KEY = "auth.basicToken";

interface AuthContextValue {
  basicToken: string | null;
  username: string | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function encode(username: string, password: string) {
  return btoa(`${username}:${password}`);
}

function readInitialToken(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function getCurrentUsername(): string | null {
  return decodeUsername(readInitialToken());
}

function decodeUsername(token: string | null): string | null {
  if (!token) return null;
  try {
    return atob(token).split(":")[0] ?? null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [basicToken, setBasicToken] = useState<string | null>(readInitialToken);

  const login = useCallback((username: string, password: string) => {
    const token = encode(username, password);
    try {
      sessionStorage.setItem(STORAGE_KEY, token);
    } catch {
      // storage unavailable; the in-memory value still applies
    }
    abortAllRequests();
    resetSessionState();
    queryClient.clear();
    setBasicToken(token);
  }, []);

  const logout = useCallback(() => {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // storage unavailable; the in-memory value still applies
    }
    abortAllRequests();
    resetSessionState();
    queryClient.clear();
    setBasicToken(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      basicToken,
      username: decodeUsername(basicToken),
      isAuthenticated: basicToken !== null,
      login,
      logout,
    }),
    [basicToken, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
