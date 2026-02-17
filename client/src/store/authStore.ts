'use client';

import { useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'TRAINER' | 'TRAINEE';
}

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  login: (user: User, token: string, refreshToken: string) => void;
  logout: () => void;
  setUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      login: (user, token, refreshToken) => {
        localStorage.setItem('token', token);
        set({ user, token, refreshToken, isAuthenticated: true });
      },
      logout: () => {
        localStorage.removeItem('token');
        set({ user: null, token: null, refreshToken: null, isAuthenticated: false });
      },
      setUser: (user) => set({ user }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

/**
 * Hook that returns true once the auth store has finished rehydrating from localStorage.
 * Uses useSyncExternalStore to ensure hydration status and store state are read
 * in the same synchronous render cycle, avoiding race conditions.
 */
export function useAuthHydrated() {
  return useSyncExternalStore(
    useAuthStore.persist.onFinishHydration,
    useAuthStore.persist.hasHydrated,
    () => false
  );
}
