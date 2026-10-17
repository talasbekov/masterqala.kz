'use client';
import { createContext, useContext, useState, type ReactNode } from 'react';
import {clearPlannedDraft} from './planned-draft';
import {clearDesktopAccountDrafts} from '../components/desktop-account/address-draft';
import {clearDesktopDisputeDrafts} from '../components/desktop-dispute/draft';
import { resetSocket } from './socket';
import {clearNewOrderDraft} from './new-order-draft';
import {claimGuestDraft,clearGuestDraft} from './guest-draft';

export interface AuthUser {
  id: string;
  phone: string;
  name: string | null;
  role: 'CLIENT' | 'OPERATOR';
}

interface AuthCtx {
  guestTransfer: ReturnType<typeof claimGuestDraft>;
  user: AuthUser | null;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
}

const Ctx = createContext<AuthCtx>({ user: null, guestTransfer:'none', login: () => {}, logout: () => {} });

function readStoredUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('user');
  return raw ? JSON.parse(raw) : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(readStoredUser);
  const [guestTransfer,setGuestTransfer]=useState<ReturnType<typeof claimGuestDraft>>('none');

  const login = (token: string, u: AuthUser) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(u));
    setGuestTransfer(claimGuestDraft(u.id));
    setUser(u);
  };
  const logout = () => {
    clearNewOrderDraft();
    clearDesktopAccountDrafts();
    clearDesktopDisputeDrafts();
    clearPlannedDraft();
    clearGuestDraft();
    setGuestTransfer('none');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    resetSocket();
    setUser(null);
  };

  return <Ctx.Provider value={{ user, guestTransfer, login, logout }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
