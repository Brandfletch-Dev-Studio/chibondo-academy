import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Star, Zap, Crown } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const plans = [
  {
    id: 'free',
    name: 'Free',
    price: 'MWK 0',
    period: 'Forever',
    icon: Star,
    features: ['Sample lessons', 'Limited quiz access', 'Community discussions'],
    color: 'border-border',
  },
  {
    id: 'monthly',
    name: 'Monthly',
    price: 'MWK 3,500',
    period: '/month',
    icon: Zap,
    features: ['All lessons & videos', 'All quizzes', 'Past papers', 'Assignment submissions', 'Progress tracking', 'Discussion access'],
    popular: true,
    color: 'border-primary',
  },
  {
    id: 'quarterly',
    name: 'Quarterly',
    price: 'MWK 9,000',
    period: '/3 months',
    icon: Crown,
    features: ['Everything in Monthly', 'Mock examinations', 'Priority support', 'Downloadable resources', 'Save MWK 1,500'],
    color: 'border-accent',
  },
  {
    id: 'annual',
    name: 'Annual',
    price: 'MWK 30,000',
    period: '/year',
    icon: Crown,
    features: ['Everything in Quarterly', 'Exam tips & strategies', 'Certificate of completion', 'Offline access', 'Save MWK 12,000'],
    color: 'border-accent',
  },
];

export default function SubscriptionPage() {
  const { user } = useOutletContext();
  const queryClient = useQueryClient();
  const currentPlan = user?.subscription_plan || 'free';

  const subscribeMutation = useMutation({
    mutationFn: async (planId) => {
      await base44.entities.Subscription.create({
        student_id: user.id,
        plan: planId,
        status: 'active',
        start_date: new Date().toISOString(),
        payment_method: 'free',
      });
      await base44.auth.updateMe({ subscription_plan: planId, subscription_status: 'active' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
      toast.success('Subscription updated! Payment integration coming soon.');
    },
  });

  return (
    <div className="space-y-6">
      <div className="text-center max-w-lg mx-auto">
        <h1 className="text-2xl font-display font-bold">Choose Your Plan</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Unlock unlimited access to all learning materials, quizzes, and revision resources
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto">
        {plans.map(plan => {
          const isCurrent = currentPlan === plan.id;
          return (
            <div key={plan.id} className={cn(
              "relative bg-card rounded-xl border-2 p-5 transition-all hover:shadow-lg",
              plan.popular ? plan.color : isCurrent ? 'border-primary' : 'border-border'
            )}>
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground text-[10px]">Most Popular</Badge>
                </div>
              )}
              <div className="text-center mb-4 pt-2">
                <plan.icon className={cn("w-8 h-8 mx-auto mb-2", plan.popular ? 'text-primary' : 'text-muted-foreground')} />
                <h3 className="font-display font-bold">{plan.name}</h3>
                <div className="mt-2">
                  <span className="text-2xl font-bold font-display">{plan.price}</span>
                  <span className="text-xs text-muted-foreground">{plan.period}</span>
                </div>
              </div>
              <ul className="space-y-2 mb-5">
                {plan.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs">
                    <Check className="w-3.5 h-3.5 text-success flex-shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Button 
                className="w-full" 
                variant={isCurrent ? "secondary" : plan.popular ? "default" : "outline"}
                disabled={isCurrent}
                onClick={() => subscribeMutation.mutate(plan.id)}
              >
                {isCurrent ? 'Current Plan' : 'Select Plan'}
              </Button>
            </div>
          );
        })}
      </div>

      <div className="text-center text-xs text-muted-foreground max-w-lg mx-auto">
        <p>Payment via Airtel Money, TNM Mpamba, and bank transfer coming soon.</p>
        <p className="mt-1">Contact us for group/school subscriptions.</p>
      </div>
    </div>
  );
}