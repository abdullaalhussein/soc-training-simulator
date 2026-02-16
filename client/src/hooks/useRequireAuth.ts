'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';

export function useRequireAuth(allowedRoles?: string[]) {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated || !user) {
      router.push('/login');
      return;
    }

    if (allowedRoles && !allowedRoles.includes(user.role)) {
      switch (user.role) {
        case 'ADMIN':
          router.push('/users');
          break;
        case 'TRAINER':
          router.push('/console');
          break;
        case 'TRAINEE':
          router.push('/dashboard');
          break;
      }
    }
  }, [isAuthenticated, user, allowedRoles, router]);

  return { user, isAuthenticated };
}
