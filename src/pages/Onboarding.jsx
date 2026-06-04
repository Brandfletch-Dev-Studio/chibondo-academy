import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, School, BookOpen, User, MapPin } from "lucide-react";

const SUBJECTS = [
  "English", "Chichewa", "Mathematics", "Biology", "Agriculture",
  "Chemistry", "Physics", "History", "Geography",
  "Bible Knowledge", "Computer Studies", "Home Economics", "Social Studies",
];

const FORMS = ["Form 1", "Form 2", "Form 3", "Form 4"];

const STEP_ICONS = [User, BookOpen, School, MapPin];
const STEP_LABELS = ["Your Name", "Your Class", "Subjects", "Your School"];

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);

  const [fullName, setFullName] = useState("");
  const [form, setForm] = useState("");
  const [subjects, setSubjects] = useState([]);
  const [schoolName, setSchoolName] = useState("");
  const [isDistanceLearner, setIsDistanceLearner] = useState(false);

  useEffect(() => {
    base44.auth.me().then(u => {
      if (!u) { window.location.href = "/login"; return; }
      setUser(u);
      // Pre-fill name if available
      if (u.full_name) setFullName(u.full_name);
    });
  }, []);

  const toggleSubject = (s) => {
    setSubjects(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };

  const canProceed = () => {
    if (step === 0) return fullName.trim().length >= 2;
    if (step === 1) return !!form;
    if (step === 2) return subjects.length > 0;
    if (step === 3) return isDistanceLearner || schoolName.trim().length >= 2;
    return false;
  };

  const handleFinish = async () => {
    setLoading(true);
    // Re-fetch user in case state hasn't loaded yet
    let currentUser = user;
    if (!currentUser) {
      currentUser = await base44.auth.me();
    }
    if (!currentUser) {
      window.location.href = "/login";
      return;
    }
    await base44.entities.StudentProfile.create({
      user_id: currentUser.id,
      full_name: fullName.trim(),
      phone_number: currentUser.phone_number || "",
      form,
      subjects,
      school_name: isDistanceLearner ? "" : schoolName.trim(),
      is_distance_learner: isDistanceLearner,
      onboarding_complete: true,
    });
    await base44.auth.updateMe({ full_name: fullName.trim(), role: "student" });
    window.location.href = "/";
  };

  const progressPct = ((step) / STEP_LABELS.length) * 100;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-start pt-8 pb-16 px-4">
      {/* Logo */}
      <div className="flex flex-col items-center mb-8">
        <img
          src="https://media.base44.com/images/public/6a212896f8e71114ad51c36f/3fd7d6af7_FB_IMG_1780187860438.jpg"
          alt="Chibondo Academy"
          className="w-16 h-16 rounded-2xl object-cover shadow-md"
        />
        <p className="text-xs text-gray-400 mt-2 font-medium tracking-wide uppercase">The Chibondo Academy</p>
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-md mb-6">
        <div className="flex justify-between mb-2">
          {STEP_LABELS.map((label, i) => {
            const Icon = STEP_ICONS[i];
            return (
              <div key={i} className="flex flex-col items-center gap-1" style={{ width: "22%" }}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all
                  ${i < step ? "bg-green-500 text-white" : i === step ? "bg-primary text-white" : "bg-gray-200 text-gray-400"}`}>
                  {i < step ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                </div>
                <span className={`text-[10px] text-center leading-tight ${i === step ? "text-primary font-semibold" : "text-gray-400"}`}>{label}</span>
              </div>
            );
          })}
        </div>
        <div className="h-1.5 bg-gray-200 rounded-full">
          <div className="h-1.5 bg-primary rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      {/* Card */}
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-200 p-6">

        {/* Step 0 — Full Name */}
        {step === 0 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">What is your full name?</h2>
              <p className="text-sm text-gray-500 mt-1">This is how your teachers and classmates will see you.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                autoFocus
                placeholder="e.g. Chisomo Banda"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                className="h-12"
              />
            </div>
          </div>
        )}

        {/* Step 1 — Form/Class */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">What class are you in?</h2>
              <p className="text-sm text-gray-500 mt-1">Select your current form level.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {FORMS.map(f => (
                <button
                  key={f}
                  onClick={() => setForm(f)}
                  className={`h-16 rounded-xl border-2 font-semibold text-base transition-all
                    ${form === f
                      ? "border-primary bg-primary text-white shadow-md"
                      : "border-gray-200 bg-white text-gray-700 hover:border-primary/50"}`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2 — Subjects */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Which subjects are you studying?</h2>
              <p className="text-sm text-gray-500 mt-1">Tap all that apply — you can change these later.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {SUBJECTS.map(s => (
                <button
                  key={s}
                  onClick={() => toggleSubject(s)}
                  className={`px-3 py-2 rounded-full text-sm font-medium border-2 transition-all
                    ${subjects.includes(s)
                      ? "border-primary bg-primary text-white"
                      : "border-gray-200 bg-white text-gray-700 hover:border-primary/50"}`}
                >
                  {s}
                </button>
              ))}
            </div>
            {subjects.length > 0 && (
              <p className="text-xs text-primary font-medium">{subjects.length} subject{subjects.length > 1 ? "s" : ""} selected</p>
            )}
          </div>
        )}

        {/* Step 3 — School */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Where are you currently learning?</h2>
              <p className="text-sm text-gray-500 mt-1">This helps us tailor content to your situation.</p>
            </div>

            <button
              onClick={() => { setIsDistanceLearner(v => !v); if (!isDistanceLearner) setSchoolName(""); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 font-medium text-sm transition-all
                ${isDistanceLearner ? "border-primary bg-primary/5 text-primary" : "border-gray-200 text-gray-600 hover:border-primary/40"}`}
            >
              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0
                ${isDistanceLearner ? "border-primary bg-primary" : "border-gray-300"}`}>
                {isDistanceLearner && <CheckCircle2 className="w-3 h-3 text-white" />}
              </div>
              I am not attending physical classes
            </button>

            {!isDistanceLearner && (
              <div className="space-y-2">
                <Label htmlFor="school">School Name</Label>
                <Input
                  id="school"
                  autoFocus
                  placeholder="e.g. Chibondo Secondary School"
                  value={schoolName}
                  onChange={e => setSchoolName(e.target.value)}
                  className="h-12"
                />
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="flex gap-3 mt-6">
          {step > 0 && (
            <Button variant="outline" className="flex-1 h-12" onClick={() => setStep(s => s - 1)}>
              Back
            </Button>
          )}
          {step < STEP_LABELS.length - 1 ? (
            <Button className="flex-1 h-12 font-semibold" disabled={!canProceed()} onClick={() => setStep(s => s + 1)}>
              Continue
            </Button>
          ) : (
           <Button className="flex-1 h-12 font-semibold" disabled={loading} onClick={handleFinish}>
             {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : "Start Learning 🎉"}
           </Button>
          )}
        </div>
      </div>

      <p className="text-xs text-gray-400 mt-6 text-center">Step {step + 1} of {STEP_LABELS.length}</p>
    </div>
  );
}