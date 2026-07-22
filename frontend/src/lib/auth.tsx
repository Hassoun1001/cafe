import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { TOKEN_KEY, setUnauthorizedHandler } from './api';
import { decodeJwt } from './decodeJwt';

interface AuthContextValue {
  isAuthenticated: boolean;
  isAdmin: boolean;
  username: string | null;
  permissions: string[];
  // ADMIN always passes regardless of key — mirrors the backend's
  // requirePermission middleware so the UI hides exactly what the API would
  // reject anyway.
  can: (key: string) => boolean;
  login: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
  }, []);

  const login = useCallback((t: string) => {
    localStorage.setItem(TOKEN_KEY, t);
    setToken(t);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
  }, [logout]);

  const value = useMemo(() => {
    const payload = decodeJwt<{ role?: string; username?: string; permissions?: string[] }>(token);
    const isAdmin = payload?.role === 'ADMIN';
    const permissions = payload?.permissions ?? [];
    return {
      isAuthenticated: !!token,
      isAdmin,
      username: payload?.username ?? null,
      permissions,
      can: (key: string) => isAdmin || permissions.includes(key),
      login,
      logout,
    };
  }, [token, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
