import React, { useState, useRef, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import {
  User, School, CreditCard, Bell, Shield, Save, Loader2, Copy, ExternalLink,
  Trash2, Users, BookOpen, Layers, Gift, Mail, Camera, Lock, Globe, Phone,
  MapPin, AtSign, Check, ChevronRight, Sparkles, Settings2, Database,
  Palette, BellRing, Key, Building2, DollarSign, Zap, Star
} from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import EmailTemplateSettings from '@/components/admin/EmailTemplateSettings';
import { cn } from '@/lib/utils';
import { appParams } from '@/lib/app-params';

// ─── Gold accent helpers ──────────────────────────────────────────────────────
const GOLD = 'hsl(43 74% 52%)';
const GOLD_BG = 'hsl(43 74% 52% / 0.12)';
const GOLD_BORDER = 'hsl(43 74% 52% / 0.3)';

// ─── Sidebar nav items ────────────────────────────────────────────────────────
const NAV = [
  { key: 'profile',       label: 'My Profile',       icon: User,       badge: null },
  { key: 'academy',       label: 'Academy Info',      icon: Building2,  badge: null },
  { key: 'pricing',       label: 'Pricing & Plans',   icon: DollarSign, badge: null },
  { key: 'payments',      label: 'Payment Gateway',   icon: CreditCard, badge: 'PayChangu' },
  { key: 'affiliate',     label: 'Affiliate Program', icon: Gift,       badge: null },
  { key: 'emails',        label: 'Email Templates',   icon: Mail,       badge: null },
  { key: 'notifications', label: 'Notifications',     icon: BellRing,   badge: null },
  { key: 'security',      label: 'Security',          icon: Shield,     badge: null },
  { key: 'data',          label: 'Data Management',   icon: Database,   badge: 'Danger', badgeDanger: true },
];

// ─── Section wrapper ──────────────────────────────────────────────────────────
function Section({ icon: Icon, title, subtitle, children, gold = false }) {
  return (
    <div className={cn(
      'rounded-2xl border p-6 space-y-5',
      gold
        ? 'bg-gradient-to-br from-[hsl(43_74%_52%_/_0.06)] to-[hsl(222_47%_11%)] border-[hsl(43_74%_52%_/_0.25)]'
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
          <h2 className="font-display font-semibold text-sm">{title}</h2>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

// ─── Save button ──────────────────────────────────────────────────────────────
function SaveButton({ onClick, loading, label = 'Save Changes' }) {
  return (
    <div className="flex justify-end pt-2">
      <Button onClick={onClick} disabled={loading}
        className="gap-2 px-6 font-semibold"
        style={{ background: GOLD, color: 'hsl(222 47% 8%)', border: 'none' }}>
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        {label}
      </Button>
    </div>
  );
}

// ─── Field row ────────────────────────────────────────────────────────────────
function Field({ label, hint, children }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</Label>
      {hint && <p className="text-[11px] text-muted-foreground -mt-1">{hint}</p>}
      {children}
    </div>
  );
}

// ─── Entity list for data management ─────────────────────────────────────────
const ENTITY_LIST = [
  { key: 'StudentProfile',     label: 'Student Profiles',   icon: Users },
  { key: 'Enrollment',         label: 'Enrollments',        icon: BookOpen },
  { key: 'Payment',            label: 'Payments',           icon: CreditCard },
  { key: 'Subscription',       label: 'Subscriptions',      icon: CreditCard },
  { key: 'Referral',           label: 'Referrals',          icon: Gift },
  { key: 'Lesson',             label: 'Lessons',            icon: Layers },
  { key: 'Subject',            label: 'Courses',            icon: BookOpen },
  { key: 'Topic',              label: 'Topics',             icon: Layers },
  { key: 'TeacherApplication', label: 'Tutor Applications', icon: Users },
];

// ═══════════════════════════════════════════════════════════════════════════
// PANEL COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

// ── Profile Panel ─────────────────────────────────────────────────────────────
function ProfilePanel({ user }) {
  const qc = useQueryClient();
  const avatarRef = useRef();
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(user?.avatar_url || '');
  const [form, setForm] = useState({
    full_name: user?.full_name || '',
    email: user?.email || '',
    phone: '',
    bio: '',
    location: '',
    website: '',
  });

  // Load any extended profile data
  const { data: profile } = useQuery({
    queryKey: ['adminProfile', user?.id],
    queryFn: async () => {
      const r = await base44.entities.StudentProfile.filter({ user_id: user.id });
      return r[0] || null;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (profile) {
      setForm(f => ({
        ...f,
        phone: profile.phone_number || '',
        bio: profile.bio || '',
        location: profile.location || profile.school_name || '',
        website: profile.website || '',
      }));
    }
  }, [profile]);

  useEffect(() => {
    setPreview(user?.avatar_url || '');
    setForm(f => ({
      ...f,
      full_name: user?.full_name || '',
      email: user?.email || '',
    }));
  }, [user?.id]);

  const handleAvatar = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.auth.updateMe({ avatar_url: file_url });
      setPreview(file_url);
      qc.invalidateQueries({ queryKey: ['currentUser'] });
      toast.success('Profile photo updated');
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await base44.auth.updateMe({ full_name: form.full_name });
      if (profile?.id) {
        await base44.entities.StudentProfile.update(profile.id, {
          phone_number: form.phone,
          bio: form.bio,
          school_name: form.location,
          website: form.website,
        });
      } else if (user?.id) {
        await base44.entities.StudentProfile.create({
          user_id: user.id,
          phone_number: form.phone,
          bio: form.bio,
          school_name: form.location,
          website: form.website,
          full_name: form.full_name,
        });
      }
      qc.invalidateQueries({ queryKey: ['currentUser'] });
      qc.invalidateQueries({ queryKey: ['adminProfile', user?.id] });
      toast.success('Profile saved');
    } catch (e) {
      toast.error('Save failed: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const initials = (form.full_name || 'A').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="space-y-5">
      {/* Hero avatar card */}
      <div className="rounded-2xl border p-6 bg-gradient-to-br from-[hsl(43_74%_52%_/_0.06)] to-[hsl(222_47%_11%)] border-[hsl(43_74%_52%_/_0.25)] flex flex-col sm:flex-row items-center gap-6">
        <div className="relative flex-shrink-0">
          <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-[hsl(43_74%_52%_/_0.4)] shadow-lg">
            {preview
              ? <img src={preview} alt="avatar" className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center text-2xl font-display font-bold"
                  style={{ background: GOLD_BG, color: GOLD }}>{initials}</div>
            }
          </div>
          <button onClick={() => avatarRef.current?.click()}
            disabled={uploading}
            className="absolute -bottom-2 -right-2 w-8 h-8 rounded-xl flex items-center justify-center shadow-lg border border-border transition-all hover:scale-105"
            style={{ background: GOLD, color: 'hsl(222 47% 8%)' }}>
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
          </button>
          <input ref={avatarRef} type="file" accept="image/*" className="sr-only" onChange={handleAvatar} />
        </div>
        <div className="text-center sm:text-left">
          <div className="flex items-center gap-2 justify-center sm:justify-start">
            <h2 className="text-xl font-display font-bold">{form.full_name || 'Administrator'}</h2>
            <Badge className="text-[10px] px-2 py-0.5 font-semibold" style={{ background: GOLD_BG, color: GOLD, border: `1px solid ${GOLD_BORDER}` }}>
              <Star className="w-2.5 h-2.5 mr-1" />Admin
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">{form.email}</p>
          <p className="text-xs text-muted-foreground mt-1">The Chibondo Academy · Platform Administrator</p>
        </div>
      </div>

      {/* Form */}
      <Section icon={User} title="Personal Information" subtitle="Your public-facing admin identity">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Full Name">
            <Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Your full name" />
          </Field>
          <Field label="Email Address" hint="Used for platform notifications">
            <Input value={form.email} disabled className="opacity-60 cursor-not-allowed" />
          </Field>
          <Field label="Phone Number">
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+265 999 000 000" className="pl-9" />
            </div>
          </Field>
          <Field label="Location">
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Lilongwe, Malawi" className="pl-9" />
            </div>
          </Field>
          <div className="col-span-full">
            <Field label="Bio / About">
              <Textarea value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
                placeholder="Brief bio visible in admin audit logs and platform reports…"
                className="resize-none" rows={3} />
            </Field>
          </div>
          <Field label="Website / LinkedIn">
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} placeholder="https://..." className="pl-9" />
            </div>
          </Field>
        </div>
        <SaveButton onClick={handleSave} loading={saving} />
      </Section>
    </div>
  );
}

// ── Academy Info Panel ────────────────────────────────────────────────────────
function AcademyPanel() {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    school_name: 'The Chibondo Academy',
    tagline: 'Excellence in Malawian Secondary Education',
    contact_email: 'admin@chibondo.mw',
    contact_phone: '+265 999 000 000',
    address: 'Lilongwe, Malawi',
    website: 'https://chibondoacademy.com',
    about: '',
    logo_url: '',
    social_facebook: '',
    social_twitter: '',
    social_instagram: '',
    social_whatsapp: '',
  });

  // Load saved academy settings from DB
  const { data: savedSettings } = useQuery({
    queryKey: ['platformSettings', 'academy'],
    queryFn: () => base44.entities.PlatformSettings.filter({ key: 'academy' }),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (savedSettings?.[0]?.value) {
      setForm(f => ({ ...f, ...savedSettings[0].value }));
    }
  }, [savedSettings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await base44.functions.invoke('savePlatformSettings', { planKey: 'academy', value: form });
      toast.success('Academy info saved');
    } catch (e) {
      toast.error('Save failed: ' + (e.message || ''));
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      <Section icon={Building2} title="Academy Identity" subtitle="Public-facing name, tagline and contact info" gold>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="col-span-full">
            <Field label="Academy Name">
              <Input value={form.school_name} onChange={e => setForm(f => ({ ...f, school_name: e.target.value }))} />
            </Field>
          </div>
          <div className="col-span-full">
            <Field label="Tagline">
              <Input value={form.tagline} onChange={e => setForm(f => ({ ...f, tagline: e.target.value }))} placeholder="Short slogan shown on landing page" />
            </Field>
          </div>
          <Field label="Contact Email">
            <div className="relative">
              <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} className="pl-9" />
            </div>
          </Field>
          <Field label="Contact Phone">
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input value={form.contact_phone} onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))} className="pl-9" />
            </div>
          </Field>
          <Field label="Office Address">
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className="pl-9" />
            </div>
          </Field>
          <Field label="Website URL">
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} className="pl-9" />
            </div>
          </Field>
          <div className="col-span-full">
            <Field label="About the Academy">
              <Textarea value={form.about} onChange={e => setForm(f => ({ ...f, about: e.target.value }))}
                placeholder="2–3 sentences used on the about page and SEO…" rows={3} className="resize-none" />
            </Field>
          </div>
        </div>
        <SaveButton onClick={handleSave} loading={saving} />
      </Section>

      <Section icon={Globe} title="Social Media Links" subtitle="Linked from the platform footer">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { key: 'social_facebook', label: 'Facebook', placeholder: 'https://facebook.com/...' },
            { key: 'social_twitter',  label: 'Twitter / X', placeholder: 'https://x.com/...' },
            { key: 'social_instagram',label: 'Instagram', placeholder: 'https://instagram.com/...' },
            { key: 'social_whatsapp', label: 'WhatsApp Business', placeholder: 'https://wa.me/...' },
          ].map(({ key, label, placeholder }) => (
            <Field key={key} label={label}>
              <Input value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} placeholder={placeholder} />
            </Field>
          ))}
        </div>
        <SaveButton onClick={handleSave} loading={saving} />
      </Section>
    </div>
  );
}

// ── Pricing Panel ─────────────────────────────────────────────────────────────
function PricingPanel() {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    monthly_price: 10000,
    annual_price: 80000,
    biannual_price: 150000,
    currency: 'MWK',
    free_lessons_per_subject: 2,
    trial_enabled: true,
    trial_days: 7,
  });

  // Load saved pricing from DB
  const { data: savedPricing } = useQuery({
    queryKey: ['platformSettings', 'pricing'],
    queryFn: () => base44.entities.PlatformSettings.filter({ key: 'pricing' }),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (savedPricing?.[0]?.value) {
      setForm(f => ({ ...f, ...savedPricing[0].value }));
    }
  }, [savedPricing]);

  const plans = [
    { key: 'monthly_price',  label: 'Monthly',   period: '/month',  icon: '📅', saving: null },
    { key: 'annual_price',   label: 'Annual',    period: '/year',   icon: '🏆', saving: 'Save 33%' },
    { key: 'biannual_price', label: 'Bi-Annual', period: '/2 years',icon: '⭐', saving: 'Save 37%' },
  ];

  const handleSave = async () => {
    setSaving(true);
    try {
      await base44.functions.invoke('savePlatformSettings', { planKey: 'pricing', value: form });
      toast.success('Pricing updated');
    } catch { toast.error('Save failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      <Section icon={DollarSign} title="Subscription Plans" subtitle="Set pricing for each plan in MWK" gold>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {plans.map(({ key, label, period, icon, saving }) => (
            <div key={key} className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{icon} {label}</span>
                {saving && <Badge className="text-[10px]" style={{ background: GOLD_BG, color: GOLD, border: `1px solid ${GOLD_BORDER}` }}>{saving}</Badge>}
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Price (MWK)</Label>
                <Input type="number" value={form[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: Number(e.target.value) }))}
                  className="mt-1 font-mono" />
              </div>
              <p className="text-xs text-muted-foreground">MWK {Number(form[key]).toLocaleString()}{period}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border">
          <Field label="Free Lessons per Subject" hint="Visible before requiring subscription">
            <Input type="number" value={form.free_lessons_per_subject}
              onChange={e => setForm(f => ({ ...f, free_lessons_per_subject: Number(e.target.value) }))} />
          </Field>
          <Field label="Currency">
            <Select value={form.currency} onValueChange={v => setForm(f => ({ ...f, currency: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="MWK">MWK — Malawian Kwacha</SelectItem>
                <SelectItem value="USD">USD — US Dollar</SelectItem>
                <SelectItem value="ZAR">ZAR — South African Rand</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
        <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-card">
          <div>
            <p className="text-sm font-medium">Free Trial</p>
            <p className="text-xs text-muted-foreground">New students get a free trial period</p>
          </div>
          <div className="flex items-center gap-3">
            {form.trial_enabled && (
              <div className="flex items-center gap-2">
                <Input type="number" value={form.trial_days}
                  onChange={e => setForm(f => ({ ...f, trial_days: Number(e.target.value) }))}
                  className="w-16 text-center text-sm" />
                <span className="text-xs text-muted-foreground">days</span>
              </div>
            )}
            <Switch checked={form.trial_enabled} onCheckedChange={v => setForm(f => ({ ...f, trial_enabled: v }))} />
          </div>
        </div>
        <SaveButton onClick={handleSave} loading={saving} />
      </Section>
    </div>
  );
}

// ── Payments Panel ────────────────────────────────────────────────────────────
function PaymentsPanel() {
  const [copied, setCopied] = useState(false);
  const webhookUrl = `https://api.base44.com/api/apps/6a2115bb078a7219b5cbd8b0/functions/payChanguWebhook`;

  const copy = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    toast.success('Webhook URL copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-5">
      <Section icon={CreditCard} title="PayChangu Integration" subtitle="Malawian payment gateway configuration" gold>
        {/* Status badge */}
        <div className="flex items-center gap-3 p-4 rounded-xl border border-[hsl(43_74%_52%_/_0.2)] bg-[hsl(43_74%_52%_/_0.05)]">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <p className="text-sm font-medium">PayChangu webhook endpoint is active</p>
          <Badge className="ml-auto text-[10px]" style={{ background: 'hsl(142 76% 36% / 0.15)', color: 'hsl(142 76% 46%)', border: '1px solid hsl(142 76% 36% / 0.3)' }}>Live</Badge>
        </div>

        <Field label="Webhook URL" hint="Paste this into your PayChangu dashboard → Settings → Webhooks">
          <div className="flex gap-2">
            <Input readOnly value={webhookUrl} className="font-mono text-xs" />
            <Button variant="outline" size="icon" onClick={copy} className="flex-shrink-0">
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
        </Field>

        <a href="https://dashboard.paychangu.com" target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm font-medium transition-colors hover:underline"
          style={{ color: GOLD }}>
          <ExternalLink className="w-3.5 h-3.5" /> Open PayChangu Dashboard
        </a>
      </Section>

      <Section icon={Zap} title="How Payments Work">
        <div className="space-y-2">
          {[
            'Student selects a plan and clicks Pay',
            'PayChangu processes the payment (mobile money / card)',
            'Webhook fires to this endpoint automatically',
            'Subscription is activated and student gains full access',
          ].map((step, i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-muted/40">
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
                style={{ background: GOLD_BG, color: GOLD }}>{i + 1}</div>
              <p className="text-sm text-muted-foreground">{step}</p>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

// ── Affiliate Panel ───────────────────────────────────────────────────────────
function AffiliatePanel() {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    enabled: true,
    commission_amount: 10000,
    min_payout: 5000,
    payout_schedule: 'monthly',
    cookie_days: 30,
  });

  const { data: settingsData = [] } = useQuery({
    queryKey: ['affiliateSettings'],
    queryFn: () => base44.entities.PlatformSettings.filter({ key: 'affiliate_commission' }),
  });

  useEffect(() => {
    if (settingsData[0]?.value) {
      const v = settingsData[0].value;
      setForm(f => ({ ...f, ...v }));
    }
  }, [settingsData]);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (settingsData[0]?.id) {
        await base44.entities.PlatformSettings.update(settingsData[0].id, { value: form });
      } else {
        await base44.entities.PlatformSettings.create({ key: 'affiliate_commission', value: form, description: 'Affiliate program configuration' });
      }
      toast.success('Affiliate settings saved');
    } catch (e) { toast.error('Save failed: ' + e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      <Section icon={Gift} title="Affiliate Program" subtitle="Referral commissions and payout rules" gold>
        <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-card">
          <div>
            <p className="text-sm font-semibold">Affiliate Program Enabled</p>
            <p className="text-xs text-muted-foreground">Allow users to earn commissions by referring new students</p>
          </div>
          <Switch checked={form.enabled} onCheckedChange={v => setForm(f => ({ ...f, enabled: v }))} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Commission Per Referral (MWK)" hint="Fixed amount paid when a referred student subscribes">
            <Input type="number" value={form.commission_amount}
              onChange={e => setForm(f => ({ ...f, commission_amount: Number(e.target.value) }))} className="font-mono" />
          </Field>
          <Field label="Minimum Payout (MWK)" hint="Affiliate must earn at least this to request payout">
            <Input type="number" value={form.min_payout}
              onChange={e => setForm(f => ({ ...f, min_payout: Number(e.target.value) }))} className="font-mono" />
          </Field>
          <Field label="Payout Schedule">
            <Select value={form.payout_schedule} onValueChange={v => setForm(f => ({ ...f, payout_schedule: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="manual">Manual (on request)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Referral Cookie Duration" hint="Days the referral link stays attributed to the affiliate">
            <div className="flex items-center gap-2">
              <Input type="number" value={form.cookie_days}
                onChange={e => setForm(f => ({ ...f, cookie_days: Number(e.target.value) }))} className="font-mono" />
              <span className="text-sm text-muted-foreground flex-shrink-0">days</span>
            </div>
          </Field>
        </div>

        {/* Preview card */}
        <div className="rounded-xl p-4 border border-[hsl(43_74%_52%_/_0.2)] bg-[hsl(43_74%_52%_/_0.04)] space-y-1.5">
          <p className="text-xs font-semibold" style={{ color: GOLD }}>Current Affiliate Rules</p>
          <p className="text-sm text-muted-foreground">Earn <strong className="text-foreground">MWK {Number(form.commission_amount).toLocaleString()}</strong> per successful referral · Min payout <strong className="text-foreground">MWK {Number(form.min_payout).toLocaleString()}</strong> · Paid <strong className="text-foreground">{form.payout_schedule}</strong></p>
        </div>

        <SaveButton onClick={handleSave} loading={saving} />
      </Section>
    </div>
  );
}

// ── Notifications Panel ───────────────────────────────────────────────────────
function NotificationsPanel() {
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    email_on_enrollment: true,
    email_on_payment: true,
    email_on_submission: false,
    email_on_new_teacher: true,
    email_on_payout_request: true,
    push_new_messages: true,
    push_system_alerts: true,
  });

  // Load saved notification preferences from DB
  const { data: savedNotif } = useQuery({
    queryKey: ['platformSettings', 'notifications'],
    queryFn: () => base44.entities.PlatformSettings.filter({ key: 'notifications' }),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (savedNotif?.[0]?.value) {
      setSettings(s => ({ ...s, ...savedNotif[0].value }));
    }
  }, [savedNotif]);

  const NOTIF_ITEMS = [
    { key: 'email_on_enrollment',    label: 'New Enrollment',      desc: 'Email when a student enrolls in a course',    icon: BookOpen },
    { key: 'email_on_payment',       label: 'Payment Received',    desc: 'Email on every successful payment',           icon: CreditCard },
    { key: 'email_on_submission',    label: 'Assignment Submitted',desc: 'Email when a student submits an assignment',   icon: Layers },
    { key: 'email_on_new_teacher',   label: 'New Tutor Application',desc: 'Email when a teacher applies to join',        icon: Users },
    { key: 'email_on_payout_request',label: 'Payout Request',     desc: 'Email when an affiliate requests payout',     icon: Gift },
  ];

  const handleSave = async () => {
    setSaving(true);
    try {
      await base44.functions.invoke('savePlatformSettings', { planKey: 'notifications', value: settings });
      toast.success('Notification preferences saved');
    } catch { toast.error('Save failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      <Section icon={BellRing} title="Email Notifications" subtitle="Choose which events trigger admin emails">
        <div className="space-y-2">
          {NOTIF_ITEMS.map(({ key, label, desc, icon: Icon }) => (
            <div key={key} className="flex items-center justify-between p-3.5 rounded-xl border border-border hover:border-[hsl(43_74%_52%_/_0.2)] transition-colors bg-card">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                  <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
              </div>
              <Switch checked={settings[key]} onCheckedChange={v => setSettings(s => ({ ...s, [key]: v }))} />
            </div>
          ))}
        </div>
        <SaveButton onClick={handleSave} loading={saving} />
      </Section>
    </div>
  );
}

// ── Security Panel ────────────────────────────────────────────────────────────
function SecurityPanel() {
  const [savingPwd, setSavingPwd] = useState(false);
  const [pwdForm, setPwdForm] = useState({ current: '', new: '', confirm: '' });
  const [settings, setSettings] = useState({
    require_email_verification: true,
    allow_google_oauth: true,
    session_timeout_hours: 24,
    max_login_attempts: 5,
  });

  const handleChangePassword = async () => {
    if (pwdForm.new !== pwdForm.confirm) { toast.error('New passwords do not match'); return; }
    if (pwdForm.new.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    setSavingPwd(true);
    try {
      await base44.auth.changePassword({ current_password: pwdForm.current, new_password: pwdForm.new });
      toast.success('Password changed successfully');
      setPwdForm({ current: '', new: '', confirm: '' });
    } catch (e) {
      toast.error(e.message || 'Failed to change password');
    } finally { setSavingPwd(false); }
  };

  // Load saved security settings
  const { data: savedSecurity } = useQuery({
    queryKey: ['platformSettings', 'security'],
    queryFn: () => base44.entities.PlatformSettings.filter({ key: 'security' }),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (savedSecurity?.[0]?.value) {
      setSettings(s => ({ ...s, ...savedSecurity[0].value }));
    }
  }, [savedSecurity]);

  const [savingSettings, setSavingSettings] = useState(false);
  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await base44.functions.invoke('savePlatformSettings', { planKey: 'security', value: settings });
      toast.success('Security settings saved');
    } catch (e) {
      toast.error('Save failed: ' + (e.message || ''));
    } finally { setSavingSettings(false); }
  };

  return (
    <div className="space-y-5">
      <Section icon={Lock} title="Change Password" subtitle="Update your admin account password">
        <div className="space-y-3 max-w-md">
          <Field label="Current Password">
            <Input type="password" value={pwdForm.current} onChange={e => setPwdForm(f => ({ ...f, current: e.target.value }))} placeholder="••••••••" />
          </Field>
          <Field label="New Password">
            <Input type="password" value={pwdForm.new} onChange={e => setPwdForm(f => ({ ...f, new: e.target.value }))} placeholder="Min. 8 characters" />
          </Field>
          <Field label="Confirm New Password">
            <Input type="password" value={pwdForm.confirm} onChange={e => setPwdForm(f => ({ ...f, confirm: e.target.value }))} placeholder="Repeat new password" />
          </Field>
        </div>
        <SaveButton onClick={handleChangePassword} loading={savingPwd} label="Change Password" />
      </Section>

      <Section icon={Shield} title="Platform Security">
        <div className="space-y-2">
          {[
            { key: 'require_email_verification', label: 'Require Email Verification', desc: 'New students must verify their email before accessing content' },
            { key: 'allow_google_oauth', label: 'Allow Google Sign-In', desc: 'Students can sign in with their Google account' },
          ].map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-card">
              <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
              <Switch checked={settings[key]} onCheckedChange={v => setSettings(s => ({ ...s, [key]: v }))} />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border">
          <Field label="Session Timeout" hint="Hours of inactivity before auto-logout">
            <Input type="number" value={settings.session_timeout_hours}
              onChange={e => setSettings(s => ({ ...s, session_timeout_hours: Number(e.target.value) }))} />
          </Field>
          <Field label="Max Login Attempts" hint="Attempts before temporary lockout">
            <Input type="number" value={settings.max_login_attempts}
              onChange={e => setSettings(s => ({ ...s, max_login_attempts: Number(e.target.value) }))} />
          </Field>
        </div>
        <SaveButton onClick={handleSaveSettings} loading={savingSettings} label="Save Security Settings" />
      </Section>
    </div>
  );
}

// ── Data Management Panel ─────────────────────────────────────────────────────
function DataPanel() {
  const [deleting, setDeleting] = useState(null);
  const deleteMutation = useMutation({
    mutationFn: async (entityKey) => {
      const entity = base44.entities[entityKey];
      let total = 0;
      // Paginate to handle entities with >500 records
      while (true) {
        const records = await entity.filter({}, 'created_date', 500);
        if (records.length === 0) break;
        await Promise.all(records.map(r => entity.delete(r.id)));
        total += records.length;
        if (records.length < 500) break;
      }
      return total;
    },
    onSuccess: (count, entityKey) => {
      toast.success(`Deleted ${count} records from ${entityKey}`);
      setDeleting(null);
    },
    onError: (err) => {
      toast.error('Delete failed: ' + err.message);
      setDeleting(null);
    },
  });

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Trash2 className="w-4 h-4 text-destructive" />
        </div>
        <div>
          <p className="text-sm font-semibold text-destructive">Danger Zone</p>
          <p className="text-xs text-muted-foreground mt-0.5">These actions are permanent and cannot be undone. Proceed with caution.</p>
        </div>
      </div>

      <Section icon={Database} title="Clear Entity Data" subtitle="Permanently delete all records from a collection">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {ENTITY_LIST.map(({ key, label, icon: Icon }) => (
            <AlertDialog key={key}>
              <AlertDialogTrigger asChild>
                <button className="flex items-center gap-3 p-3 rounded-xl border border-border hover:border-destructive/40 hover:bg-destructive/5 transition-all text-left group">
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center group-hover:bg-destructive/10 flex-shrink-0">
                    <Icon className="w-4 h-4 text-muted-foreground group-hover:text-destructive" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{label}</p>
                    <p className="text-xs text-muted-foreground">Delete all records</p>
                  </div>
                  <Trash2 className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-destructive flex-shrink-0" />
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete all {label}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete <strong>all records</strong> in <strong>{label}</strong>. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => { setDeleting(key); deleteMutation.mutate(key); }}
                    disabled={deleteMutation.isPending && deleting === key}>
                    {deleteMutation.isPending && deleting === key
                      ? <><Loader2 className="w-4 h-4 animate-spin mr-1.5" />Deleting...</>
                      : 'Yes, Delete All'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ))}
        </div>
      </Section>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════
export default function AdminSettings() {
  const { user } = useOutletContext() ?? {};
  const [active, setActive] = useState('profile');

  const PANELS = {
    profile:       <ProfilePanel user={user} />,
    academy:       <AcademyPanel />,
    pricing:       <PricingPanel />,
    payments:      <PaymentsPanel />,
    affiliate:     <AffiliatePanel />,
    emails:        <EmailTemplateSettings />,
    notifications: <NotificationsPanel />,
    security:      <SecurityPanel />,
    data:          <DataPanel />,
  };

  return (
    <div className="min-h-screen">
      {/* Page header */}
      <div className="mb-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: GOLD_BG }}>
          <Settings2 className="w-5 h-5" style={{ color: GOLD }} />
        </div>
        <div>
          <h1 className="text-2xl font-display font-bold">Settings</h1>
          <p className="text-sm text-muted-foreground">Manage your platform, profile and configurations</p>
        </div>
        <Badge className="ml-auto hidden sm:flex items-center gap-1.5 px-3 py-1 text-xs font-semibold"
          style={{ background: GOLD_BG, color: GOLD, border: `1px solid ${GOLD_BORDER}` }}>
          <Sparkles className="w-3 h-3" /> Admin
        </Badge>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* ── Sidebar nav ── */}
        <nav className="w-full lg:w-56 flex-shrink-0">
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            {/* Mini profile in sidebar */}
            <div className="p-4 border-b border-border flex items-center gap-3"
              style={{ background: 'hsl(222 47% 11%)' }}>
              <div className="w-9 h-9 rounded-xl overflow-hidden border border-[hsl(43_74%_52%_/_0.3)] flex-shrink-0">
                {user?.avatar_url
                  ? <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-sm font-bold"
                      style={{ background: GOLD_BG, color: GOLD }}>
                      {(user?.full_name || 'A')[0].toUpperCase()}
                    </div>
                }
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate">{user?.full_name || 'Administrator'}</p>
                <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
              </div>
            </div>

            {/* Nav items */}
            <div className="p-2 space-y-0.5">
              {NAV.map(({ key, label, icon: Icon, badge, badgeDanger }) => (
                <button key={key} onClick={() => setActive(key)}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all text-left',
                    active === key
                      ? 'font-semibold'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  )}
                  style={active === key ? { background: GOLD_BG, color: GOLD } : {}}>
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1 truncate">{label}</span>
                  {badge && (
                    <span className={cn(
                      'text-[9px] px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0',
                      badgeDanger
                        ? 'bg-destructive/10 text-destructive'
                        : 'bg-muted text-muted-foreground'
                    )}>{badge}</span>
                  )}
                  {active === key && <ChevronRight className="w-3 h-3 flex-shrink-0" />}
                </button>
              ))}
            </div>
          </div>
        </nav>

        {/* ── Panel content ── */}
        <div className="flex-1 min-w-0">
          {PANELS[active]}
        </div>
      </div>
    </div>
  );
}

