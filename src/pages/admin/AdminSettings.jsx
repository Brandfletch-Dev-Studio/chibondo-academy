import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { School, CreditCard, Bell, Shield, Save, Loader2, Copy, ExternalLink, Trash2, Users, BookOpen, Layers, Gift } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { useQueryClient, useMutation } from '@tanstack/react-query';

const ENTITY_LIST = [
  { key: 'StudentProfile',      label: 'Student Profiles',     icon: Users },
  { key: 'Enrollment',          label: 'Enrollments',          icon: BookOpen },
  { key: 'Payment',             label: 'Payments',             icon: CreditCard },
  { key: 'Subscription',        label: 'Subscriptions',        icon: CreditCard },
  { key: 'Referral',            label: 'Referrals',            icon: Gift },
  { key: 'Lesson',              label: 'Lessons',              icon: Layers },
  { key: 'Subject',             label: 'Courses',              icon: BookOpen },
  { key: 'Topic',               label: 'Topics',               icon: Layers },
  { key: 'TeacherApplication',  label: 'Tutor Applications',   icon: Users },
];

function DataManagement() {
  const [deleting, setDeleting] = useState(null);
  const deleteMutation = useMutation({
    mutationFn: async (entityKey) => {
      const entity = base44.entities[entityKey];
      const records = await entity.list('created_date', 500);
      await Promise.all(records.map(r => entity.delete(r.id)));
      return records.length;
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
    <div className="bg-card rounded-xl border border-destructive/30 p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Trash2 className="w-4 h-4 text-destructive" />
        <h2 className="font-semibold text-destructive">Data Management</h2>
      </div>
      <p className="text-sm text-muted-foreground">Permanently delete all records from a collection. This cannot be undone.</p>
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
                  disabled={deleteMutation.isPending && deleting === key}
                >
                  {deleteMutation.isPending && deleting === key
                    ? <><Loader2 className="w-4 h-4 animate-spin mr-1.5" />Deleting...</>
                    : 'Yes, Delete All'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ))}
      </div>
    </div>
  );
}

export default function AdminSettings() {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  const [general, setGeneral] = useState({
    school_name: 'The Chibondo Academy',
    tagline: 'Excellence in Malawian Secondary Education',
    contact_email: 'admin@chibondo.mw',
    contact_phone: '+265 999 000 000',
    address: 'Lilongwe, Malawi',
  });

  const [pricing, setPricing] = useState({
    monthly_price: 10000,
    annual_price: 80000,
    biannual_price: 150000,
    currency: 'MWK',
    free_lessons_per_subject: 2,
  });

  const [notifications, setNotifications] = useState({
    email_on_enrollment: true,
    email_on_payment: true,
    email_on_submission: false,
  });

  const handleSave = async (section) => {
    setLoading(true);
    try {
      if (section === 'Pricing') {
        await base44.functions.invoke('savePlatformSettings', { planKey: 'pricing', value: pricing });
      } else if (section === 'General') {
        await base44.functions.invoke('savePlatformSettings', { planKey: 'general', value: general });
      }
      
      queryClient.invalidateQueries({ queryKey: ['platformSettings'] });
      toast.success(`${section} settings saved successfully!`);
    } catch (error) {
      toast.error(`Failed to save ${section} settings`);
    } finally {
      setLoading(false);
    }
  };

  const copyWebhookUrl = () => {
    const webhookUrl = `${window.location.origin}/api/functions/payChanguWebhook`;
    navigator.clipboard.writeText(webhookUrl);
    toast.success('Webhook URL copied to clipboard! Configure this in your PayChangu dashboard.');
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-display font-bold">Platform Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Configure your academy platform</p>
      </div>

      {/* PayChangu Integration */}
      <Card className="border-primary/50 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary" />
            PayChangu Payment Integration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Configure your PayChangu webhook to receive payment notifications automatically.
          </p>
          <div className="bg-background rounded-lg p-4 border border-border">
            <Label className="text-xs font-medium">Webhook URL</Label>
            <div className="flex gap-2 mt-2">
              <Input 
                readOnly 
                value={`${window.location.origin}/api/functions/payChanguWebhook`}
                className="font-mono text-xs"
              />
              <Button variant="outline" size="icon" onClick={copyWebhookUrl}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Add this URL to your PayChangu dashboard under Settings → Webhooks
            </p>
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <ExternalLink className="w-3 h-3" />
            <a href="https://dashboard.paychangu.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">
              Open PayChangu Dashboard
            </a>
          </div>
        </CardContent>
      </Card>

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
          <Button onClick={() => handleSave('General')} disabled={loading}><Save className="w-4 h-4 mr-1" /> Save</Button>
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
            <Label>Annual Plan Price</Label>
            <Input className="mt-1" type="number" value={pricing.annual_price} onChange={e => setPricing({ ...pricing, annual_price: Number(e.target.value) })} />
          </div>
          <div>
            <Label>Biannual Plan Price (2 Years)</Label>
            <Input className="mt-1" type="number" value={pricing.biannual_price} onChange={e => setPricing({ ...pricing, biannual_price: Number(e.target.value) })} />
          </div>
        </div>
        <div className="flex justify-end pt-2">
          <Button onClick={() => handleSave('Pricing')} disabled={loading}><Save className="w-4 h-4 mr-1" /> Save</Button>
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
          <Button onClick={() => handleSave('Notification')} disabled={loading}><Save className="w-4 h-4 mr-1" /> Save</Button>
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

      {/* Danger Zone */}
      <DataManagement />
    </div>
  );
}