import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { STUDY_TOKEN_KEY, setStudyUnauthorizedHandler } from './studyApi';
import { decodeJwt } from './decodeJwt';

interface StudyAuthContextValue {
  isAuthenticated: boolean;
  isAdmin: boolean;
  username: string | null;
  permissions: string[];
  can: (key: string) => boolean;
  login: (token: string) => void;
  logout: () => void;
}

const StudyAuthContext = createContext<StudyAuthContextValue | null>(null);

export function StudyAuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(STUDY_TOKEN_KEY));

  const logout = useCallback(() => {
    localStorage.removeItem(STUDY_TOKEN_KEY);
    setToken(null);
  }, []);

  const login = useCallback((t: string) => {
    localStorage.setItem(STUDY_TOKEN_KEY, t);
    setToken(t);
  }, []);

  useEffect(() => {
    setStudyUnauthorizedHandler(logout);
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

  return <StudyAuthContext.Provider value={value}>{children}</StudyAuthContext.Provider>;
}

export function useStudyAuth() {
  const ctx = useContext(StudyAuthContext);
  if (!ctx) throw new Error('useStudyAuth must be used within StudyAuthProvider');
  return ctx;
}
