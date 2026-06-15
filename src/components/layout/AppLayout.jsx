import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import Sidebar from './Sidebar';
import { X, Camera } from 'lucide-react';
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
  const [sidebarPhotoOpen, setSidebarPhotoOpen] = useState(false);

  const handleToggle = () => {
    setCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('sidebar-collapsed', String(next));
      return next;
    });
  };

  // Session-persistent auth check.
  //
  // Key rules for session persistence:
  //   1. Only treat the user as logged-out when the server explicitly says
  //      the token is invalid (401/403). Any other error (network timeout,
  //      server 5xx, DNS failure) is transient — keep the cached user.
  //   2. React Query will use the last successful cached value while a
  //      background refetch is in flight, so users never see a "blink" to
  //      the guest state during a normal re-check.
  //   3. gcTime > staleTime means the cache survives navigation even if no
  //      component is subscribed, so coming back to the app from a different
  //      tab never triggers a cold auth check.
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      try {
        return await base44.auth.me();
      } catch (err) {
        // Genuine auth rejection — no token or token revoked
        const status = err?.status ?? err?.response?.status;
        if (status === 401 || status === 403) {
          return null; // user is genuinely not authenticated
        }
        // Transient error (network blip, 5xx, timeout).
        // Throw so React Query keeps the previous cached value and retries.
        throw err;
      }
    },
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5_000),
    staleTime: 30 * 60_000,  // 30 min — background re-check, but cached user shown in the meantime
    gcTime:    60 * 60_000,  // 60 min — keep in cache across navigation / tab switches
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
  } : null; // null = guest

  const { data: notifications = [] } = useQuery({
    queryKey: ['unreadNotifications'],
    queryFn: async () => {
      if (!user?.id) return [];
      return base44.entities.Notification.filter({ user_id: user.id, is_read: false }, '-created_date', 50);
    },
    enabled: !!user?.id,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: 60_000, // poll every 60s for new notifications
  });

  const isGuest = !enrichedUser;

  const sAvatar    = enrichedUser?.avatar_url;
  const sInitial   = enrichedUser?.full_name?.[0]?.toUpperCase() || 'U';
  const sRoleLabel = enrichedUser?.role === 'admin' ? 'Admin' : enrichedUser?.role === 'teacher' ? 'Tutor' : 'Student';
  const sSettingsPath = enrichedUser?.role === 'admin' ? '/admin/settings' : enrichedUser?.role === 'teacher' ? '/teacher/settings' : '/settings';

  return (
    <>
      {/* ── Sidebar avatar lightbox ── */}
      {sidebarPhotoOpen && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)' }}
          onClick={() => setSidebarPhotoOpen(false)}
        >
          <div
            className="relative flex flex-col items-center gap-4 max-w-xs w-full"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setSidebarPhotoOpen(false)}
              className="absolute -top-10 right-0 p-2 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            {sAvatar ? (
              <img src={sAvatar} alt={enrichedUser?.full_name}
                className="w-52 h-52 rounded-full object-cover border-4"
                style={{ borderColor: 'hsl(43 74% 52%)' }} />
            ) : (
              <div
                className="w-52 h-52 rounded-full flex items-center justify-center text-7xl font-black border-4"
                style={{ background: 'hsl(43 74% 52%)', color: 'hsl(222 47% 11%)', borderColor: 'hsl(43 74% 52%)' }}
              >
                {sInitial}
              </div>
            )}
            <div className="text-center">
              <p className="text-white text-xl font-bold">{enrichedUser?.full_name || 'User'}</p>
              <p className="text-sm mt-0.5" style={{ color: 'hsl(43 74% 66%)' }}>{sRoleLabel}</p>
            </div>
            <a href={sSettingsPath} onClick={() => setSidebarPhotoOpen(false)}>
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer"
                style={{ background: 'hsl(43 74% 52%)', color: 'hsl(222 47% 11%)' }}>
                <Camera className="w-3.5 h-3.5" /> Change Photo
              </div>
            </a>
          </div>
        </div>
      )}
      <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar — shown for authenticated users only */}
      {!isGuest && (
        <div className="hidden lg:block flex-shrink-0">
          <Sidebar user={enrichedUser} collapsed={collapsed} onToggle={handleToggle} onAvatarClick={() => setSidebarPhotoOpen(true)} />
        </div>
      )}

      {/* Mobile Sidebar Sheet — authenticated only */}
      {!isGuest && (
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="p-0 w-64 border-0">
            <MobileSidebar user={enrichedUser} onClose={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>
      )}

      {/* Main Content */}
      <div className={cn(
        "flex-1 flex flex-col min-w-0 transition-[margin] duration-300 ease-in-out",
        !isGuest && collapsed ? "lg:ml-16" : !isGuest ? "lg:ml-64" : ""
      )}>
        <TopBar
          user={enrichedUser}
          notificationCount={notifications.length}
          onMenuClick={() => setMobileOpen(true)}
        />
        <main key={location.pathname} className="flex-1 p-4 lg:p-6 pb-24 lg:pb-6 w-full max-w-7xl mx-auto page-enter">
          <Outlet context={{ user: enrichedUser, notifications }} />
        </main>
      </div>

      {/* Bottom nav — shown for ALL users (guests get public-only nav items) */}
      <BottomNav user={enrichedUser} notifications={notifications} />
    </div>
    </>
  );
}
