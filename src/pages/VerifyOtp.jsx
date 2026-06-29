import React, { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Loader2, Mail, RefreshCw, CheckCircle2, ArrowLeft } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import SEO from "@/components/SEO";

// Deep-link map: open the user's email app directly
const EMAIL_PROVIDERS = {
  "gmail.com":       { name: "Gmail",       deepLink: "googlegmail://", webUrl: "https://mail.google.com" },
  "googlemail.com":  { name: "Gmail",       deepLink: "googlegmail://", webUrl: "https://mail.google.com" },
  "outlook.com":     { name: "Outlook",     deepLink: "ms-outlook://",  webUrl: "https://outlook.live.com" },
  "hotmail.com":     { name: "Outlook",     deepLink: "ms-outlook://",  webUrl: "https://outlook.live.com" },
  "live.com":        { name: "Outlook",     deepLink: "ms-outlook://",  webUrl: "https://outlook.live.com" },
  "yahoo.com":       { name: "Yahoo Mail",  deepLink: "ymail://",       webUrl: "https://mail.yahoo.com" },
  "ymail.com":       { name: "Yahoo Mail",  deepLink: "ymail://",       webUrl: "https://mail.yahoo.com" },
  "icloud.com":      { name: "Apple Mail",  deepLink: "message://",     webUrl: "https://www.icloud.com/mail" },
  "me.com":          { name: "Apple Mail",  deepLink: "message://",     webUrl: "https://www.icloud.com/mail" },
  "protonmail.com":  { name: "ProtonMail",  deepLink: "protonmail://",  webUrl: "https://mail.proton.me" },
  "proton.me":       { name: "ProtonMail",  deepLink: "protonmail://",  webUrl: "https://mail.proton.me" },
};

function getProvider(email) {
  const domain = email.split("@")[1]?.toLowerCase() || "";
  return EMAIL_PROVIDERS[domain] || null;
}

function openMailApp(provider) {
  if (!provider) return;
  const tried = Date.now();
  window.location.href = provider.deepLink;
  setTimeout(() => {
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

  const inputRef    = useRef(null);
  const cooldownRef = useRef(null);
  const verifying   = useRef(false);

  const provider = getProvider(email);

  // Guard: no email state → back to register
  useEffect(() => {
    if (!email) navigate("/register", { replace: true });
  }, [email]);

  // Auto-focus input
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 150);
  }, []);

  // Initial cooldown countdown
  useEffect(() => {
    startCooldown(30);
    return () => clearInterval(cooldownRef.current);
  }, []);

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

  // Auto-verify as soon as 6 digits are typed
  useEffect(() => {
    if (code.length === 6 && !loading && !success) {
      handleVerify(code);
    }
  }, [code]);

  // SMS OTP Credential API (Android Chrome only — no clipboard involved)
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
        // trackReferral is handled by the dashboard on first load
        setTimeout(() => {
          window.location.replace("/dashboard");
        }, 900);
      } else {
        setError("No token returned. Please try logging in.");
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
    } finally { setResending(false); }
  };

  return (
    <>
      <SEO title="Verify Email" description="Verify your email to activate your Chibondo Academy account." />
      <AuthLayout title="Verify your email" subtitle="Enter the 6-digit code sent to your inbox">
        <div className="space-y-6">

          {/* Status icon + email */}
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
              <p className="text-sm text-muted-foreground">A 6-digit code was sent to</p>
              <p className="font-bold text-foreground mt-0.5 break-all">{email}</p>
            </div>
          </div>

          {/* Open email app shortcut */}
          {provider && !success && (
            <button
              type="button"
              onClick={() => openMailApp(provider)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border bg-muted/40 text-sm font-medium hover:bg-muted transition-colors"
            >
              <Mail className="w-4 h-4" />
              Open {provider.name}
            </button>
          )}

          {/* Error */}
          {error && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm text-center">
              {error}
            </div>
          )}

          {/* Success */}
          {success && (
            <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-green-700 dark:text-green-400 text-sm text-center font-medium">
              ✓ Verified! Redirecting to your dashboard…
            </div>
          )}

          {/* Code input */}
          {!success && (
            <div className="space-y-3">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Verification Code
              </label>
              <input
                ref={inputRef}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={code}
                onChange={e => {
                  const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                  setCode(val);
                  if (error) setError("");
                }}
                disabled={loading}
                placeholder="000000"
                className="w-full text-center text-3xl font-mono tracking-[0.5em] py-4 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-accent/50 disabled:opacity-50 transition-all"
                autoComplete="one-time-code"
              />
              <p className="text-xs text-muted-foreground text-center">
                Type your 6-digit code above — it verifies automatically
              </p>
            </div>
          )}

          {/* Resend */}
          {!success && (
            <div className="text-center">
              {cooldown > 0 ? (
                <p className="text-sm text-muted-foreground">
                  Resend available in <span className="font-semibold text-foreground">{cooldown}s</span>
                </p>
              ) : (
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resending}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline disabled:opacity-50"
                >
                  {resending
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending…</>
                    : <><RefreshCw className="w-3.5 h-3.5" /> Resend code</>}
                </button>
              )}
            </div>
          )}

          {/* Back link */}
          <div className="text-center">
            <button
              type="button"
              onClick={() => navigate("/register")}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-3 h-3" /> Wrong email? Go back
            </button>
          </div>

        </div>
      </AuthLayout>
    </>
  );
}
