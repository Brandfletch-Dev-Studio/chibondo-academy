import React, { useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Mail, Lock, Phone, Loader2, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import AuthLayout from "@/components/AuthLayout";

const SUBJECTS = [
  "English", "Chichewa", "Mathematics", "Biology", "Agriculture",
  "Chemistry", "Physics", "History", "Geography",
  "Bible Knowledge", "Computer Studies", "Home Economics", "Social Studies",
];

export default function TeacherRegister() {
  const [step, setStep] = useState("form"); // "form" | "otp" | "done"
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [subjects, setSubjects] = useState([]);
  const [qualifications, setQualifications] = useState("");
  const [school, setSchool] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const toggleSubject = (s) =>
    setSubjects(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) { setError("Passwords do not match"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    setLoading(true);
    try {
      await base44.auth.register({ email: email.trim(), password });
      setStep("otp");
    } catch (err) {
      setError(err.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setError("");
    setLoading(true);
    try {
      const result = await base44.auth.verifyOtp({ email: email.trim(), otpCode });
      if (result?.access_token) base44.auth.setToken(result.access_token);

      // Create the teacher application record
      const me = await base44.auth.me();
      await base44.entities.TeacherApplication.create({
        full_name: fullName.trim(),
        email: email.trim(),
        phone_number: phone.trim(),
        subjects,
        qualifications: qualifications.trim(),
        school_or_institution: school.trim(),
        status: "pending",
        user_id: me?.id || "",
      });

      setStep("done");
    } catch (err) {
      setError(err.message || "Verification failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    try { await base44.auth.resendOtp(email.trim()); }
    catch (err) { setError(err.message || "Failed to resend code"); }
  };

  if (step === "done") {
    return (
      <AuthLayout title="Application Submitted" subtitle="We'll review your application and get back to you">
        <div className="text-center py-4 space-y-4">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">You're on the list!</h3>
            <p className="text-sm text-gray-500 mt-2">
              Your teacher application is <strong>pending approval</strong> by the Chibondo Academy admin team.
              You'll receive an email at <strong>{email}</strong> once approved.
            </p>
          </div>
          <Link to="/login">
            <Button variant="outline" className="w-full h-11 mt-2">Back to Sign In</Button>
          </Link>
        </div>
      </AuthLayout>
    );
  }

  if (step === "otp") {
    return (
      <AuthLayout
        title="Verify your email"
        subtitle={`We sent a 6-digit code to ${email}`}
      >
        {error && <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-600 text-sm">{error}</div>}
        <div className="flex justify-center mb-6">
          <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode} autoFocus autoComplete="one-time-code">
            <InputOTPGroup>
              {[0,1,2,3,4,5].map(i => <InputOTPSlot key={i} index={i} />)}
            </InputOTPGroup>
          </InputOTP>
        </div>
        <Button className="w-full h-12 font-semibold" onClick={handleVerify} disabled={loading || otpCode.length < 6}>
          {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Verifying...</> : "Confirm & Submit Application"}
        </Button>
        <p className="text-center text-sm text-gray-500 mt-4">
          Didn't get a code?{" "}
          <button onClick={handleResend} className="text-primary font-medium hover:underline">Resend</button>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Apply as a Teacher"
      subtitle="Join The Chibondo Academy as an educator — applications are reviewed by our admin team"
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="text-primary font-medium hover:underline">Sign in</Link>
          {" · "}
          <Link to="/register" className="text-primary font-medium hover:underline">Student sign-up</Link>
        </>
      }
    >
      {error && <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-600 text-sm">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="fullName">Full Name <span className="text-red-500">*</span></Label>
          <Input id="fullName" autoFocus placeholder="Your full name" value={fullName} onChange={e => setFullName(e.target.value)} className="h-12" required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email Address <span className="text-red-500">*</span></Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} className="pl-10 h-12" required />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Phone Number <span className="text-gray-400 text-xs font-normal">(optional)</span></Label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input id="phone" type="tel" placeholder="+265 99 123 4567" value={phone} onChange={e => setPhone(e.target.value)} className="pl-10 h-12" />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Subjects You Teach <span className="text-gray-400 text-xs font-normal">(select all that apply)</span></Label>
          <div className="flex flex-wrap gap-2">
            {SUBJECTS.map(s => (
              <button type="button" key={s} onClick={() => toggleSubject(s)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-all
                  ${subjects.includes(s) ? "border-primary bg-primary text-white" : "border-gray-200 text-gray-600 hover:border-primary/50"}`}>
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="qualifications">Qualifications / Experience</Label>
          <Textarea id="qualifications" placeholder="e.g. B.Ed Mathematics, 5 years teaching experience..." value={qualifications} onChange={e => setQualifications(e.target.value)} className="resize-none" rows={3} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="school">Current School / Institution <span className="text-gray-400 text-xs font-normal">(if applicable)</span></Label>
          <Input id="school" placeholder="e.g. Chibondo Secondary School" value={school} onChange={e => setSchool(e.target.value)} className="h-12" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="t-password">Password <span className="text-red-500">*</span></Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input id="t-password" type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder="At least 6 characters" value={password} onChange={e => setPassword(e.target.value)} className="pl-10 pr-10 h-12" required />
            <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="t-confirm">Confirm Password <span className="text-red-500">*</span></Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input id="t-confirm" type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder="Repeat your password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="pl-10 h-12" required />
          </div>
        </div>

        <Button type="submit" className="w-full h-12 font-semibold" disabled={loading}>
          {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting...</> : "Submit Application"}
        </Button>
      </form>
    </AuthLayout>
  );
}