'use client';

import { useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { disconnectAll } from '@/lib/socket';
import { api, clearCsrfToken } from '@/lib/api';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'TRAINER' | 'TRAINEE';
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
  setUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      login: (user, _token) => {
        // C-1: Token is set as httpOnly cookie by the server — NOT stored in localStorage.
        set({ user, token: null, isAuthenticated: true });
      },
      logout: () => {
        // Best-effort server-side token revocation (cookies sent automatically)
        try { api.post('/auth/logout', {}); } catch {}
        disconnectAll();
        clearCsrfToken();
        set({ user: null, token: null, isAuthenticated: false });
      },
      setUser: (user) => set({ user }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        // Do NOT persist token — httpOnly cookies handle auth
      }),
    }
  )
);

/**
 * Hook that returns true once the auth store has finished rehydrating from localStorage.
 * Uses useSyncExternalStore to ensure hydration status and store state are read
 * in the same synchronous render cycle, avoiding race conditions.
 */
const subscribe = (onStoreChange: () => void) => {
  if (useAuthStore.persist?.onFinishHydration) {
    return useAuthStore.persist.onFinishHydration(onStoreChange);
  }
  return () => {};
};
const getSnapshot = () => useAuthStore.persist?.hasHydrated?.() ?? false;
const getServerSnapshot = () => false;

export function useAuthHydrated() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
