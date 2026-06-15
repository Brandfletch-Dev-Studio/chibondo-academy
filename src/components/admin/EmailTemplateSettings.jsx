import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Save, Loader2, Mail, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

const DEFAULT_TEMPLATES = {
  subscription_expired_subject: 'Your Chibondo Academy subscription has expired',
  subscription_expired_body:
`Dear {student_name},

Your school fees subscription expired on {end_date}.

Please renew your subscription to continue accessing all lessons and course materials.

Visit {subscription_link} to pay your fees.

Regards,
The Chibondo Academy Team`,

  subscription_expiring_subject: 'Your Chibondo Academy subscription expires soon',
  subscription_expiring_body:
`Dear {student_name},

This is a reminder that your school fees subscription will expire on {end_date}.

Renew before it expires to avoid interruption to your studies.

Visit {subscription_link} to renew.

Regards,
The Chibondo Academy Team`,

  payment_confirmed_subject: 'Payment Confirmed – Welcome to Chibondo Academy!',
  payment_confirmed_body:
`Dear {student_name},

Your payment has been received and your subscription is now active until {end_date}.

You now have full access to all lessons and course materials.

Visit {dashboard_link} to start learning.

Regards,
The Chibondo Academy Team`,
};

const TEMPLATE_FIELDS = [
  {
    id: 'subscription_expired',
    label: 'Subscription Expired',
    description: 'Sent when a student\'s subscription expires. Variables: {student_name}, {end_date}, {subscription_link}',
  },
  {
    id: 'subscription_expiring',
    label: 'Subscription Expiring Soon',
    description: 'Sent 3 days before expiry. Variables: {student_name}, {end_date}, {subscription_link}, {days_left}',
  },
  {
    id: 'payment_confirmed',
    label: 'Payment Confirmed',
    description: 'Sent after a successful fee payment. Variables: {student_name}, {end_date}, {dashboard_link}, {plan}',
  },
];

export default function EmailTemplateSettings() {
  const queryClient = useQueryClient();
  const [templates, setTemplates] = useState(DEFAULT_TEMPLATES);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['platformSettings', 'email_templates'],
    queryFn: async () => {
      const res = await base44.entities.PlatformSettings.filter({ key: 'email_templates' });
      return res[0]?.value || null;
    },
  });

  useEffect(() => {
    if (settings) {
      setTemplates({ ...DEFAULT_TEMPLATES, ...settings });
    }
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
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            Customise the emails sent to students for subscription events. Use the variable placeholders shown in each template's description.
          </p>
        </div>
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="flex-shrink-0">
          {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
          Save Templates
        </Button>
      </div>

      {TEMPLATE_FIELDS.map(field => (
        <div key={field.id} className="bg-card rounded-xl border border-border p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Mail className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-sm">{field.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{field.description}</p>
            </div>
          </div>

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
                rows={8}
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
        </div>
      ))}
    </div>
  );
}