import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { db } from '@/api/supabaseClient';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";

/**
 * Supabase sends the reset link as:
 *   https://chibondoacademy.com/reset-password#access_token=xxx&type=recovery
 *
 * We read the token from the hash fragment, store it, then let the user
 * enter a new password. On submit we authenticate with that token and
 * call the Supabase PUT /auth/v1/user endpoint to update the password.
 */
function getTokenFromHash() {
  try {
    const hash = window.location.hash.slice(1); // strip leading #
    const params = new URLSearchParams(hash);
    if (params.get("type") === "recovery") {
      return params.get("access_token") || null;
    }
    // fallback: plain ?token= or ?access_token= in query string
    const qs = new URLSearchParams(window.location.search);
    return qs.get("access_token") || qs.get("token") || null;
  } catch {
    return null;
  }
}

export default function ResetPassword() {
  const [accessToken, setAccessToken] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const token = getTokenFromHash();
    setAccessToken(token);
    // Clear the hash so the token isn't exposed in history
    if (token) window.history.replaceState(null, "", window.location.pathname);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      // Store the recovery token so changePassword() can use it as the Bearer
      db.auth.setToken(accessToken);
      await db.auth.changePassword(newPassword);
      setDone(true);
      // Redirect to login after 2 seconds
      setTimeout(() => { window.location.href = "/login"; }, 2000);
    } catch (err) {
      setError(err.message || "Failed to reset password. The link may have expired.");
    } finally {
      setLoading(false);
    }
  };

  // No token in URL
  if (!accessToken && !done) {
    return (
      <AuthLayout
        icon={AlertTriangle}
        title="Invalid reset link"
        subtitle="This password reset link is missing or has expired"
        footer={
          <Link to="/forgot-password" className="text-primary font-medium hover:underline">
            Request a new link
          </Link>
        }
      >
        <p className="text-sm text-muted-foreground text-center">
          Please request a fresh password reset email and click the link within 1 hour.
        </p>
      </AuthLayout>
    );
  }

  // Success state
  if (done) {
    return (
      <AuthLayout icon={CheckCircle2} title="Password updated!" subtitle="Redirecting you to login...">
        <p className="text-sm text-muted-foreground text-center">Your password has been changed successfully.</p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      icon={Lock}
      title="Choose a new password"
      subtitle="Enter your new password below"
    >
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">New Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              autoFocus
              placeholder="••••••••"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="pl-10 h-12"
              required
              minLength={6}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">Confirm Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="pl-10 h-12"
              required
              minLength={6}
            />
          </div>
        </div>
        <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
          {loading ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Updating password...</>
          ) : (
            "Set new password"
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}
