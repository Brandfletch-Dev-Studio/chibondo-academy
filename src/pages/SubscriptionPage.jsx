import React, { useState, useEffect } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, GraduationCap, Zap, Crown, Loader2, BookOpen, Calendar, Users, Award } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import SEO from '@/components/SEO';

export default function SubscriptionPage() {
  const { user } = useOutletContext();
  const currentPlan = user?.subscription_plan || 'free';

  const [pricing, setPricing] = useState({
    monthly_price: 10000,
    annual_price: 80000,
    biannual_price: 150000,
  });

  const [processing, setProcessing] = useState(false);

  const { data: pricingData, isLoading } = useQuery({
    queryKey: ['pricing'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getPricing', {});
      return res.data.pricing;
    },
  });

  // Check active subscription
  const { data: subscription } = useQuery({
    queryKey: ['subscription', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const results = await base44.entities.Subscription.filter({ student_id: user.id, status: 'active' });
      return results[0] || null;
    },
    enabled: !!user?.id,
  });

  const hasPaidFees = subscription && subscription.status === 'active';

  useEffect(() => {
    if (pricingData) {
      setPricing({
        monthly_price: pricingData.monthly_price || 10000,
        annual_price: pricingData.annual_price || 80000,
        biannual_price: pricingData.biannual_price || 150000,
      });
    }
  }, [pricingData]);

  const plans = [
    {
      id: 'monthly',
      name: 'Monthly',
      price: pricing.monthly_price,
      period: 'per month',
      duration: '1 Month',
      icon: Zap,
      features: ['All lessons & videos', 'All quizzes & tests', 'Past papers access', 'Assignment submissions', 'Progress tracking'],
      popular: true,
      color: 'border-accent',
      bgColor: 'bg-accent/5',
    },
    {
      id: 'annual',
      name: 'Annual',
      price: pricing.annual_price,
      period: 'per year',
      duration: '1 Year',
      icon: Crown,
      features: ['Everything in Monthly', 'Priority support', 'Exam tips & strategies', 'Revision resources', `Save MWK ${(pricing.monthly_price * 12 - pricing.annual_price).toLocaleString()}`],
      color: 'border-primary',
      bgColor: 'bg-primary/5',
    },
    {
      id: 'biannual',
      name: 'Biannual',
      price: pricing.biannual_price,
      period: 'for 2 years',
      duration: '2 Years',
      icon: Award,
      features: ['Everything in Annual', 'Certificate of completion', 'Dedicated support', 'Offline access', `Save MWK ${(pricing.monthly_price * 24 - pricing.biannual_price).toLocaleString()}`],
      color: 'border-success',
      bgColor: 'bg-success/5',
    },
  ];

  const initiatePayment = useMutation({
    mutationFn: async (plan) => {
      const res = await base44.functions.invoke('createPayChanguSession', { plan });
      return res.data;
    },
    onSuccess: (data) => {
      setProcessing(false);
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        toast.error('Could not get payment link. Please try again.');
      }
    },
    onError: (error) => {
      toast.error(error.message || 'Payment failed. Please try again.');
      setProcessing(false);
    },
  });

  const handlePlanSelect = (planId) => {
    setProcessing(true);
    initiatePayment.mutate(planId);
  };

  const formatPrice = (price) => price.toLocaleString('en-MW');

  return (
    <>
      <SEO 
        title="School Fees & Pricing"
        description="Affordable online secondary education at Chibondo Academy. Monthly, quarterly, and annual plans available. Access MSCE lessons, quizzes, past papers from MWK 10,000/month."
        canonical={`${window.location.origin}/subscription`}
      />
      <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <GraduationCap className="w-8 h-8 text-primary" />
          </div>
        </div>
        <h1 className="text-3xl font-display font-bold">School Fees</h1>
        <p className="text-muted-foreground max-w-md mx-auto">
          Pay your school fees to unlock full access to all lessons, quizzes, past papers, and learning resources.
        </p>
      </div>

      {/* Active Subscription Banner */}
      {hasPaidFees && (
        <div className="bg-success/10 border border-success/30 rounded-2xl p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-success/20 flex items-center justify-center flex-shrink-0">
            <Check className="w-6 h-6 text-success" />
          </div>
          <div>
            <p className="font-semibold text-success">Fees Paid ✓</p>
            <p className="text-sm text-muted-foreground">
              You have an active <span className="font-medium capitalize">{subscription.plan}</span> plan.
              {subscription.end_date && ` Valid until ${new Date(subscription.end_date).toLocaleDateString('en-MW', { day: 'numeric', month: 'long', year: 'numeric' })}.`}
            </p>
          </div>
          <div className="ml-auto">
            <Link to="/subjects">
              <Button variant="outline" size="sm">Go to Lessons</Button>
            </Link>
          </div>
        </div>
      )}

      {/* What you get */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { icon: BookOpen, label: 'All Lessons', sub: 'Videos & notes' },
          { icon: Award, label: 'Past Papers', sub: 'Exam revision' },
          { icon: Users, label: 'Discussions', sub: 'Ask teachers' },
          { icon: Calendar, label: 'Progress', sub: 'Track growth' },
        ].map(({ icon: Icon, label, sub }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-4 text-center">
            <Icon className="w-6 h-6 text-primary mx-auto mb-2" />
            <p className="text-sm font-semibold">{label}</p>
            <p className="text-xs text-muted-foreground">{sub}</p>
          </div>
        ))}
      </div>

      {/* Fee Plans */}
      <div>
        <h2 className="text-lg font-display font-semibold mb-4">Choose a Fee Period</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {plans.map(plan => {
            const isCurrent = hasPaidFees && currentPlan === plan.id;
            return (
              <div key={plan.id} className={cn(
                "relative rounded-2xl border-2 p-6 transition-all hover:shadow-lg",
                plan.bgColor,
                isCurrent ? 'border-success' : plan.popular ? plan.color : 'border-border'
              )}>
                {plan.popular && !hasPaidFees && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-accent text-accent-foreground text-[10px] px-3">Most Popular</Badge>
                  </div>
                )}
                <div className="mb-4 pt-1">
                  <plan.icon className="w-7 h-7 text-primary mb-3" />
                  <h3 className="font-display font-bold text-lg">{plan.name}</h3>
                  <p className="text-xs text-muted-foreground">{plan.duration} of access</p>
                  <div className="mt-3">
                    <span className="text-3xl font-bold font-display">MWK {formatPrice(plan.price)}</span>
                    <span className="text-xs text-muted-foreground ml-1">{plan.period}</span>
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
                  variant={isCurrent ? "secondary" : "default"}
                  disabled={isCurrent || isLoading || processing}
                  onClick={() => handlePlanSelect(plan.id)}
                >
                  {processing ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Redirecting...</>
                  ) : isCurrent ? 'Current Plan' : `Pay MWK ${formatPrice(plan.price)}`}
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3 text-sm">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <GraduationCap className="w-4 h-4 text-primary" />
        </div>
        <div>
          <p className="font-medium">Need help with your fees?</p>
          <p className="text-xs text-muted-foreground">
            Secure payment via Airtel Money & TNM Mpamba. Contact us at{' '}
            <a href="mailto:support@chibondoacademy.com" className="text-primary hover:underline">support@chibondoacademy.com</a>
          </p>
        </div>
      </div>
    </div>
    </>
  );
}