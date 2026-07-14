// usePushNotifications.js — Push notification hook for Chibondo Academy
import { useState, useEffect, useCallback, useRef } from 'react';
import { db } from '@/api/supabaseClient';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;
const SUBSCRIBE_TIMEOUT_MS = 12000; // 12s timeout — prevents infinite hang

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications(user) {
  const [permission, setPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  const [subscription, setSubscription] = useState(null);
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [error, setError] = useState(null);
  const swRef = useRef(null);

  // Check support
  useEffect(() => {
    const supported =
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window;
    setIsSupported(supported);
  }, []);

  // Get SW registration + existing subscription (read-only, no auto-subscribe)
  useEffect(() => {
    if (!isSupported) return;
    navigator.serviceWorker.ready.then((reg) => {
      swRef.current = reg;
      // Only read existing subscription — do NOT auto-subscribe
      reg.pushManager.getSubscription().then((sub) => {
        if (sub) setSubscription(sub);
      });
    });
  }, [isSupported]);

  // Listen for SW messages
  useEffect(() => {
    if (!isSupported) return;
    const handler = (event) => {
      if (event.data?.type === 'PUSH_SUBSCRIPTION_CHANGED') {
        setSubscription(event.data.subscription);
        if (user?.id && event.data.subscription) {
          saveSubscriptionToServer(user.id, event.data.subscription);
        }
      }
    };
    navigator.serviceWorker.addEventListener('message', handler);
    return () => navigator.serviceWorker.removeEventListener('message', handler);
  }, [isSupported, user?.id]);

  const saveSubscriptionToServer = async (userId, sub) => {
    try {
      const subJSON = typeof sub.toJSON === 'function' ? sub.toJSON() : sub;
      await db.entities.User.update(userId, {
        push_subscription: JSON.stringify(subJSON),
        push_enabled: true,
      });
    } catch (err) {
      console.error('[Push] Failed to save subscription:', err);
    }
  };

  const removeSubscriptionFromServer = async (userId) => {
    try {
      await db.entities.User.update(userId, {
        push_subscription: null,
        push_enabled: false,
      });
    } catch (err) {
      console.error('[Push] Failed to remove subscription:', err);
    }
  };

  // subscribe — called ONLY by explicit user action (button click)
  const subscribe = useCallback(async () => {
    if (!isSupported || !user?.id) {
      setError('Push notifications not supported on this device.');
      return null;
    }

    // Wait for SW to be ready (up to 8s)
    if (!swRef.current) {
      try {
        const reg = await Promise.race([
          navigator.serviceWorker.ready,
          new Promise((_, reject) => setTimeout(() => reject(new Error('SW timeout')), 8000)),
        ]);
        swRef.current = reg;
      } catch {
        setError('Service worker not ready. Try refreshing the page.');
        return null;
      }
    }

    setIsSubscribing(true);
    setError(null);

    try {
      // Request permission first
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result === 'denied') {
        setError('Notifications blocked. Please enable them in your browser settings.');
        return null;
      }
      if (result !== 'granted') {
        setError('Notification permission not granted.');
        return null;
      }

      if (!VAPID_PUBLIC_KEY) {
        setError('Push notifications not configured. Contact support.');
        return null;
      }

      // Subscribe with timeout guard
      const sub = await Promise.race([
        swRef.current.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Subscription timed out. Please try again.')), SUBSCRIBE_TIMEOUT_MS)
        ),
      ]);

      setSubscription(sub);
      await saveSubscriptionToServer(user.id, sub);
      return sub;

    } catch (err) {
      console.error('[Push] Subscribe error:', err);
      const msg = err.message || 'Failed to enable notifications.';
      setError(msg);
      return null;
    } finally {
      setIsSubscribing(false);
    }
  }, [isSupported, user?.id]);

  const unsubscribe = useCallback(async () => {
    if (!subscription || !user?.id) return;
    try {
      await subscription.unsubscribe();
      setSubscription(null);
      await removeSubscriptionFromServer(user.id);
    } catch (err) {
      console.error('[Push] Unsubscribe error:', err);
      setError(err.message);
    }
  }, [subscription, user?.id]);

  return {
    isSupported,
    permission,
    subscription,
    isSubscribing,
    error,
    isSubscribed: !!subscription && permission === 'granted',
    subscribe,
    unsubscribe,
  };
}
