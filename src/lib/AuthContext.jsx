import React, { createContext, useState, useContext, useEffect } from 'react';
import { db } from '@/api/supabaseClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser]                   = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(false);
  const [authError, setAuthError]         = useState(null);
  const [authChecked, setAuthChecked]     = useState(false);
  const [appPublicSettings, setAppPublicSettings] = useState(null);

  useEffect(() => {
    checkUserAuth();
    loadPublicSettings();
  }, []);

  const loadPublicSettings = async () => {
    try {
      setIsLoadingPublicSettings(true);
      const settings = await db.entities.PlatformSettings.list('created_date', 1);
      if (settings && settings.length > 0) setAppPublicSettings(settings[0]);
    } catch (_) {
      // Non-fatal — settings are optional
    } finally {
      setIsLoadingPublicSettings(false);
    }
  };

  const checkUserAuth = async () => {
    try {
      setIsLoadingAuth(true);
      const currentUser = await db.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);

      // No OTP flow — StudentProfile is saved directly in Register.jsx on signup
    } catch (error) {
      setIsAuthenticated(false);
      setUser(null);
      // Only log if it's not a plain "not authenticated" (expected when logged out)
      if (error?.status !== 401) {
        console.error('Auth check failed:', error);
      }
    } finally {
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  };

  const logout = (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    try {
      localStorage.removeItem('aca_access_token');
      localStorage.removeItem('token');
    } catch (_) {}
    if (shouldRedirect) window.location.href = '/login';
  };

  const navigateToLogin = () => {
    window.location.href = '/login';
  };

  // Kept for backwards compat (some pages may call it)
  const checkAppState = () => checkUserAuth();

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
