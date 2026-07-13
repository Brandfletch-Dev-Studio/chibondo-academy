// sendPushNotification.js — Vercel Edge/Node function to send push notifications
// Deploy to: api/send-push.js (Vercel serverless function)
// Uses web-push library (add to package.json: "web-push": "^3.6.7")

import webpush from 'web-push';

webpush.setVapidDetails(
  'mailto:admin@chibondoacademy.com',
  process.env.VITE_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Basic auth: require internal secret header
  const secret = req.headers['x-internal-secret'];
  if (secret !== process.env.INTERNAL_API_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { subscriptions, notification } = req.body;

  if (!subscriptions?.length || !notification) {
    return res.status(400).json({ error: 'Missing subscriptions or notification' });
  }

  const payload = JSON.stringify({
    title: notification.title || 'Chibondo Academy',
    body: notification.body || '',
    icon: notification.icon || '/icon-192.png',
    url: notification.url || '/',
    tag: notification.tag || 'chibondo',
    notificationId: notification.notificationId || null,
    requireInteraction: notification.requireInteraction || false,
  });

  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush.sendNotification(
        typeof sub === 'string' ? JSON.parse(sub) : sub,
        payload,
        {
          urgency: notification.urgency || 'normal', // 'very-low' | 'low' | 'normal' | 'high'
          TTL: notification.ttl || 86400, // 24 hours
        }
      )
    )
  );

  const succeeded = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.filter((r) => r.status === 'rejected').length;

  // Log failed subscriptions (expired/invalid — should be removed from DB)
  const expiredSubs = [];
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      const statusCode = r.reason?.statusCode;
      if (statusCode === 410 || statusCode === 404) {
        expiredSubs.push(subscriptions[i]);
      }
    }
  });

  return res.status(200).json({
    message: `Sent to ${succeeded}/${subscriptions.length} subscribers`,
    succeeded,
    failed,
    expiredSubs,
  });
}
