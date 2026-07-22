// usePWA.js — PWA install prompt + update handler for Chibondo Academy
import { useState, useEffect, useCallback, useRef } from 'react';

// Stable key used across accounts — install state is per-device, not per-user
const INSTALLED_KEY = 'chibondo_pwa_installed';

export function usePWA() {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isInstalled, setIsInstalled]     = useState(false);
  const [isInstalling, setIsInstalling]   = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isOnline, setIsOnline]           = useState(navigator.onLine);
  const [registration, setRegistration]   = useState(null);
  const newWorkerRef = useRef(null);

  // Online/offline detection
  useEffect(() => {
    const handleOnline  = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Detect installed state robustly:
  // 1. Standalone display mode (already running as PWA)
  // 2. getInstalledRelatedApps() — Chrome Android API to check if PWA is on home screen
  // 3. Persistent localStorage flag set on install
  useEffect(() => {
    // Check 1: running in standalone mode already
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;

    if (standalone) {
      setIsInstalled(true);
      localStorage.setItem(INSTALLED_KEY, '1');
      return;
    }

    // Check 2: localStorage flag from a previous install
    if (localStorage.getItem(INSTALLED_KEY) === '1') {
      setIsInstalled(true);
      return;
    }

    // Check 3: getInstalledRelatedApps (Chrome 73+, Android only)
    if ('getInstalledRelatedApps' in navigator) {
      navigator.getInstalledRelatedApps().then((apps) => {
        if (apps && apps.length > 0) {
          setIsInstalled(true);
          localStorage.setItem(INSTALLED_KEY, '1');
        }
      }).catch(() => {});
    }
  }, []);

  // Capture beforeinstallprompt — only fires if not already installed
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      // Double-check we're not already installed before storing the prompt
      const alreadyInstalled =
        window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true ||
        localStorage.getItem(INSTALLED_KEY) === '1';
      if (!alreadyInstalled) {
        setInstallPrompt(e);
      }
    };

    const onInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
      localStorage.setItem(INSTALLED_KEY, '1');
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  // Listen for SW updates
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.ready.then((reg) => {
      setRegistration(reg);

      const checkUpdate = () => reg.update().catch(() => {});
      const interval = setInterval(checkUpdate, 60 * 60 * 1000);

      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorkerRef.current = newWorker;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            setUpdateAvailable(true);
          }
        });
      });

      return () => clearInterval(interval);
    });

    const handleControllerChange = () => window.location.reload();
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
    return () => navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
  }, []);

  // Install app
  const installApp = useCallback(async () => {
    if (!installPrompt) return;
    setIsInstalling(true);
    try {
      await installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setInstallPrompt(null);
        localStorage.setItem(INSTALLED_KEY, '1');
      }
    } finally {
      setIsInstalling(false);
    }
  }, [installPrompt]);

  // Apply update
  const applyUpdate = useCallback(() => {
    if (newWorkerRef.current) {
      newWorkerRef.current.postMessage({ type: 'SKIP_WAITING' });
    } else if (registration?.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
    setUpdateAvailable(false);
  }, [registration]);

  return {
    canInstall: !!installPrompt && !isInstalled,
    isInstalled,
    isInstalling,
    updateAvailable,
    isOnline,
    registration,
    installApp,
    applyUpdate,
  };
}
