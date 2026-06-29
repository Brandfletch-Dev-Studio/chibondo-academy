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

export function useAuthGate() {
  const navigate = useNavigate();
  const location = useLocation();

  // Check Supabase JWT in localStorage
  const isAuthenticated = !!(
    localStorage.getItem('base44_access_token') ||
    localStorage.getItem('token')
  );

  const requireAuth = useCallback((callback, options = {}) => {
    if (isAuthenticated) {
      if (callback) callback();
      return;
    }
    const returnTo = options.returnTo || location.pathname + location.search;
    sessionStorage.setItem('auth_return_to', returnTo);
    if (options.intent) sessionStorage.setItem('auth_intent', options.intent);
    navigate('/login', { state: { returnTo } });
  }, [isAuthenticated, location, navigate]);

  return { isAuthenticated, requireAuth };
}
