import React, { useEffect, useState } from 'react';
import { usePWA } from '@/hooks/usePWA';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { Button } from '@/components/ui/button';
import { Download, RefreshCw, WifiOff, Bell, X } from 'lucide-react';
import { toast } from 'sonner';

// ── localStorage-backed 7-day snooze helpers ────────────────────────────────
function isWithin7Days(key) {
  const v = localStorage.getItem(key);
  if (!v) return false;
  return Date.now() - Number(v) < 7 * 24 * 60 * 60 * 1000;
}
function snooze(key) {
  localStorage.setItem(key, String(Date.now()));
}
function markPermanent(key) {
  localStorage.setItem(key, 'permanent');
}
function isPermanent(key) {
  return localStorage.getItem(key) === 'permanent';
}

export default function PWAManager({ user }) {
  const {
    canInstall,
    isInstalled,
    isInstalling,
    updateAvailable,
    isOnline,
    installApp,
    applyUpdate,
  } = usePWA();

  const {
    isSupported: pushSupported,
    permission,
    isSubscribed,
    isSubscribing,
    error: pushError,
    subscribe,
  } = usePushNotifications(user);

  const [showInstallModal, setShowInstallModal] = useState(false);
  const [showPushModal, setShowPushModal]       = useState(false);
  const [showUpdateModal, setShowUpdateModal]   = useState(false);
  const [offlineToastId, setOfflineToastId]     = useState(null);

  // ── Install modal: skip if already installed, or snoozed/permanently dismissed ──
  useEffect(() => {
    if (!canInstall) return;
    if (isInstalled) return;
    if (isPermanent('pwa_dismissed')) return;
    if (isWithin7Days('pwa_dismissed_at')) return;
    const t = setTimeout(() => setShowInstallModal(true), 3000);
    return () => clearTimeout(t);
  }, [canInstall, isInstalled]);

  // ── Push prompt: 10s after load, skip if snoozed/subscribed/denied ──────────
  useEffect(() => {
    if (!pushSupported || isSubscribed || permission === 'denied' || !user?.id) return;
    if (isPermanent('push_dismissed')) return;
    if (isWithin7Days('push_dismissed_at')) return;
    if (showInstallModal) return;
    const t = setTimeout(() => setShowPushModal(true), 10000);
    return () => clearTimeout(t);
  }, [pushSupported, isSubscribed, permission, user?.id, showInstallModal]);

  // ── Update available modal ──────────────────────────────────────────────────
  useEffect(() => {
    if (!updateAvailable) return;
    setShowUpdateModal(true);
  }, [updateAvailable]);

  // ── Offline/online toast ────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOnline) {
      const id = toast.warning('You are offline', {
        description: 'Some features may be unavailable.',
        duration: Infinity,
        icon: <WifiOff className="w-4 h-4" />,
      });
      setOfflineToastId(id);
    } else {
      if (offlineToastId) {
        toast.dismiss(offlineToastId);
        toast.success('Back online!', { duration: 3000 });
        setOfflineToastId(null);
      }
    }
  }, [isOnline]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleInstall = async () => {
    await installApp();
    setShowInstallModal(false);
    markPermanent('pwa_dismissed'); // installed — never ask again
  };

  const handleDismissInstall = () => {
    setShowInstallModal(false);
    snooze('pwa_dismissed_at'); // snooze 7 days
  };

  const handleEnablePush = async () => {
    const sub = await subscribe();
    if (sub) {
      setShowPushModal(false);
      markPermanent('push_dismissed'); // subscribed — never ask again
      toast.success('Push notifications enabled!');
    }
  };

  const handleDismissPush = () => {
    setShowPushModal(false);
    snooze('push_dismissed_at'); // snooze 7 days
  };

  const handleDismissUpdate = () => setShowUpdateModal(false);

  const activeModal = showInstallModal ? 'install' : showPushModal ? 'push' : showUpdateModal ? 'update' : null;

  return (
    <>
      {activeModal && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[80] animate-in fade-in duration-200"
          onClick={() => {
            if (activeModal === 'install') handleDismissInstall();
            if (activeModal === 'push')    handleDismissPush();
            if (activeModal === 'update')  handleDismissUpdate();
          }}
        />
      )}

      {/* ── INSTALL modal ── */}
      {showInstallModal && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[90] w-[calc(100%-2rem)] max-w-sm bg-card border border-border rounded-2xl shadow-xl p-6 animate-in fade-in zoom-in-95 duration-200">
          <button onClick={handleDismissInstall} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground rounded-full p-1 transition-colors">
            <X className="w-5 h-5" />
          </button>
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 ring-2 ring-primary/20 flex items-center justify-center mb-4">
              <Download className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-xl font-bold mb-1">Install Chibondo Academy</h3>
            <p className="text-xs text-muted-foreground mb-4">Add to your home screen for the best experience</p>
            <ul className="text-sm text-muted-foreground text-left space-y-2 mb-6 w-full">
              <li className="flex items-center gap-2"><span className="text-primary font-bold">✓</span> Works offline — no internet needed</li>
              <li className="flex items-center gap-2"><span className="text-primary font-bold">✓</span> Loads instantly from your home screen</li>
              <li className="flex items-center gap-2"><span className="text-primary font-bold">✓</span> Full-screen, distraction-free learning</li>
            </ul>
            <div className="flex flex-col gap-2 w-full">
              <Button onClick={handleInstall} disabled={isInstalling} className="w-full py-6 text-base font-semibold rounded-xl">
                {isInstalling ? 'Installing...' : 'Install App'}
              </Button>
              <Button variant="ghost" onClick={handleDismissInstall} className="w-full py-6 text-base text-muted-foreground rounded-xl">
                Not now
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── PUSH NOTIFICATIONS modal ── */}
      {showPushModal && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[90] w-[calc(100%-2rem)] max-w-sm bg-card border border-border rounded-2xl shadow-xl p-6 animate-in fade-in zoom-in-95 duration-200">
          <button onClick={handleDismissPush} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground rounded-full p-1 transition-colors">
            <X className="w-5 h-5" />
          </button>
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 ring-2 ring-primary/20 flex items-center justify-center mb-4">
              <Bell className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-xl font-bold mb-1">Stay in the loop</h3>
            <p className="text-xs text-muted-foreground mb-4">Turn on notifications to never miss a thing</p>
            <ul className="text-sm text-muted-foreground text-left space-y-2 mb-6 w-full">
              <li className="flex items-center gap-2"><span className="text-primary font-bold">✓</span> New lessons &amp; quiz alerts</li>
              <li className="flex items-center gap-2"><span className="text-primary font-bold">✓</span> Assignment deadlines &amp; grades</li>
              <li className="flex items-center gap-2"><span className="text-primary font-bold">✓</span> Works even when app is closed</li>
            </ul>
            <div className="flex flex-col gap-2 w-full">
              <Button onClick={handleEnablePush} disabled={isSubscribing} className="w-full py-6 text-base font-semibold rounded-xl">
                {isSubscribing ? 'Enabling...' : 'Enable Notifications'}
              </Button>
              <Button variant="ghost" onClick={handleDismissPush} className="w-full py-6 text-base text-muted-foreground rounded-xl">
                Maybe later
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── UPDATE AVAILABLE modal ── */}
      {showUpdateModal && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[90] w-[calc(100%-2rem)] max-w-sm bg-card border border-border rounded-2xl shadow-xl p-6 animate-in fade-in zoom-in-95 duration-200">
          <button onClick={handleDismissUpdate} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground rounded-full p-1 transition-colors">
            <X className="w-5 h-5" />
          </button>
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 ring-2 ring-primary/20 flex items-center justify-center mb-4">
              <RefreshCw className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-xl font-bold mb-1">Update available</h3>
            <p className="text-sm text-muted-foreground mb-6">A new version of the app is ready. Reload to get the latest improvements.</p>
            <div className="flex flex-col gap-2 w-full">
              <Button onClick={() => { applyUpdate(); setShowUpdateModal(false); }} className="w-full py-6 text-base font-semibold rounded-xl">
                Reload &amp; Update
              </Button>
              <Button variant="ghost" onClick={handleDismissUpdate} className="w-full py-6 text-base text-muted-foreground rounded-xl">
                Later
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
