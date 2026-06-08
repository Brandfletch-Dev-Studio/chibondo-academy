import React, { useState, useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
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

  // ── Forum Presence Heartbeat ──────────────────────────────────────────────
  // FIX 11: use useLocation so the effect re-runs on route change, not just mount
  // Previously: isOnForums() only evaluated at mount — stale if user navigated later
  const location = useLocation();
  const isOnForums = location.pathname.startsWith('/forums') || location.pathname.startsWith('/forum');

  useEffect(() => {
    if (!user?.id || !isOnForums) return;

    // Presence record ref — avoid re-fetching on every beat
    let presenceId = null;

    const beat = async () => {
      try {
        const now = new Date().toISOString();
        if (presenceId) {
          // Fast path: we already know the record ID
          await base44.entities.ForumPresence.update(presenceId, { last_seen: now });
        } else {
          const existing = await base44.entities.ForumPresence.filter({ user_id: user.id });
          if (existing[0]) {
            presenceId = existing[0].id;
            await base44.entities.ForumPresence.update(presenceId, { last_seen: now });
          } else {
            const created = await base44.entities.ForumPresence.create({
              user_id:   user.id,
              user_name: user.full_name || user.email || 'Student',
              user_role: user.role || 'user',
              last_seen: now,
            });
            presenceId = created?.id;
          }
        }
      } catch(_) {}
    };

    // Fire immediately when entering forums, then every 60s
    beat();
    const iv = setInterval(beat, 60_000);
    return () => clearInterval(iv);
  }, [user?.id, isOnForums]);

  // Load StudentProfile to get persisted avatar_url as fallback
  const { data: studentProfile } = useQuery({
    queryKey: ['studentProfile', user?.id],
    queryFn: async () => {
      const r = await base44.entities.StudentProfile.filter({ user_id: user.id });
      return r[0] || null;
    },
    enabled: !!user?.id && user?.role !== 'admin' && user?.role !== 'teacher',
    staleTime: 60_000,
  });

  // Merge avatar from StudentProfile if User record doesn't have it
  const enrichedUser = user ? {
    ...user,
    avatar_url: user.avatar_url || studentProfile?.avatar_url || null,
  } : user;

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
        <Sidebar user={enrichedUser} collapsed={collapsed} onToggle={handleToggle} />
      </div>

      {/* Mobile Sidebar Sheet */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-0 w-64 border-0">
          <MobileSidebar user={enrichedUser} onClose={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <div className={cn(
        "flex-1 flex flex-col min-w-0 transition-[margin] duration-300 ease-in-out",
        collapsed ? "lg:ml-16" : "lg:ml-64"
      )}>
        <TopBar user={enrichedUser} notificationCount={notifications.length} onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 p-4 lg:p-6 pb-24 lg:pb-6 w-full max-w-7xl mx-auto">
          <Outlet context={{ user: enrichedUser, notifications }} />
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
