import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { db } from '@/api/supabaseClient';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Lock, Loader2, Eye, EyeOff, Phone } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import SEO from "@/components/SEO";

export default function Login() {
  const [loginMethod, setLoginMethod] = useState('phone'); // 'phone' | 'email'
  const [phone,       setPhone]       = useState("");
  const [email,       setEmail]       = useState("");
  const [password,    setPassword]    = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error,       setError]       = useState("");
  const [loading,     setLoading]     = useState(false);

  // Remove platform-injected social/OAuth buttons
  useEffect(() => {
    const SOCIAL_SELECTORS = [
      '[data-provider="google"]','[data-provider="facebook"]',
      'button[aria-label*="Google"]','button[aria-label*="google"]',
      '.social-login','.oauth-buttons','[class*="google-login"]',
      '[class*="social-auth"]','[class*="GoogleLogin"]',
      '.aca-social-login','[data-testid*="social"]','[data-testid*="google"]',
    ];
    function remove() { SOCIAL_SELECTORS.forEach(sel => document.querySelectorAll(sel).forEach(el => el.remove())); }
    remove();
    const obs = new MutationObserver(remove);
    obs.observe(document.body, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, []);

  const resolveEmail = () => {
    if (loginMethod === 'email') return email.trim();
    // Derive placeholder email from phone digits (same logic as register)
    const digits = phone.replace(/\D/g,'');
    const last9  = digits.slice(-9);
    return `${last9}@student.chibondoacademy.com`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (loginMethod === 'phone') {
      if (!phone.trim()) { setError("Please enter your phone number"); return; }
      if (phone.replace(/\D/g,'').length < 9) { setError("Please enter a valid phone number"); return; }
    } else {
      if (!email.trim()) { setError("Please enter your email address"); return; }
    }
    if (!password) { setError("Please enter your password"); return; }

    setLoading(true);
    try {
      await db.auth.loginViaEmailPassword(resolveEmail(), password);
      window.location.href = "/";
    } catch (err) {
      if (loginMethod === 'phone') {
        setError("Incorrect phone number or password. Please try again.");
      } else {
        setError("Incorrect email or password. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <SEO
        title="Login"
        description="Sign in to your Chibondo Academy account to access online courses, lessons, and study materials."
        canonical={`${window.location.origin}/login`}
      />
      <AuthLayout
        title="Welcome Back"
        subtitle="Continue from where you left off"
        footer={
          <>
            New to the academy?{" "}
            <Link to="/register" className="text-primary font-medium hover:underline">Join us</Link>
          </>
        }
      >
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-600 text-sm">{error}</div>
        )}

        {/* Login method toggle */}
        <div className="flex gap-1 bg-muted/60 p-1 rounded-xl mb-5">
          <button
            type="button"
            onClick={() => { setLoginMethod('phone'); setError(''); }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all ${
              loginMethod === 'phone' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'
            }`}
          >
            <Phone className="w-3.5 h-3.5" /> Phone
          </button>
          <button
            type="button"
            onClick={() => { setLoginMethod('email'); setError(''); }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all ${
              loginMethod === 'email' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'
            }`}
          >
            <Mail className="w-3.5 h-3.5" /> Email
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {loginMethod === 'phone' ? (
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="phone" type="tel" autoFocus autoComplete="tel"
                  placeholder="e.g. 0881234567"
                  value={phone} onChange={e => setPhone(e.target.value)}
                  className="pl-10 h-12" required
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email" type="email" autoFocus autoComplete="email"
                  placeholder="you@example.com"
                  value={email} onChange={e => setEmail(e.target.value)}
                  className="pl-10 h-12" required
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link to="/forgot-password" className="text-xs text-primary hover:underline">Forgot password?</Link>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="password" type={showPassword ? "text" : "password"}
                autoComplete="current-password" placeholder="••••••••"
                value={password} onChange={e => setPassword(e.target.value)}
                className="pl-10 pr-10 h-12" required
              />
              <button type="button" onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <Button type="submit" className="w-full h-12 font-semibold" disabled={loading}>
            {loading
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Signing in…</>
              : "Sign In"}
          </Button>
        </form>
      </AuthLayout>
    </>
  );
}
