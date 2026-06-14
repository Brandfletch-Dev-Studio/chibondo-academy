import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { uploadImage } from '@/utils/uploadImage';
import {
  User, Camera, GraduationCap, BookOpen, CreditCard, Mail,
  CheckCircle2, Circle, ChevronDown, ChevronUp, X, ArrowRight, Sparkles, Loader2,
  ShieldAlert
} from 'lucide-react';
import { toast } from 'sonner';

const DISMISS_KEY  = (uid) => `aca_checklist_dismissed_${uid}`;
const SNOOZE_KEY   = (uid) => `aca_checklist_snooze_${uid}`;
const SNOOZE_HOURS = 6;

function useLocalDismiss(userId) {
  const isDismissed = () => {
    if (!userId) return false;
    if (localStorage.getItem(DISMISS_KEY(userId)) === 'done') return true;
    const snooze = localStorage.getItem(SNOOZE_KEY(userId));
    if (snooze) {
      const until = new Date(snooze);
      if (new Date() < until) return true;
      localStorage.removeItem(SNOOZE_KEY(userId));
    }
    return false;
  };
  const snooze  = () => {
    const until = new Date(Date.now() + SNOOZE_HOURS * 60 * 60 * 1000);
    localStorage.setItem(SNOOZE_KEY(userId), until.toISOString());
  };
  const markDone = () => localStorage.setItem(DISMISS_KEY(userId), 'done');
  return { isDismissed, snooze, markDone };
}

export default function SetupChecklist({ user }) {
  const navigate = useNavigate();
  const qc       = useQueryClient();
  const userId   = user?.id;
  const { isDismissed, snooze, markDone } = useLocalDismiss(userId);

  const [visible,        setVisible]        = useState(false);
  const [collapsed,      setCollapsed]      = useState(false);
  const [uploading,      setUploading]      = useState(false);
  const [photoPreview,   setPhotoPreview]   = useState(user?.avatar_url || '');
  const [editingName,    setEditingName]    = useState(false);
  const [nameVal,        setNameVal]        = useState(user?.full_name || '');
  const [savingName,     setSavingName]     = useState(false);
  // Email verification inline state
  const [verifyStep,     setVerifyStep]     = useState('idle'); // idle | sending | otp | verifying
  const [otpVal,         setOtpVal]         = useState('');
  const [verifyError,    setVerifyError]    = useState('');
  const fileRef = useRef();

  const { data: studentProfile } = useQuery({
    queryKey: ['studentProfile', userId],
    queryFn:  () => base44.entities.StudentProfile.filter({ user_id: userId }, 'created_date', 1).then(r => r[0] || null),
    enabled:  !!userId,
    staleTime: 0,
  });

  const { data: enrollments = [] } = useQuery({
    queryKey: ['enrollments', userId],
    queryFn:  () => base44.entities.Enrollment.filter({ student_id: userId }, '-created_date', 100),
    enabled:  !!userId,
    staleTime: 0,
  });

  const { data: subscription } = useQuery({
    queryKey: ['subscription', userId],
    queryFn:  () => base44.entities.Subscription.filter({ student_id: userId, status: 'active' }, '-created_date', 1).then(r => r[0] || null),
    enabled:  !!userId,
    staleTime: 0,
  });

  const hasName    = !!(user?.full_name?.trim() && user.full_name.trim() !== user.email);
  const hasPhoto   = !!(photoPreview || user?.avatar_url);
  const hasClass   = !!(studentProfile?.form);
  const hasEnroll  = enrollments.length > 0;
  const hasFees    = !!(subscription);
  const isVerified = !!(user?.email_verified);

  // Send OTP for email verification
  const handleSendOtp = async () => {
    setVerifyStep('sending');
    setVerifyError('');
    try {
      await base44.auth.resendOtp(user.email);
      setVerifyStep('otp');
      toast.success('Verification code sent to your email!');
    } catch (err) {
      setVerifyError('Could not send code. Try again.');
      setVerifyStep('idle');
    }
  };

  // Submit OTP
  const handleVerifyOtp = async () => {
    if (!otpVal.trim() || otpVal.length !== 6) {
      setVerifyError('Enter the 6-digit code');
      return;
    }
    setVerifyStep('verifying');
    setVerifyError('');
    try {
      const result = await base44.auth.verifyOtp({ email: user.email, otpCode: otpVal.trim() });
      if (result?.access_token) {
        try { localStorage.setItem('base44_access_token', result.access_token); } catch (_) {}
        try { localStorage.setItem('token', result.access_token); } catch (_) {}
        await base44.auth.setToken(result.access_token);
      }
      qc.invalidateQueries({ queryKey: ['currentUser'] });
      toast.success('Email verified! ✓');
      setVerifyStep('idle');
      setOtpVal('');
    } catch (err) {
      setVerifyError('Invalid code. Please try again.');
      setVerifyStep('otp');
    }
  };

  const items = [
    {
      id: 'verify',
      done: isVerified,
      label: 'Verify your email address',
      icon: Mail,
      action: handleSendOtp,
      required: true, // enforced — shown at top with prominent styling
    },
    { id: 'name',   done: hasName,    label: 'Add your full name',           icon: User,          action: () => setEditingName(true) },
    { id: 'photo',  done: hasPhoto,   label: 'Upload a profile picture',     icon: Camera,        action: () => navigate('/settings?tab=profile') },
    { id: 'class',  done: hasClass,   label: 'Select your class',            icon: GraduationCap, action: () => navigate('/settings?tab=profile') },
    { id: 'enroll', done: hasEnroll,  label: 'Choose subjects to enroll in', icon: BookOpen,      action: () => navigate('/enroll-subjects') },
    { id: 'fees',   done: hasFees,    label: 'Pay fees to start learning',   icon: CreditCard,    action: () => navigate('/subscription') },
  ];

  const doneCount = items.filter(i => i.done).length;
  const allDone   = doneCount === items.length;
  const pct       = Math.round((doneCount / items.length) * 100);

  useEffect(() => {
    if (!userId) return;
    if (allDone) { markDone(); setVisible(false); return; }
    setVisible(!isDismissed());
  }, [userId, allDone, doneCount]);

  useEffect(() => { setPhotoPreview(user?.avatar_url || ''); }, [user?.avatar_url]);
  useEffect(() => { setNameVal(user?.full_name || ''); },      [user?.full_name]);

  const handlePhotoFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please select an image'); return; }
    if (file.size > 5 * 1024 * 1024)    { toast.error('Image must be under 5 MB'); return; }
    setPhotoPreview(URL.createObjectURL(file));
    setUploading(true);
    try {
      const url = await uploadImage(file);
      setPhotoPreview(url);
      await base44.auth.updateMe({ avatar_url: url });
      if (studentProfile?.id) {
        await base44.entities.StudentProfile.update(studentProfile.id, { avatar_url: url });
      } else {
        await base44.entities.StudentProfile.create({ user_id: userId, avatar_url: url });
      }
      qc.invalidateQueries({ queryKey: ['currentUser'] });
      qc.invalidateQueries({ queryKey: ['studentProfile', userId] });
      toast.success('Profile picture updated!');
    } catch {
      toast.error('Upload failed. Try again.');
      setPhotoPreview(user?.avatar_url || '');
    } finally { setUploading(false); }
  };

  const saveName = async () => {
    if (!nameVal.trim()) return;
    setSavingName(true);
    try {
      await base44.auth.updateMe({ full_name: nameVal.trim() });
      qc.invalidateQueries({ queryKey: ['currentUser'] });
      setEditingName(false);
      toast.success('Name saved!');
    } catch { toast.error('Could not save name.'); }
    finally  { setSavingName(false); }
  };

  if (!visible || !userId) return null;

  return (
    <div className="rounded-2xl border border-border bg-card text-card-foreground overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-accent" />
          </div>
          <div>
            <p className="font-display font-bold text-sm text-foreground">Set up your account</p>
            <p className="text-[11px] text-muted-foreground">{doneCount} of {items.length} complete</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCollapsed(v => !v)}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
          <button
            onClick={() => { snooze(); setVisible(false); }}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Remind me later">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-5 pb-3">
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full bg-accent transition-all duration-500"
            style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Enforced OTP banner — shown prominently when email not verified */}
      {!isVerified && !collapsed && (
        <div className="mx-3 mb-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 flex items-start gap-3">
          <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-amber-800">Email verification required</p>
            <p className="text-[11px] text-amber-700 mt-0.5">
              Please verify your email to secure your account. You can still learn while you do this.
            </p>
          </div>
        </div>
      )}

      {/* Items */}
      {!collapsed && (
        <div className="px-3 pb-4 space-y-0.5">
          {items.map(item => (
            <ChecklistItem
              key={item.id}
              item={item}
              editingName={editingName}
              nameVal={nameVal}
              setNameVal={setNameVal}
              saveName={saveName}
              savingName={savingName}
              setEditingName={setEditingName}
              uploading={uploading}
              photoPreview={photoPreview}
              verifyStep={verifyStep}
              otpVal={otpVal}
              setOtpVal={setOtpVal}
              verifyError={verifyError}
              handleSendOtp={handleSendOtp}
              handleVerifyOtp={handleVerifyOtp}
              userEmail={user?.email}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ChecklistItem({
  item, editingName, nameVal, setNameVal, saveName, savingName, setEditingName,
  uploading, photoPreview,
  verifyStep, otpVal, setOtpVal, verifyError, handleSendOtp, handleVerifyOtp, userEmail,
}) {
  const Icon        = item.icon;
  const isVerifyItem = item.id === 'verify';

  return (
    <div className={`rounded-xl overflow-hidden ${isVerifyItem && !item.done ? 'ring-1 ring-amber-200 bg-amber-50/30' : ''}`}>
      <div
        className={`flex items-center gap-3 px-3 py-3 transition-colors ${
          item.done
            ? 'opacity-50'
            : isVerifyItem
            ? 'cursor-default'
            : 'hover:bg-muted cursor-pointer'
        }`}
        onClick={item.done || isVerifyItem ? undefined : item.action}
      >
        {/* Tick / circle */}
        <div className="flex-shrink-0 w-5">
          {item.done
            ? <CheckCircle2 className="w-5 h-5 text-green-500" />
            : isVerifyItem
            ? <ShieldAlert className="w-5 h-5 text-amber-500" />
            : <Circle       className="w-5 h-5 text-muted-foreground/40" />}
        </div>

        {/* Icon badge */}
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
          isVerifyItem && !item.done ? 'bg-amber-100' : 'bg-muted'
        }`}>
          {item.id === 'photo' && photoPreview && !item.done ? (
            <img src={photoPreview} alt="" className="w-full h-full object-cover rounded-lg" />
          ) : (
            <Icon className={`w-4 h-4 ${isVerifyItem && !item.done ? 'text-amber-600' : 'text-muted-foreground'}`} />
          )}
        </div>

        {/* Label / inline input */}
        <div className="flex-1 min-w-0">
          {item.id === 'name' && editingName && !item.done ? (
            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
              <input
                autoFocus
                value={nameVal}
                onChange={e => setNameVal(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter')  saveName();
                  if (e.key === 'Escape') setEditingName(false);
                }}
                className="flex-1 text-sm bg-background border border-border rounded-lg px-2.5 py-1 outline-none focus:ring-1 focus:ring-accent text-foreground"
                placeholder="Your full name"
              />
              <button
                onClick={saveName}
                disabled={savingName}
                className="text-xs font-semibold px-3 py-1 rounded-lg bg-accent text-accent-foreground transition-opacity hover:opacity-90">
                {savingName ? '…' : 'Save'}
              </button>
            </div>
          ) : item.id === 'photo' && uploading ? (
            <p className="text-sm text-muted-foreground">Uploading…</p>
          ) : isVerifyItem && !item.done ? (
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-semibold text-amber-800">Verify your email</p>
                <span className="text-[10px] font-bold bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded-full uppercase tracking-wide">Required</span>
              </div>
              <p className="text-[11px] text-amber-700 truncate">{userEmail}</p>
            </div>
          ) : (
            <p className={`text-sm font-medium ${item.done ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
              {item.label}
            </p>
          )}
        </div>

        {/* Action button / arrow */}
        {!item.done && isVerifyItem && verifyStep === 'idle' && (
          <button
            onClick={(e) => { e.stopPropagation(); handleSendOtp(); }}
            className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-amber-500 text-white flex items-center gap-1 flex-shrink-0 hover:bg-amber-600 transition-colors"
          >
            Verify now
          </button>
        )}
        {!item.done && isVerifyItem && verifyStep === 'sending' && (
          <Loader2 className="w-4 h-4 animate-spin text-amber-500 flex-shrink-0" />
        )}
        {!item.done && !isVerifyItem && item.id !== 'name' && (
          <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/40 flex-shrink-0" />
        )}
      </div>

      {/* Inline OTP entry — shown below the row when step is otp or verifying */}
      {isVerifyItem && !item.done && (verifyStep === 'otp' || verifyStep === 'verifying') && (
        <div className="px-4 pb-4 pt-1 bg-amber-50/60 rounded-b-xl" onClick={e => e.stopPropagation()}>
          <p className="text-[11px] text-amber-700 mb-2">Enter the 6-digit code sent to <span className="font-medium">{userEmail}</span></p>
          <div className="flex items-center gap-2">
            <input
              autoFocus
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={otpVal}
              onChange={e => setOtpVal(e.target.value.replace(/\D/g, ''))}
              onKeyDown={e => { if (e.key === 'Enter') handleVerifyOtp(); }}
              className="flex-1 text-sm bg-background border border-amber-300 rounded-lg px-3 py-1.5 outline-none focus:ring-1 focus:ring-amber-400 text-foreground font-mono tracking-widest text-center"
            />
            <button
              onClick={handleVerifyOtp}
              disabled={verifyStep === 'verifying'}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-500 text-white flex items-center gap-1 hover:bg-amber-600 transition-colors disabled:opacity-60"
            >
              {verifyStep === 'verifying' ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Confirm'}
            </button>
            <button
              onClick={() => { handleSendOtp(); }}
              disabled={verifyStep === 'verifying'}
              className="text-xs text-amber-700 hover:text-amber-900 underline disabled:opacity-50"
              title="Resend code"
            >
              Resend
            </button>
          </div>
          {verifyError && <p className="text-[11px] text-red-500 mt-1.5">{verifyError}</p>}
        </div>
      )}
    </div>
  );
}
