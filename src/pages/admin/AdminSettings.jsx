import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Settings, School, CreditCard, Bell, Shield, Save } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminSettings() {
  const [general, setGeneral] = useState({
    school_name: 'The Chibondo Academy',
    tagline: 'Excellence in Malawian Secondary Education',
    contact_email: 'admin@chibondo.mw',
    contact_phone: '+265 999 000 000',
    address: 'Lilongwe, Malawi',
  });

  const [pricing, setPricing] = useState({
    monthly_price: 5000,
    quarterly_price: 13500,
    annual_price: 48000,
    currency: 'MWK',
    free_lessons_per_subject: 2,
  });

  const [notifications, setNotifications] = useState({
    email_on_enrollment: true,
    email_on_payment: true,
    email_on_submission: false,
  });

  const handleSave = (section) => {
    toast.success(`${section} settings saved successfully!`);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-display font-bold">Platform Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Configure your academy platform</p>
      </div>

      {/* General */}
      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <School className="w-4 h-4 text-primary" />
          <h2 className="font-semibold">General Information</h2>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Label>School / Academy Name</Label>
            <Input className="mt-1" value={general.school_name} onChange={e => setGeneral({ ...general, school_name: e.target.value })} />
          </div>
          <div className="col-span-2">
            <Label>Tagline</Label>
            <Input className="mt-1" value={general.tagline} onChange={e => setGeneral({ ...general, tagline: e.target.value })} />
          </div>
          <div>
            <Label>Contact Email</Label>
            <Input className="mt-1" value={general.contact_email} onChange={e => setGeneral({ ...general, contact_email: e.target.value })} />
          </div>
          <div>
            <Label>Contact Phone</Label>
            <Input className="mt-1" value={general.contact_phone} onChange={e => setGeneral({ ...general, contact_phone: e.target.value })} />
          </div>
          <div className="col-span-2">
            <Label>Address</Label>
            <Input className="mt-1" value={general.address} onChange={e => setGeneral({ ...general, address: e.target.value })} />
          </div>
        </div>
        <div className="flex justify-end pt-2">
          <Button onClick={() => handleSave('General')}><Save className="w-4 h-4 mr-1" /> Save</Button>
        </div>
      </div>

      {/* Pricing */}
      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <CreditCard className="w-4 h-4 text-primary" />
          <h2 className="font-semibold">Pricing & Plans</h2>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Currency</Label>
            <Select value={pricing.currency} onValueChange={v => setPricing({ ...pricing, currency: v })}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="MWK">MWK (Malawian Kwacha)</SelectItem>
                <SelectItem value="USD">USD (US Dollar)</SelectItem>
                <SelectItem value="ZAR">ZAR (South African Rand)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Free Lessons per Subject</Label>
            <Input className="mt-1" type="number" value={pricing.free_lessons_per_subject} onChange={e => setPricing({ ...pricing, free_lessons_per_subject: Number(e.target.value) })} />
          </div>
          <div>
            <Label>Monthly Plan Price</Label>
            <Input className="mt-1" type="number" value={pricing.monthly_price} onChange={e => setPricing({ ...pricing, monthly_price: Number(e.target.value) })} />
          </div>
          <div>
            <Label>Quarterly Plan Price</Label>
            <Input className="mt-1" type="number" value={pricing.quarterly_price} onChange={e => setPricing({ ...pricing, quarterly_price: Number(e.target.value) })} />
          </div>
          <div>
            <Label>Annual Plan Price</Label>
            <Input className="mt-1" type="number" value={pricing.annual_price} onChange={e => setPricing({ ...pricing, annual_price: Number(e.target.value) })} />
          </div>
        </div>
        <div className="flex justify-end pt-2">
          <Button onClick={() => handleSave('Pricing')}><Save className="w-4 h-4 mr-1" /> Save</Button>
        </div>
      </div>

      {/* Notifications */}
      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Bell className="w-4 h-4 text-primary" />
          <h2 className="font-semibold">Notification Settings</h2>
        </div>
        <div className="space-y-4">
          {[
            { key: 'email_on_enrollment', label: 'Email admin on new enrollment' },
            { key: 'email_on_payment', label: 'Email admin on new payment' },
            { key: 'email_on_submission', label: 'Email teacher on assignment submission' },
          ].map(item => (
            <div key={item.key} className="flex items-center justify-between">
              <Label className="font-normal">{item.label}</Label>
              <Switch checked={notifications[item.key]} onCheckedChange={v => setNotifications({ ...notifications, [item.key]: v })} />
            </div>
          ))}
        </div>
        <div className="flex justify-end pt-2">
          <Button onClick={() => handleSave('Notification')}><Save className="w-4 h-4 mr-1" /> Save</Button>
        </div>
      </div>

      {/* Security */}
      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="w-4 h-4 text-primary" />
          <h2 className="font-semibold">Security</h2>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
            <div>
              <p className="text-sm font-medium">Require Email Verification</p>
              <p className="text-xs text-muted-foreground">Students must verify their email to access premium content</p>
            </div>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
            <div>
              <p className="text-sm font-medium">Allow Self-Registration</p>
              <p className="text-xs text-muted-foreground">Let students register without admin approval</p>
            </div>
            <Switch defaultChecked />
          </div>
        </div>
      </div>
    </div>
  );
}