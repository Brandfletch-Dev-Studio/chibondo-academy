import React from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  DollarSign, Clock, CheckCircle2, Wallet,
  Users, TrendingUp, ArrowRight, Gift
} from 'lucide-react';

function StatCard({ label, value, icon: Icon, color, sub }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-2xl font-display font-bold">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      {sub && <p className="text-xs mt-1 font-medium text-muted-foreground">{sub}</p>}
    </div>
  );
}

export default function AffiliateDashboard() {
  const { user, settings } = useOutletContext();
  const referralCode = user?.referral_code || (user?.id ? `CHIB-${user.id.slice(-6).toUpperCase()}` : '');

  const { data: referrals = [] } = useQuery({
    queryKey: ['myReferrals', user?.id],
    queryFn: () => base44.entities.Referral.filter({ referrer_id: user?.id }, '-created_date', 200),
    enabled: !!user?.id,
  });

  const { data: payouts = [] } = useQuery({
    queryKey: ['myPayouts', user?.id],
    queryFn: () => base44.entities.PayoutRequest.filter({ affiliate_id: user?.id }, '-created_date', 50),
    enabled: !!user?.id,
  });

  // Derive earnings from Referrals (no separate Commission entity)
  const totalEarnings    = referrals.reduce((s, r) => s + (r.reward_amount || 0), 0);
  const pendingComm      = referrals.filter(r => r.reward_status === 'pending' && r.reward_amount > 0).reduce((s, r) => s + (r.reward_amount || 0), 0);
  const paidComm         = referrals.filter(r => r.reward_status === 'paid').reduce((s, r) => s + (r.reward_amount || 0), 0);
  const paidOut          = payouts.filter(p => p.status === 'completed').reduce((s, p) => s + (p.amount || 0), 0);
  const availableBalance = Math.max(0, pendingComm - paidOut);
  const totalReferrals  = referrals.length;
  const paidReferrals   = referrals.filter(r => ['paid', 'rewarded'].includes(r.status)).length;
  const convRate        = totalReferrals > 0 ? Math.round((paidReferrals / totalReferrals) * 100) : 0;

  const minPayout  = settings?.min_payout || 5000;
  const commType   = settings?.commission_type || 'percentage';
  const commRate   = commType === 'percentage'
    ? `${settings?.percentage_rate || 0}%`
    : commType === 'fixed'
    ? `MWK ${(settings?.fixed_amount || 0).toLocaleString()}`
    : 'Tiered';

  return (
    <div className="space-y-6">
      {/* Program Info Banner */}
      <div className="rounded-2xl p-5 border border-border flex flex-col sm:flex-row sm:items-center gap-4"
        style={{ background: 'linear-gradient(135deg, hsl(222 47% 14%), hsl(43 74% 52% / 0.08))' }}>
        <div className="flex-1 space-y-2">
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-background/50 border border-border text-sm">
              <TrendingUp className="w-4 h-4" style={{ color: 'hsl(43 74% 52%)' }} />
              <span className="text-muted-foreground">Commission Rate:</span>
              <span className="font-bold" style={{ color: 'hsl(43 74% 52%)' }}>{commRate}</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-background/50 border border-border text-sm">
              <Wallet className="w-4 h-4" style={{ color: 'hsl(43 74% 52%)' }} />
              <span className="text-muted-foreground">Min. Payout:</span>
              <span className="font-bold" style={{ color: 'hsl(43 74% 52%)' }}>MWK {minPayout.toLocaleString()}</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Your referral code: <span className="font-mono font-bold text-foreground">{referralCode}</span></p>
        </div>
        <Link to="/affiliate/links"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex-shrink-0"
          style={{ background: 'hsl(43 74% 52%)', color: 'hsl(222 47% 11%)' }}>
          Share Link <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Total Earnings"      value={`MWK ${totalEarnings.toLocaleString()}`}   icon={DollarSign}   color="text-accent bg-accent/10" />
        <StatCard label="Pending Commissions" value={`MWK ${pendingComm.toLocaleString()}`}     icon={Clock}        color="text-yellow-500 bg-yellow-500/10" />
        <StatCard label="Paid Commissions"    value={`MWK ${paidComm.toLocaleString()}`}        icon={CheckCircle2} color="text-green-500 bg-green-500/10" />
        <StatCard label="Available Balance"   value={`MWK ${Math.max(0,availableBalance).toLocaleString()}`} icon={Wallet} color="text-primary bg-primary/10"
          sub={availableBalance >= minPayout ? '✓ Eligible for payout' : `Need MWK ${Math.max(0,minPayout-availableBalance).toLocaleString()} more`} />
        <StatCard label="Total Referrals"     value={totalReferrals}                            icon={Users}        color="text-blue-500 bg-blue-500/10" />
        <StatCard label="Conversion Rate"     value={`${convRate}%`}                            icon={TrendingUp}   color="text-purple-500 bg-purple-500/10"
          sub={`${paidReferrals} of ${totalReferrals} paid`} />
      </div>

      {/* Quick links */}
      <div className="grid sm:grid-cols-3 gap-3">
        {[
          { label: 'View Referral Links', to: '/affiliate/links',       icon: '🔗' },
          { label: 'Request Payout',      to: '/affiliate/payouts',     icon: '💰' },
          { label: 'Marketing Materials', to: '/affiliate/materials',   icon: '📣' },
        ].map(({ label, to, icon }) => (
          <Link key={to} to={to}
            className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card hover:border-primary/30 hover:bg-muted/40 transition-all group">
            <span className="text-2xl">{icon}</span>
            <span className="text-sm font-medium flex-1">{label}</span>
            <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          </Link>
        ))}
      </div>

      {/* Recent referrals */}
      {referrals.length > 0 && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h3 className="font-semibold flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" /> Recent Referrals
            </h3>
            <Link to="/affiliate/referrals" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          <div className="divide-y divide-border">
            {referrals.slice(0, 5).map(r => (
              <div key={r.id} className="flex items-center gap-3 px-5 py-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-primary">
                    {(r.referred_name || r.referred_email || '?')[0].toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{r.referred_name || r.referred_email || 'Pending registration'}</p>
                  <p className="text-xs text-muted-foreground">{new Date(r.created_date).toLocaleDateString()}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  r.status === 'rewarded' ? 'bg-green-500/10 text-green-600' :
                  r.status === 'paid'     ? 'bg-yellow-500/10 text-yellow-600' :
                  r.status === 'registered' ? 'bg-blue-500/10 text-blue-600' :
                  'bg-muted text-muted-foreground'
                } capitalize`}>{r.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
