import { useState, useEffect } from 'react';

/**
 * WhatsApp-style timestamp formatter.
 *
 * Rules (all times shown in viewer's LOCAL timezone):
 *   Posted today          →  "10:45 PM"
 *   Posted yesterday      →  "Yesterday 10:45 PM"
 *   Posted this week      →  "Mon 10:45 PM"
 *   Posted this year      →  "12 Jun 10:45 PM"
 *   Older                 →  "12 Jun 2024 10:45 PM"
 *
 * The timestamp is re-evaluated every minute so "Today" flips to "Yesterday"
 * at midnight without a page reload.
 */

function formatWhatsApp(isoDate) {
  if (!isoDate) return '';
  const then = new Date(isoDate);
  if (isNaN(then.getTime())) return '';

  const now   = new Date();
  const time  = then.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Midnight of today in local time
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thenStart  = new Date(then.getFullYear(), then.getMonth(), then.getDate());
  const diffDays   = Math.round((todayStart - thenStart) / 86_400_000);

  if (diffDays === 0) return time;                            // "10:45 PM"
  if (diffDays === 1) return `Yesterday ${time}`;             // "Yesterday 10:45 PM"

  // Within the last 6 days — show short weekday name
  if (diffDays < 7) {
    const day = then.toLocaleDateString([], { weekday: 'short' }); // "Mon"
    return `${day} ${time}`;                                  // "Mon 10:45 PM"
  }

  // Same calendar year — omit year
  if (then.getFullYear() === now.getFullYear()) {
    const date = then.toLocaleDateString([], { day: 'numeric', month: 'short' });
    return `${date} ${time}`;                                 // "12 Jun 10:45 PM"
  }

  // Older — include year
  const date = then.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
  return `${date} ${time}`;                                   // "12 Jun 2024 10:45 PM"
}

export function useLiveAgo(isoDate) {
  const [label, setLabel] = useState(() => formatWhatsApp(isoDate));

  useEffect(() => {
    if (!isoDate) return;
    setLabel(formatWhatsApp(isoDate));

    // Re-evaluate every minute so "Today" → "Yesterday" flips at midnight
    const id = setInterval(() => setLabel(formatWhatsApp(isoDate)), 60_000);
    return () => clearInterval(id);
  }, [isoDate]);

  return label;
}

// Plain utility for non-hook contexts (lists, cards)
export function formatAgo(isoDate) {
  return formatWhatsApp(isoDate);
}
