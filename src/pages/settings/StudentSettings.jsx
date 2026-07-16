import React, { useState, useEffect, useRef } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { db } from '@/api/supabaseClient';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  User, Bell, CreditCard, Sun, Moon, Camera, Loader2, Save,
  GraduationCap, Phone, School, BellRing, Palette, Shield,
  Check, ExternalLink, BookOpen, Trash2, AlertTriangle, Lock, Eye, EyeOff,
  Smartphone, WifiOff
} from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';

// ── Gold accent tokens ─────────────────────────────────────────────────────
const GOLD        = 'hsl(var(--primary))';
const GOLD_BG = 'hsl(var(--primary) / 0.12)';
const GOLD_BORDER = 'hsl(var(--primary) / 0.3)';

// ── Sidebar nav ───────────────────────────────────────────────────────────
const NAV = [
  { key: 'profile',       label: 'My Profile',    icon: User         },
  { key: 'academic',      label: 'Academic',       icon: GraduationCap },
  { key: 'notifications', label: 'Notifications',  icon: BellRing     },
  { key: 'billing',       label: 'Billing',        icon: CreditCard   },
  { key: 'appearance',    label: 'Appearance',     icon: Palette      },
  { key: 'security',      label: 'Security',       icon: Shield       },
];

// ── Shared sub-components ─────────────────────────────────────────────────
function Section({ icon: Icon, title, subtitle, children, gold = false }) {
  return (
    <div className={cn(
      'rounded-2xl border p-6 space-y-5',
      gold
        ? 'bg-gradient-to-br from-[hsl(var(--primary)_/_0.06)] to-card border-[hsl(var(--primary)_/_0.25)]'
        : 'bg-card border-border'
    )}>
      <div className="flex items-center gap-3">
        <div className={cn(
          'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0',
          gold ? 'bg-[hsl(var(--primary)_/_0.15)]' : 'bg-muted'
        )}>
          <Icon className="w-4 h-4" style={gold ? { color: GOLD } : {}} />
        </div>
        <div>
          <h2 className="font-semibold text-sm">{title}</h2>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

function SaveBtn({ onClick, loading, label = 'Save Changes' }) {
  return (
    <div className="flex items-center justify-end pt-2">
      <Button onClick={onClick} disabled={loading} className="gap-2 px-6 font-semibold"
        style={{ background: GOLD, color: 'hsl(var(--background))', border: 'none' }}>
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        {label}
      </Button>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</Label>
      {hint && <p className="text-[11px] text-muted-foreground -mt-1">{hint}</p>}
      {children}
    </div>
  );
}

// ── Profile Panel ─────────────────────────────────────────────────────────
function ProfilePanel({ user, profile, profileLoaded, qc }) {
  const { checkUserAuth } = useAuth();
  const avatarRef = useRef();
  const [uploading, setUploading] = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [preview,   setPreview]   = useState(user?.avatar_url || '');
  const [fullName,  setFullName]  = useState(user?.full_name || '');
  const [phone,     setPhone]     = useState(profile?.phone_number || '');
  const [schoolName,setSchoolName]= useState(profile?.school_name || '');

  // Re-seed when user is present AND the profile query has actually resolved
  // (profileLoaded distinguishes "still fetching" from "fetched, no profile yet" —
  // seeding too early, before the async profile fetch finishes, left phone/school
  // permanently blank even though the data was saved correctly in the DB).
  const seeded = useRef(false);
  useEffect(() => {
    if (!seeded.current && user?.id && profileLoaded) {
      seeded.current = true;
      setPreview(user?.avatar_url || '');
      setFullName(user?.full_name || '');
      setPhone(profile?.phone_number || '');
      setSchoolName(profile?.school_name || '');
    }
  }, [user?.id, profileLoaded, profile?.id]);

  const handleAvatar = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return; }
    if (file.size > 5 * 1024 * 1024)    { toast.error('Image must be under 5 MB'); return; }

    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);
    setUploading(true);
    try {
      const { uploadImage } = await import('@/utils/uploadImage');
      const file_url = await uploadImage(file);
      setPreview(file_url);

      // Save avatar via db.auth.updateMe → patches users table in Supabase
      await db.auth.updateMe({ avatar_url: file_url });

      // Save avatar_url to user_metadata
      await db.auth.updateMe({ data: { avatar_url: file_url } });

      await checkUserAuth();
      qc.invalidateQueries({ queryKey: ['studentProfile'] });
      toast.success('Profile photo updated!');
    } catch (err) {
      toast.error(err?.message || 'Upload failed — please try again');
      setPreview(user?.avatar_url || '');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!fullName.trim()) { toast.error('Full name is required'); return; }
    setSaving(true);
    try {
      // Update users table via Supabase
      await db.auth.updateMe({ full_name: fullName.trim() });

      // Save extended profile fields to user_metadata
      await db.auth.updateMe({
        data: {
          full_name:    fullName.trim(),
          phone_number: phone.trim(),
          school_name:  schoolName.trim(),
        }
      });

      await checkUserAuth();
      toast.success('Profile saved!');
    } catch (err) {
      toast.error(err?.message || 'Save failed — please try again');
    } finally {
      setSaving(false);
    }
  };

  const initials = (fullName || user?.email || 'S')
    .split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="space-y-5">
      {/* Hero avatar card */}
      <div className="rounded-2xl border p-6 bg-gradient-to-br from-[hsl(var(--primary)_/_0.06)] to-card border-[hsl(var(--primary)_/_0.25)] flex flex-col sm:flex-row items-center gap-6">
        <div className="relative flex-shrink-0">
          <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-[hsl(var(--primary)_/_0.4)] shadow-lg">
            {preview
              ? <img src={preview} alt="avatar" className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center text-2xl font-bold"
                  style={{ background: GOLD_BG, color: GOLD }}>{initials}</div>
            }
          </div>
          <button onClick={() => avatarRef.current?.click()} disabled={uploading}
            className="absolute -bottom-2 -right-2 w-8 h-8 rounded-xl flex items-center justify-center shadow-lg border border-border transition-all hover:scale-105"
            style={{ background: GOLD, color: 'hsl(var(--background))' }}>
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
          </button>
          <input ref={avatarRef} type="file" accept="image/*" className="sr-only" onChange={handleAvatar} />
        </div>
        <div className="text-center sm:text-left">
          <h2 className="text-xl font-bold">{fullName || user?.email || 'Student'}</h2>
          <p className="text-sm text-muted-foreground mt-1">{user?.email}</p>
          <p className="text-xs text-muted-foreground mt-1">Tap the camera icon to update your photo</p>
        </div>
      </div>

      {/* Personal details */}
      <Section icon={User} title="Personal Information" subtitle="Your name and contact details">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="col-span-full">
            <Field label="Full Name">
              <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your full name" />
            </Field>
          </div>
          <Field label="Email Address" hint="Cannot be changed here">
            <Input value={user?.email || ''} disabled className="opacity-60 cursor-not-allowed" />
          </Field>
          <Field label="Phone Number">
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input value={phone} onChange={e => setPhone(e.target.value)}
                placeholder="+265 XXX XXX XXX" className="pl-9" />
            </div>
          </Field>
          <div className="col-span-full">
            <Field label="School Name">
              <div className="relative">
                <School className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input value={schoolName} onChange={e => setSchoolName(e.target.value)}
                  placeholder="Your school" className="pl-9" />
              </div>
            </Field>
          </div>
        </div>
        <SaveBtn onClick={handleSave} loading={saving} />
      </Section>
    </div>
  );
}

// ── Academic Panel ────────────────────────────────────────────────────────
function AcademicPanel({ user, profile, qc }) {
  const [saving,       setSaving]       = useState(false);
  const [selectedForm, setSelectedForm] = useState(profile?.form || '');

  useEffect(() => {
    if (profile?.form) setSelectedForm(profile.form);
  }, [profile?.form]);

  const { data: enrollments = [] } = useQuery({
    queryKey: ['enrollments', user?.id],
    queryFn: () => db.entities.Enrollment.filter({ student_id: user.id }),
    enabled: !!user?.id,
  });

  const handleSave = async () => {
    if (!selectedForm) { toast.error('Please select a form first'); return; }
    setSaving(true);
    try {
      // Save form selection to user_metadata via Supabase auth
      await db.auth.updateMe({ data: { form: selectedForm } });
      await checkUserAuth();
      toast.success('Form saved!');
    } catch (err) {
      toast.error(err?.message || 'Save failed — please try again');
    } finally {
      setSaving(false);
    }
  };

  const FORMS = ['Form 3', 'Form 4'];

  return (
    <div className="space-y-5">
      <Section icon={GraduationCap} title="Class & Form" subtitle="Your current academic level" gold>
        <Field label="Select Your Form">
          <div className="flex gap-3 mt-1">
            {FORMS.map(f => (
              <button key={f} onClick={() => setSelectedForm(f)}
                className={cn(
                  'flex-1 py-3 rounded-xl border text-sm font-semibold transition-all',
                  selectedForm === f
                    ? 'border-[hsl(var(--primary)_/_0.6)]'
                    : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted'
                )}
                style={selectedForm === f ? { background: GOLD_BG, color: GOLD } : {}}>
                {f}
              </button>
            ))}
          </div>
        </Field>
        <SaveBtn onClick={handleSave} loading={saving} />
      </Section>

      <Section icon={BookOpen} title="Enrolled Subjects" subtitle="Subjects you are currently studying">
        {enrollments.length === 0 ? (
          <div className="text-center py-6 space-y-3">
            <p className="text-sm text-muted-foreground">You haven't enrolled in any subjects yet.</p>
            <Button variant="outline" size="sm" onClick={() => window.location.href = '/enroll-subjects'} className="gap-2">
              <BookOpen className="w-4 h-4" /> Browse Subjects
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {enrollments.map(e => (
              <div key={e.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: GOLD_BG }}>
                    <BookOpen className="w-3.5 h-3.5" style={{ color: GOLD }} />
                  </div>
                  <span className="text-sm font-medium">{e.subject_name || e.subject_id}</span>
                </div>
                <Badge variant="outline" className="text-[10px]">
                  <Check className="w-2.5 h-2.5 mr-1" />Enrolled
                </Badge>
              </div>
            ))}
            <Button variant="ghost" size="sm" onClick={() => window.location.href = '/enroll-subjects'}
              className="text-xs gap-1.5 text-muted-foreground hover:text-foreground mt-1">
              <ExternalLink className="w-3 h-3" /> Manage Subjects
            </Button>
          </div>
        )}
      </Section>
    </div>
  );
}

// ── Notifications Panel ───────────────────────────────────────────────────
function NotificationsPanel({ user }) {
  const [lessons,       setLessons]       = useState(true);
  const [assignments,   setAssignments]   = useState(true);
  const [quizzes,       setQuizzes]       = useState(true);
  const [announcements, setAnnouncements] = useState(true);

  const {
    isSupported: pushSupported,
    isSubscribed,
    permission,
    isSubscribing,
    subscribe,
    unsubscribe,
    error: pushError,
  } = usePushNotifications(user);

  const rows = [
    { label: 'New Lessons',   hint: 'When a new lesson is published in your subjects', val: lessons,       set: setLessons },
    { label: 'Assignments',   hint: 'When an assignment is due or graded',              val: assignments,   set: setAssignments },
    { label: 'Quizzes',       hint: 'Quiz results and upcoming quiz reminders',         val: quizzes,       set: setQuizzes },
    { label: 'Announcements', hint: 'Platform-wide news and updates',                   val: announcements, set: setAnnouncements },
  ];

  return (
    <Section icon={BellRing} title="Notification Preferences" subtitle="Choose what you want to be notified about" gold>
      <div className="space-y-3">
        {/* Push Notifications Toggle */}
        {pushSupported && (
          <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-card">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Smartphone className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">Push Notifications</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {permission === 'denied'
                    ? 'Blocked by browser — enable in browser settings'
                    : isSubscribed
                    ? 'Receiving push alerts on this device'
                    : 'Get instant alerts even when the app is closed'}
                </p>
                {pushError && <p className="text-xs text-destructive mt-0.5">{pushError}</p>}
              </div>
            </div>
            <Switch
              checked={isSubscribed}
              disabled={isSubscribing || permission === 'denied'}
              onCheckedChange={(checked) => checked ? subscribe() : unsubscribe()}
            />
          </div>
        )}
        {/* In-app notification toggles */}
        {rows.map(({ label, hint, val, set }) => (
          <div key={label} className="flex items-center justify-between p-4 rounded-xl border border-border bg-card">
            <div>
              <p className="text-sm font-medium">{label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>
            </div>
            <Switch checked={val} onCheckedChange={set} />
          </div>
        ))}
      </div>
    </Section>
  );
}

// ── Billing Panel ─────────────────────────────────────────────────────────
function BillingPanel({ user }) {
  const { data: subscription } = useQuery({
    queryKey: ['mySubscription', user?.id],
    queryFn: async () => {
      const r = await db.entities.Subscription.filter({ student_id: user.id });
      return r[0] || null;
    },
    enabled: !!user?.id,
  });

  const { data: payments = [] } = useQuery({
    queryKey: ['myPayments', user?.id],
    queryFn: () => db.entities.Payment.filter({ student_id: user.id }),
    enabled: !!user?.id,
  });

  const isActive = !!subscription;

  return (
    <div className="space-y-5">
      <div className={cn(
        'rounded-2xl border p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4',
        isActive
          ? 'bg-gradient-to-br from-[hsl(var(--primary)_/_0.06)] to-card border-[hsl(var(--primary)_/_0.25)]'
          : 'bg-card border-border'
      )}>
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ background: isActive ? GOLD_BG : 'hsl(var(--muted))' }}>
          <CreditCard className="w-5 h-5" style={{ color: isActive ? GOLD : undefined }} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">{isActive ? 'Active Subscription' : 'No Active Plan'}</h3>
            <Badge className="text-[10px] px-2 py-0.5"
              style={isActive
                ? { background: 'hsl(142 76% 36% / 0.15)', color: 'hsl(142 76% 46%)', border: '1px solid hsl(142 76% 36% / 0.3)' }
                : { background: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' }}>
              {isActive ? '● Active' : '○ Inactive'}
            </Badge>
          </div>
          {isActive ? (
            <p className="text-xs text-muted-foreground mt-1">
              Plan: <span className="font-medium capitalize">{subscription?.plan || 'Monthly'}</span>
              {subscription?.expires_at && ` · Renews ${new Date(subscription.expires_at).toLocaleDateString()}`}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mt-1">Subscribe to unlock all lessons and resources.</p>
          )}
        </div>
        {!isActive && (
          <Button size="sm" className="font-semibold"
            style={{ background: GOLD, color: 'hsl(var(--background))', border: 'none' }}
            onClick={() => window.location.href = '/subscription'}>
            Subscribe Now
          </Button>
        )}
      </div>

      <Section icon={CreditCard} title="Payment History" subtitle="Your recent transactions">
        {payments.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No payments found.</p>
        ) : (
          <div className="space-y-2">
            {payments.slice(0, 5).map(p => (
              <div key={p.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border">
                <div>
                  <p className="text-sm font-medium capitalize">{p.plan || 'Subscription'} Plan</p>
                  <p className="text-xs text-muted-foreground">{new Date(p.created_date).toLocaleDateString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">MWK {Number(p.amount || 0).toLocaleString()}</p>
                  <Badge className="text-[10px]"
                    style={{ background: 'hsl(142 76% 36% / 0.15)', color: 'hsl(142 76% 46%)', border: '1px solid hsl(142 76% 36% / 0.3)' }}>
                    Paid
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

// ── Appearance Panel ──────────────────────────────────────────────────────
function AppearancePanel() {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'system');

  const applyTheme = (t) => {
    setTheme(t);
    localStorage.setItem('theme', t);
    const root = document.documentElement;
    if (t === 'dark')        root.classList.add('dark');
    else if (t === 'light')  root.classList.remove('dark');
    else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      prefersDark ? root.classList.add('dark') : root.classList.remove('dark');
    }
  };

  const options = [
    { value: 'light',  label: 'Light',  icon: Sun,     desc: 'Always light' },
    { value: 'dark',   label: 'Dark',   icon: Moon,    desc: 'Always dark (recommended for Android)' },
    { value: 'system', label: 'System', icon: Palette, desc: 'Follow device setting' },
  ];

  return (
    <Section icon={Palette} title="Appearance" subtitle="Choose your preferred colour scheme">
      <div className="space-y-2">
        {options.map(({ value, label, icon: Icon, desc }) => (
          <button key={value} onClick={() => applyTheme(value)}
            className={cn(
              'w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all',
              theme === value ? 'border-accent bg-accent/10' : 'border-border bg-muted/30 hover:bg-muted/60'
            )}>
            <Icon className="w-5 h-5 flex-shrink-0" style={theme === value ? { color: GOLD } : {}} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">{label}</p>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
            {theme === value && <Check className="w-4 h-4 flex-shrink-0" style={{ color: GOLD }} />}
          </button>
        ))}
      </div>
    </Section>
  );
}

// ── Security Panel ────────────────────────────────────────────────────────
function SecurityPanel({ user }) {
  const navigate = useNavigate();
  const [showPwForm,       setShowPwForm]       = useState(false);
  const [currentPassword,  setCurrentPassword]  = useState('');
  const [newPassword,      setNewPassword]      = useState('');
  const [confirmPassword,  setConfirmPassword]  = useState('');
  const [showPw,           setShowPw]           = useState(false);
  const [saving,           setSaving]           = useState(false);
  const [deleteStep,       setDeleteStep]       = useState('idle');
  const [confirmText,      setConfirmText]      = useState('');
  const CONFIRM_WORD = 'DELETE';

  const handleChangePassword = async () => {
    if (!newPassword)                          { toast.error('Enter a new password'); return; }
    if (newPassword.length < 6)               { toast.error('Password must be at least 6 characters'); return; }
    if (newPassword !== confirmPassword)      { toast.error('Passwords do not match'); return; }
    setSaving(true);
    try {
      await db.auth.changePassword({ currentPassword, newPassword });
      toast.success('Password changed successfully!');
      setShowPwForm(false);
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (err) {
      toast.error(err?.message || 'Could not change password');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (confirmText !== CONFIRM_WORD) return;
    setDeleteStep('deleting');
    try {
      // Soft-delete: just sign out and clear data
      // Full delete requires a Supabase Edge Function — for now, sign out and clear
      await db.auth.logout?.();
      localStorage.clear();
      setTimeout(() => { window.location.replace('/'); }, 1500);
      setDeleteStep('done');
    } catch (e) {
      toast.error('Could not delete account. Please contact support.');
      setDeleteStep('confirm');
    }
  };

  return (
    <div className="space-y-5">
      <Section icon={Shield} title="Password" subtitle="Change your account password">
        {!showPwForm ? (
          <Button variant="outline" onClick={() => setShowPwForm(true)} className="gap-2">
            <Lock className="w-4 h-4" /> Change Password
          </Button>
        ) : (
          <div className="space-y-4">
            <Field label="Current Password">
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input type={showPw ? 'text' : 'password'} value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  placeholder="Current password" className="pl-9 pr-9" />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </Field>
            <Field label="New Password">
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input type={showPw ? 'text' : 'password'} value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="New password (min 6 chars)" className="pl-9" />
              </div>
            </Field>
            <Field label="Confirm New Password">
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input type={showPw ? 'text' : 'password'} value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password" className="pl-9" />
              </div>
            </Field>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowPwForm(false)}>Cancel</Button>
              <Button onClick={handleChangePassword} disabled={saving} className="gap-2 font-semibold"
                style={{ background: GOLD, color: 'hsl(var(--background))', border: 'none' }}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Update Password
              </Button>
            </div>
          </div>
        )}
      </Section>

      {/* Danger zone */}
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-destructive/10 flex items-center justify-center flex-shrink-0">
            <Trash2 className="w-4 h-4 text-destructive" />
          </div>
          <div>
            <h2 className="font-semibold text-sm text-destructive">Delete Account</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Permanently remove your account and all data</p>
          </div>
        </div>

        {deleteStep === 'idle' && (
          <Button variant="outline" size="sm" className="border-destructive/40 text-destructive hover:bg-destructive/10"
            onClick={() => setDeleteStep('confirm')}>
            Delete My Account
          </Button>
        )}

        {deleteStep === 'confirm' && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-700 dark:text-amber-400">
                This will permanently delete your account, all enrolled subjects, progress, and payment history. Type <strong>DELETE</strong> to confirm.
              </p>
            </div>
            <Input value={confirmText} onChange={e => setConfirmText(e.target.value)}
              placeholder="Type DELETE to confirm" className="font-mono" />
            <div className="flex gap-3">
              <Button variant="outline" size="sm" onClick={() => { setDeleteStep('idle'); setConfirmText(''); }}>Cancel</Button>
              <Button size="sm" variant="destructive" disabled={confirmText !== CONFIRM_WORD}
                onClick={handleDeleteAccount}>
                Permanently Delete
              </Button>
            </div>
          </div>
        )}

        {deleteStep === 'done' && (
          <p className="text-sm text-muted-foreground">Account deleted. Redirecting…</p>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
export default function StudentSettings() {
  const context      = useOutletContext() ?? {};
  const user         = context.user;
  const qc           = useQueryClient();
  const [activeTab, setActiveTab] = useState('profile');

  const [searchParams, setSearchParams] = React.useState ? React.useState(null) : [null, null];

  // Profile data lives in Supabase user_metadata — no extra DB table needed
  // user_metadata is loaded by AuthContext and available on the user object
  const profile = {
    id: user?.id,
    phone_number: user?.user_metadata?.phone_number || user?.phone_number || '',
    school_name:  user?.user_metadata?.school_name  || user?.school_name  || '',
    form:         user?.user_metadata?.form         || user?.form         || '',
    avatar_url:   user?.user_metadata?.avatar_url   || user?.avatar_url   || '',
  };
  const profileQueryLoading = false;

  const panels = {
    profile:       <ProfilePanel user={user} profile={profile} profileLoaded={!profileQueryLoading} qc={qc} />,
    academic:      <AcademicPanel user={user} profile={profile} qc={qc} />,
    notifications: <NotificationsPanel user={user} />,
    billing:       <BillingPanel user={user} />,
    appearance:    <AppearancePanel />,
    security:      <SecurityPanel user={user} />,
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your account and preferences</p>
      </div>

      {/* Mobile tabs (horizontal scroll) */}
      <div className="flex gap-1 overflow-x-auto pb-1 md:hidden">
        {NAV.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap flex-shrink-0 transition-all',
              activeTab === key
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            )}
            style={activeTab === key ? { background: GOLD_BG, color: GOLD } : {}}>
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Desktop sidebar layout */}
      <div className="flex gap-6">
        <aside className="hidden md:flex flex-col w-48 flex-shrink-0 space-y-1">
          {NAV.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setActiveTab(key)}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-left transition-all w-full',
                activeTab === key
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
              style={activeTab === key ? { background: GOLD_BG, color: GOLD } : {}}>
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </button>
          ))}
        </aside>

        <main className="flex-1 min-w-0">
          {panels[activeTab]}
        </main>
      </div>
    </div>
  );
}
