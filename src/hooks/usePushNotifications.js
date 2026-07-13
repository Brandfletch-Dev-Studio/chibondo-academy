// usePushNotifications.js — Robust push notification hook for Chibondo Academy
import { useState, useEffect, useCallback, useRef } from 'react';
import { db } from '@/api/supabaseClient';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

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
  const [permission, setPermission] = useState(Notification?.permission ?? 'default');
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

  // Get SW registration
  useEffect(() => {
    if (!isSupported) return;
    navigator.serviceWorker.ready.then((reg) => {
      swRef.current = reg;
      reg.pushManager.getSubscription().then((sub) => {
        setSubscription(sub);
      });
    });
  }, [isSupported]);

  // Listen for SW messages (subscription changed, navigate, etc.)
  useEffect(() => {
    if (!isSupported) return;
    const handler = (event) => {
      if (event.data?.type === 'PUSH_SUBSCRIPTION_CHANGED') {
        setSubscription(event.data.subscription);
        if (user?.id && event.data.subscription) {
          saveSubscriptionToServer(user.id, event.data.subscription);
        }
      }
      if (event.data?.type === 'NAVIGATE') {
        window.location.href = event.data.url;
      }
    };
    navigator.serviceWorker.addEventListener('message', handler);
    return () => navigator.serviceWorker.removeEventListener('message', handler);
  }, [isSupported, user?.id]);

  const saveSubscriptionToServer = async (userId, sub) => {
    try {
      const subJSON = sub.toJSON();
      // Store push subscription in Supabase user profile
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

  const subscribe = useCallback(async () => {
    if (!isSupported || !swRef.current || !user?.id) return;
    setIsSubscribing(true);
    setError(null);
    try {
      // Request permission
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== 'granted') {
        setError('Notification permission denied.');
        return null;
      }

      // Subscribe
      const sub = await swRef.current.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      setSubscription(sub);
      await saveSubscriptionToServer(user.id, sub);
      return sub;
    } catch (err) {
      console.error('[Push] Subscribe error:', err);
      setError(err.message);
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

  // Request permission if already granted — auto-subscribe on mount
  const autoSubscribe = useCallback(async () => {
    if (!isSupported || !user?.id || subscription) return;
    if (Notification.permission === 'granted') {
      await subscribe();
    }
  }, [isSupported, user?.id, subscription, subscribe]);

  useEffect(() => {
    autoSubscribe();
  }, [autoSubscribe]);

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
