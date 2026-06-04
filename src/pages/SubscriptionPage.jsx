import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Star, Zap, Crown, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

export default function SubscriptionPage() {
  const { user } = useOutletContext();
  const queryClient = useQueryClient();
  const currentPlan = user?.subscription_plan || 'free';

  const [pricing, setPricing] = useState({
    monthly_price: 3500,
    quarterly_price: 9000,
    annual_price: 30000,
  });

  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [phone, setPhone] = useState('');
  const [provider, setProvider] = useState('airtel');
  const [processing, setProcessing] = useState(false);

  // Fetch dynamic pricing
  const { data: pricingData, isLoading } = useQuery({
    queryKey: ['pricing'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getPricing', {});
      return res.data.pricing;
    },
  });

  useEffect(() => {
    if (pricingData) {
      setPricing({
        monthly_price: pricingData.monthly_price || 3500,
        quarterly_price: pricingData.quarterly_price || 9000,
        annual_price: pricingData.annual_price || 30000,
      });
    }
  }, [pricingData]);

  const plans = [
    {
      id: 'free',
      name: 'Free',
      price: 0,
      period: 'Forever',
      icon: Star,
      features: ['Sample lessons', 'Limited quiz access', 'Community discussions'],
      color: 'border-border',
    },
    {
      id: 'monthly',
      name: 'Monthly',
      price: pricing.monthly_price,
      period: '/month',
      icon: Zap,
      features: ['All lessons & videos', 'All quizzes', 'Past papers', 'Assignment submissions', 'Progress tracking', 'Discussion access'],
      popular: true,
      color: 'border-primary',
    },
    {
      id: 'quarterly',
      name: 'Quarterly',
      price: pricing.quarterly_price,
      period: '/3 months',
      icon: Crown,
      features: ['Everything in Monthly', 'Mock examinations', 'Priority support', 'Downloadable resources', `Save MWK ${pricing.monthly_price * 3 - pricing.quarterly_price}`],
      color: 'border-accent',
    },
    {
      id: 'annual',
      name: 'Annual',
      price: pricing.annual_price,
      period: '/year',
      icon: Crown,
      features: ['Everything in Quarterly', 'Exam tips & strategies', 'Certificate of completion', 'Offline access', `Save MWK ${pricing.monthly_price * 12 - pricing.annual_price}`],
      color: 'border-accent',
    },
  ];

  const initiatePayment = useMutation({
    mutationFn: async ({ plan, phone, provider }) => {
      const res = await base44.functions.invoke('createPayChanguSession', { plan, phone, provider });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Payment initiated! Check your phone for PIN prompt.');
      setPaymentDialogOpen(false);
      // TODO: Set up webhook listener to update subscription status
    },
    onError: (error) => {
      toast.error(error.message || 'Payment failed. Please try again.');
      setProcessing(false);
    },
  });

  const handlePlanSelect = (plan) => {
    if (plan.id === 'free') {
      // Free plan - direct activation
      // TODO: Implement free plan activation
      toast.info('Free plan activation coming soon');
      return;
    }
    setSelectedPlan(plan);
    setPaymentDialogOpen(true);
  };

  const handlePaymentSubmit = async () => {
    if (!phone || phone.length < 10) {
      toast.error('Please enter a valid phone number');
      return;
    }

    setProcessing(true);
    initiatePayment.mutate({ plan: selectedPlan.id, phone, provider });
  };

  const formatPrice = (price) => {
    return price.toLocaleString('en-MW');
  };

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
                  <span className="text-2xl font-bold font-display">MWK {formatPrice(plan.price)}</span>
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
                disabled={isCurrent || isLoading}
                onClick={() => handlePlanSelect(plan)}
              >
                {isCurrent ? 'Current Plan' : 'Select Plan'}
              </Button>
            </div>
          );
        })}
      </div>

      <div className="text-center text-xs text-muted-foreground max-w-lg mx-auto">
        <p>Secure payment via Airtel Money and TNM Mpamba.</p>
        <p className="mt-1">Contact us for group/school subscriptions.</p>
      </div>

      {/* Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Complete Your Payment</DialogTitle>
            <DialogDescription>
              {selectedPlan?.name} Plan - MWK {formatPrice(selectedPlan?.price || 0)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Mobile Money Provider</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={provider === 'airtel' ? 'default' : 'outline'}
                  onClick={() => setProvider('airtel')}
                  className={provider === 'airtel' ? 'bg-red-600 hover:bg-red-700' : ''}
                >
                  Airtel Money
                </Button>
                <Button
                  variant={provider === 'tnm' ? 'default' : 'outline'}
                  onClick={() => setProvider('tnm')}
                  className={provider === 'tnm' ? 'bg-blue-600 hover:bg-blue-700' : ''}
                >
                  TNM Mpamba
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                placeholder="999 123 456"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-12"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Enter the number registered with {provider === 'airtel' ? 'Airtel Money' : 'TNM Mpamba'}
              </p>
            </div>

            <div className="flex gap-3 pt-4">
              <Button variant="outline" className="flex-1" onClick={() => setPaymentDialogOpen(false)}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={handlePaymentSubmit} disabled={processing}>
                {processing ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</>
                ) : (
                  `Pay MWK ${formatPrice(selectedPlan?.price || 0)}`
                )}
              </Button>
            </div>

            <div className="bg-muted/50 rounded-lg p-3 text-xs">
              <p className="font-medium">How it works:</p>
              <ol className="list-decimal list-inside mt-2 space-y-1 text-muted-foreground">
                <li>Click "Pay" button above</li>
                <li>Check your phone for USSD PIN prompt</li>
                <li>Enter your mobile money PIN</li>
                <li>Your subscription activates instantly!</li>
              </ol>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}