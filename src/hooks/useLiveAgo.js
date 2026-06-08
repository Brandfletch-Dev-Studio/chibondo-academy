import { useState, useEffect } from 'react';

/**
 * useLiveAgo — authentic relative timestamps that stay accurate without page reload.
 *
 * Calculates "just now / X minutes ago / yesterday / X weeks ago" from any UTC
 * ISO timestamp and re-evaluates on a smart schedule:
 *
 *   < 1 min   → ticks every  10 seconds  ("just now" → "1 minute ago")
 *   < 1 hour  → ticks every  60 seconds
 *   < 24 hrs  → ticks every   5 minutes
 *   older     → ticks every  60 minutes
 *
 * The viewer's local timezone is used automatically (JS Date handles this).
 * No hardcoded strings — every label is computed from the real DB timestamp.
 *
 * @param {string|null} isoDate  UTC ISO string from the database (created_date, updated_date, etc.)
 * @returns {string}  e.g. "just now", "3 minutes ago", "yesterday", "2 weeks ago"
 */

function formatAgo(isoDate) {
  if (!isoDate) return '';
  const now  = Date.now();
  const then = new Date(isoDate).getTime();
  if (isNaN(then)) return '';
  const diffMs  = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr  = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr  / 24);
  const diffWk  = Math.floor(diffDay / 7);

  if (diffSec < 30)  return 'just now';
  if (diffSec < 90)  return '1 minute ago';
  if (diffMin < 60)  return `${diffMin} minutes ago`;
  if (diffMin < 90)  return '1 hour ago';
  if (diffHr  < 24)  return `${diffHr} hours ago`;
  if (diffDay === 1) return 'yesterday';
  if (diffDay <  7)  return `${diffDay} days ago`;
  if (diffWk  === 1) return '1 week ago';
  if (diffWk  <  5)  return `${diffWk} weeks ago`;

  // Older than ~1 month — show a real date in the viewer's locale
  return new Date(isoDate).toLocaleDateString(undefined, {
    day: 'numeric', month: 'short', year: diffDay > 365 ? 'numeric' : undefined,
  });
}

function getInterval(isoDate) {
  if (!isoDate) return 60 * 60 * 1000;
  const diffMs = Date.now() - new Date(isoDate).getTime();
  if (diffMs < 60_000)          return 10_000;   // < 1 min  → every 10s
  if (diffMs < 60 * 60_000)     return 60_000;   // < 1 hr   → every 1 min
  if (diffMs < 24 * 60 * 60_000) return 5 * 60_000; // < 24 hr → every 5 min
  return 60 * 60_000;                             // older    → every 1 hr
}

export function useLiveAgo(isoDate) {
  const [label, setLabel] = useState(() => formatAgo(isoDate));

  useEffect(() => {
    if (!isoDate) return;

    // Recompute immediately whenever the date changes
    setLabel(formatAgo(isoDate));

    let id;

    function schedule() {
      const interval = getInterval(isoDate);
      id = setTimeout(() => {
        setLabel(formatAgo(isoDate));
        schedule(); // reschedule with recalculated interval
      }, interval);
    }

    schedule();
    return () => clearTimeout(id);
  }, [isoDate]);

  return label;
}

export { formatAgo };
