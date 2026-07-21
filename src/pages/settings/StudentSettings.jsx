import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { db } from '@/api/supabaseClient';
import { toast } from 'sonner';
import {
  User, Lock, Bell, LogOut, GraduationCap, ChevronRight,
  Loader2, Eye, EyeOff, Phone, Mail, Check, BookOpen,
  Shield, Smartphone, X, School, Info,
} from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';

// ── constants ─────────────────────────────────────────────────────────────────
const TABS = [
  { key: 'profile',       label: 'Profile',       icon: User          },
  { key: 'academic',      label: 'Academic',       icon: GraduationCap },
  { key: 'notifications', label: 'Notifications',  icon: Bell          },
  { key: 'security',      label: 'Security',       icon: Shield        },
];

const formatPhone = (val) => {
  const digits = val.replace(/\D/g, '');
  if (!digits) return val;
  if (digits.startsWith('265')) return '+' + digits;
  if (digits.startsWith('0'))   return '+265' + digits.slice(1);
  return '+265' + digits;
};

const isPlaceholderEmail = (email) =>
  !email || email.includes('@student.chibondoacademy.com');

// ── tiny reusables ─────────────────────────────────────────────────────────────
function Field({ label, hint, children }) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">{label}</p>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function TextInput({ icon: Icon, ...props }) {
  return (
    <div className="relative">
      {Icon && <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />}
      <input
        {...props}
        className={`w-full h-11 rounded-xl border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-shadow ${Icon ? 'pl-9 pr-3' : 'px-3'} ${props.className || ''}`}
      />
    </div>
  );
}

function SaveBtn({ loading, label = 'Save Changes', icon: Icon = Check }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full h-11 rounded-xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60 transition-opacity"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
      {loading ? 'Saving…' : label}
    </button>
  );
}

// ── panels ─────────────────────────────────────────────────────────────────────

function ProfilePanel({ user, checkUserAuth }) {
  const [fullName,  setFullName]  = useState(user?.full_name || '');
  const [phone,     setPhone]     = useState('');
  const [email,     setEmail]     = useState('');
  const [saving,    setSaving]    = useState(false);
  const hasPlaceholder = isPlaceholderEmail(user?.email);

  useEffect(() => {
    if (!user) return;
    setFullName(user.full_name || '');
    db.entities.StudentProfile.filter({ user_id: user.id }).then(rows => {
      if (rows[0]) {
        // Prefer StudentProfile phone, fall back to auth user.phone (set at registration)
        const phoneVal = rows[0].phone_number || user?.phone || '';
        if (phoneVal) setPhone(phoneVal);
        if (!isPlaceholderEmail(rows[0].email)) setEmail(rows[0].email || '');
      } else {
        // No profile yet — still pre-fill from auth user phone
        if (user?.phone) setPhone(user.phone);
      }
    }).catch(() => {});
  }, [user?.id]);

  const save = async (e) => {
    e.preventDefault();
    if (!fullName.trim()) return toast.error('Name is required');
    const formattedPhone = phone.trim() ? formatPhone(phone) : '';
    setSaving(true);
    try {
      // Update users table (full_name + phone) — always works, no schema issues
      await db.auth.updateMe({ full_name: fullName.trim() });
      if (formattedPhone) {
        await db.entities.User.update(user.id, { phone_number: formattedPhone }).catch(() => {});
      }
      const rows = await db.entities.StudentProfile.filter({ user_id: user.id });
      // Only update columns that actually exist in student_profiles table:
      // user_id, full_name, phone_number, email, form, avatar_url
      const profileData = {
        user_id:      user.id,
        full_name:    fullName.trim(),
        phone_number: formattedPhone,
        // Note: student_profiles has no email column — email is on users table only
      };
      if (rows[0]) await db.entities.StudentProfile.update(rows[0].id, profileData);
      else         await db.entities.StudentProfile.create(profileData);

      if (hasPlaceholder && email.trim()) {
        // Email update in Supabase sends a confirmation — fire-and-forget, don't block save
        db.auth.updateMe({ email: email.trim() }).catch(() => {});
      }
      await checkUserAuth();
      toast.success('Profile saved');
    } catch (err) {
      toast.error(err?.message || 'Could not save');
    } finally { setSaving(false); }
  };

  return (
    <form onSubmit={save} className="space-y-4">
      <Field label="Full Name">
        <TextInput
          value={fullName}
          onChange={e => setFullName(e.target.value)}
          placeholder="Your full name"
          icon={User}
        />
      </Field>

      <Field label="Phone Number" hint="Your Malawi mobile number (auto-formatted to +265)">
        <TextInput
          type="tel"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          onBlur={() => phone.trim() && setPhone(formatPhone(phone))}
          placeholder="e.g. 0881234567"
          icon={Phone}
        />
      </Field>

      <Field
        label="Email Address"
        hint={hasPlaceholder ? 'Add a real email to recover your account if you lose access' : undefined}
      >
        {hasPlaceholder ? (
          <div className="space-y-2">
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl border border-amber-300/70 bg-amber-50/60 dark:bg-amber-900/10">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 dark:text-amber-400">
                No email linked yet. Adding one lets you reset your password via email.
              </p>
            </div>
            <TextInput
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              icon={Mail}
            />
          </div>
        ) : (
          <div className="flex items-center gap-2 h-11 px-3 rounded-xl border bg-muted/40 text-sm text-muted-foreground">
            <Mail className="w-4 h-4 shrink-0" />
            <span className="truncate">{user?.email}</span>
          </div>
        )}
      </Field>

      <SaveBtn loading={saving} label="Save Profile" />
    </form>
  );
}

function AcademicPanel({ user }) {
  const [profile,  setProfile]   = useState(null);
  const [form,     setForm]      = useState('');
  const [saving,   setSaving]    = useState(false);
  const [subjects, setSubjects]  = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    // student_profiles uses user_id and form (not class_name/school_name)
    db.entities.StudentProfile.filter({ user_id: user.id }).then(rows => {
      if (rows[0]) {
        setProfile(rows[0]);
        // Column is 'form' — may be stored as "Form 3" or just "3"
        setForm(rows[0].form || '');
      }
    }).catch(() => {});
    db.entities.Enrollment.filter({ student_id: user.id }).then(rows => {
      setSubjects(rows);
    }).catch(() => {});
  }, [user?.id]);

  const save = async (e) => {
    e.preventDefault();
    if (!form) return toast.error('Please select your form');
    setSaving(true);
    try {
      // Also sync to auth user_metadata so it survives token refresh
      await db.auth.updateMe({ data: { form } }).catch(() => {});

      // Save to StudentProfile — column name is 'form'
      if (profile) {
        await db.entities.StudentProfile.update(profile.id, { form });
      } else {
        const newProfile = await db.entities.StudentProfile.create({ user_id: user.id, form });
        setProfile(newProfile);
      }
      toast.success('Academic details saved');
    } catch (err) {
      toast.error(err?.message || 'Could not save');
    } finally { setSaving(false); }
  };

  const FORMS = ['Form 1', 'Form 2', 'Form 3', 'Form 4'];

  return (
    <div className="space-y-6">
      <form onSubmit={save} className="space-y-4">
        <Field label="Form / Class" hint="Determines which subjects and content you see">
          <select
            value={form}
            onChange={e => setForm(e.target.value)}
            className="w-full h-11 rounded-xl border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option value="">Select your form…</option>
            {FORMS.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </Field>

        <SaveBtn loading={saving} label="Save Academic Details" icon={GraduationCap} />
      </form>

      {/* Enrolled subjects summary */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold">Enrolled Subjects</p>
          <button
            onClick={() => navigate('/enroll-subjects')}
            className="text-xs text-primary font-medium hover:underline flex items-center gap-1"
          >
            Manage <ChevronRight className="w-3 h-3" />
          </button>
        </div>
        {subjects.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-muted/20 py-8 text-center">
            <BookOpen className="w-8 h-8 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">No subjects enrolled yet</p>
            <button
              onClick={() => navigate('/enroll-subjects')}
              className="mt-3 text-xs text-primary font-medium hover:underline"
            >
              Enrol in subjects →
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {subjects.slice(0, 8).map(s => (
              <div key={s.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border bg-card">
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <BookOpen className="w-3.5 h-3.5 text-primary" />
                </div>
                <span className="text-sm font-medium flex-1 truncate">{s.subject_name}</span>
                <span className="text-xs text-muted-foreground">{s.form_name || ''}</span>
              </div>
            ))}
            {subjects.length > 8 && (
              <p className="text-xs text-center text-muted-foreground pt-1">
                +{subjects.length - 8} more · <button onClick={() => navigate('/enroll-subjects')} className="text-primary hover:underline">view all</button>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function NotificationsPanel({ user }) {
  const { permission, subscribe, unsubscribe, isSupported, isSubscribing, error, isSubscribed } = usePushNotifications(user);
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [saving, setSaving] = useState(false);

  const granted = permission === 'granted';

  // Load push_enabled or email_notifications on mount
  useEffect(() => {
    let active = true;
    const loadSettings = async () => {
      try {
        // Try StudentProfile first
        const profiles = await db.entities.StudentProfile.filter({ user_id: user.id });
        if (active && profiles && profiles.length > 0) {
          const prof = profiles[0];
          if (prof.push_enabled !== undefined && prof.push_enabled !== null) {
            setEmailNotifs(!!prof.push_enabled);
            return;
          }
          if (prof.email_notifications !== undefined && prof.email_notifications !== null) {
            setEmailNotifs(!!prof.email_notifications);
            return;
          }
        }
        
        // Try User entity
        const u = await db.entities.User.filter({ id: user.id });
        if (active && u && u.length > 0) {
          const usr = u[0];
          if (usr.push_enabled !== undefined && usr.push_enabled !== null) {
            setEmailNotifs(!!usr.push_enabled);
            return;
          }
          if (usr.email_notifications !== undefined && usr.email_notifications !== null) {
            setEmailNotifs(!!usr.email_notifications);
            return;
          }
        }
      } catch (err) {
        console.error('Error loading notification settings:', err);
      }
    };
    loadSettings();
    return () => { active = false; };
  }, [user.id]);

  const toggleEmailNotifs = async () => {
    if (saving) return;
    const newValue = !emailNotifs;
    setSaving(true);
    try {
      await db.entities.User.update(user.id, { email_notifications: newValue });
      setEmailNotifs(newValue);
      toast.success('Email notifications updated');
    } catch (err) {
      toast.error(err?.message || 'Could not update email notifications');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Push */}
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Smartphone className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">Push Notifications</p>
            <p className="text-xs text-muted-foreground mt-0.5">Get notified about new lessons, assignments, and announcements</p>
          </div>
          <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${granted ? 'bg-emerald-100 text-emerald-600' : 'bg-muted text-muted-foreground'}`}>
            {granted ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
          </div>
        </div>

        {!isSubscribed && isSupported && (
          <button
            onClick={subscribe}
            disabled={isSubscribing}
            className="w-full h-10 rounded-xl bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {isSubscribing
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Enabling…</>
              : <><Bell className="w-4 h-4" /> Enable Notifications</>}
          </button>
        )}

        {error && (
          <p className="text-xs text-destructive px-1">{error}</p>
        )}

        {granted && isSubscribed && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-xs text-emerald-700 dark:text-emerald-400 font-medium flex-1">Notifications are enabled</span>
              <button onClick={unsubscribe} className="text-xs text-muted-foreground hover:text-destructive underline">Disable</button>
            </div>
          </div>
        )}

        {!isSupported && (
          <p className="text-xs text-muted-foreground px-1">Push notifications are not supported on this device/browser.</p>
        )}
      </div>

      {/* Email notifications */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Mail className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">Email Notifications</p>
              <p className="text-xs text-muted-foreground mt-0.5">Payment reminders and platform updates</p>
            </div>
          </div>
          {saving && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground shrink-0" />}
          <button
            onClick={toggleEmailNotifs}
            disabled={saving}
            className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${emailNotifs ? 'bg-primary' : 'bg-muted'} ${saving ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${emailNotifs ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </div>
      </div>
    </div>
  );
}

function SecurityPanel() {
  const [currentPw, setCurrentPw] = useState('');
  const [newPw,     setNewPw]     = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw,    setShowPw]    = useState(false);
  const [saving,    setSaving]    = useState(false);

  const save = async (e) => {
    e.preventDefault();
    if (!currentPw)          return toast.error('Enter your current password');
    if (newPw.length < 6)    return toast.error('New password must be at least 6 characters');
    if (newPw !== confirmPw) return toast.error('Passwords do not match');
    setSaving(true);
    try {
      await db.auth.changePassword({ currentPassword: currentPw, newPassword: newPw });
      toast.success('Password updated successfully');
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    } catch (err) {
      toast.error(err?.message || 'Could not update password');
    } finally { setSaving(false); }
  };

  const pwType = showPw ? 'text' : 'password';

  return (
    <form onSubmit={save} className="space-y-4">
      <Field label="Current Password">
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type={pwType}
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
            type={pwType}
            value={newPw}
            onChange={e => setNewPw(e.target.value)}
            placeholder="At least 6 characters"
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
            type={pwType}
            value={confirmPw}
            onChange={e => setConfirmPw(e.target.value)}
            placeholder="Re-enter new password"
            autoComplete="new-password"
            className="w-full h-11 rounded-xl border bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
      </Field>

      {/* Password strength hint */}
      {newPw.length > 0 && (
        <div className="flex gap-1.5">
          {[1,2,3,4].map(i => (
            <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${
              newPw.length >= i * 3
                ? i <= 1 ? 'bg-red-400'
                : i <= 2 ? 'bg-amber-400'
                : i <= 3 ? 'bg-yellow-400'
                : 'bg-emerald-500'
              : 'bg-muted'
            }`} />
          ))}
        </div>
      )}

      <SaveBtn loading={saving} label="Change Password" icon={Lock} />
    </form>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function StudentSettings() {
  const { user, logout, checkUserAuth } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('profile');

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (!user) return null;

  const ActivePanel = {
    profile:       <ProfilePanel       user={user} checkUserAuth={checkUserAuth} />,
    academic:      <AcademicPanel      user={user} />,
    notifications: <NotificationsPanel user={user} />,
    security:      <SecurityPanel />,
  }[tab];

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* ── Hero header ── */}
      <div className="bg-gradient-to-br from-primary to-primary/80 px-4 pt-5 pb-0">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center text-primary-foreground font-bold text-lg">
            {(user.full_name || user.email || '?')[0].toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-primary-foreground leading-tight">
              {user.full_name || 'My Account'}
            </p>
            <p className="text-xs text-primary-foreground/70 truncate max-w-[220px]">{user.email}</p>
          </div>
        </div>

        {/* Tab bar — sits on the gradient, pills hang over edge */}
        <div className="flex gap-1 overflow-x-auto no-scrollbar pb-0">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-t-xl text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0 ${
                tab === key
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-primary-foreground/70 hover:text-primary-foreground hover:bg-white/10'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Panel content ── */}
      <div className="max-w-lg mx-auto px-4 py-5">
        {ActivePanel}

        {/* Sign out — always at bottom */}
        <div className="mt-8 pt-5 border-t">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-between px-3 py-3 rounded-xl text-destructive hover:bg-destructive/5 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center">
                <LogOut className="w-4 h-4" />
              </div>
              <span className="text-sm font-medium">Sign Out</span>
            </div>
            <ChevronRight className="w-4 h-4 opacity-40" />
          </button>
        </div>
      </div>
    </div>
  );
}

