import React, { useState, useEffect, useRef } from 'react';
import { Outlet } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import BottomNav from './BottomNav';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import MobileSidebar from './MobileSidebar';

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('sidebar-collapsed') === 'true'; } catch { return false; }
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleToggle = () => {
    setCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('sidebar-collapsed', String(next));
      return next;
    });
  };

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  // Guarantee every registered user has role='user' (student)
  // Runs once when user first loads — covers Google OAuth & email registrations
  useEffect(() => {
    if (user && !user.role) {
      base44.auth.updateMe({ role: 'user' }).catch(() => {});
    }
  }, [user?.id, user?.role]);

  const { data: notifications = [] } = useQuery({
    queryKey: ['unreadNotifications'],
    queryFn: async () => {
      if (!user?.id) return [];
      return base44.entities.Notification.filter({ user_id: user.id, is_read: false }, '-created_date', 50);
    },
    enabled: !!user?.id,
  });

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block flex-shrink-0">
        <Sidebar user={user} collapsed={collapsed} onToggle={handleToggle} />
      </div>

      {/* Mobile Sidebar Sheet */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-0 w-64 border-0">
          <MobileSidebar user={user} onClose={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <div className={cn(
        "flex-1 flex flex-col min-w-0 transition-[margin] duration-300 ease-in-out",
        collapsed ? "lg:ml-16" : "lg:ml-64"
      )}>
        <TopBar user={user} notificationCount={notifications.length} onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 p-4 lg:p-6 pb-24 lg:pb-6 w-full max-w-7xl mx-auto">
          <Outlet context={{ user, notifications }} />
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
