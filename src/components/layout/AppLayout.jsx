import React, { useState, useEffect } from 'react';
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

  // PUBLIC MODE: auth.me() may fail for unauthenticated visitors — that's fine.
  // We catch the error and treat user as null (guest). Authenticated users work exactly as before.
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      try { return await base44.auth.me(); }
      catch { return null; }
    },
    retry: false,          // don't hammer the auth endpoint for guests
    staleTime: 5 * 60_000, // 5 min — reduces redundant auth checks while browsing
  });

  // Guarantee every registered user has role='user' (student)
  useEffect(() => {
    if (user && !user.role) {
      base44.auth.updateMe({ role: 'user' }).catch(() => {});
    }
  }, [user?.id, user?.role]);

  // ── Forum Presence Heartbeat (authenticated users only) ────────────────────
  const location = useLocation();
  const isOnForums = location.pathname.startsWith('/forums') || location.pathname.startsWith('/forum');

  useEffect(() => {
    if (!user?.id || !isOnForums) return;

    let presenceId = null;
    const beat = async () => {
      try {
        const now = new Date().toISOString();
        if (presenceId) {
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

    beat();
    const iv = setInterval(beat, 60_000);
    return () => clearInterval(iv);
  }, [user?.id, isOnForums]);

  // Avatar fallback from StudentProfile
  const { data: studentProfile } = useQuery({
    queryKey: ['studentProfile', user?.id],
    queryFn: async () => {
      const r = await base44.entities.StudentProfile.filter({ user_id: user.id });
      return r[0] || null;
    },
    enabled: !!user?.id && user?.role !== 'admin' && user?.role !== 'teacher',
    staleTime: 60_000,
  });

  const enrichedUser = user ? {
    ...user,
    avatar_url: user.avatar_url || studentProfile?.avatar_url || null,
  } : null; // null = guest (not undefined — so pages can distinguish)

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
      {/* Desktop Sidebar — only shown when authenticated */}
      {enrichedUser && (
        <div className="hidden lg:block flex-shrink-0">
          <Sidebar user={enrichedUser} collapsed={collapsed} onToggle={handleToggle} />
        </div>
      )}

      {/* Mobile Sidebar Sheet */}
      {enrichedUser && (
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="p-0 w-64 border-0">
            <MobileSidebar user={enrichedUser} onClose={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>
      )}

      {/* Main Content */}
      <div className={cn(
        "flex-1 flex flex-col min-w-0 transition-[margin] duration-300 ease-in-out",
        enrichedUser && collapsed ? "lg:ml-16" : enrichedUser ? "lg:ml-64" : ""
      )}>
        <TopBar
          user={enrichedUser}
          notificationCount={notifications.length}
          onMenuClick={() => setMobileOpen(true)}
        />
        <main className="flex-1 p-4 lg:p-6 pb-24 lg:pb-6 w-full max-w-7xl mx-auto">
          <Outlet context={{ user: enrichedUser, notifications }} />
        </main>
      </div>

      {/* Bottom nav only for authenticated users */}
      {enrichedUser && <BottomNav />}
    </div>
  );
}
