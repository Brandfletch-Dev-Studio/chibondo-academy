import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Loader2, Mail, RefreshCw, CheckCircle2, ArrowLeft } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import SEO from "@/components/SEO";

export default function VerifyOtp() {
  const location = useLocation();
  const navigate = useNavigate();

  const email   = location.state?.email   || "";
  const refCode = location.state?.refCode || null;

  const [code,        setCode]        = useState("");
  const [error,       setError]       = useState("");
  const [loading,     setLoading]     = useState(false);
  const [success,     setSuccess]     = useState(false);
  const [resending,   setResending]   = useState(false);
  const [cooldown,    setCooldown]    = useState(30);
  const inputRef    = useRef(null);
  const cooldownRef = useRef(null);
  const verifying   = useRef(false); // prevent double-fire

  // Redirect back if no email in state
  useEffect(() => {
    if (!email) navigate("/register", { replace: true });
  }, [email]);

  // Auto-focus input
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 150);
  }, []);

  // Start initial cooldown — OTP was just sent from Register page
  useEffect(() => {
    startCooldown(30);
    return () => clearInterval(cooldownRef.current);
  }, []);

  // OTP Credential API — auto-fill from SMS/email if browser supports it
  useEffect(() => {
    if (!("OTPCredential" in window)) return;
    const ac = new AbortController();
    navigator.credentials
      .get({ otp: { transport: ["sms"] }, signal: ac.signal })
      .then((cred) => {
        if (cred?.code) {
          const cleaned = cred.code.replace(/\D/g, "").slice(0, 6);
          setCode(cleaned);
        }
      })
      .catch(() => {}); // user dismissed or not supported — silent
    return () => ac.abort();
  }, []);

  function startCooldown(seconds = 30) {
    setCooldown(seconds);
    clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setCooldown(v => {
        if (v <= 1) { clearInterval(cooldownRef.current); return 0; }
        return v - 1;
      });
    }, 1000);
  }

  // Auto-validate as soon as 6 digits are present
  useEffect(() => {
    if (code.length === 6 && !loading && !success) {
      handleVerify(code);
    }
  }, [code]);

  const handleChange = (e) => {
    const val = e.target.value.replace(/\D/g, "").slice(0, 6);
    setCode(val);
    setError("");
  };

  const handleVerify = async (otp) => {
    const otpCode = (otp || code).replace(/\D/g, "");
    if (otpCode.length !== 6 || verifying.current) return;

    verifying.current = true;
    setError("");
    setLoading(true);

    try {
      const result = await base44.auth.verifyOtp({ email: email.trim(), otpCode });
      const token  = result?.access_token ?? result?.token ?? result?.data?.access_token;

      if (token) {
        setSuccess(true);
        base44.auth.setToken(token);

        // Assign student role
        try { await base44.auth.updateMe({ role: "user" }); } catch (_) {}

        // Handle referral silently
        if (refCode) {
          (async () => {
            try {
              const referrers = await base44.entities.User.filter({ referral_code: refCode });
              if (referrers.length > 0) {
                const newUser = await base44.auth.me();
                await base44.entities.Referral.create({
                  referrer_id:   referrers[0].id,
                  referee_id:    newUser.id,
                  referee_email: email.trim(),
                  status:        "pending",
                  referral_code: refCode,
                }).catch(() => {});
              }
            } catch (_) {}
          })();
        }

        setTimeout(() => {
          window.location.replace(`/dashboard?access_token=${encodeURIComponent(token)}`);
        }, 800);
      } else {
        setError("Verification succeeded but no token was returned. Please try logging in.");
        verifying.current = false;
        setLoading(false);
      }
    } catch (err) {
      setError(err.message || "Invalid code. Please check and try again.");
      setCode("");
      verifying.current = false;
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;
    setResending(true);
    setError("");
    setCode("");
    try {
      await base44.auth.resendOtp(email.trim());
      startCooldown(30);
      setTimeout(() => inputRef.current?.focus(), 50);
    } catch {
      setError("Could not resend code. Please try again.");
    } finally {
      setResending(false);
    }
  };

  const emailDomain = email.split("@")[1]?.toLowerCase() || "";
  const emailProvider = (() => {
    if (emailDomain.includes("gmail"))   return { name: "Open Gmail",   url: "https://mail.google.com",   color: "#EA4335" };
    if (emailDomain.includes("outlook") || emailDomain.includes("hotmail") || emailDomain.includes("live"))
      return { name: "Open Outlook", url: "https://outlook.live.com", color: "#0078D4" };
    if (emailDomain.includes("yahoo"))   return { name: "Open Yahoo Mail", url: "https://mail.yahoo.com", color: "#6001D2" };
    return null;
  })();

  return (
    <>
      <SEO title="Verify Email" description="Verify your email to activate your Chibondo Academy account." />
      <AuthLayout
        title="Check your email"
        subtitle="Enter the code we sent you to activate your account"
      >
        <div className="space-y-6">

          {/* Email badge */}
          <div className="flex flex-col items-center gap-3 text-center">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors duration-300 ${
              success ? "bg-green-100" : "bg-accent/10"
            }`}>
              {success
                ? <CheckCircle2 className="w-8 h-8 text-green-500" />
                : loading
                ? <Loader2 className="w-8 h-8 text-accent animate-spin" />
                : <Mail className="w-8 h-8 text-accent" />}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">We sent a verification code to</p>
              <p className="font-bold text-foreground mt-0.5">{email}</p>
            </div>
          </div>

          {/* Where to find it */}
          <div className="rounded-xl bg-muted/40 border border-border p-4 space-y-2.5">
            <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Where to find your code</p>
            <ol className="space-y-1.5">
              {[
                <>Open your inbox for <span className="font-medium text-foreground">{email}</span></>,
                <>Look for an email from <span className="font-medium text-foreground">The Chibondo Academy</span> — subject: "Verify your email"</>,
                <>Not there? Check your <span className="font-medium text-foreground">Spam / Junk</span> folder</>,
              ].map((text, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <span className="text-accent font-bold flex-shrink-0 mt-0.5">{i + 1}.</span>
                  <span>{text}</span>
                </li>
              ))}
            </ol>
            {emailProvider && (
              <a
                href={emailProvider.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-1 text-xs font-semibold px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted transition-colors"
                style={{ color: emailProvider.color }}
              >
                ↗ {emailProvider.name}
              </a>
            )}
          </div>

          {/* Single code input */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Verification Code
            </label>
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="Enter 6-digit code"
              maxLength={6}
              value={code}
              onChange={handleChange}
              disabled={loading || success}
              className={`w-full h-14 px-4 text-center text-2xl font-mono tracking-[0.4em] rounded-xl border-2 outline-none transition-all
                ${success
                  ? "border-green-400 bg-green-50 text-green-700"
                  : error
                  ? "border-red-400 bg-red-50 text-red-700 focus:border-red-400"
                  : "border-border bg-background text-foreground focus:border-accent focus:ring-2 focus:ring-accent/20"}
                disabled:opacity-60 disabled:cursor-not-allowed`}
            />

            {/* Status messages */}
            {error && (
              <p className="text-sm text-red-500 text-center">{error}</p>
            )}
            {loading && !success && (
              <p className="text-sm text-muted-foreground text-center animate-pulse">Verifying…</p>
            )}
            {success && (
              <div className="flex items-center justify-center gap-1.5 text-green-600">
                <CheckCircle2 className="w-4 h-4" />
                <p className="text-sm font-semibold">Verified! Taking you to your dashboard…</p>
              </div>
            )}
          </div>

          {/* Resend + back */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate("/register", { replace: true })}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-3 h-3" /> Use different email
            </button>

            <button
              onClick={handleResend}
              disabled={cooldown > 0 || resending || success}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              {resending
                ? <><Loader2 className="w-3 h-3 animate-spin" /> Sending…</>
                : cooldown > 0
                ? `Resend in ${cooldown}s`
                : <><RefreshCw className="w-3 h-3" /> Resend code</>}
            </button>
          </div>

        </div>
      </AuthLayout>
    </>
  );
}
