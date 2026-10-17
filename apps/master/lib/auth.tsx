'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { resetSocket } from './socket';
import {clearMasterApplicationDrafts} from './master-application-draft';
import {clearMasterDisputeDrafts} from '../components/desktop-dispute/draft';
import {clearPlannedDrafts} from './plannedDraft';
import {clearUrgentQuoteDrafts} from '../components/desktop-urgent/quoteDraft';

export interface AuthUser {
  id: string;
  phone: string;
  name: string | null;
  role: 'CLIENT' | 'OPERATOR';
}

interface AuthCtx {
  ready:boolean;
  user: AuthUser | null;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
}

const Ctx = createContext<AuthCtx>({ ready:false,user: null, login: () => {}, logout: () => {} });

function readStoredUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  try {const raw=localStorage.getItem('user'),value=raw?JSON.parse(raw):null;return value&&typeof value.id==='string'&&typeof value.phone==='string'&&['CLIENT','OPERATOR'].includes(value.role)?value:null;}catch{return null;}
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready,setReady]=useState(false);
  useEffect(()=>{setUser(readStoredUser());setReady(true);},[]);

  const login = (token: string, u: AuthUser) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(u));
    setUser(u);
    setReady(true);
  };
  const logout = () => {
    clearMasterApplicationDrafts();
    clearMasterDisputeDrafts();
    clearUrgentQuoteDrafts();
    try{clearPlannedDrafts(window.sessionStorage);}catch{/* Storage can be unavailable. */}
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    resetSocket();
    setUser(null);
  };

  return <Ctx.Provider value={{ ready,user, login, logout }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
