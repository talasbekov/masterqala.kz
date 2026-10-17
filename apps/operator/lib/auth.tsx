'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export interface AuthUser {
  id: string;
  phone: string;
  name: string | null;
  role: 'CLIENT' | 'OPERATOR';
}

interface AuthCtx {
  ready: boolean;
  user: AuthUser | null;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
}

const Ctx = createContext<AuthCtx>({ ready: false, user: null, login: () => {}, logout: () => {} });

function readStoredUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('user'), value = raw ? JSON.parse(raw) : null;
    return value && typeof value.id === 'string' && value.id.length > 0 &&
      typeof value.phone === 'string' && ['CLIENT', 'OPERATOR'].includes(value.role) &&
      (value.name === null || typeof value.name === 'string') ? value : null;
  } catch { return null; }
}

function clearOperatorDrafts() {
  try {
    for (const key of Object.keys(window.sessionStorage)) {
      if (key.startsWith('mq:operator:')) window.sessionStorage.removeItem(key);
    }
  } catch { /* Storage may be unavailable. */ }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => { setUser(readStoredUser()); setReady(true); }, []);

  const login = (token: string, u: AuthUser) => {
    if (user?.id !== u.id || user?.role !== u.role) clearOperatorDrafts();
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(u));
    setUser(u);
    setReady(true);
  };
  const logout = () => {
    clearOperatorDrafts();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return <Ctx.Provider value={{ ready, user, login, logout }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
