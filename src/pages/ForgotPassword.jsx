import React, { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Phone, Loader2, MessageCircle } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import SEO from "@/components/SEO";

export default function ForgotPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const refCode = searchParams.get("ref");

  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (refCode) localStorage.setItem("pending_referral_code", refCode);
  }, [refCode]);

  const handleSubmit = async (e) => {
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
          state: { phone: data.phone || digits, refCode: refCode || null, isReset: true },
        });
      }, 600);
    } catch (err) {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <>
      <SEO
        title="Reset Access"
        description="Reset your Chibondo Academy access with WhatsApp verification."
        canonical={`${window.location.origin}/forgot-password`}
      />
      <AuthLayout
        title="Reset your access"
        subtitle="Verify your WhatsApp number to regain access"
        footer={
          <>
            Remembered your login?{" "}
            <Link to="/login" className="text-primary font-medium hover:underline">Sign in</Link>
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
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
              We'll send a verification link to your WhatsApp. Tap it to regain access to your account.
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
      </AuthLayout>
    </>
  );
}
