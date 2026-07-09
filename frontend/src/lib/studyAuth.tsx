import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { STUDY_TOKEN_KEY, setStudyUnauthorizedHandler } from './studyApi';

interface StudyAuthContextValue {
  isAuthenticated: boolean;
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

  const value = useMemo(() => ({ isAuthenticated: !!token, login, logout }), [token, login, logout]);

  return <StudyAuthContext.Provider value={value}>{children}</StudyAuthContext.Provider>;
}

export function useStudyAuth() {
  const ctx = useContext(StudyAuthContext);
  if (!ctx) throw new Error('useStudyAuth must be used within StudyAuthProvider');
  return ctx;
}
