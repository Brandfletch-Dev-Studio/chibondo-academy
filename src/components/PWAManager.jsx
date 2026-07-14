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
    error: pushError,
    subscribe,
  } = usePushNotifications(user);

  const [showInstallModal, setShowInstallModal] = useState(false);
  const [showPushModal, setShowPushModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [offlineToastId, setOfflineToastId] = useState(null);
  const [dismissed, setDismissed] = useState({
    install: false,
    push: false,
    update: false,
  });

  // Show install modal after 3s if applicable
  useEffect(() => {
    if (!canInstall || dismissed.install) return;
    const t = setTimeout(() => setShowInstallModal(true), 3000);
    return () => clearTimeout(t);
  }, [canInstall, dismissed.install]);

  // Show push prompt 10s after load
  useEffect(() => {
    if (!pushSupported || isSubscribed || permission === 'denied' || dismissed.push || !user?.id) return;
    if (showInstallModal) return;
    if (isSubscribing) return; // Don't open modal if already subscribing in background
    const t = setTimeout(() => setShowPushModal(true), 10000);
    return () => clearTimeout(t);
  }, [pushSupported, isSubscribed, permission, dismissed.push, user?.id, showInstallModal, isSubscribing]);

  // Update available modal instead of toast (Requirement 4)
  useEffect(() => {
    if (!updateAvailable || dismissed.update) return;
    setShowUpdateModal(true);
  }, [updateAvailable, dismissed.update]);

  // Offline/online toast: keep as sonner toast (WifiOff, warning) (Requirement 5)
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
    setShowInstallModal(false);
  };

  const handleEnablePush = async () => {
    const sub = await subscribe();
    if (sub) {
      setShowPushModal(false);
      toast.success('Push notifications enabled!');
    }
  };

  const handleDismissInstall = () => {
    setShowInstallModal(false);
    setDismissed(d => ({ ...d, install: true }));
  };

  const handleDismissPush = () => {
    setShowPushModal(false);
    setDismissed(d => ({ ...d, push: true }));
  };

  const handleDismissUpdate = () => {
    setShowUpdateModal(false);
    setDismissed(d => ({ ...d, update: true }));
  };

  // Check if any modal is active to show the backdrop
  const activeModal = showInstallModal ? 'install' : showPushModal ? 'push' : showUpdateModal ? 'update' : null;

  return (
    <>
      {activeModal && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[80] animate-in fade-in duration-200"
          onClick={() => {
            if (activeModal === 'install') handleDismissInstall();
            if (activeModal === 'push') handleDismissPush();
            if (activeModal === 'update') handleDismissUpdate();
          }}
        />
      )}

      {/* INSTALL modal */}
      {showInstallModal && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[90] w-[calc(100%-2rem)] max-w-sm bg-card border border-border rounded-2xl shadow-xl p-6 animate-in fade-in zoom-in-95 duration-200">
          <button
            onClick={handleDismissInstall}
            className="absolute top-4 right-4 text-muted-foreground hover:text-foreground rounded-full p-1 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 ring-2 ring-primary/20 flex items-center justify-center mb-4">
              <Download className="w-8 h-8 text-primary" />
            </div>
            
            <h3 className="text-xl font-bold mb-1">Install The ACA App</h3>
            <p className="text-xs text-muted-foreground mb-4">Add to your home screen for the best experience</p>
            <ul className="text-sm text-muted-foreground text-left space-y-2 mb-6 w-full">
              <li className="flex items-center gap-2"><span className="text-primary font-bold">✓</span> Works offline — no internet needed</li>
              <li className="flex items-center gap-2"><span className="text-primary font-bold">✓</span> Loads instantly from your home screen</li>
              <li className="flex items-center gap-2"><span className="text-primary font-bold">✓</span> Full-screen, distraction-free learning</li>
            </ul>
            
            <div className="flex flex-col gap-2 w-full">
              <Button 
                onClick={handleInstall} 
                disabled={isInstalling}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 py-6 text-base font-semibold rounded-xl"
              >
                {isInstalling ? 'Installing...' : 'Install App'}
              </Button>
              <Button 
                variant="ghost" 
                onClick={handleDismissInstall}
                className="w-full text-muted-foreground hover:text-foreground py-6 text-base font-medium rounded-xl"
              >
                Not now
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* PUSH NOTIFICATIONS prompt */}
      {showPushModal && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[90] w-[calc(100%-2rem)] max-w-sm bg-card border border-border rounded-2xl shadow-xl p-6 animate-in fade-in zoom-in-95 duration-200">
          <button
            onClick={handleDismissPush}
            className="absolute top-4 right-4 text-muted-foreground hover:text-foreground rounded-full p-1 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 ring-2 ring-primary/20 flex items-center justify-center mb-4">
              <Bell className="w-8 h-8 text-primary" />
            </div>
            
            <h3 className="text-xl font-bold mb-1">Stay in the loop</h3>
            <p className="text-xs text-muted-foreground mb-4">Turn on notifications to never miss a thing</p>
            <ul className="text-sm text-muted-foreground text-left space-y-2 mb-6 w-full">
              <li className="flex items-center gap-2"><span className="text-primary font-bold">✓</span> New lessons & quiz alerts</li>
              <li className="flex items-center gap-2"><span className="text-primary font-bold">✓</span> Assignment deadlines & grades</li>
              <li className="flex items-center gap-2"><span className="text-primary font-bold">✓</span> Works even when app is closed</li>
            </ul>
            
            <div className="flex flex-col gap-2 w-full">
              <Button 
                onClick={handleEnablePush} 
                disabled={isSubscribing}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 py-6 text-base font-semibold rounded-xl"
              >
                {isSubscribing ? 'Enabling...' : 'Enable Notifications'}
              </Button>
              <Button 
                variant="ghost" 
                onClick={handleDismissPush}
                className="w-full text-muted-foreground hover:text-foreground py-6 text-base font-medium rounded-xl"
              >
                Maybe later
              </Button>
            </div>
            {pushError && (
              <p className="text-xs text-destructive mt-3 text-center leading-snug">{pushError}</p>
            )}
          </div>
        </div>
      )}

      {/* UPDATE available */}
      {showUpdateModal && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[90] w-[calc(100%-2rem)] max-w-sm bg-card border border-border rounded-2xl shadow-xl p-6 animate-in fade-in zoom-in-95 duration-200">
          <button
            onClick={handleDismissUpdate}
            className="absolute top-4 right-4 text-muted-foreground hover:text-foreground rounded-full p-1 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4 animate-spin">
              <RefreshCw className="w-6 h-6 text-primary" />
            </div>
            
            <h3 className="text-lg font-bold mb-1">New version available</h3>
            <p className="text-sm text-muted-foreground mb-6">
              A new version of Chibondo Academy is ready. Update now to access the latest features and fixes.
            </p>
            
            <div className="flex flex-col gap-2 w-full">
              <Button 
                onClick={applyUpdate}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 py-6 text-base font-semibold rounded-xl"
              >
                Update now
              </Button>
              <Button 
                variant="ghost" 
                onClick={handleDismissUpdate}
                className="w-full text-muted-foreground hover:text-foreground py-6 text-base font-medium rounded-xl"
              >
                Later
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
