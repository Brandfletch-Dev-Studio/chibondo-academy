import React, { useState, useEffect } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { db } from '@/api/supabaseClient';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Lock, Loader2, Eye, EyeOff, User as UserIcon, Phone } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import SEO from "@/components/SEO";

export default function Register() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const refCode  = searchParams.get("ref");

  useEffect(() => {
    if (refCode) localStorage.setItem("pending_referral_code", refCode);
  }, [refCode]);

  const [fullName,        setFullName]        = useState("");
  const [phone,           setPhone]           = useState("");
  const [email,           setEmail]           = useState("");
  const [password,        setPassword]        = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword,    setShowPassword]    = useState(false);
  const [error,           setError]           = useState("");
  const [loading,         setLoading]         = useState(false);

  // Remove platform-injected social/OAuth buttons
  useEffect(() => {
    const SELECTORS = [
      '[data-provider="google"]','[data-provider="facebook"]',
      'button[aria-label*="Google"]','button[aria-label*="google"]',
      '.social-login','.oauth-buttons','[class*="google-login"]',
      '[class*="social-auth"]','[class*="GoogleLogin"]',
      '.aca-social-login','[data-testid*="social"]','[data-testid*="google"]',
    ];
    function remove() { SELECTORS.forEach(s => document.querySelectorAll(s).forEach(el => el.remove())); }
    remove();
    const obs = new MutationObserver(remove);
    obs.observe(document.body, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, []);

  // Format phone: ensure +265 prefix for Malawi
  const formatPhone = (val) => {
    const digits = val.replace(/\D/g, '');
    if (digits.startsWith('265')) return '+' + digits;
    if (digits.startsWith('0')) return '+265' + digits.slice(1);
    if (digits.length > 0 && !digits.startsWith('265')) return '+265' + digits;
    return val;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!fullName.trim())               { setError("Please enter your full name"); return; }
    if (!phone.trim())                  { setError("Please enter your phone number"); return; }
    if (phone.replace(/\D/g,'').length < 9) { setError("Please enter a valid phone number"); return; }
    if (password !== confirmPassword)   { setError("Passwords do not match"); return; }
    if (password.length < 6)            { setError("Password must be at least 6 characters"); return; }

    // Email is optional but if provided must be valid
    if (email.trim() && !/\S+@\S+\.\S+/.test(email.trim())) {
      setError("Please enter a valid email address"); return;
    }

    setLoading(true);
    try {
      // Use phone as login identity if no email; generate a placeholder email
      const loginEmail = email.trim() || `${phone.replace(/\D/g,'').slice(-9)}@student.chibondoacademy.com`;
      const formattedPhone = formatPhone(phone.trim());

      const result = await db.auth.register({
        email: loginEmail,
        password,
        full_name: fullName.trim(),
        phone_number: formattedPhone,  // saved into user_metadata by supabaseClient
        data: {
          full_name: fullName.trim(),
          phone_number: formattedPhone,
        },
      });

      const token = result?.access_token ?? result?.token ?? result?.data?.access_token;

      // Save phone to StudentProfile after registration
      if (token) {
        db.auth.setToken(token);
        // Create/update StudentProfile with phone immediately
        try {
          const me = await db.auth.me();
          if (me?.id) {
            const existing = await db.entities.StudentProfile.filter({ user_id: me.id });
            if (existing.length > 0) {
              await db.entities.StudentProfile.update(existing[0].id, { phone_number: formattedPhone });
            } else {
              await db.entities.StudentProfile.create({ user_id: me.id, full_name: fullName.trim(), phone_number: formattedPhone });
            }
          }
        } catch (_) {}
        window.location.replace("/dashboard");
      } else {
        navigate("/verify-otp", {
          replace: true,
          state: { email: loginEmail, refCode: refCode || null },
        });
      }
    } catch (err) {
      const msg = err.message || "";
      if (msg.toLowerCase().includes("already registered") || msg.toLowerCase().includes("already exists") || msg.toLowerCase().includes("user already")) {
        setError("An account with this phone number already exists. Please sign in instead.");
      } else {
        setError(msg || "Registration failed. Please try again.");
      }
      setLoading(false);
    }
  };

  return (
    <>
      <SEO
        title="Register"
        description="Create your free Chibondo Academy account. Join today and get access to MSCE lessons, quizzes, and past papers."
        canonical={`${window.location.origin}/register`}
      />
      <AuthLayout
        title="Create Your Account"
        subtitle="Join Chibondo Academy and start your MSCE journey"
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
          {/* Full Name */}
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <div className="relative">
              <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="fullName" type="text" autoFocus autoComplete="name"
                placeholder="Your full name" value={fullName}
                onChange={e => setFullName(e.target.value)}
                className="pl-10 h-12" required
              />
            </div>
          </div>

          {/* Phone — primary, required */}
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="phone" type="tel" autoComplete="tel"
                placeholder="e.g. 0881234567 or +265881234567"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="pl-10 h-12" required
              />
            </div>
            <p className="text-[11px] text-muted-foreground">Used for account recovery and important updates</p>
          </div>

          {/* Email — secondary, not labelled optional */}
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="email" type="email" autoComplete="email"
                placeholder="you@example.com" value={email}
                onChange={e => setEmail(e.target.value)}
                className="pl-10 h-12"
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="password" type={showPassword ? "text" : "password"}
                autoComplete="new-password" placeholder="At least 6 characters"
                value={password} onChange={e => setPassword(e.target.value)}
                className="pl-10 pr-10 h-12" required
              />
              <button type="button" onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="confirmPassword" type={showPassword ? "text" : "password"}
                autoComplete="new-password" placeholder="Repeat your password"
                value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                className="pl-10 h-12" required
              />
            </div>
          </div>

          <Button type="submit" className="w-full h-12 font-semibold" disabled={loading}>
            {loading
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating account…</>
              : "Create Account"}
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
