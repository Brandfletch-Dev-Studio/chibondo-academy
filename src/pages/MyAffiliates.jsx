import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import {
  Gift, DollarSign, Users, TrendingUp, Copy, Check, Share2,
  Smartphone, Building2, Loader2, Wallet, Settings, Link2,
  BarChart3, Clock, CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';

const statusColors = {
  pending: 'bg-muted text-muted-foreground',
  registered: 'bg-blue-100 text-blue-700',
  paid: 'bg-yellow-100 text-yellow-700',
  rewarded: 'bg-green-100 text-green-700',
};

// ─── OVERVIEW TAB ─────────────────────────────────────────────────────────────
function AffiliateOverview({ referrals, commissionSettings }) {
  const stats = {
    total: referrals.length,
    registered: referrals.filter(r => ['registered', 'paid', 'rewarded'].includes(r.status)).length,
    paid: referrals.filter(r => ['paid', 'rewarded'].includes(r.status)).length,
    earned: referrals.filter(r => r.reward_status === 'paid').reduce((acc, r) => acc + (r.reward_amount || 0), 0),
    pending: referrals.filter(r => r.reward_status === 'pending' && r.reward_amount > 0).reduce((acc, r) => acc + (r.reward_amount || 0), 0),
  };

  const type = commissionSettings?.commission_type || 'percentage';
  const rateDisplay = type === 'percentage' 
    ? `${commissionSettings?.percentage_rate || 0}% of each payment`
    : type === 'fixed' 
    ? `MWK ${(commissionSettings?.fixed_amount || 0).toLocaleString()} per referral`
    : `Tiered rates available`;

  return (
    <div className="space-y-6">
      {/* Commission Rate Banner */}
      <div className="bg-gradient-to-r from-accent/10 to-accent/5 border border-accent/20 rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center flex-shrink-0">
            <DollarSign className="w-5 h-5 text-accent" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-sm mb-1">Your Commission Rate</h3>
            <p className="text-lg font-bold text-accent">{rateDisplay}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Minimum payout: MWK {(commissionSettings?.min_payout || 5000).toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Total Referrals', value: stats.total, icon: Users, color: 'text-primary bg-primary/10' },
          { label: 'Registered', value: stats.registered, icon: CheckCircle2, color: 'text-blue-500 bg-blue-500/10' },
          { label: 'Paid Fees', value: stats.paid, icon: DollarSign, color: 'text-success bg-success/10' },
          { label: 'Earned', value: `MWK ${stats.earned.toLocaleString()}`, icon: Gift, color: 'text-accent bg-accent/10' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-4">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${color}`}>
              <Icon className="w-4 h-4" />
            </div>
            <p className="text-xl font-bold font-display">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {stats.pending > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 flex items-center gap-3">
          <Clock className="w-5 h-5 text-yellow-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-yellow-700">Pending Payout</p>
            <p className="text-xs text-yellow-600">MWK {stats.pending.toLocaleString()} waiting to be paid out</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── LINK GENERATOR TAB ───────────────────────────────────────────────────────
function LinkGenerator({ referralCode }) {
  const [copied, setCopied] = useState('');
  const referralLink = `${window.location.origin}/register?ref=${referralCode}`;

  const shareMessage = `📚 *The Chibondo Academy* is an online secondary school that offers MSCE lessons in all subjects.

Fees start from *MWK10,000 per month* and that unlocks access to both Form 3 and Form 4 content.

Register for free through this link 👇
${referralLink}`;

  const copy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopied(''), 2000);
  };

  const handleWhatsApp = () => {
    const encoded = encodeURIComponent(shareMessage);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Join Chibondo Academy',
        text: shareMessage,
        url: referralLink,
      });
    } else {
      copy(shareMessage);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold mb-1">Your Referral Code</h3>
        <p className="text-sm text-muted-foreground">Share this code or link to earn rewards</p>
      </div>

      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <div className="text-center py-4 bg-muted/50 rounded-xl">
          <p className="text-xs text-muted-foreground mb-2">Your Code</p>
          <p className="text-2xl font-bold font-mono tracking-widest text-primary">{referralCode}</p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-mono text-muted-foreground flex-1 truncate">{referralLink}</p>
            <Button variant="outline" size="sm" onClick={() => copy(referralLink, 'link')}>
              {copied === 'link' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => copy(referralCode, 'code')} className="text-sm">
              {copied === 'code' ? <Check className="w-4 h-4 mr-1.5" /> : <Copy className="w-4 h-4 mr-1.5" />}
              Copy Code
            </Button>
            <Button variant="outline" onClick={handleWhatsApp} className="text-sm bg-green-500/10 text-green-600 hover:bg-green-500/20 border-green-500/20">
              <Share2 className="w-4 h-4 mr-1.5" />
              WhatsApp
            </Button>
          </div>

          <Button variant="outline" onClick={handleShare} className="w-full">
            <Share2 className="w-4 h-4 mr-2" />
            Share Message
          </Button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-4">
        <h4 className="font-semibold text-sm mb-2">How Sharing Works</h4>
        <ol className="space-y-2 text-xs text-muted-foreground">
          <li className="flex gap-2"><span className="font-semibold text-foreground">1.</span> Share your unique link or code</li>
          <li className="flex gap-2"><span className="font-semibold text-foreground">2.</span> Friend registers using your link</li>
          <li className="flex gap-2"><span className="font-semibold text-foreground">3.</span> You earn rewards when they pay fees</li>
        </ol>
      </div>
    </div>
  );
}

// ─── PAYOUTS TAB ──────────────────────────────────────────────────────────────
function PayoutsTab({ referrals, commissionSettings }) {
  const queryClient = useQueryClient();
  const { user } = useOutletContext();
  const [requestDialog, setRequestDialog] = useState(false);
  const [payoutData, setPayoutData] = useState({ amount: '', method: 'airtel_money', details: '' });

  const { data: payoutRequests = [] } = useQuery({
    queryKey: ['myPayoutRequests', user?.id],
    queryFn: () => base44.entities.PayoutRequest.filter({ affiliate_id: user?.id }, '-created_date', 50),
    enabled: !!user?.id,
  });

  const pendingEarnings = referrals.filter(r => r.reward_status === 'pending' && r.reward_amount > 0)
    .reduce((acc, r) => acc + (r.reward_amount || 0), 0);
  
  const paidEarnings = referrals.filter(r => r.reward_status === 'paid')
    .reduce((acc, r) => acc + (r.reward_amount || 0), 0);

  const minPayout = commissionSettings?.min_payout || 5000;
  const canRequestPayout = pendingEarnings >= minPayout;

  const requestMutation = useMutation({
    mutationFn: async () => {
      await base44.entities.PayoutRequest.create({
        affiliate_id: user.id,
        affiliate_name: user.full_name,
        amount: parseFloat(payoutData.amount) || pendingEarnings,
        payment_method: payoutData.method,
        payment_details: payoutData.details,
        status: 'pending',
        referral_ids: referrals.filter(r => r.reward_status === 'pending').map(r => r.id),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myPayoutRequests'] });
      toast.success('Payout request submitted!');
      setRequestDialog(false);
      setPayoutData({ amount: '', method: 'airtel_money', details: '' });
    },
  });

  const methodLabels = { 
    airtel_money: 'Airtel Money', 
    tnm_mpamba: 'TNM Mpamba', 
    bank_transfer: 'Bank Transfer' 
  };

  const statusColors = {
    pending: 'bg-yellow-500/10 text-yellow-600',
    approved: 'bg-blue-500/10 text-blue-600',
    paid: 'bg-success/10 text-success',
    rejected: 'bg-destructive/10 text-destructive',
  };

  return (
    <div className="space-y-6">
      {/* Earnings Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Pending</p>
          <p className="text-2xl font-bold text-yellow-600">MWK {pendingEarnings.toLocaleString()}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Paid Out</p>
          <p className="text-2xl font-bold text-success">MWK {paidEarnings.toLocaleString()}</p>
        </div>
      </div>

      {/* Request Payout Button */}
      <Dialog open={requestDialog} onOpenChange={setRequestDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Payout</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Amount (MWK)</Label>
              <Input 
                type="number" 
                value={payoutData.amount || pendingEarnings} 
                onChange={e => setPayoutData({ ...payoutData, amount: e.target.value })}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Min: MWK {minPayout.toLocaleString()} · Available: MWK {pendingEarnings.toLocaleString()}
              </p>
            </div>
            <div>
              <Label>Payment Method</Label>
              <select 
                className="w-full mt-1 h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={payoutData.method}
                onChange={e => setPayoutData({ ...payoutData, method: e.target.value })}
              >
                <option value="airtel_money">Airtel Money</option>
                <option value="tnm_mpamba">TNM Mpamba</option>
                <option value="bank_transfer">Bank Transfer</option>
              </select>
            </div>
            <div>
              <Label>Payment Details</Label>
              <Input 
                placeholder={payoutData.method === 'bank_transfer' ? 'Bank account details' : 'Phone number'}
                value={payoutData.details}
                onChange={e => setPayoutData({ ...payoutData, details: e.target.value })}
                className="mt-1"
              />
            </div>
            <Button 
              className="w-full" 
              onClick={() => requestMutation.mutate()}
              disabled={requestMutation.isPending || !canRequestPayout}
            >
              {requestMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting...</> : 'Submit Request'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {!canRequestPayout ? (
        <div className="bg-muted/50 border border-border rounded-xl p-6 text-center">
          <Wallet className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-sm font-semibold mb-1">Minimum Payout Not Reached</p>
          <p className="text-xs text-muted-foreground">
            You need MWK {minPayout.toLocaleString()} to request a payout. Keep referring more students!
          </p>
        </div>
      ) : (
        <Button className="w-full" onClick={() => setRequestDialog(true)}>
          <DollarSign className="w-4 h-4 mr-2" />
          Request Payout (MWK {pendingEarnings.toLocaleString()})
        </Button>
      )}

      {/* Payout History */}
      {payoutRequests.length > 0 && (
        <div>
          <h3 className="font-semibold mb-3">Payout History</h3>
          <div className="space-y-2">
            {payoutRequests.map(req => (
              <div key={req.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card text-sm">
                <div className="flex-1">
                  <p className="font-medium">MWK {(req.amount || 0).toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">
                    {methodLabels[req.payment_method]} · {new Date(req.created_date).toLocaleDateString()}
                  </p>
                </div>
                <Badge className={`text-[10px] capitalize ${statusColors[req.status]}`}>{req.status}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SETTINGS TAB ─────────────────────────────────────────────────────────────
function AffiliateSettings() {
  const { user } = useOutletContext();
  const queryClient = useQueryClient();
  const [customCode, setCustomCode] = useState(user?.referral_code || '');
  const [notifications, setNotifications] = useState(true);

  const updateMutation = useMutation({
    mutationFn: async () => {
      await base44.auth.updateMe({ referral_code: customCode.trim().toUpperCase() });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user'] });
      toast.success('Settings saved!');
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold mb-1">Custom Referral Code</h3>
        <p className="text-sm text-muted-foreground">Personalize your referral code (optional)</p>
      </div>

      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div>
          <Label>Current Code</Label>
          <Input
            value={customCode}
            onChange={e => setCustomCode(e.target.value.toUpperCase().replace(/\s/g, ''))}
            placeholder="CHIBXXXXXX"
            className="mt-1 font-mono"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Leave blank to use auto-generated code
          </p>
        </div>

        <Button 
          className="w-full" 
          onClick={() => updateMutation.mutate()}
          disabled={updateMutation.isPending || !customCode.trim()}
        >
          {updateMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : 'Save Code'}
        </Button>
      </div>

      <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
        <div>
          <p className="font-semibold text-sm">Email Notifications</p>
          <p className="text-xs text-muted-foreground">Get notified when referrals pay fees</p>
        </div>
        <Switch checked={notifications} onCheckedChange={setNotifications} />
      </div>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function MyAffiliates() {
  const { user } = useOutletContext();
  const referralCode = user?.referral_code || (user?.id ? `CHIB-${user.id.slice(-6).toUpperCase()}` : '');

  const { data: referrals = [] } = useQuery({
    queryKey: ['myReferrals', user?.id],
    queryFn: () => base44.entities.Referral.filter({ referrer_id: user?.id }, '-created_date', 50),
    enabled: !!user?.id,
  });

  const { data: commissionSettingsData = [] } = useQuery({
    queryKey: ['affiliateSettings'],
    queryFn: () => base44.entities.PlatformSettings.filter({ key: 'affiliate_commission' }),
  });
  const commissionSettings = commissionSettingsData[0]?.value || {};

  if (!user) return null;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-display font-bold flex items-center gap-2">
          <Gift className="w-6 h-6 text-accent" /> My Affiliates
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Track your referrals and earn rewards</p>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex flex-wrap gap-1 h-auto">
          <TabsTrigger value="overview"><BarChart3 className="w-4 h-4 mr-1.5" /> Overview</TabsTrigger>
          <TabsTrigger value="links"><Link2 className="w-4 h-4 mr-1.5" /> Share Links</TabsTrigger>
          <TabsTrigger value="payouts"><DollarSign className="w-4 h-4 mr-1.5" /> Payouts</TabsTrigger>
          <TabsTrigger value="settings"><Settings className="w-4 h-4 mr-1.5" /> Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-5">
          <AffiliateOverview referrals={referrals} commissionSettings={commissionSettings} />
        </TabsContent>

        <TabsContent value="links" className="mt-5">
          <LinkGenerator referralCode={referralCode} />
        </TabsContent>

        <TabsContent value="payouts" className="mt-5">
          <PayoutsTab referrals={referrals} commissionSettings={commissionSettings} />
        </TabsContent>

        <TabsContent value="settings" className="mt-5">
          <AffiliateSettings />
        </TabsContent>
      </Tabs>

      {/* Referrals List */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-semibold">Your Referrals</h2>
          <p className="text-xs text-muted-foreground">{referrals.length} total referrals</p>
        </div>
        {referrals.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-12 h-12 mx-auto text-muted-foreground/20 mb-3" />
            <p className="text-sm text-muted-foreground">No referrals yet. Start sharing your link!</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {referrals.map(r => (
              <div key={r.id} className="flex items-center gap-3 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{r.referred_name || r.referred_email || 'Pending'}</p>
                  <p className="text-xs text-muted-foreground">{new Date(r.created_date).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  {r.reward_amount > 0 && (
                    <span className="text-xs font-semibold text-accent">+MWK {r.reward_amount.toLocaleString()}</span>
                  )}
                  <Badge className={`text-xs capitalize ${statusColors[r.status]}`}>{r.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}