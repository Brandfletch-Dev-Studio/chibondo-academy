import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Loader2, Mail, RefreshCw, CheckCircle2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import AuthLayout from "@/components/AuthLayout";
import SEO from "@/components/SEO";

export default function VerifyOtp() {
  const location  = useLocation();
  const navigate  = useNavigate();

  // Email + refCode passed via router state from Register page
  const email   = location.state?.email   || "";
  const refCode = location.state?.refCode || null;

  const [digits,       setDigits]       = useState(["", "", "", "", "", ""]);
  const [error,        setError]        = useState("");
  const [loading,      setLoading]      = useState(false);
  const [success,      setSuccess]      = useState(false);
  const [resending,    setResending]    = useState(false);
  const [cooldown,     setCooldown]     = useState(30); // starts with cooldown since OTP just sent
  const inputRefs = useRef([]);
  const cooldownRef = useRef(null);

  // If no email in state, redirect back to register
  useEffect(() => {
    if (!email) navigate("/register", { replace: true });
  }, [email]);

  // Start initial cooldown (OTP was just sent from Register page)
  useEffect(() => {
    startCooldown(30);
    return () => clearInterval(cooldownRef.current);
  }, []);

  // Auto-focus first box
  useEffect(() => {
    setTimeout(() => inputRefs.current[0]?.focus(), 100);
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

  // Auto-submit when all 6 digits are filled
  useEffect(() => {
    if (digits.every(d => d !== "")) {
      handleVerify(digits.join(""));
    }
  }, [digits]);

  const handleDigitChange = (index, value) => {
    // Handle paste of full code
    if (value.length > 1) {
      const pasted = value.replace(/\D/g, "").slice(0, 6);
      if (pasted.length === 6) {
        const newDigits = pasted.split("");
        setDigits(newDigits);
        inputRefs.current[5]?.focus();
        return;
      }
    }

    const cleaned = value.replace(/\D/g, "").slice(-1);
    const newDigits = [...digits];
    newDigits[index] = cleaned;
    setDigits(newDigits);
    setError("");

    // Advance to next box
    if (cleaned && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace") {
      if (digits[index]) {
        const newDigits = [...digits];
        newDigits[index] = "";
        setDigits(newDigits);
      } else if (index > 0) {
        inputRefs.current[index - 1]?.focus();
        const newDigits = [...digits];
        newDigits[index - 1] = "";
        setDigits(newDigits);
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleVerify = async (code) => {
    const otpCode = code || digits.join("");
    if (otpCode.length !== 6) { setError("Please enter all 6 digits"); return; }
    if (loading || success) return;

    setError("");
    setLoading(true);
    try {
      const result = await base44.auth.verifyOtp({ email: email.trim(), otpCode });
      const token  = result?.access_token ?? result?.token ?? result?.data?.access_token;

      if (token) {
        setSuccess(true);
        // Persist token via SDK (axios headers + localStorage)
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
                  referrer_id:  referrers[0].id,
                  referee_id:   newUser.id,
                  referee_email: email.trim(),
                  status:       "pending",
                  referral_code: refCode,
                }).catch(() => {});
              }
            } catch (_) {}
          })();
        }

        // Short success pause then redirect — token in URL survives the reload
        setTimeout(() => {
          window.location.replace(`/dashboard?access_token=${encodeURIComponent(token)}`);
        }, 800);
      } else {
        setError("Verification succeeded but no token received. Please try logging in.");
        setLoading(false);
      }
    } catch (err) {
      setError(err.message || "Invalid code. Please check and try again.");
      setLoading(false);
      // Clear digits so user can retype
      setDigits(["", "", "", "", "", ""]);
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;
    setResending(true);
    setError("");
    setDigits(["", "", "", "", "", ""]);
    try {
      await base44.auth.resendOtp(email.trim());
      startCooldown(30);
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
    } catch (err) {
      setError("Could not resend code. Please try again.");
    } finally {
      setResending(false);
    }
  };

  // Derive provider hint from email domain
  const emailDomain = email.split("@")[1]?.toLowerCase() || "";
  const emailProviderInfo = (() => {
    if (emailDomain.includes("gmail"))   return { name: "Gmail",   url: "https://mail.google.com",   color: "#EA4335" };
    if (emailDomain.includes("outlook") || emailDomain.includes("hotmail") || emailDomain.includes("live"))
      return { name: "Outlook", url: "https://outlook.live.com", color: "#0078D4" };
    if (emailDomain.includes("yahoo"))   return { name: "Yahoo Mail", url: "https://mail.yahoo.com", color: "#6001D2" };
    return null;
  })();

  return (
    <>
      <SEO title="Verify Email" description="Verify your email to activate your Chibondo Academy account." />
      <AuthLayout
        title="Verify your email"
        subtitle="Your account is almost ready!"
        footer={
          <div className="space-y-2 text-center">
            <p className="text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link to="/login" className="text-primary font-medium hover:underline">Sign in</Link>
            </p>
          </div>
        }
      >
        <div className="space-y-6">

          {/* ── Email icon + info ── */}
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center">
              {success
                ? <CheckCircle2 className="w-8 h-8 text-green-500" />
                : <Mail className="w-8 h-8 text-accent" />}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">We sent a 6-digit code to</p>
              <p className="font-bold text-foreground text-base mt-0.5">{email}</p>
            </div>
          </div>

          {/* ── Where to find it ── */}
          <div className="rounded-xl bg-muted/50 border border-border p-4 space-y-2">
            <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Where to find your code</p>
            <ul className="space-y-1.5">
              <li className="flex items-start gap-2 text-xs text-muted-foreground">
                <span className="text-accent font-bold mt-0.5">1.</span>
                Open your email inbox for <span className="font-medium text-foreground mx-1">{email}</span>
              </li>
              <li className="flex items-start gap-2 text-xs text-muted-foreground">
                <span className="text-accent font-bold mt-0.5">2.</span>
                Look for an email from <span className="font-medium text-foreground mx-1">The Chibondo Academy</span> with subject "Verify your email"
              </li>
              <li className="flex items-start gap-2 text-xs text-muted-foreground">
                <span className="text-accent font-bold mt-0.5">3.</span>
                If you don't see it, check your <span className="font-medium text-foreground mx-1">Spam / Junk</span> folder
              </li>
            </ul>
            {emailProviderInfo && (
              <a
                href={emailProviderInfo.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 mt-2 text-xs font-semibold px-3 py-2 rounded-lg border border-border bg-background hover:bg-muted transition-colors w-fit"
              >
                <span style={{ color: emailProviderInfo.color }}>↗</span>
                Open {emailProviderInfo.name}
              </a>
            )}
          </div>

          {/* ── 6-digit input boxes ── */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground text-center">Enter your 6-digit code</p>
            <div className="flex gap-2 justify-center">
              {digits.map((digit, i) => (
                <input
                  key={i}
                  ref={el => inputRefs.current[i] = el}
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={digit}
                  disabled={loading || success}
                  onChange={e => handleDigitChange(i, e.target.value)}
                  onKeyDown={e => handleKeyDown(i, e)}
                  onFocus={e => e.target.select()}
                  className={`w-11 h-14 text-center text-xl font-bold rounded-xl border-2 outline-none transition-all
                    ${success
                      ? "border-green-400 bg-green-50 text-green-700"
                      : digit
                      ? "border-accent bg-accent/5 text-foreground"
                      : "border-border bg-background text-foreground"}
                    focus:border-accent focus:ring-2 focus:ring-accent/20
                    disabled:opacity-60 disabled:cursor-not-allowed`}
                />
              ))}
            </div>

            {error && (
              <p className="text-sm text-red-500 text-center">{error}</p>
            )}

            {success && (
              <div className="flex items-center justify-center gap-2 text-green-600">
                <CheckCircle2 className="w-4 h-4" />
                <p className="text-sm font-semibold">Verified! Redirecting to dashboard…</p>
              </div>
            )}
          </div>

          {/* ── Verify button (fallback if auto-submit doesn't fire) ── */}
          {!success && (
            <Button
              onClick={() => handleVerify()}
              disabled={loading || digits.some(d => d === "")}
              className="w-full h-12 font-semibold"
            >
              {loading
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Verifying…</>
                : "Verify & Go to Dashboard"}
            </Button>
          )}

          {/* ── Resend + back ── */}
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
