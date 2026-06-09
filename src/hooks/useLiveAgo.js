import { useState, useEffect } from 'react';

/**
 * Parses a Base44 ISO date string correctly.
 *
 * Base44 stores all dates in UTC but WITHOUT the Z suffix,
 * e.g. "2026-06-09T07:45:00.000000"
 *
 * Without Z, browsers are inconsistent about whether to treat
 * the value as UTC or local — causing an N-hour offset bug.
 * Fix: always append Z to make it unambiguously UTC.
 */
function parseUTC(isoDate) {
  if (!isoDate) return null;
  // Already has explicit timezone — leave as-is
  if (isoDate.endsWith('Z')) {
    const d = new Date(isoDate);
    return isNaN(d.getTime()) ? null : d;
  }
  // Has offset like +02:00 or -05:00 after the T
  const afterT = isoDate.slice(10);
  if (afterT.includes('+') || (afterT.includes('-') && afterT.lastIndexOf('-') > 0)) {
    const d = new Date(isoDate);
    return isNaN(d.getTime()) ? null : d;
  }
  // No timezone — Base44 UTC, force it
  const d = new Date(isoDate + 'Z');
  return isNaN(d.getTime()) ? null : d;
}

/**
 * WhatsApp-style timestamp formatter.
 *
 * Rules (all times shown in the viewer's LOCAL timezone):
 *   Posted today       ->  "10:45 PM"
 *   Posted yesterday   ->  "Yesterday 10:45 PM"
 *   Posted this week   ->  "Mon 10:45 PM"
 *   Posted this year   ->  "12 Jun 10:45 PM"
 *   Older              ->  "12 Jun 2024 10:45 PM"
 *
 * Updates every minute so day labels flip correctly at midnight.
 */
function formatWhatsApp(isoDate) {
  if (!isoDate) return '';
  const then = parseUTC(isoDate);
  if (!then) return '';

  const now = new Date();

  // Local clock time e.g. '10:45 PM'
  const time = then.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Build LOCAL midnight for today and for 'then'.
  // toLocaleDateString('en-CA') returns 'YYYY-MM-DD' in the viewer's LOCAL timezone.
  // Passing that into new Date() gives midnight LOCAL — correct for diffDays math.
  const todayStart = new Date(now.toLocaleDateString('en-CA'));
  const thenStart  = new Date(then.toLocaleDateString('en-CA'));
  const diffDays   = Math.round((todayStart - thenStart) / 86_400_000);

  if (diffDays === 0) return time;
  if (diffDays === 1) return 'Yesterday ' + time;
  if (diffDays < 7) {
    const day = then.toLocaleDateString([], { weekday: 'short' });
    return day + ' ' + time;
  }
  if (then.getFullYear() === now.getFullYear()) {
    const date = then.toLocaleDateString([], { day: 'numeric', month: 'short' });
    return date + ' ' + time;
  }
  const date = then.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
  return date + ' ' + time;
}

export function useLiveAgo(isoDate) {
  const [label, setLabel] = useState(() => formatWhatsApp(isoDate));

  useEffect(() => {
    if (!isoDate) return;
    // Recalculate immediately when the date prop changes
    setLabel(formatWhatsApp(isoDate));
    // Re-evaluate every minute so day labels flip at midnight
    const id = setInterval(() => setLabel(formatWhatsApp(isoDate)), 60_000);
    return () => clearInterval(id);
  }, [isoDate]);

  return label;
}

// Plain utility for non-hook contexts (static renders, list maps)
export function formatAgo(isoDate) {
  return formatWhatsApp(isoDate);
}
