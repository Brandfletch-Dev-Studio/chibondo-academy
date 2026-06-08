import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Wallet, AlertCircle, CheckCircle2, Clock, XCircle, ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

const PAYOUT_STATUS = {
  pending:    { label: 'Pending',    icon: Clock,        color: 'bg-yellow-500/10 text-yellow-600' },
  processing: { label: 'Processing', icon: ArrowUpRight, color: 'bg-blue-500/10 text-blue-600' },
  completed:  { label: 'Completed',  icon: CheckCircle2, color: 'bg-green-500/10 text-green-600' },
  rejected:   { label: 'Rejected',   icon: XCircle,      color: 'bg-red-500/10 text-red-600' },
};

export default function AffiliatePayouts() {
  const { user, settings } = useOutletContext();
  const qc = useQueryClient();
  const [dialog, setDialog] = useState(false);
  const [form, setForm] = useState({ method: 'airtel_money', details: '', amount: '' });

  const minPayout = settings?.min_payout || 5000;

  const { data: referrals = [] } = useQuery({
    queryKey: ['myReferrals', user?.id],
    queryFn: () => base44.entities.Referral.filter({ referrer_id: user?.id }, '-created_date', 200),
    enabled: !!user?.id,
  });
  const { data: payouts = [], isLoading } = useQuery({
    queryKey: ['myPayouts', user?.id],
    queryFn: () => base44.entities.PayoutRequest.filter({ affiliate_id: user?.id }, '-created_date', 50),
    enabled: !!user?.id,
  });
  const { data: commissions = [] } = useQuery({
    queryKey: ['myCommissions', user?.id],
    queryFn: () => base44.entities.Commission.filter({ affiliate_id: user?.id }, '-created_date', 200),
    enabled: !!user?.id,
  });

  // Calculate balances
  const totalEarned = commissions.length > 0
    ? commissions.reduce((s, c) => s + (c.amount || 0), 0)
    : referrals.filter(r => r.reward_amount > 0).reduce((s, r) => s + (r.reward_amount || 0), 0);
  const paidOut    = payouts.filter(p => p.status === 'completed').reduce((s, p) => s + (p.amount || 0), 0);
  const available  = Math.max(0, totalEarned - paidOut);
  const canRequest = available >= minPayout && !payouts.some(p => p.status === 'pending' || p.status === 'processing');
  const hasPending = payouts.some(p => p.status === 'pending' || p.status === 'processing');

  const requestMut = useMutation({
    mutationFn: async () => {
      const amt = parseFloat(form.amount) || available;
      if (amt < minPayout) throw new Error(`Minimum payout is MWK ${minPayout.toLocaleString()}`);
      if (amt > available)  throw new Error(`Amount exceeds available balance`);
      if (!form.details)    throw new Error('Please enter your payment details');
      return base44.entities.PayoutRequest.create({
        affiliate_id: user.id,
        affiliate_name: user.full_name || user.email,
        amount: amt,
        payment_method: form.method,
        payment_details: form.details,
        status: 'pending',
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['myPayouts'] });
      toast.success('Payout request submitted! We\'ll process it within 2-3 business days.');
      setDialog(false);
      setForm({ method: 'airtel_money', details: '', amount: '' });
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      {/* Balance cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-2xl p-5 col-span-2 sm:col-span-1">
          <p className="text-xs text-muted-foreground mb-1">Available Balance</p>
          <p className="text-3xl font-display font-bold" style={{ color: 'hsl(43 74% 52%)' }}>
            MWK {available.toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Min. payout: MWK {minPayout.toLocaleString()}
          </p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Total Earned</p>
          <p className="text-xl font-bold text-accent">MWK {totalEarned.toLocaleString()}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Total Paid Out</p>
          <p className="text-xl font-bold text-green-500">MWK {paidOut.toLocaleString()}</p>
        </div>
      </div>

      {/* Request button / status */}
      {hasPending ? (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
          <Clock className="w-5 h-5 text-yellow-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-yellow-700">Payout Request Pending</p>
            <p className="text-xs text-yellow-600">You have a pending request being processed. We'll notify you when it's done.</p>
          </div>
        </div>
      ) : !canRequest ? (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/50 border border-border">
          <AlertCircle className="w-5 h-5 text-muted-foreground flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold">Not Yet Eligible</p>
            <p className="text-xs text-muted-foreground">
              You need MWK {Math.max(0, minPayout - available).toLocaleString()} more to reach the minimum payout of MWK {minPayout.toLocaleString()}.
            </p>
          </div>
        </div>
      ) : (
        <Button
          onClick={() => setDialog(true)}
          className="w-full sm:w-auto"
          size="lg"
          style={{ background: 'hsl(43 74% 52%)', color: 'hsl(222 47% 11%)' }}
        >
          <Wallet className="w-4 h-4 mr-2" />
          Request Withdrawal — MWK {available.toLocaleString()}
        </Button>
      )}

      {/* Payout history */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-semibold">Payout History</h3>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : payouts.length === 0 ? (
          <div className="py-12 text-center">
            <Wallet className="w-10 h-10 mx-auto text-muted-foreground/20 mb-3" />
            <p className="text-sm text-muted-foreground">No payouts yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {payouts.map(p => {
              const cfg = PAYOUT_STATUS[p.status] || PAYOUT_STATUS.pending;
              const Icon = cfg.icon;
              return (
                <div key={p.id} className="flex items-center gap-4 px-5 py-4">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">MWK {(p.amount || 0).toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.payment_method?.replace('_', ' ')} · {new Date(p.created_date).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })}
                    </p>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${cfg.color}`}>{cfg.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Request dialog */}
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Request Payout</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Available: <span className="font-bold text-foreground">MWK {available.toLocaleString()}</span></p>
            </div>
            <div className="space-y-1.5">
              <Label>Amount (MWK)</Label>
              <Input
                type="number"
                placeholder={`Min. ${minPayout.toLocaleString()}`}
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Payment Method</Label>
              <Select value={form.method} onValueChange={v => setForm(f => ({ ...f, method: v, details: '' }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="airtel_money">Airtel Money</SelectItem>
                  <SelectItem value="tnm_mpamba">TNM Mpamba</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{form.method === 'bank_transfer' ? 'Bank Account Details' : 'Phone Number'}</Label>
              <Input
                placeholder={form.method === 'bank_transfer' ? 'Bank name, account number, account name' : '09XXXXXXXX'}
                value={form.details}
                onChange={e => setForm(f => ({ ...f, details: e.target.value }))}
              />
            </div>
            <Button
              className="w-full"
              onClick={() => requestMut.mutate()}
              disabled={requestMut.isPending}
              style={{ background: 'hsl(43 74% 52%)', color: 'hsl(222 47% 11%)' }}
            >
              {requestMut.isPending ? 'Submitting…' : 'Submit Request'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
