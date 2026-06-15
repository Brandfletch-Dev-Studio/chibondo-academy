import React, { useState, useEffect, useRef } from 'react';
import { useOutletContext, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';

import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAutosave, AutosaveIndicator } from '@/hooks/useAutosave';
import {
  User, Bell, CreditCard, Sun, Moon, Camera, Loader2, Save,
  GraduationCap, Phone, School, BellRing, Palette, Shield,
  ChevronRight, Star, Check, ExternalLink, BookOpen
} from 'lucide-react';

// Refresh SDK axios Authorization header from the latest token in localStorage.
// appParams.token is frozen at module-load time; this keeps uploads/saves working
// for sessions created after the initial page load (e.g. post-registration flow).
function ensureSdkToken() {
  const t = window.localStorage.getItem('base44_access_token') || window.localStorage.getItem('token');
  if (t) base44.auth.setToken(t);
}

// ── Gold accent tokens ────────────────────────────────────────────────────────
const GOLD        = 'hsl(43 74% 52%)';
const GOLD_BG     = 'hsl(43 74% 52% / 0.12)';
const GOLD_BORDER = 'hsl(43 74% 52% / 0.3)';

// ── Sidebar nav ───────────────────────────────────────────────────────────────
const NAV = [
  { key: 'profile',       label: 'My Profile',    icon: User       },
  { key: 'academic',      label: 'Academic',       icon: GraduationCap },
  { key: 'notifications', label: 'Notifications',  icon: BellRing   },
  { key: 'billing',       label: 'Billing',        icon: CreditCard },
  { key: 'appearance',    label: 'Appearance',     icon: Palette    },
];

// ── Shared sub-components ─────────────────────────────────────────────────────
function Section({ icon: Icon, title, subtitle, children, gold = false }) {
  return (
    <div className={cn(
      'rounded-2xl border p-6 space-y-5',
      gold
        ? 'bg-gradient-to-br from-[hsl(43_74%_52%_/_0.06)] to-card border-[hsl(43_74%_52%_/_0.25)]'
        : 'bg-card border-border'
    )}>
      <div className="flex items-center gap-3">
        <div className={cn(
          'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0',
          gold ? 'bg-[hsl(43_74%_52%_/_0.15)]' : 'bg-muted'
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

function SaveBtn({ onClick, loading, label = 'Save Changes', saveStatus }) {
  return (
    <div className="flex items-center justify-end gap-3 pt-2">
      <AutosaveIndicator status={saveStatus} />
      <Button onClick={onClick} disabled={loading} className="gap-2 px-6 font-semibold"
        style={{ background: GOLD, color: 'hsl(222 47% 8%)', border: 'none' }}>
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

// ═══════════════════════════════════════════════════════════════════════════════
// PANELS
// ═══════════════════════════════════════════════════════════════════════════════

// ── Profile Panel ─────────────────────────────────────────────────────────────
function ProfilePanel({ user, profile, qc }) {
  const { checkUserAuth } = useAuth();
  const avatarRef = useRef();
  const [uploading, setUploading]   = useState(false);
  const [saving, setSaving]         = useState(false);
  const [preview, setPreview]       = useState(user?.avatar_url || '');
  const [confirmedUrl, setConfirmedUrl] = useState(user?.avatar_url || '');
  const [fullName, setFullName]     = useState(user?.full_name || '');
  const [phone, setPhone]           = useState('');
  const [schoolName, setSchoolName] = useState('');

  useEffect(() => {
    setPreview(user?.avatar_url || '');
    setConfirmedUrl(user?.avatar_url || '');
    setFullName(user?.full_name || '');
  }, [user?.id]);

  useEffect(() => {
    if (profile) {
      setPhone(profile.phone_number || '');
      setSchoolName(profile.school_name || '');
    }
  }, [profile?.id]);

  const handleAvatar = async (e) => {
    ensureSdkToken();
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setConfirmedUrl(file_url);
      setPreview(file_url);
      await base44.auth.updateMe({ avatar_url: file_url });
      if (profile?.id) {
        await base44.entities.StudentProfile.update(profile.id, { avatar_url: file_url });
      } else if (user?.id) {
        await base44.entities.StudentProfile.create({ user_id: user.id, avatar_url: file_url });
      }
      await checkUserAuth();
      qc.invalidateQueries({ queryKey: ['studentProfile', user?.id] });
      qc.invalidateQueries({ queryKey: ['studentProfile'] });
      toast.success('Profile photo updated!');
    } catch (err) {
      toast.error('Upload failed: ' + (err?.message || 'Unknown error'));
      setPreview(user?.avatar_url || '');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    ensureSdkToken();
    setSaving(true);
    try {
      await base44.auth.updateMe({ full_name: fullName.trim(), ...(confirmedUrl ? { avatar_url: confirmedUrl } : {}) });
      if (profile?.id) {
        await base44.entities.StudentProfile.update(profile.id, {
          full_name: fullName.trim(),
          phone_number: phone,
          school_name: schoolName,
        });
      } else if (user?.id) {
        await base44.entities.StudentProfile.create({
          user_id: user.id,
          full_name: fullName.trim(),
          phone_number: phone,
          school_name: schoolName,
        });
      }
      await checkUserAuth();
      qc.invalidateQueries({ queryKey: ['studentProfile', user?.id] });
      qc.invalidateQueries({ queryKey: ['studentProfile'] });
      toast.success('Profile saved!');
    } catch (err) {
      toast.error(`Save failed: ${err?.message || 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const { saveStatus: profileSaveStatus } = useAutosave(handleSave, [fullName, phone, schoolName]);

  const initials = (fullName || user?.email || 'S').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="space-y-5">
      {/* Hero avatar card */}
      <div className="rounded-2xl border p-6 bg-gradient-to-br from-[hsl(43_74%_52%_/_0.06)] to-card border-[hsl(43_74%_52%_/_0.25)] flex flex-col sm:flex-row items-center gap-6">
        <div className="relative flex-shrink-0">
          <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-[hsl(43_74%_52%_/_0.4)] shadow-lg">
            {preview
              ? <img src={preview} alt="avatar" className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center text-2xl font-bold"
                  style={{ background: GOLD_BG, color: GOLD }}>{initials}</div>
            }
          </div>
          <button onClick={() => avatarRef.current?.click()} disabled={uploading}
            className="absolute -bottom-2 -right-2 w-8 h-8 rounded-xl flex items-center justify-center shadow-lg border border-border transition-all hover:scale-105"
            style={{ background: GOLD, color: 'hsl(222 47% 8%)' }}>
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
          </button>
          <input ref={avatarRef} type="file" accept="image/*" className="sr-only" onChange={handleAvatar} />
        </div>
        <div className="text-center sm:text-left">
          <div className="flex items-center gap-2 justify-center sm:justify-start">
            <h2 className="text-xl font-bold">{fullName || 'Student'}</h2>
            <Badge className="text-[10px] px-2 py-0.5 font-semibold"
              style={{ background: GOLD_BG, color: GOLD, border: `1px solid ${GOLD_BORDER}` }}>
              <Star className="w-2.5 h-2.5 mr-1 inline" />Student
            </Badge>
          </div>
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
        <SaveBtn onClick={handleSave} loading={saving} saveStatus={profileSaveStatus} />
      </Section>
    </div>
  );
}

// ── Academic Panel ────────────────────────────────────────────────────────────
function AcademicPanel({ user, profile, qc }) {
  const [saving, setSaving]           = useState(false);
  const [selectedForm, setSelectedForm] = useState('');

  useEffect(() => {
    if (profile) setSelectedForm(profile.form || '');
  }, [profile?.id]);

  const { data: enrollments = [] } = useQuery({
    queryKey: ['enrollments', user?.id],
    queryFn: () => base44.entities.Enrollment.filter({ student_id: user.id }),
    enabled: !!user?.id,
  });

  const handleSave = async () => {
    ensureSdkToken();
    setSaving(true);
    try {
      if (profile?.id) {
        await base44.entities.StudentProfile.update(profile.id, { form: selectedForm });
      } else if (user?.id) {
        await base44.entities.StudentProfile.create({ user_id: user.id, form: selectedForm });
      }
      qc.invalidateQueries({ queryKey: ['studentProfile', user?.id] });
      toast.success('Academic info saved!');
    } catch (err) {
      toast.error(`Save failed: ${err?.message || 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const FORMS = ['Form 3', 'Form 4'];

  return (
    <div className="space-y-5">
      <Section icon={GraduationCap} title="Class & Form" subtitle="Your current academic level" gold>
        <div className="space-y-3">
          <Field label="Select Your Form">
            <div className="flex gap-3 mt-1">
              {FORMS.map(f => (
                <button key={f} onClick={() => setSelectedForm(f)}
                  className={cn(
                    'flex-1 py-3 rounded-xl border text-sm font-semibold transition-all',
                    selectedForm === f
                      ? 'border-[hsl(43_74%_52%_/_0.6)] text-foreground'
                      : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted'
                  )}
                  style={selectedForm === f ? { background: GOLD_BG, color: GOLD } : {}}>
                  {f}
                </button>
              ))}
            </div>
          </Field>
        </div>
        <SaveBtn onClick={handleSave} loading={saving} saveStatus={profileSaveStatus} />
      </Section>

      <Section icon={BookOpen} title="Enrolled Subjects" subtitle="Subjects you are currently studying">
        {enrollments.length === 0 ? (
          <div className="text-center py-6 space-y-3">
            <p className="text-sm text-muted-foreground">You haven't enrolled in any subjects yet.</p>
            <Button variant="outline" size="sm" onClick={() => window.location.href = '/enroll-subjects'}
              className="gap-2">
              <BookOpen className="w-4 h-4" /> Browse Subjects
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {enrollments.map(e => (
              <div key={e.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ background: GOLD_BG }}>
                    <BookOpen className="w-3.5 h-3.5" style={{ color: GOLD }} />
                  </div>
                  <span className="text-sm font-medium">{e.subject_name || e.subject_id}</span>
                </div>
                <Badge variant="outline" className="text-[10px]">
                  <Check className="w-2.5 h-2.5 mr-1" />Enrolled
                </Badge>
              </div>
            ))}
            <div className="pt-1">
              <Button variant="ghost" size="sm" onClick={() => window.location.href = '/enroll-subjects'}
                className="text-xs gap-1.5 text-muted-foreground hover:text-foreground">
                <ExternalLink className="w-3 h-3" /> Manage Subjects
              </Button>
            </div>
          </div>
        )}
      </Section>
    </div>
  );
}

// ── Notifications Panel ───────────────────────────────────────────────────────
function NotificationsPanel() {
  const [lessons, setLessons]         = useState(true);
  const [assignments, setAssignments] = useState(true);
  const [quizzes, setQuizzes]         = useState(true);
  const [announcements, setAnnouncements] = useState(true);

  const rows = [
    { label: 'New Lessons',     hint: 'When a new lesson is published in your subjects', val: lessons,       set: setLessons },
    { label: 'Assignments',     hint: 'When an assignment is due or graded',              val: assignments,   set: setAssignments },
    { label: 'Quizzes',         hint: 'Quiz results and upcoming quiz reminders',         val: quizzes,       set: setQuizzes },
    { label: 'Announcements',   hint: 'Platform-wide news and updates',                   val: announcements, set: setAnnouncements },
  ];

  return (
    <div className="space-y-5">
      <Section icon={BellRing} title="Notification Preferences" subtitle="Choose what you want to be notified about" gold>
        <div className="space-y-3">
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
        <SaveBtn onClick={() => toast.success('Notification preferences saved!')} loading={false} />
      </Section>
    </div>
  );
}

// ── Billing Panel ─────────────────────────────────────────────────────────────
function BillingPanel({ user }) {
  const { data: subscription } = useQuery({
    queryKey: ['mySubscription', user?.id],
    queryFn: async () => {
      const r = await base44.entities.Subscription.filter({ student_id: user.id });
      return r[0] || null;
    },
    enabled: !!user?.id,
  });

  const { data: payments = [] } = useQuery({
    queryKey: ['myPayments', user?.id],
    queryFn: () => base44.entities.Payment.filter({ student_id: user.id }),
    enabled: !!user?.id,
  });

  const isActive = !!subscription;

  return (
    <div className="space-y-5">
      {/* Status card */}
      <div className={cn(
        'rounded-2xl border p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4',
        isActive
          ? 'bg-gradient-to-br from-[hsl(43_74%_52%_/_0.06)] to-card border-[hsl(43_74%_52%_/_0.25)]'
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
            style={{ background: GOLD, color: 'hsl(222 47% 8%)', border: 'none' }}
            onClick={() => window.location.href = '/subscription'}>
            Subscribe Now
          </Button>
        )}
      </div>

      {/* Payment history */}
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

// ── Appearance Panel ──────────────────────────────────────────────────────────
function AppearancePanel() {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');

  const setT = (t) => {
    setTheme(t);
    localStorage.setItem('theme', t);
    document.documentElement.classList.toggle('dark', t === 'dark');
    toast.success(`${t === 'dark' ? 'Dark' : 'Light'} mode enabled`);
  };

  return (
    <div className="space-y-5">
      <Section icon={Palette} title="Theme" subtitle="Choose your preferred display mode" gold>
        <div className="grid grid-cols-2 gap-4">
          {[
            { key: 'light', label: 'Light Mode', icon: Sun,  desc: 'Clean white background' },
            { key: 'dark',  label: 'Dark Mode',  icon: Moon, desc: 'Easy on the eyes at night' },
          ].map(({ key, label, icon: Icon, desc }) => (
            <button key={key} onClick={() => setT(key)}
              className={cn(
                'flex flex-col items-center gap-3 p-5 rounded-2xl border transition-all',
                theme === key
                  ? 'border-[hsl(43_74%_52%_/_0.6)]'
                  : 'border-border bg-muted/30 hover:bg-muted/60'
              )}
              style={theme === key ? { background: GOLD_BG } : {}}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={theme === key ? { background: GOLD_BG } : { background: 'hsl(var(--muted))' }}>
                <Icon className="w-5 h-5" style={theme === key ? { color: GOLD } : {}} />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold">{label}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{desc}</p>
              </div>
              {theme === key && (
                <div className="w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ background: GOLD }}>
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}
            </button>
          ))}
        </div>
      </Section>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function StudentSettings() {
  const { user } = useOutletContext() ?? {};
  const [searchParams, setSearchParams] = useSearchParams();
  const qc = useQueryClient();

  const defaultTab = searchParams.get('tab') || 'profile';
  const [active, setActive] = useState(defaultTab);

  useEffect(() => {
    setActive(searchParams.get('tab') || 'profile');
  }, [searchParams]);

  const setTab = (key) => {
    setActive(key);
    setSearchParams({ tab: key }, { replace: true });
  };

  const { data: profile } = useQuery({
    queryKey: ['studentProfile', user?.id],
    queryFn: async () => {
      const r = await base44.entities.StudentProfile.filter({ user_id: user.id });
      return r[0] || null;
    },
    enabled: !!user?.id,
  });

  const panels = {
    profile:       <ProfilePanel       user={user} profile={profile} qc={qc} />,
    academic:      <AcademicPanel      user={user} profile={profile} qc={qc} />,
    notifications: <NotificationsPanel />,
    billing:       <BillingPanel       user={user} />,
    appearance:    <AppearancePanel />,
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 max-w-5xl">
      {/* Sidebar */}
      <aside className="lg:w-56 flex-shrink-0">
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Settings</p>
          </div>
          <nav className="p-2 space-y-0.5">
            {NAV.map(({ key, label, icon: Icon }) => (
              <button key={key} onClick={() => setTab(key)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left',
                  active === key
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                )}
                style={active === key ? { background: GOLD_BG, color: GOLD } : {}}>
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span>{label}</span>
                {active === key && <ChevronRight className="w-3.5 h-3.5 ml-auto" style={{ color: GOLD }} />}
              </button>
            ))}
          </nav>
        </div>
      </aside>

      {/* Main panel */}
      <main className="flex-1 min-w-0">
        {panels[active] || panels.profile}
      </main>
    </div>
  );
}
