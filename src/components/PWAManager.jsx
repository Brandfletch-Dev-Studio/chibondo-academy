// PWAManager.jsx — Install banner, update toast, offline banner, push prompt
// Drop this into AppLayout or main App.jsx
import React, { useEffect, useState } from 'react';
import { usePWA } from '@/hooks/usePWA';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { Button } from '@/components/ui/button';
import { Download, RefreshCw, WifiOff, Bell, X } from 'lucide-react';
import { toast } from 'sonner';

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
    subscribe,
  } = usePushNotifications(user);

  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [showPushPrompt, setShowPushPrompt] = useState(false);
  const [offlineToastId, setOfflineToastId] = useState(null);
  const [dismissed, setDismissed] = useState({
    install: false,
    push: false,
  });

  // Show install banner after 3s if applicable
  useEffect(() => {
    if (!canInstall || dismissed.install) return;
    const t = setTimeout(() => setShowInstallBanner(true), 3000);
    return () => clearTimeout(t);
  }, [canInstall, dismissed.install]);

  // Show push prompt 10s after load if not subscribed and permission not denied
  useEffect(() => {
    if (!pushSupported || isSubscribed || permission === 'denied' || dismissed.push || !user?.id) return;
    const t = setTimeout(() => setShowPushPrompt(true), 10000);
    return () => clearTimeout(t);
  }, [pushSupported, isSubscribed, permission, dismissed.push, user?.id]);

  // Update available toast
  useEffect(() => {
    if (!updateAvailable) return;
    toast('Update available', {
      description: 'A new version of Chibondo Academy is ready.',
      duration: Infinity,
      action: {
        label: 'Update now',
        onClick: applyUpdate,
      },
      icon: <RefreshCw className="w-4 h-4" />,
    });
  }, [updateAvailable]);

  // Offline/online toast
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

  const handleInstall = async () => {
    await installApp();
    setShowInstallBanner(false);
  };

  const handleEnablePush = async () => {
    const sub = await subscribe();
    if (sub) {
      setShowPushPrompt(false);
      toast.success('Push notifications enabled!');
    }
  };

  return (
    <>
      {/* Install Banner */}
      {showInstallBanner && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-md">
          <div className="bg-card border border-border rounded-xl shadow-lg p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Download className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">Install Chibondo Academy</p>
              <p className="text-xs text-muted-foreground">Add to your home screen for the best experience</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button size="sm" onClick={handleInstall} disabled={isInstalling}>
                {isInstalling ? 'Installing...' : 'Install'}
              </Button>
              <button
                onClick={() => { setShowInstallBanner(false); setDismissed(d => ({ ...d, install: true })); }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Push Notification Prompt */}
      {showPushPrompt && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-md">
          <div className="bg-card border border-border rounded-xl shadow-lg p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Bell className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">Stay up to date</p>
              <p className="text-xs text-muted-foreground">Get notified about lessons, quizzes & announcements</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button size="sm" onClick={handleEnablePush} disabled={isSubscribing}>
                {isSubscribing ? 'Enabling...' : 'Enable'}
              </Button>
              <button
                onClick={() => { setShowPushPrompt(false); setDismissed(d => ({ ...d, push: true })); }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
