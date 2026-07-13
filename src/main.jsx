import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

// ── Service Worker Registration ─────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then((reg) => {
        console.log('[SW] Registered, scope:', reg.scope);

        // Pass VAPID public key to SW for pushsubscriptionchange handler
        if (reg.active) {
          reg.active.postMessage({
            type: 'SET_VAPID_KEY',
            key: import.meta.env.VITE_VAPID_PUBLIC_KEY,
          });
        }
      })
      .catch((err) => {
        console.error('[SW] Registration failed:', err);
      });

    // Listen for SW messages — handle navigation from push click
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'NAVIGATE') {
        window.location.href = event.data.url;
      }
    });
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
