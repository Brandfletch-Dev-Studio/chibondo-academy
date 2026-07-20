import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { db } from '@/api/supabaseClient';
import { toast } from 'sonner';
import {
  User, Lock, Bell, LogOut, ChevronRight,
  Camera, Loader2, Eye, EyeOff, Phone, Mail, Check,
} from 'lucide-react';

// ── helpers ──────────────────────────────────────────────────────────────────
const formatPhone = (val) => {
  const digits = val.replace(/\D/g, '');
  if (!digits) return val;
  if (digits.startsWith('265')) return '+' + digits;
  if (digits.startsWith('0'))   return '+265' + digits.slice(1);
  return '+265' + digits;
};

const isPlaceholder = (email) =>
  !email || email.includes('@student.chibondoacademy.com');

// ── tiny reusable field ───────────────────────────────────────────────────────
function Field({ label, hint, children }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ── section card ──────────────────────────────────────────────────────────────
function Section({ title, children }) {
  return (
    <div className="rounded-2xl border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{title}</h2>
      </div>
      <div className="p-4 space-y-4">{children}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function StudentSettings() {
  const { user, logout, checkUserAuth } = useAuth();
  const navigate = useNavigate();

  // ── profile state ──
  const [fullName,  setFullName]  = useState('');
  const [phone,     setPhone]     = useState('');
  const [email,     setEmail]     = useState('');   // only shown if placeholder
  const [saving,    setSaving]    = useState(false);

  // ── password state ──
  const [currentPw,  setCurrentPw]  = useState('');
  const [newPw,      setNewPw]      = useState('');
  const [confirmPw,  setConfirmPw]  = useState('');
  const [showPw,     setShowPw]     = useState(false);
  const [savingPw,   setSavingPw]   = useState(false);

  // ── hydrate from user + StudentProfile ──
  useEffect(() => {
    if (!user) return;
    setFullName(user.full_name || '');
    setPhone(user.phone_number || user.user_metadata?.phone_number || '');

    // Load StudentProfile for phone / email
    db.entities.StudentProfile.filter({ user_id: user.id })
      .then(rows => {
        if (rows[0]) {
          if (rows[0].phone_number) setPhone(rows[0].phone_number);
          if (!isPlaceholder(rows[0].email)) setEmail(rows[0].email || '');
        }
      })
      .catch(() => {});
  }, [user]);

  // ── save profile ──
  const saveProfile = async (e) => {
    e.preventDefault();
    if (!fullName.trim()) return toast.error('Name is required');
    const formattedPhone = phone.trim() ? formatPhone(phone) : '';
    setSaving(true);
    try {
      // 1. Update auth user
      await db.auth.updateMe({ full_name: fullName.trim() });

      // 2. Update / create StudentProfile
      const rows = await db.entities.StudentProfile.filter({ user_id: user.id });
      const profileData = {
        user_id:      user.id,
        full_name:    fullName.trim(),
        phone_number: formattedPhone,
        email:        (!isPlaceholder(user.email) ? user.email : email.trim()) || user.email || '',
      };
      if (rows[0]) {
        await db.entities.StudentProfile.update(rows[0].id, profileData);
      } else {
        await db.entities.StudentProfile.create(profileData);
      }

      await checkUserAuth();
      toast.success('Profile saved');
    } catch (err) {
      toast.error(err?.message || 'Could not save profile');
    } finally {
      setSaving(false);
    }
  };

  // ── change password ──
  const changePassword = async (e) => {
    e.preventDefault();
    if (!currentPw)                   return toast.error('Enter your current password');
    if (newPw.length < 6)             return toast.error('New password must be at least 6 characters');
    if (newPw !== confirmPw)          return toast.error('Passwords do not match');
    setSavingPw(true);
    try {
      await db.auth.changePassword({ currentPassword: currentPw, newPassword: newPw });
      toast.success('Password updated');
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    } catch (err) {
      toast.error(err?.message || 'Could not update password');
    } finally {
      setSavingPw(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (!user) return null;
  const hasPlaceholderEmail = isPlaceholder(user.email);

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/90 backdrop-blur border-b px-4 py-3 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
          <User className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h1 className="text-base font-semibold leading-tight">Settings</h1>
          <p className="text-xs text-muted-foreground">{user.email}</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-5">

        {/* ── Profile ── */}
        <Section title="Profile">
          <form onSubmit={saveProfile} className="space-y-4">

            <Field label="Full Name">
              <input
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="Your full name"
                className="w-full h-11 rounded-xl border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </Field>

            <Field label="Phone Number" hint="Used to receive payment reminders">
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  onBlur={() => phone.trim() && setPhone(formatPhone(phone))}
                  placeholder="e.g. 0881234567"
                  className="w-full h-11 rounded-xl border bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </Field>

            {/* Email — only editable if they signed up with phone only */}
            <Field
              label="Email Address"
              hint={hasPlaceholderEmail ? 'Add an email to recover your account' : undefined}
            >
              {hasPlaceholderEmail ? (
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full h-11 rounded-xl border bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
              ) : (
                <div className="flex items-center gap-2 h-11 px-3 rounded-xl border bg-muted/40 text-sm text-muted-foreground">
                  <Mail className="w-4 h-4 shrink-0" />
                  <span className="truncate">{user.email}</span>
                </div>
              )}
            </Field>

            <button
              type="submit"
              disabled={saving}
              className="w-full h-11 rounded-xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {saving ? 'Saving…' : 'Save Profile'}
            </button>
          </form>
        </Section>

        {/* ── Security ── */}
        <Section title="Security">
          <form onSubmit={changePassword} className="space-y-4">

            <Field label="Current Password">
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type={showPw ? 'text' : 'password'}
                  value={currentPw}
                  onChange={e => setCurrentPw(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full h-11 rounded-xl border bg-background pl-9 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </Field>

            <Field label="New Password">
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type={showPw ? 'text' : 'password'}
                  value={newPw}
                  onChange={e => setNewPw(e.target.value)}
                  placeholder="Min 6 characters"
                  autoComplete="new-password"
                  className="w-full h-11 rounded-xl border bg-background pl-9 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </Field>

            <Field label="Confirm New Password">
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type={showPw ? 'text' : 'password'}
                  value={confirmPw}
                  onChange={e => setConfirmPw(e.target.value)}
                  placeholder="Re-enter new password"
                  autoComplete="new-password"
                  className="w-full h-11 rounded-xl border bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </Field>

            <button
              type="submit"
              disabled={savingPw}
              className="w-full h-11 rounded-xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {savingPw ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              {savingPw ? 'Updating…' : 'Change Password'}
            </button>
          </form>
        </Section>

        {/* ── Account ── */}
        <Section title="Account">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-between px-1 py-1 rounded-xl text-destructive hover:bg-destructive/5 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center">
                <LogOut className="w-4 h-4" />
              </div>
              <span className="text-sm font-medium">Sign Out</span>
            </div>
            <ChevronRight className="w-4 h-4 opacity-40" />
          </button>
        </Section>

      </div>
    </div>
  );
}
