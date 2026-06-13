import React, { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Lock, Loader2, Eye, EyeOff, KeyRound } from "lucide-react";
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
  const [emailSent, setEmailSent] = useState(false);
  const [newUserId, setNewUserId] = useState(null);
  const [otpCode, setOtpCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState('');
  const [resending, setResending] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!email.trim()) { setError("Please enter your email address"); return; }
    if (password !== confirmPassword) { setError("Passwords do not match"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }

    setLoading(true);
    try {
      const result = await base44.auth.register({ email: email.trim(), password });
      setEmailSent(true);
      if (result?.user?.id) {
        setNewUserId(result.user.id);
      }
    } catch (err) {
      setError(err.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setVerifyError("");
    if (!otpCode.trim()) { setVerifyError("Please enter the verification code"); return; }
    if (otpCode.trim().length !== 6) { setVerifyError("Code must be 6 digits"); return; }

    setVerifying(true);
    try {
      const result = await base44.auth.verifyOtp({ email: email.trim(), otpCode: otpCode.trim() });
      if (result?.access_token) {
        await base44.auth.setToken(result.access_token);
        try {
          await base44.auth.updateMe({ role: 'user' });
        } catch (_) {}
        // Apply referral if present
        if (refCode) {
          try {
            const referrers = await base44.entities.User.filter({ referral_code: refCode });
            if (referrers.length > 0) {
              const referrerId = referrers[0].id;
              const newUser = await base44.auth.me();
              await base44.entities.Referral.create({
                referrer_id: referrerId,
                referee_id: newUser.id,
                referee_email: email.trim(),
                status: 'pending',
                referral_code: refCode,
              }).catch(() => {});
            }
          } catch (_) {}
        }
        window.location.href = '/dashboard';
      }
    } catch (err) {
      setVerifyError(err.message || "Invalid code. Please try again.");
    } finally {
      setVerifying(false);
    }
  };

  const handleResendOtp = async () => {
    setResending(true);
    setVerifyError("");
    try {
      await base44.auth.resendOtp(email.trim());
    } catch (err) {
      setVerifyError(err.message || "Failed to resend code.");
    } finally {
      setResending(false);
    }
  };

  if (emailSent) {
    return (
      <>
        <SEO 
          title="Verify Your Email"
          description="Enter the 6-digit verification code sent to your email to complete your Chibondo Academy registration."
          canonical={`${window.location.origin}/register`}
        />
        <AuthLayout
          title="Verify your email"
          subtitle={`We sent a 6-digit code to ${email}`}
        >
        <div className="text-center space-y-6 py-4">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center">
              <KeyRound className="w-8 h-8 text-accent" />
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-gray-600">
              Enter the 6-digit verification code from the email to complete your registration.
            </p>
            {refCode && (
              <p className="text-xs text-accent font-medium">
                Referral code <span className="font-mono">{refCode}</span> will be applied after verification!
              </p>
            )}
          </div>

          <form onSubmit={handleVerifyOtp} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="otp">Verification Code</Label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="000000"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  className="pl-10 h-12 text-center tracking-widest font-mono"
                  autoFocus
                  required
                />
              </div>
            </div>

            {verifyError && (
              <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm">{verifyError}</div>
            )}

            <Button type="submit" className="w-full h-12 font-semibold" disabled={verifying}>
              {verifying ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Verifying...</> : "Verify & Continue"}
            </Button>
          </form>

          <div className="pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-500 mb-2">Didn't receive the code?</p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleResendOtp}
              disabled={resending}
              className="text-xs h-9"
            >
              {resending ? <><Loader2 className="w-3 h-3 mr-2 animate-spin" />Resending...</> : "Resend Code"}
            </Button>
          </div>

          <div className="pt-2">
            <Link to="/login" className="text-sm text-primary font-medium hover:underline">
              Back to Sign In
            </Link>
          </div>
        </div>
      </AuthLayout>
      </>
    );
  }

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
