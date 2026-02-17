'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/lib/utils';
import {
  Shield, LayoutDashboard, Users, FileText, Settings, Activity,
  Monitor, BarChart3, BookOpen, ClipboardList, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useMobile } from '@/hooks/useMobile';

const navItems = {
  TRAINEE: [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  ],
  TRAINER: [
    { href: '/console', label: 'Console', icon: Monitor },
    { href: '/scenario-guide', label: 'Scenarios', icon: BookOpen },
    { href: '/reports', label: 'Reports', icon: BarChart3 },
  ],
  ADMIN: [
    { href: '/users', label: 'Users', icon: Users },
    { href: '/scenarios', label: 'Scenarios', icon: BookOpen },
    { href: '/audit', label: 'Audit Log', icon: ClipboardList },
    { href: '/settings', label: 'Settings', icon: Settings },
  ],
};

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
}

export function Sidebar({ mobileOpen, onMobileOpenChange }: SidebarProps) {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const [collapsed, setCollapsed] = useState(false);
  const isMobile = useMobile();

  if (!user) return null;

  const items = navItems[user.role] || [];

  const navContent = (
    <>
      <nav className="flex-1 p-2 space-y-1">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => onMobileOpenChange?.(false)}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {(isMobile || !collapsed) && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>
      <div className="border-t p-3">
        {(isMobile || !collapsed) && (
          <div className="text-xs text-muted-foreground">
            <p className="font-medium text-foreground truncate">{user.name}</p>
            <p className="truncate">{user.email}</p>
          </div>
        )}
      </div>
    </>
  );

  if (isMobile) {
    return (
      <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
        <SheetContent side="left" className="w-64 p-0 flex flex-col">
          <SheetHeader className="px-4 py-3 border-b">
            <SheetTitle className="flex items-center gap-2 text-sm">
              <Shield className="h-5 w-5 text-primary" />
              SOC Simulator
            </SheetTitle>
          </SheetHeader>
          {navContent}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <aside
      className={cn(
        'flex flex-col border-r bg-card transition-all duration-300',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      <div className="flex h-16 items-center border-b px-4">
        <Shield className="h-6 w-6 text-primary shrink-0" />
        {!collapsed && (
          <span className="ml-2 font-semibold text-sm">SOC Simulator</span>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto h-8 w-8"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>
      {navContent}
    </aside>
  );
}
