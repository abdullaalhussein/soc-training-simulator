'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export function DefaultCredentialsBanner() {
  const { data } = useQuery({
    queryKey: ['security', 'default-credentials'],
    queryFn: async () => {
      const { data } = await api.get('/security/default-credentials');
      return data as { hasDefaultCredentials: boolean; accounts: string[] };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false,
  });

  if (!data?.hasDefaultCredentials) return null;

  return (
    <div className="mx-4 mt-4 rounded-lg border border-red-300 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/50">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-red-800 dark:text-red-300">
            Default Credentials Detected
          </h3>
          <p className="mt-1 text-sm text-red-700 dark:text-red-400">
            The following accounts still use the default password (<code className="rounded bg-red-100 px-1 dark:bg-red-900">Password123!</code>):
          </p>
          <ul className="mt-1 list-inside list-disc text-sm text-red-700 dark:text-red-400">
            {data.accounts.map((email) => (
              <li key={email}>{email}</li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-red-700 dark:text-red-400">
            Change these passwords immediately via{' '}
            <Link href="/users" className="font-medium underline hover:text-red-900 dark:hover:text-red-200">
              User Management
            </Link>.
          </p>
        </div>
      </div>
    </div>
  );
}
