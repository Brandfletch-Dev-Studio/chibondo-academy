import React, { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Loader2, Mail, RefreshCw, CheckCircle2, ArrowLeft, ClipboardPaste } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import SEO from "@/components/SEO";

export default function VerifyOtp() {
  const location = useLocation();
  const navigate = useNavigate();

  const email   = location.state?.email   || "";
  const refCode = location.state?.refCode || null;

  const [code,       setCode]       = useState("");
  const [error,      setError]      = useState("");
  const [loading,    setLoading]    = useState(false);
  const [success,    setSuccess]    = useState(false);
  const [resending,  setResending]  = useState(false);
  const [cooldown,   setCooldown]   = useState(30);
  const [clipHint,   setClipHint]   = useState(false); // show "code copied — pasting…" hint
  const inputRef    = useRef(null);
  const cooldownRef = useRef(null);
  const verifying   = useRef(false);
  const pollRef     = useRef(null);

  useEffect(() => {
    if (!email) navigate("/register", { replace: true });
  }, [email]);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 150);
  }, []);

  useEffect(() => {
    startCooldown(30);
    return () => clearInterval(cooldownRef.current);
  }, []);

  // ── Cleanup clipboard poll on unmount ──────────────────────────────────────
  useEffect(() => () => clearInterval(pollRef.current), []);

  function startCooldown(s = 30) {
    setCooldown(s);
    clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setCooldown(v => { if (v <= 1) { clearInterval(cooldownRef.current); return 0; } return v - 1; });
    }, 1000);
  }

  // ── Auto-verify when 6 digits ready ────────────────────────────────────────
  useEffect(() => {
    if (code.length === 6 && !loading && !success) {
      handleVerify(code);
    }
  }, [code]);

  // ── Clipboard polling — read clipboard every 2s while page is focused ──────
  // When user copies a 6-digit code from their email app, we auto-fill it.
  const startClipboardPoll = useCallback(() => {
    if (!navigator.clipboard?.readText) return; // not supported
    clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      if (document.hidden || success || loading) return;
      try {
        const text = await navigator.clipboard.readText();
        const digits = text.trim().replace(/\D/g, "");
        // Only act if clipboard has exactly 6 digits and it's different from current value
        if (digits.length === 6 && digits !== code) {
          setClipHint(true);
          setCode(digits);
          setError("");
          clearInterval(pollRef.current);
          setTimeout(() => setClipHint(false), 2000);
        }
      } catch (_) {
        // Permission denied or not supported — stop polling silently
        clearInterval(pollRef.current);
      }
    }, 2000);
  }, [code, success, loading]);

  // Start clipboard polling when page becomes visible / focused
  useEffect(() => {
    const onFocus = () => startClipboardPoll();
    const onVisibility = () => { if (!document.hidden) startClipboardPoll(); };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    startClipboardPoll(); // start immediately too

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [startClipboardPoll]);

  // ── SMS OTP Credential API (works on Android Chrome) ──────────────────────
  useEffect(() => {
    if (!("OTPCredential" in window)) return;
    const ac = new AbortController();
    navigator.credentials
      .get({ otp: { transport: ["sms"] }, signal: ac.signal })
      .then(cred => {
        if (cred?.code) {
          const digits = cred.code.replace(/\D/g, "").slice(0, 6);
          setCode(digits);
        }
      })
      .catch(() => {});
    return () => ac.abort();
  }, []);

  // ── Manual paste button ────────────────────────────────────────────────────
  const handlePasteBtn = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const digits = text.trim().replace(/\D/g, "").slice(0, 6);
      if (digits.length >= 4) {
        setCode(digits);
        setError("");
      } else {
        inputRef.current?.focus();
      }
    } catch {
      inputRef.current?.focus();
    }
  };

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
        try { await base44.auth.updateMe({ role: "user" }); } catch (_) {}
        if (refCode) {
          (async () => {
            try {
              const referrers = await base44.entities.User.filter({ referral_code: refCode });
              if (referrers.length > 0) {
                const newUser = await base44.auth.me();
                await base44.entities.Referral.create({
                  referrer_id: referrers[0].id, referee_id: newUser.id,
                  referee_email: email.trim(), status: "pending", referral_code: refCode,
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
      startClipboardPoll();
      setTimeout(() => inputRef.current?.focus(), 50);
    } catch {
      setError("Could not resend code. Please try again.");
    } finally { setResending(false); }
  };

  const emailDomain = email.split("@")[1]?.toLowerCase() || "";
  const emailProvider = (() => {
    if (emailDomain.includes("gmail"))   return { name: "Open Gmail",    url: "https://mail.google.com",  color: "#EA4335" };
    if (emailDomain.includes("outlook") || emailDomain.includes("hotmail") || emailDomain.includes("live"))
      return { name: "Open Outlook", url: "https://outlook.live.com", color: "#0078D4" };
    if (emailDomain.includes("yahoo"))   return { name: "Open Yahoo Mail", url: "https://mail.yahoo.com", color: "#6001D2" };
    return null;
  })();

  return (
    <>
      <SEO title="Verify Email" description="Verify your email to activate your Chibondo Academy account." />
      <AuthLayout title="Check your email" subtitle="We'll auto-detect your code — just open the email">
        <div className="space-y-6">

          {/* Icon + email */}
          <div className="flex flex-col items-center gap-3 text-center">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors duration-300 ${
              success ? "bg-green-100" : "bg-accent/10"
            }`}>
              {success    ? <CheckCircle2 className="w-8 h-8 text-green-500" /> :
               loading    ? <Loader2      className="w-8 h-8 text-accent animate-spin" /> :
                            <Mail         className="w-8 h-8 text-accent" />}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Verification code sent to</p>
              <p className="font-bold text-foreground mt-0.5">{email}</p>
            </div>
          </div>

          {/* Where to find it */}
          <div className="rounded-xl bg-muted/40 border border-border p-4 space-y-2.5">
            <p className="text-xs font-semibold text-foreground uppercase tracking-wide">How it works</p>
            <ol className="space-y-1.5">
              {[
                <>Open your email app and find the email from <span className="font-medium text-foreground">The Chibondo Academy</span></>,
                <>Copy the 6-digit code — we'll <span className="font-medium text-foreground">detect it automatically</span> and fill it in</>,
                <>Not there? Check your <span className="font-medium text-foreground">Spam / Junk</span> folder</>,
              ].map((text, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <span className="text-accent font-bold flex-shrink-0 mt-0.5">{i + 1}.</span>
                  <span>{text}</span>
                </li>
              ))}
            </ol>
            {emailProvider && (
              <a href={emailProvider.url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-1 text-xs font-semibold px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted transition-colors"
                style={{ color: emailProvider.color }}>
                ↗ {emailProvider.name}
              </a>
            )}
          </div>

          {/* Code input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">Verification Code</label>
              {!success && (
                <button onClick={handlePasteBtn}
                  className="flex items-center gap-1 text-xs text-accent hover:opacity-80 transition-opacity">
                  <ClipboardPaste className="w-3.5 h-3.5" /> Paste code
                </button>
              )}
            </div>

            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="••••••"
                maxLength={6}
                value={code}
                onChange={handleChange}
                disabled={loading || success}
                className={`w-full h-14 px-4 text-center text-2xl font-mono tracking-[0.5em] rounded-xl border-2 outline-none transition-all
                  ${success ? "border-green-400 bg-green-50 text-green-700" :
                    error   ? "border-red-400 bg-red-50 text-red-700" :
                    clipHint ? "border-accent bg-accent/5 text-foreground" :
                               "border-border bg-background text-foreground focus:border-accent focus:ring-2 focus:ring-accent/20"}
                  disabled:opacity-60 disabled:cursor-not-allowed`}
              />
              {loading && !success && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Loader2 className="w-4 h-4 text-accent animate-spin" />
                </div>
              )}
            </div>

            {/* Status */}
            {clipHint && !error && !success && (
              <p className="text-xs text-accent text-center animate-pulse">✓ Code detected from clipboard</p>
            )}
            {error && (
              <p className="text-sm text-red-500 text-center">{error}</p>
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
            <button onClick={() => navigate("/register", { replace: true })}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-3 h-3" /> Use different email
            </button>
            <button onClick={handleResend} disabled={cooldown > 0 || resending || success}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50">
              {resending ? <><Loader2 className="w-3 h-3 animate-spin" /> Sending…</>
               : cooldown > 0 ? `Resend in ${cooldown}s`
               : <><RefreshCw className="w-3 h-3" /> Resend code</>}
            </button>
          </div>

        </div>
      </AuthLayout>
    </>
  );
}
