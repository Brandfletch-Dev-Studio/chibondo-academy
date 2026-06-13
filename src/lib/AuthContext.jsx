import React, { createContext, useState, useContext, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { appParams } from '@/lib/app-params';
import { createAxiosClient } from '@base44/sdk/dist/utils/axios-client';

const AuthContext = createContext();

/**
 * Determine whether an error is a genuine auth rejection (token invalid / user
 * not registered) vs. a transient problem (network timeout, server 5xx).
 *
 * Only genuine auth rejections should clear the session.
 * Transient errors should be ignored so the cached auth state is preserved.
 */
function isAuthRejection(error) {
  const status = error?.status ?? error?.response?.status;
  return status === 401 || status === 403;
}

export const AuthProvider = ({ children }) => {
  const [user, setUser]                                   = useState(null);
  const [isAuthenticated, setIsAuthenticated]             = useState(false);
  const [isLoadingAuth, setIsLoadingAuth]                 = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError]                         = useState(null);
  const [authChecked, setAuthChecked]                     = useState(false);
  const [appPublicSettings, setAppPublicSettings]         = useState(null);

  useEffect(() => {
    checkAppState();
  }, []);

  const checkAppState = async () => {
    try {
      setIsLoadingPublicSettings(true);
      setAuthError(null);

      const appClient = createAxiosClient({
        baseURL: `/api/apps/public`,
        headers: { 'X-App-Id': appParams.appId },
        token: appParams.token,
        interceptResponses: true,
      });

      try {
        const publicSettings = await appClient.get(`/prod/public-settings/by-id/${appParams.appId}`);
        setAppPublicSettings(publicSettings);

        if (appParams.token) {
          await checkUserAuth();
        } else {
          setIsLoadingAuth(false);
          setIsAuthenticated(false);
          setAuthChecked(true);
        }
        setIsLoadingPublicSettings(false);
      } catch (appError) {
        console.error('App state check failed:', appError);

        if (appError.status === 403 && appError.data?.extra_data?.reason) {
          const reason = appError.data.extra_data.reason;
          setAuthError({ type: reason, message: appError.message });
        } else {
          // Transient error loading app settings — don't block the app.
          // Proceed as if settings loaded, let auth check run normally.
          console.warn('Non-fatal: could not load public settings, continuing anyway');
          if (appParams.token) {
            await checkUserAuth();
          } else {
            setIsAuthenticated(false);
            setAuthChecked(true);
          }
        }
        setIsLoadingPublicSettings(false);
        setIsLoadingAuth(false);
      }
    } catch (error) {
      console.error('Unexpected error in checkAppState:', error);
      // Don't set a hard error — let the app render and let AppLayout handle auth
      setIsLoadingPublicSettings(false);
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  };

  const checkUserAuth = async () => {
    try {
      setIsLoadingAuth(true);
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);
      setIsLoadingAuth(false);
      setAuthChecked(true);
    } catch (error) {
      console.error('User auth check failed:', error);
      setIsLoadingAuth(false);
      setAuthChecked(true);

      if (isAuthRejection(error)) {
        // Token genuinely rejected — clear session
        setIsAuthenticated(false);
        setUser(null);
        setAuthError({ type: 'auth_required', message: 'Authentication required' });
      } else {
        // Transient failure (network blip, server error, timeout).
        // Keep the user as authenticated if a token exists in storage.
        // The page will retry on next interaction / navigation.
        if (appParams.token) {
          setIsAuthenticated(true);
          // user stays null until the next successful me() call — AppLayout
          // handles this gracefully by showing a loading skeleton.
        } else {
          setIsAuthenticated(false);
        }
      }
    }
  };

  const logout = (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    // Clear the token from local storage directly — do NOT redirect through
    // Base44's hosted login page, which shows Google OAuth buttons.
    try { localStorage.removeItem('base44_access_token'); localStorage.removeItem('token'); } catch (_) {}
    if (shouldRedirect) {
      window.location.href = '/login';
    }
  };

  const navigateToLogin = () => {
    // Redirect to our own login page, not Base44's hosted page
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      authChecked,
      logout,
      navigateToLogin,
      checkUserAuth,
      checkAppState,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
