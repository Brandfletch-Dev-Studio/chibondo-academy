import React, { useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Phone, Mail, Lock, Loader2, Eye, EyeOff } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import GoogleIcon from "@/components/GoogleIcon";

export default function Login() {
  const [identifier, setIdentifier] = useState(""); // phone or email
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Detect if the identifier looks like a phone number
  const isPhone = /^[+\d\s()-]{7,}$/.test(identifier.trim()) && !identifier.includes("@");

  // Derive email for Base44 auth
  const loginEmail = isPhone
    ? `${identifier.replace(/\D/g, "")}@chibondo.ac.mw`
    : identifier.trim();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await base44.auth.loginViaEmailPassword(loginEmail, password);
      window.location.href = "/";
    } catch (err) {
      setError(isPhone
        ? "Incorrect phone number or password. Please try again."
        : "Incorrect email or password. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = () => {
    base44.auth.loginWithProvider("google", "/");
  };

  return (
    <AuthLayout
      title="Welcome back, scholar"
      subtitle="Sign in to continue your learning journey"
      footer={
        <>
          New to the academy?{" "}
          <Link to="/register" className="text-primary font-medium hover:underline">Join us</Link>
        </>
      }
    >
      <Button variant="outline" className="w-full h-12 text-sm font-medium mb-6" onClick={handleGoogle}>
        <GoogleIcon className="w-5 h-5 mr-2" />
        Continue with Google
      </Button>

      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white px-3 text-gray-400">or sign in</span>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-600 text-sm">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="identifier">Phone Number or Email</Label>
          <div className="relative">
            {isPhone
              ? <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              : <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            }
            <Input
              id="identifier"
              type="text"
              autoFocus
              autoComplete="username"
              placeholder="+265 99 123 4567 or email"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
          <p className="text-xs text-gray-400">You can sign in with your phone number or email</p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link to="/forgot-password" className="text-xs text-primary hover:underline">Forgot password?</Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••"
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

        <Button type="submit" className="w-full h-12 font-semibold" disabled={loading}>
          {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Signing in...</> : "Sign In"}
        </Button>
      </form>
    </AuthLayout>
  );
}