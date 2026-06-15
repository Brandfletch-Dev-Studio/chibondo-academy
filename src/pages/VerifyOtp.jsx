import React, { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Loader2, Mail, RefreshCw, CheckCircle2, ArrowLeft } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import SEO from "@/components/SEO";

// Deep-link map: if the user's email domain matches, open the native app URI.
// Falls back to the web URL if the deep link isn't installed.
const EMAIL_PROVIDERS = {
  "gmail.com":       { name: "Gmail",        deepLink: "googlegmail://",              webUrl: "https://mail.google.com" },
  "googlemail.com":  { name: "Gmail",        deepLink: "googlegmail://",              webUrl: "https://mail.google.com" },
  "outlook.com":     { name: "Outlook",      deepLink: "ms-outlook://",               webUrl: "https://outlook.live.com" },
  "hotmail.com":     { name: "Outlook",      deepLink: "ms-outlook://",               webUrl: "https://outlook.live.com" },
  "live.com":        { name: "Outlook",      deepLink: "ms-outlook://",               webUrl: "https://outlook.live.com" },
  "yahoo.com":       { name: "Yahoo Mail",   deepLink: "ymail://",                    webUrl: "https://mail.yahoo.com" },
  "ymail.com":       { name: "Yahoo Mail",   deepLink: "ymail://",                    webUrl: "https://mail.yahoo.com" },
  "icloud.com":      { name: "Apple Mail",   deepLink: "message://",                  webUrl: "https://www.icloud.com/mail" },
  "me.com":          { name: "Apple Mail",   deepLink: "message://",                  webUrl: "https://www.icloud.com/mail" },
  "protonmail.com":  { name: "ProtonMail",   deepLink: "protonmail://",               webUrl: "https://mail.proton.me" },
  "proton.me":       { name: "ProtonMail",   deepLink: "protonmail://",               webUrl: "https://mail.proton.me" },
};

function getProvider(email) {
  const domain = email.split("@")[1]?.toLowerCase() || "";
  return EMAIL_PROVIDERS[domain] || null;
}

// Try to open the native mail app via deep link.
// If the deep link fails (app not installed), fall back to the web URL after 1.5s.
function openMailApp(provider) {
  if (!provider) return;
  const tried = Date.now();
  window.location.href = provider.deepLink;
  setTimeout(() => {
    // If we're still on the page after 1.5s, deep link didn't work — use web
    if (Date.now() - tried < 2500) {
      window.open(provider.webUrl, "_blank", "noopener,noreferrer");
    }
  }, 1500);
}

export default function VerifyOtp() {
  const location = useLocation();
  const navigate = useNavigate();

  const email   = location.state?.email   || "";
  const refCode = location.state?.refCode || null;

  const [code,      setCode]      = useState("");
  const [error,     setError]     = useState("");
  const [loading,   setLoading]   = useState(false);
  const [success,   setSuccess]   = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown,  setCooldown]  = useState(30);
  const [detected,  setDetected]  = useState(false); // clipboard detection flash

  const inputRef    = useRef(null);
  const cooldownRef = useRef(null);
  const pollRef     = useRef(null);
  const verifying   = useRef(false);
  const lastClip    = useRef(""); // track last seen clipboard value

  const provider = getProvider(email);

  // ── Guard: no email state → back to register ──────────────────────────────
  useEffect(() => {
    if (!email) navigate("/register", { replace: true });
  }, [email]);

  // ── Auto-focus ────────────────────────────────────────────────────────────
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 150);
  }, []);

  // ── Initial cooldown (OTP just fired from Register page) ─────────────────
  useEffect(() => {
    startCooldown(30);
    return () => {
      clearInterval(cooldownRef.current);
      clearInterval(pollRef.current);
    };
  }, []);

  // ── Countdown ticker ─────────────────────────────────────────────────────
  function startCooldown(s = 30) {
    setCooldown(s);
    clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setCooldown(v => {
        if (v <= 1) { clearInterval(cooldownRef.current); return 0; }
        return v - 1;
      });
    }, 1000);
  }

  // ── Auto-verify as soon as 6 digits land in state ─────────────────────────
  useEffect(() => {
    if (code.length === 6 && !loading && !success) {
      handleVerify(code);
    }
  }, [code]);

  // ── Clipboard polling ─────────────────────────────────────────────────────
  // Polls every 1.5 s while page is visible. When user copies the 6-digit code
  // from their email app and returns, it's captured instantly.
  const pollClipboard = useCallback(async () => {
    if (document.hidden || success || verifying.current) return;
    if (!navigator.clipboard?.readText) return;
    try {
      const text   = await navigator.clipboard.readText();
      const digits = text.trim().replace(/\D/g, "");
      if (digits.length === 6 && digits !== lastClip.current) {
        lastClip.current = digits;
        setDetected(true);
        setCode(digits);
        setError("");
        setTimeout(() => setDetected(false), 2000);
      }
    } catch (_) {
      // Clipboard permission denied — stop polling silently
      clearInterval(pollRef.current);
    }
  }, [success]);

  const startPolling = useCallback(() => {
    clearInterval(pollRef.current);
    pollRef.current = setInterval(pollClipboard, 1500);
  }, [pollClipboard]);

  // Start polling on mount and whenever page regains focus/visibility
  useEffect(() => {
    startPolling();
    const onFocus      = () => startPolling();
    const onVisibility = () => { if (!document.hidden) { pollClipboard(); startPolling(); } };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      clearInterval(pollRef.current);
    };
  }, [startPolling, pollClipboard]);

  // ── SMS OTP Credential API (Android Chrome) ───────────────────────────────
  useEffect(() => {
    if (!("OTPCredential" in window)) return;
    const ac = new AbortController();
    navigator.credentials
      .get({ otp: { transport: ["sms", "email"] }, signal: ac.signal })
      .then(cred => {
        if (cred?.code) {
          const digits = cred.code.replace(/\D/g, "").slice(0, 6);
          setCode(digits);
        }
      })
      .catch(() => {});
    return () => ac.abort();
  }, []);

  // ── Verify ────────────────────────────────────────────────────────────────
  const handleVerify = async (otp) => {
    const otpCode = (otp || code).replace(/\D/g, "");
    if (otpCode.length !== 6 || verifying.current) return;
    verifying.current = true;
    clearInterval(pollRef.current);
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
          // Fire-and-forget: call the secure backend function so referral is
          // tracked with asServiceRole (bypasses RLS) and correct field names
          base44.functions.invoke('trackReferral', { referralCode: refCode }).catch(() => {});
        }
        setTimeout(() => {
          window.location.replace(`/dashboard?access_token=${encodeURIComponent(token)}`);
        }, 900);
      } else {
        setError("No token returned. Please try logging in.");
        verifying.current = false;
        setLoading(false);
        startPolling();
      }
    } catch (err) {
      setError(err.message || "Invalid code. Please check and try again.");
      setCode("");
      lastClip.current = "";
      verifying.current = false;
      setLoading(false);
      startPolling();
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;
    setResending(true);
    setError("");
    setCode("");
    lastClip.current = "";
    try {
      await base44.auth.resendOtp(email.trim());
      startCooldown(30);
      startPolling();
      setTimeout(() => inputRef.current?.focus(), 50);
    } catch {
      setError("Could not resend code. Please try again.");
    } finally { setResending(false); }
  };

  // ── UI ────────────────────────────────────────────────────────────────────
  return (
    <>
      <SEO title="Verify Email" description="Verify your email to activate your Chibondo Academy account." />
      <AuthLayout title="Verify your email" subtitle="We'll detect your code automatically">
        <div className="space-y-6">

          {/* Status icon + email */}
          <div className="flex flex-col items-center gap-3 text-center">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors duration-300 ${
              success ? "bg-green-100" : "bg-accent/10"
            }`}>
              {success ? <CheckCircle2 className="w-8 h-8 text-green-500" />
               : loading ? <Loader2 className="w-8 h-8 text-accent animate-spin" />
               : <Mail className="w-8 h-8 text-accent" />}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">A 6-digit code was sent to</p>
              <p className="font-bold text-foreground mt-0.5 break-all">{email}</p>
            </div>
          </div>

          {/* Instructions */}
          <div className="rounded-xl border border-border bg-muted/30 p-4">
            <p className="text-xs font-semibold text-foreground uppercase tracking-wide mb-3">
              How to verify
            </p>
            <div className="space-y-3">
              {/* Step 1 */}
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-accent text-white text-[10px] font-bold flex items-center justify-center mt-0.5">1</span>
                <div>
                  <p className="text-sm font-medium text-foreground">Open your email app</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Find the email from <span className="font-medium">The Chibondo Academy</span> — subject: "Verify your email"
                  </p>
                  {provider && (
                    <button
                      onClick={() => openMailApp(provider)}
                      className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-colors active:scale-95"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      Open {provider.name}
                    </button>
                  )}
                </div>
              </div>
              {/* Step 2 */}
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-accent text-white text-[10px] font-bold flex items-center justify-center mt-0.5">2</span>
                <div>
                  <p className="text-sm font-medium text-foreground">Copy the 6-digit code</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Long-press the code in the email and tap <span className="font-medium">Copy</span>
                  </p>
                </div>
              </div>
              {/* Step 3 */}
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-accent text-white text-[10px] font-bold flex items-center justify-center mt-0.5">3</span>
                <div>
                  <p className="text-sm font-medium text-foreground">Come back here</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    We'll detect the code from your clipboard and verify automatically — no typing needed
                  </p>
                </div>
              </div>
              {/* Spam note */}
              <div className="flex items-start gap-3 pt-1 border-t border-border">
                <span className="flex-shrink-0 text-xs text-muted-foreground mt-0.5">💡</span>
                <p className="text-xs text-muted-foreground">
                  Don't see the email? Check your <span className="font-medium text-foreground">Spam / Junk</span> folder
                </p>
              </div>
            </div>
          </div>

          {/* Single plain input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">Verification Code</label>
              {detected && (
                <span className="text-xs text-accent font-medium animate-pulse">
                  ✓ Code detected
                </span>
              )}
            </div>
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="Enter 6-digit code"
              maxLength={6}
              value={code}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                setCode(val);
                setError("");
              }}
              disabled={loading || success}
              className={`w-full h-13 px-4 py-3.5 rounded-xl border-2 outline-none text-lg font-mono tracking-widest text-center transition-all
                ${success  ? "border-green-400 bg-green-50 text-green-700"
                : detected ? "border-accent bg-accent/5 text-foreground"
                : error    ? "border-red-400 bg-red-50 text-red-700"
                :            "border-border bg-background text-foreground focus:border-accent focus:ring-2 focus:ring-accent/20"}
                disabled:opacity-60 disabled:cursor-not-allowed`}
            />

            {/* Feedback */}
            {error && !loading && (
              <p className="text-sm text-red-500 text-center">{error}</p>
            )}
            {loading && !success && (
              <p className="text-sm text-muted-foreground text-center animate-pulse">Verifying…</p>
            )}
            {success && (
              <div className="flex items-center justify-center gap-1.5 text-green-600">
                <CheckCircle2 className="w-4 h-4" />
                <p className="text-sm font-semibold">Verified! Redirecting to dashboard…</p>
              </div>
            )}
          </div>

          {/* Bottom row */}
          <div className="flex items-center justify-between pt-1">
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
