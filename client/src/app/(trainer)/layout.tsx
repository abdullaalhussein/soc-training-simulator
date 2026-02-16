'use client';

import { useRequireAuth } from '@/hooks/useRequireAuth';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';

export default function TrainerLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useRequireAuth(['TRAINER', 'ADMIN']);

  if (!isAuthenticated) return null;

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
