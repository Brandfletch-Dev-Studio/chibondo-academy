import React, { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Lock, Loader2, Eye, EyeOff } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import SEO from "@/components/SEO";

export default function Register() {
  const [searchParams] = useSearchParams();
  const refCode = searchParams.get('ref');

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Remove any platform-injected social login buttons on mount
  useEffect(() => {
    const selectors = [
      '[data-provider="google"]',
      'button[aria-label*="Google"]',
      '.social-login',
      '.oauth-buttons',
      '[class*="google-login"]',
      '[class*="social-auth"]',
    ];
    selectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => el.remove());
    });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!email.trim()) { setError("Please enter your email address"); return; }
    if (password !== confirmPassword) { setError("Passwords do not match"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }

    setLoading(true);
    try {
      // Register — skip OTP gate, go straight to dashboard
      const result = await base44.auth.register({ email: email.trim(), password });

      // Set token if returned directly (no OTP flow)
      if (result?.access_token) {
        await base44.auth.setToken(result.access_token);
      }

      // Assign student role
      try { await base44.auth.updateMe({ role: 'user' }); } catch (_) {}

      // Apply referral silently in background
      if (refCode) {
        (async () => {
          try {
            const referrers = await base44.entities.User.filter({ referral_code: refCode });
            if (referrers.length > 0) {
              const newUser = await base44.auth.me();
              await base44.entities.Referral.create({
                referrer_id: referrers[0].id,
                referee_id: newUser.id,
                referee_email: email.trim(),
                status: 'pending',
                referral_code: refCode,
              }).catch(() => {});
            }
          } catch (_) {}
        })();
      }

      window.location.href = '/dashboard';
    } catch (err) {
      setError(err.message || "Registration failed. Please try again.");
      setLoading(false);
    }
  };

  return (
    <>
      <SEO
        title="Register"
        description="Create your free Chibondo Academy account. Join today and get access to quality online secondary education with MSCE lessons, quizzes, and past papers."
        canonical={`${window.location.origin}/register`}
      />
      <AuthLayout
        title="Welcome to The Chibondo Academy"
        subtitle="Create your account and start your learning journey today"
        footer={
          <div className="space-y-3">
            <div>
              Already have an account?{" "}
              <Link to="/login" className="text-primary font-medium hover:underline">Sign in</Link>
            </div>
            <div className="pt-2 border-t border-gray-200">
              Interested in teaching?{" "}
              <Link to="/register/teacher" className="text-primary font-medium hover:underline">Apply as Teacher</Link>
            </div>
          </div>
        }
      >
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-600 text-sm">{error}</div>
      )}

      {refCode && (
        <div className="mb-4 p-3 rounded-lg bg-accent/10 border border-accent/20 text-sm">
          <p className="font-semibold text-accent">Referral Code Applied</p>
          <p className="text-xs text-muted-foreground mt-0.5">Code: <span className="font-mono">{refCode}</span></p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email Address <span className="text-red-500">*</span></Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              id="email"
              type="email"
              autoFocus
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password <span className="text-red-500">*</span></Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10 pr-10 h-12"
              required
            />
            <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm Password <span className="text-red-500">*</span></Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              id="confirmPassword"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Repeat your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>

        <Button type="submit" className="w-full h-12 font-semibold" disabled={loading}>
          {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating account...</> : "Create Account"}
        </Button>

        <p className="text-center text-xs text-gray-500">
          By registering, you agree to our{" "}
          <Link to="/terms" className="text-primary hover:underline">Terms of Service</Link>
          {" "}and{" "}
          <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>
        </p>
      </form>
      </AuthLayout>
    </>
  );
}
