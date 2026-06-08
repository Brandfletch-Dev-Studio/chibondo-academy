import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { UserCog, Smartphone, Building2, Bell, Save, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

export default function AffiliateProfile() {
  const { user } = useOutletContext() || {};
  const qc = useQueryClient();

  const [profile, setProfile] = useState({
    full_name:    user?.full_name    || '',
    email:        user?.email        || '',
    phone:        user?.phone        || '',
    whatsapp:     user?.whatsapp     || '',
  });

  const [payment, setPayment] = useState({
    preferred_method: user?.preferred_payment_method || 'airtel_money',
    airtel_number:    user?.airtel_number    || '',
    tnm_number:       user?.tnm_number       || '',
    bank_name:        user?.bank_name        || '',
    bank_account:     user?.bank_account     || '',
    bank_holder:      user?.bank_holder      || '',
  });

  const [notifs, setNotifs] = useState({
    email_notifications:    user?.email_notifications    !== false,
    inapp_notifications:    user?.inapp_notifications    !== false,
  });

  useEffect(() => {
    if (user) {
      setProfile({ full_name: user.full_name || '', email: user.email || '', phone: user.phone || '', whatsapp: user.whatsapp || '' });
      setPayment({
        preferred_method: user.preferred_payment_method || 'airtel_money',
        airtel_number: user.airtel_number || '',
        tnm_number: user.tnm_number || '',
        bank_name: user.bank_name || '',
        bank_account: user.bank_account || '',
        bank_holder: user.bank_holder || '',
      });
      setNotifs({ email_notifications: user.email_notifications !== false, inapp_notifications: user.inapp_notifications !== false });
    }
  }, [user?.id]);

  const saveMut = useMutation({
    mutationFn: () => base44.auth.updateMe({ ...profile, ...payment, ...notifs }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['currentUser'] });
      toast.success('Profile saved!');
    },
    onError: () => toast.error('Failed to save. Please try again.'),
  });

  const Section = ({ title, icon: Icon, children }) => (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-border">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <h3 className="font-semibold text-sm">{title}</h3>
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  );

  const Field = ({ label, value, onChange, type = 'text', placeholder, disabled }) => (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} disabled={disabled}
        className={disabled ? 'opacity-60 cursor-not-allowed' : ''} />
    </div>
  );

  return (
    <div className="space-y-5 max-w-xl">
      {/* Personal info */}
      <Section title="Personal Information" icon={UserCog}>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Full Name" value={profile.full_name}
            onChange={v => setProfile(p => ({ ...p, full_name: v }))} placeholder="Your full name" />
          <Field label="Email Address" value={profile.email}
            onChange={v => setProfile(p => ({ ...p, email: v }))} type="email" placeholder="email@example.com" />
          <Field label="Phone Number" value={profile.phone}
            onChange={v => setProfile(p => ({ ...p, phone: v }))} placeholder="+265 9XX XXX XXX" />
          <Field label="WhatsApp Number" value={profile.whatsapp}
            onChange={v => setProfile(p => ({ ...p, whatsapp: v }))} placeholder="+265 9XX XXX XXX" />
        </div>
      </Section>

      {/* Payment methods */}
      <Section title="Payment Methods" icon={Smartphone}>
        <p className="text-xs text-muted-foreground -mt-1">Set up your preferred payment method to receive commissions.</p>

        {/* Airtel Money */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-red-500/10 flex items-center justify-center">
              <Smartphone className="w-3.5 h-3.5 text-red-500" />
            </div>
            <p className="text-sm font-medium">Airtel Money</p>
          </div>
          <Input value={payment.airtel_number} onChange={e => setPayment(p => ({ ...p, airtel_number: e.target.value }))}
            placeholder="Airtel Money phone number" />
        </div>

        {/* TNM Mpamba */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-blue-500/10 flex items-center justify-center">
              <Smartphone className="w-3.5 h-3.5 text-blue-500" />
            </div>
            <p className="text-sm font-medium">TNM Mpamba</p>
          </div>
          <Input value={payment.tnm_number} onChange={e => setPayment(p => ({ ...p, tnm_number: e.target.value }))}
            placeholder="TNM Mpamba phone number" />
        </div>

        {/* Bank */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-muted flex items-center justify-center">
              <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">Bank Account</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-2">
            <Input value={payment.bank_name} onChange={e => setPayment(p => ({ ...p, bank_name: e.target.value }))} placeholder="Bank name" />
            <Input value={payment.bank_account} onChange={e => setPayment(p => ({ ...p, bank_account: e.target.value }))} placeholder="Account number" />
            <Input value={payment.bank_holder} onChange={e => setPayment(p => ({ ...p, bank_holder: e.target.value }))} placeholder="Account holder name" />
          </div>
        </div>
      </Section>

      {/* Notifications */}
      <Section title="Notification Preferences" icon={Bell}>
        {[
          { key: 'email_notifications', label: 'Email Notifications', sub: 'Get notified via email when referrals register or pay fees' },
          { key: 'inapp_notifications', label: 'In-App Notifications', sub: 'Receive notifications inside the platform' },
        ].map(({ key, label, sub }) => (
          <div key={key} className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">{label}</p>
              <p className="text-xs text-muted-foreground">{sub}</p>
            </div>
            <Switch checked={notifs[key]} onCheckedChange={v => setNotifs(n => ({ ...n, [key]: v }))} />
          </div>
        ))}
      </Section>

      {/* Save */}
      <Button
        onClick={() => saveMut.mutate()}
        disabled={saveMut.isPending}
        className="w-full"
        style={{ background: 'hsl(43 74% 52%)', color: 'hsl(222 47% 11%)' }}
      >
        {saveMut.isPending
          ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</>
          : <><Save className="w-4 h-4 mr-2" />Save Profile</>
        }
      </Button>
    </div>
  );
}
