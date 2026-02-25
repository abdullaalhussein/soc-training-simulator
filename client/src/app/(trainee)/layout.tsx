'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';

export default function TraineeLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useRequireAuth(['TRAINEE']);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  if (isLoading || !isAuthenticated) return null;

  const isInvestigation = pathname.startsWith('/scenario/');

  return (
    <div className="flex h-screen">
      <Sidebar
        mobileOpen={sidebarOpen}
        onMobileOpenChange={setSidebarOpen}
        defaultCollapsed={isInvestigation}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
