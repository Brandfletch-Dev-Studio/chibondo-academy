import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Save, Loader2, Mail, RefreshCw, Zap, ShoppingCart, CreditCard, UserCheck, Bell } from 'lucide-react';
import { toast } from 'sonner';

const DEFAULT_TEMPLATES = {
  // ── Welcome ──────────────────────────────────────────────────────────────
  welcome_enabled: true,
  welcome_subject: 'Welcome to Chibondo Academy! 🎓',
  welcome_body:
`Dear {student_name},

Welcome to Chibondo Academy! We are thrilled to have you join our learning community.

You now have access to your student dashboard where you can explore our subjects, topics, and learning resources.

To unlock full access to all lessons and course materials, pay your school fees from the Fees section of your dashboard.

Your referral code is: {referral_code}
Share it with friends and earn rewards when they subscribe!

Start your learning journey at: {dashboard_link}

Regards,
The Chibondo Academy Team`,

  // ── Payment Confirmed (Membership) ───────────────────────────────────────
  payment_confirmed_enabled: true,
  payment_confirmed_subject: 'Payment Confirmed – Full Access Unlocked! 🎉',
  payment_confirmed_body:
`Dear {student_name},

Great news! Your payment has been received and your {plan} subscription is now active.

✅ Subscription: {plan}
📅 Active until: {end_date}
💳 Amount paid: MWK {amount}

You now have full access to all lessons, past papers, and course materials.

Visit your dashboard to start learning: {dashboard_link}

If you have any questions, reply to this email or contact us at {contact_email}.

Regards,
The Chibondo Academy Team`,

  // ── Cart Recovery ────────────────────────────────────────────────────────
  cart_recovery_enabled: true,
  cart_recovery_subject: 'Did you forget something? Your fees payment is incomplete 💳',
  cart_recovery_body:
`Dear {student_name},

We noticed you started the school fees payment process but didn't complete it.

Don't miss out — your subscription gives you:
📚 Full access to all lessons and course materials
📝 Past exam papers and revision resources
💬 Access to study forums and teacher support

Complete your {plan} subscription payment (MWK {amount}) now:
{payment_link}

This reminder was sent because your payment session was left incomplete. If you already paid, please ignore this email or contact us at {contact_email}.

Regards,
The Chibondo Academy Team`,

  // ── Subscription Expired ─────────────────────────────────────────────────
  subscription_expired_enabled: true,
  subscription_expired_subject: 'Your Chibondo Academy subscription has expired',
  subscription_expired_body:
`Dear {student_name},

Your school fees subscription expired on {end_date}.

Please renew your subscription to continue accessing all lessons and course materials.

Visit {subscription_link} to pay your fees.

Regards,
The Chibondo Academy Team`,

  // ── Subscription Expiring ────────────────────────────────────────────────
  subscription_expiring_enabled: true,
  subscription_expiring_subject: 'Your Chibondo Academy subscription expires soon ⏰',
  subscription_expiring_body:
`Dear {student_name},

This is a reminder that your school fees subscription will expire on {end_date} — only {days_left} day(s) away.

Renew before it expires to avoid any interruption to your studies.

Visit {subscription_link} to renew.

Regards,
The Chibondo Academy Team`,
};

const TEMPLATE_FIELDS = [
  {
    id: 'welcome',
    label: "Welcome Email',
    icon: UserCheck,
    badge: "On Registration',
    badgeColor: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    description: "Sent immediately after a student registers. Variables: {student_name}, {referral_code}, {dashboard_link}',
  },
  {
    id: "payment_confirmed',
    label: "Payment Confirmed',
    icon: CreditCard,
    badge: "On Payment',
    badgeColor: 'bg-success/10 text-success border-success/20',
    description: "Sent after a successful fee payment. Variables: {student_name}, {plan}, {end_date}, {amount}, {dashboard_link}, {contact_email}',
  },
  {
    id: "cart_recovery',
    label: "Cart Recovery',
    icon: ShoppingCart,
    badge: "1 hr after abandon',
    badgeColor: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
    description: "Sent 1 hour after a student starts but does not complete payment. Variables: {student_name}, {plan}, {amount}, {payment_link}, {contact_email}",
  },
  {
    id: 'subscription_expired',
    label: "Subscription Expired',
    icon: Bell,
    badge: "On Expiry',
    badgeColor: 'bg-destructive/10 text-destructive border-destructive/20',
    description: "Sent when a student's subscription expires. Variables: {student_name}, {end_date}, {subscription_link}",
  },
  {
    id: 'subscription_expiring',
    label: "Subscription Expiring Soon',
    icon: Zap,
    badge: "3 days before',
    badgeColor: 'bg-accent/10 text-accent border-accent/20',
    description: "Sent 3 days before expiry. Variables: {student_name}, {end_date}, {days_left}, {subscription_link}',
  },
];

export default function EmailTemplateSettings() {
  const queryClient = useQueryClient();
  const [templates, setTemplates] = useState(DEFAULT_TEMPLATES);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["platformSettings', 'email_templates'],
    queryFn: async () => {
      const res = await base44.entities.PlatformSettings.filter({ key: 'email_templates' });
      return res[0]?.value || null;
    },
  });

  useEffect(() => {
    if (settings) setTemplates({ ...DEFAULT_TEMPLATES, ...settings });
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const existing = await base44.entities.PlatformSettings.filter({ key: 'email_templates' });
      if (existing[0]) {
        await base44.entities.PlatformSettings.update(existing[0].id, { value: templates });
      } else {
        await base44.entities.PlatformSettings.create({ key: 'email_templates', value: templates });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platformSettings', 'email_templates'] });
      toast.success('Email templates saved');
    },
    onError: () => toast.error('Failed to save templates'),
  });

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            Customise all automated emails. Toggle each email on or off. Use the variable placeholders shown in each template's description.
          </p>
        </div>
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="flex-shrink-0 h-9 px-4 text-sm">
          {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Save className="w-4 h-4 mr-1.5" />}
          Save All
        </Button>
      </div>

      {TEMPLATE_FIELDS.map(field => {
        const Icon = field.icon;
        const isEnabled = templates[`${field.id}_enabled`] !== false;
        return (
          <div key={field.id} className={`rounded-xl border p-5 space-y-4 transition-opacity ${isEnabled ? 'bg-card border-border' : 'bg-muted/30 border-border opacity-60'}`}>
            {/* Header row */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm">{field.label}</p>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${field.badgeColor}`}>
                      {field.badge}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{field.description}</p>
                </div>
              </div>
              {/* Enable/disable toggle */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs text-muted-foreground">{isEnabled ? 'On' : 'Off'}</span>
                <Switch
                  checked={isEnabled}
                  onCheckedChange={v => setTemplates(prev => ({ ...prev, [`${field.id}_enabled`]: v }))}
                />
              </div>
            </div>

            {/* Template fields — hidden when disabled */}
            {isEnabled && (
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Subject Line</Label>
                  <Input
                    className="mt-1 text-sm"
                    value={templates[`${field.id}_subject`] || ''}
                    onChange={e => setTemplates(prev => ({ ...prev, [`${field.id}_subject`]: e.target.value }))}
                    placeholder="Email subject..."
                  />
                </div>
                <div>
                  <Label className="text-xs">Email Body</Label>
                  <Textarea
                    className="mt-1 text-sm font-mono resize-none"
                    rows={9}
                    value={templates[`${field.id}_body`] || ''}
                    onChange={e => setTemplates(prev => ({ ...prev, [`${field.id}_body`]: e.target.value }))}
                    placeholder="Email body text..."
                  />
                </div>
                <button
                  className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
                  onClick={() => setTemplates(prev => ({
                    ...prev,
                    [`${field.id}_subject`]: DEFAULT_TEMPLATES[`${field.id}_subject`],
                    [`${field.id}_body`]: DEFAULT_TEMPLATES[`${field.id}_body`],
                  }))}
                >
                  <RefreshCw className="w-3 h-3" /> Reset to default
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
