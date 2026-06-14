import React, { useState, useEffect, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Lock, Loader2, Eye, EyeOff, ShieldCheck, RefreshCw } from "lucide-react";
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

  // OTP step — the Base44 platform always sends an OTP on register before
  // issuing a token. We handle it inline so users don't leave the page.
  const [step, setStep] = useState('form'); // 'form' | 'otp'
  const [otpVal, setOtpVal] = useState('');
  const [otpError, setOtpError] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownRef = useRef(null);

  // Remove platform-injected social/Google login buttons
  useEffect(() => {
    const SOCIAL_SELECTORS = [
      '[data-provider="google"]', '[data-provider="facebook"]',
      'button[aria-label*="Google"]', 'button[aria-label*="google"]',
      '.social-login', '.oauth-buttons', '[class*="google-login"]',
      '[class*="social-auth"]', '[class*="GoogleLogin"]',
      '.base44-social-login', '[data-testid*="social"]', '[data-testid*="google"]',
    ];
    function removeSocialButtons() {
      SOCIAL_SELECTORS.forEach(sel => document.querySelectorAll(sel).forEach(el => el.remove()));
    }
    removeSocialButtons();
    const observer = new MutationObserver(removeSocialButtons);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  // Countdown for resend button
  const startCooldown = () => {
    setResendCooldown(30);
    clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setResendCooldown(v => {
        if (v <= 1) { clearInterval(cooldownRef.current); return 0; }
        return v - 1;
      });
    }, 1000);
  };
  useEffect(() => () => clearInterval(cooldownRef.current), []);

  // Step 1 — create account (platform sends OTP automatically)
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!email.trim()) { setError("Please enter your email address"); return; }
    if (password !== confirmPassword) { setError("Passwords do not match"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }

    setLoading(true);
    try {
      await base44.auth.register({ email: email.trim(), password });
      // Platform sends OTP to email — move to OTP step
      setStep('otp');
      startCooldown();
    } catch (err) {
      setError(err.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Step 2 — verify OTP → get token → log in
  const handleVerifyOtp = async () => {
    if (!otpVal.trim() || otpVal.length !== 6) {
      setOtpError("Please enter the 6-digit code");
      return;
    }
    setOtpError("");
    setOtpLoading(true);
    try {
      const result = await base44.auth.verifyOtp({ email: email.trim(), otpCode: otpVal.trim() });
      const token = result?.access_token ?? result?.token ?? result?.data?.access_token;

      if (token) {
        // Save token properly via SDK (writes to axios + localStorage)
        base44.auth.setToken(token);

        // Assign student role
        try { await base44.auth.updateMe({ role: 'user' }); } catch (_) {}

        // Apply referral silently
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

        // Redirect with token in URL so app-params picks it up on reload
        window.location.replace(`/dashboard?access_token=${encodeURIComponent(token)}`);
      } else {
        setOtpError("Verification succeeded but no token received. Please try logging in.");
      }
    } catch (err) {
      setOtpError(err.message || "Invalid code. Please try again.");
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setResending(true);
    setOtpError("");
    try {
      await base44.auth.resendOtp(email.trim());
      startCooldown();
    } catch (err) {
      setOtpError("Could not resend code. Please try again.");
    } finally {
      setResending(false);
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
        subtitle={
          step === 'otp'
            ? "Check your email for a verification code"
            : "Create your account and start your learning journey today"
        }
        footer={
          step === 'form' ? (
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
          ) : (
            <div>
              <button
                onClick={() => { setStep('form'); setOtpVal(''); setOtpError(''); }}
                className="text-sm text-primary hover:underline">
                ← Use a different email
              </button>
            </div>
          )
        }
      >
        {/* ── Step 1: Registration form ── */}
        {step === 'form' && (
          <>
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
                    id="email" type="email" autoFocus autoComplete="email"
                    placeholder="you@example.com" value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 h-12" required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password <span className="text-red-500">*</span></Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="password" type={showPassword ? "text" : "password"}
                    autoComplete="new-password" placeholder="At least 6 characters"
                    value={password} onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10 h-12" required
                  />
                  <button type="button" onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password <span className="text-red-500">*</span></Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="confirmPassword" type={showPassword ? "text" : "password"}
                    autoComplete="new-password" placeholder="Repeat your password"
                    value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10 h-12" required
                  />
                </div>
              </div>

              <Button type="submit" className="w-full h-12 font-semibold" disabled={loading}>
                {loading
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating account...</>
                  : "Create Account"}
              </Button>

              <p className="text-center text-xs text-gray-500">
                By registering, you agree to our{" "}
                <Link to="/terms" className="text-primary hover:underline">Terms of Service</Link>
                {" "}and{" "}
                <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>
              </p>
            </form>
          </>
        )}

        {/* ── Step 2: OTP verification ── */}
        {step === 'otp' && (
          <div className="space-y-5">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center">
                <ShieldCheck className="w-8 h-8 text-accent" />
              </div>
            </div>

            <div className="text-center space-y-1">
              <p className="text-sm text-muted-foreground">
                We sent a 6-digit code to
              </p>
              <p className="font-semibold text-foreground">{email}</p>
            </div>

            {otpError && (
              <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm">{otpError}</div>
            )}

            <div className="space-y-2">
              <Label htmlFor="otp">Verification Code</Label>
              <Input
                id="otp"
                type="text"
                inputMode="numeric"
                maxLength={6}
                autoFocus
                placeholder="000000"
                value={otpVal}
                onChange={(e) => setOtpVal(e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) => { if (e.key === 'Enter') handleVerifyOtp(); }}
                className="h-14 text-center text-2xl font-mono tracking-[0.5em] text-foreground"
              />
            </div>

            <Button
              onClick={handleVerifyOtp}
              className="w-full h-12 font-semibold"
              disabled={otpLoading || otpVal.length !== 6}>
              {otpLoading
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Verifying...</>
                : "Verify & Go to Dashboard"}
            </Button>

            <div className="text-center">
              <button
                onClick={handleResendOtp}
                disabled={resendCooldown > 0 || resending}
                className="text-sm text-muted-foreground hover:text-foreground disabled:opacity-50 flex items-center gap-1.5 mx-auto">
                {resending
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending...</>
                  : resendCooldown > 0
                  ? `Resend code in ${resendCooldown}s`
                  : <><RefreshCw className="w-3.5 h-3.5" /> Resend code</>}
              </button>
            </div>
          </div>
        )}
      </AuthLayout>
    </>
  );
}
