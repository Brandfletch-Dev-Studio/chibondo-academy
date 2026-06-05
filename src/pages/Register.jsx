import React, { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Lock, Loader2, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import GoogleIcon from "@/components/GoogleIcon";
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
      // Store the new user ID for tracking referral after OTP verification
      if (result?.user?.id) {
        setNewUserId(result.user.id);
      }
    } catch (err) {
      setError(err.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = () => {
    base44.auth.loginWithProvider("google", "/onboarding");
  };

  if (emailSent) {
    return (
      <>
        <SEO 
          title="Verify Your Email"
          description="Check your email to verify your Chibondo Academy account and complete registration."
          canonical={`${window.location.origin}/register`}
        />
        <AuthLayout
          title="Check your email"
          subtitle={`We sent a verification link to ${email}`}
        >
        <div className="text-center space-y-6 py-4">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-gray-600">
              Click the link in the email to verify your account and complete your registration.
            </p>
            {refCode && (
              <p className="text-xs text-accent font-medium">
                Your referral code <span className="font-mono">{refCode}</span> has been saved. We'll track it once you verify your email!
              </p>
            )}
            <p className="text-xs text-gray-400">
              Didn't receive the email? Check your spam folder.
            </p>
          </div>
          <div className="pt-2 border-t border-gray-100">
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
      <Button variant="outline" className="w-full h-12 text-sm font-medium mb-6" onClick={handleGoogle}>
        <GoogleIcon className="w-5 h-5 mr-2" />
        Continue with Google
      </Button>

      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white px-3 text-gray-400">or sign up with email</span>
        </div>
      </div>

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
          <Label htmlFor="confirm">Confirm Password <span className="text-red-500">*</span></Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              id="confirm"
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
      </form>
      </AuthLayout>
    </>
  );
}