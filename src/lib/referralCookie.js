/**
 * Referral cookie tracking utility.
 *
 * When a visitor lands on ANY page with ?ref=CODE in the URL, we store the
 * referral code in a cookie (default 30 days) AND localStorage. This persists
 * across sessions so the referral is tracked even if the visitor browses
 * around and comes back later to register.
 *
 * After the referral is successfully recorded at registration, the cookie
 * is cleared so we don't keep stale tracking data.
 */

const COOKIE_NAME = 'aca_referral_code';
const STORAGE_KEY = 'pending_referral_code';
const DEFAULT_COOKIE_DAYS = 30;

/**
 * Set the referral cookie + localStorage from a URL ?ref= parameter.
 * Should be called on every page load (App-level).
 */
export function captureReferralFromURL() {
  if (typeof window === 'undefined') return;

  const params = new URLSearchParams(window.location.search);
  const refCode = params.get('ref');

  if (refCode) {
    const code = refCode.trim().toUpperCase();
    setReferralCookie(code);
    localStorage.setItem(STORAGE_KEY, code);
    // Clean the URL — remove ?ref= so it doesn't get shared with the code embedded
    if (window.history && window.history.replaceState) {
      const cleanUrl = window.location.pathname + window.location.hash;
      window.history.replaceState(null, '', cleanUrl);
    }
  }
}

/**
 * Set the referral cookie with a configurable expiry (default 30 days).
 */
export function setReferralCookie(code, days = DEFAULT_COOKIE_DAYS) {
  if (typeof document === 'undefined') return;
  const maxAge = days * 24 * 60 * 60;
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(code)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

/**
 * Read the referral code from cookie first, fall back to localStorage.
 * Returns null if no referral code is stored.
 */
export function getReferralCode() {
  if (typeof window === 'undefined') return null;

  // Try cookie first
  const cookies = document.cookie.split(';');
  for (const c of cookies) {
    const [name, ...valueParts] = c.trim().split('=');
    if (name === COOKIE_NAME) {
      const value = valueParts.join('=');
      if (value) return decodeURIComponent(value);
    }
  }

  // Fall back to localStorage
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) return stored.toUpperCase();

  return null;
}

/**
 * Clear the referral cookie and localStorage after the referral has been
 * successfully tracked at registration.
 */
export function clearReferralTracking() {
  if (typeof document === 'undefined') return;
  document.cookie = `${COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
  localStorage.removeItem(STORAGE_KEY);
}
