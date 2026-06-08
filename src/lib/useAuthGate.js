/**
 * useAuthGate — triggers login flow for protected actions
 *
 * Usage:
 *   const { user, requireAuth } = useAuthGate();
 *   <button onClick={() => requireAuth(() => handleEnroll())}>Join Class</button>
 *
 * If user is authenticated: runs the callback immediately.
 * If not: saves the intended action + current URL, redirects to /login.
 */
import { useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { appParams } from '@/lib/app-params';

export function useAuthGate() {
  const navigate = useNavigate();
  const location = useLocation();

  // Check auth synchronously from the query cache (no async call needed)
  const isAuthenticated = !!appParams.token;

  const requireAuth = useCallback((callback, options = {}) => {
    if (isAuthenticated) {
      // Already logged in — run the action directly
      if (callback) callback();
      return;
    }
    // Not logged in — save return destination + run intent
    const returnTo = options.returnTo || location.pathname + location.search;
    sessionStorage.setItem('auth_return_to', returnTo);
    if (options.intent) sessionStorage.setItem('auth_intent', options.intent);
    // Redirect to login
    base44.auth.redirectToLogin(window.location.origin + returnTo);
  }, [isAuthenticated, location]);

  return { isAuthenticated, requireAuth };
}
