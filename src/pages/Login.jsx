import React, { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Phone, Mail, Loader2, MessageCircle, Lock } from "lucide-react";
import { db } from "@/api/supabaseClient";
import AuthLayout from "@/components/AuthLayout";
import { useAuth } from "@/lib/AuthContext";
import SEO from "@/components/SEO";

export default function Login() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const refCode = searchParams.get("ref");

  const [mode, setMode] = useState("whatsapp"); // "whatsapp" | "email"
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const { isAuthenticated, authChecked } = useAuth();

  useEffect(() => {
    if (refCode) localStorage.setItem("pending_referral_code", refCode);
  }, [refCode]);

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (authChecked && isAuthenticated) window.location.replace("/dashboard");
  }, [authChecked, isAuthenticated]);

  // ── WhatsApp login ──
  const handleWhatsApp = async (e) => {
    e.preventDefault();
    setError("");

    const digits = phone.replace(/\D/g, "");
    if (digits.length < 9) {
      setError("Please enter a valid phone number");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/wa-otp?action=send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: digits }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to send. Please try again.");
        setLoading(false);
        return;
      }

      setSent(true);
      setTimeout(() => {
        navigate("/verify-otp", {
          state: { phone: data.phone || digits, refCode: refCode || null },
        });
      }, 600);
    } catch (err) {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  // ── Email login (for existing students) ──
  const handleEmail = async (e) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError("Please enter your email and password");
      return;
    }

    setLoading(true);
    try {
      const data = await db.auth.loginViaEmailPassword(email.trim(), password);
      if (data.access_token) {
        window.location.replace("/dashboard");
      } else {
        setError("Login failed. Please check your credentials.");
        setLoading(false);
      }
    } catch (err) {
      setError(err?.message || "Invalid email or password.");
      setLoading(false);
    }
  };

  return (
    <>
      <SEO
        title="Login"
        description="Sign in to your Chibondo Academy account with WhatsApp verification or email."
        canonical={`${window.location.origin}/login`}
      />
      <AuthLayout
        title="Welcome Back"
        subtitle="Sign in to your account"
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

        {sent && (
          <div className="mb-4 p-3 rounded-lg bg-green-50 text-green-600 text-sm text-center">
            <Loader2 className="w-4 h-4 inline mr-1 animate-spin" />
            Sending verification link via WhatsApp…
          </div>
        )}

        {/* ── Mode toggle ── */}
        <div className="flex gap-2 mb-5 p-1 rounded-xl bg-muted/50">
          <button
            type="button"
            onClick={() => { setMode("whatsapp"); setError(""); }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all ${
              mode === "whatsapp" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"
            }`}
          >
            <MessageCircle className="w-4 h-4" /> WhatsApp
          </button>
          <button
            type="button"
            onClick={() => { setMode("email"); setError(""); }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all ${
              mode === "email" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"
            }`}
          >
            <Mail className="w-4 h-4" /> Email
          </button>
        </div>

        {/* ── WhatsApp login ── */}
        {mode === "whatsapp" && (
          <form onSubmit={handleWhatsApp} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="phone">WhatsApp Number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="phone"
                  type="tel"
                  autoFocus
                  autoComplete="tel"
                  placeholder="0991234567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="pl-10 h-12"
                  required
                />
              </div>
              <p className="text-xs text-muted-foreground">
                We'll send a verification link to your WhatsApp. Just tap it to log in.
              </p>
            </div>

            <Button type="submit" className="w-full h-12 font-semibold" disabled={loading}>
              {loading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending…</>
              ) : (
                <><MessageCircle className="w-4 h-4 mr-2" />Send WhatsApp Link</>
              )}
            </Button>
          </form>
        )}

        {/* ── Email login (for existing students) ── */}
        {mode === "email" && (
          <form onSubmit={handleEmail} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email Address</Label>
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

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 h-12"
                  required
                />
              </div>
            </div>

            <Button type="submit" className="w-full h-12 font-semibold" disabled={loading}>
              {loading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Signing in…</>
              ) : (
                <><Lock className="w-4 h-4 mr-2" />Sign In</>
              )}
            </Button>

            <div className="text-center">
              <Link to="/forgot-password" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                Forgot your password?
              </Link>
            </div>
          </form>
        )}

        {refCode && (
          <div className="mt-4 p-3 rounded-lg bg-accent/10 border border-accent/20 text-sm">
            <p className="font-semibold text-accent">Referral Code Applied</p>
            <p className="text-xs text-muted-foreground mt-0.5">Code: <span className="font-mono">{refCode}</span></p>
          </div>
        )}
      </AuthLayout>
    </>
  );
}
