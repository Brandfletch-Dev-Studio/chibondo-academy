import React, { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Loader2, MessageCircle, RefreshCw, CheckCircle2, ArrowLeft } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import SEO from "@/components/SEO";
import { db } from "@/api/supabaseClient";

export default function VerifyOtp() {
  const location = useLocation();
  const navigate = useNavigate();

  const phone = location.state?.phone || "";
  const name = location.state?.name || "";
  const refCode = location.state?.refCode || null;
  const isNew = location.state?.isNew || false;
  const isReset = location.state?.isReset || false;

  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(30);

  const inputRef = useRef(null);
  const cooldownRef = useRef(null);
  const verifying = useRef(false);

  // Guard: no phone state → back to login
  useEffect(() => {
    if (!phone) navigate("/login", { replace: true });
  }, [phone]);

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

  // SMS OTP Credential API (Android Chrome)
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

  const handleVerify = async (otp) => {
    const otpCode = (otp || code).replace(/\D/g, "");
    if (otpCode.length !== 6 || verifying.current) return;
    verifying.current = true;
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/wa-otp?action=verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          code: otpCode,
          name: name || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Invalid code. Please check and try again.");
        setCode("");
        verifying.current = false;
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 50);
        return;
      }

      // Success — save token and redirect
      const token = data.access_token;
      if (token) {
        setSuccess(true);
        db.auth.setToken(token, data.refresh_token);

        // Track referral if code exists (fire and forget)
        if (refCode) {
          db.functions?.invoke?.("trackReferral", { refCode }).catch(() => {});
        }

        setTimeout(() => {
          window.location.replace(`/dashboard`);
        }, 900);
      } else {
        setError("No token returned. Please try logging in.");
        verifying.current = false;
        setLoading(false);
      }
    } catch (err) {
      setError("Something went wrong. Please try again.");
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
      const res = await fetch("/api/wa-otp?action=send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Could not resend code. Please try again.");
      } else {
        startCooldown(30);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    } catch {
      setError("Could not resend code. Please try again.");
    } finally {
      setResending(false);
    }
  };

  return (
    <>
      <SEO title="Verify WhatsApp" description="Verify your WhatsApp number to activate your Chibondo Academy account." />
      <AuthLayout title={isReset ? "Verify to reset access" : "Verify your WhatsApp"} subtitle={isReset ? "Enter the code sent to your WhatsApp to regain access" : "Enter the 6-digit code sent to your WhatsApp"}>
        <div className="space-y-6">

          {/* Status icon + phone */}
          <div className="flex flex-col items-center gap-3 text-center">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors duration-300 ${
              success ? "bg-green-100" : "bg-accent/10"
            }`}>
              {success
                ? <CheckCircle2 className="w-8 h-8 text-green-500" />
                : loading
                  ? <Loader2 className="w-8 h-8 text-accent animate-spin" />
                  : <MessageCircle className="w-8 h-8 text-accent" />}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">A 6-digit code was sent via WhatsApp to</p>
              <p className="font-bold text-foreground mt-0.5">+{phone}</p>
            </div>
          </div>

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
              onClick={() => navigate("/login", { replace: true })}
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Change number
            </button>
          </div>
        </div>
      </AuthLayout>
    </>
  );
}
