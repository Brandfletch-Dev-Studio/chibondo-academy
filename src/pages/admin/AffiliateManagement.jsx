import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Users, DollarSign, TrendingUp, Clock, CheckCircle2,
  Gift, Settings, ChevronRight, Search, Eye, Ban,
  BarChart3, Loader2, ArrowUpRight, UserCheck, AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

const STATUS_COLORS = {
  pending:    'bg-yellow-500/10 text-yellow-600',
  registered: 'bg-blue-500/10 text-blue-600',
  paid:       'bg-success/10 text-success',
  rewarded:   'bg-primary/10 text-primary',
};

const PAYOUT_COLORS = {
  pending:  'bg-yellow-500/10 text-yellow-600',
  paid:     'bg-success/10 text-success',
  cancelled:'bg-destructive/10 text-destructive',
};

// ─── COMMISSION SETTINGS ─────────────────────────────────────────────────────
function CommissionSettings() {
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState({
    commission_type: 'percentage',
    percentage_rate: 10,
    fixed_amount: 2000,
    tier1_referrals: 5,  tier1_rate: 10,
    tier2_referrals: 15, tier2_rate: 15,
    tier3_referrals: 30, tier3_rate: 20,
    min_payout: 5000,
  });
  const [loaded, setLoaded] = useState(false);

  useQuery({
    queryKey: ['affiliateSettings'],
    queryFn: async () => {
      const res = await base44.entities.PlatformSettings.filter({ key: 'affiliate_commission' });
      if (res[0]?.value) { setSettings(res[0].value); }
      setLoaded(true);
      return res;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const existing = await base44.entities.PlatformSettings.filter({ key: 'affiliate_commission' });
      if (existing[0]) {
        return base44.entities.PlatformSettings.update(existing[0].id, { value: settings });
      }
      return base44.entities.PlatformSettings.create({ key: 'affiliate_commission', value: settings });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['affiliateSettings'] }); toast.success('Commission settings saved'); },
  });

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h3 className="font-semibold mb-1">Commission Type</h3>
        <p className="text-sm text-muted-foreground mb-3">Choose how affiliates are rewarded for referrals</p>
        <div className="grid grid-cols-3 gap-3">
          {[
            { id: 'percentage', label: 'Percentage', desc: '% of each payment' },
            { id: 'fixed',      label: 'Fixed Amount', desc: 'MWK per referral' },
            { id: 'tiered',     label: 'Tiered',    desc: 'Rate by volume' },
          ].map(opt => (
            <button key={opt.id}
              onClick={() => setSettings(s => ({ ...s, commission_type: opt.id }))}
              className={`p-4 rounded-xl border-2 text-left transition-all ${settings.commission_type === opt.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}
            >
              <p className="font-semibold text-sm">{opt.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {settings.commission_type === 'percentage' && (
        <div className="p-4 bg-card border border-border rounded-xl">
          <Label>Commission Rate (%)</Label>
          <div className="flex items-center gap-3 mt-2">
            <Input type="number" className="w-32" value={settings.percentage_rate}
              onChange={e => setSettings(s => ({ ...s, percentage_rate: parseFloat(e.target.value) || 0 }))} />
            <span className="text-sm text-muted-foreground">% of each student payment</span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Example: If a student pays MWK 10,000, the affiliate earns MWK {((settings.percentage_rate / 100) * 10000).toLocaleString()}
          </p>
        </div>
      )}

      {settings.commission_type === 'fixed' && (
        <div className="p-4 bg-card border border-border rounded-xl">
          <Label>Fixed Amount per Referral (MWK)</Label>
          <div className="flex items-center gap-3 mt-2">
            <Input type="number" className="w-36" value={settings.fixed_amount}
              onChange={e => setSettings(s => ({ ...s, fixed_amount: parseFloat(e.target.value) || 0 }))} />
            <span className="text-sm text-muted-foreground">per successful referral</span>
          </div>
        </div>
      )}

      {settings.commission_type === 'tiered' && (
        <div className="p-4 bg-card border border-border rounded-xl space-y-4">
          <h4 className="font-semibold text-sm">Tier Thresholds</h4>
          {[
            { tier: 1, refKey: 'tier1_referrals', rateKey: 'tier1_rate' },
            { tier: 2, refKey: 'tier2_referrals', rateKey: 'tier2_rate' },
            { tier: 3, refKey: 'tier3_referrals', rateKey: 'tier3_rate' },
          ].map(t => (
            <div key={t.tier} className="grid grid-cols-2 gap-3 items-center">
              <div>
                <Label className="text-xs">Tier {t.tier}: Min Referrals</Label>
                <Input type="number" className="mt-1" value={settings[t.refKey]}
                  onChange={e => setSettings(s => ({ ...s, [t.refKey]: parseInt(e.target.value) || 0 }))} />
              </div>
              <div>
                <Label className="text-xs">Commission Rate (%)</Label>
                <Input type="number" className="mt-1" value={settings[t.rateKey]}
                  onChange={e => setSettings(s => ({ ...s, [t.rateKey]: parseFloat(e.target.value) || 0 }))} />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="p-4 bg-card border border-border rounded-xl">
        <Label>Minimum Payout Threshold (MWK)</Label>
        <Input type="number" className="mt-2 w-48" value={settings.min_payout}
          onChange={e => setSettings(s => ({ ...s, min_payout: parseInt(e.target.value) || 0 }))} />
        <p className="text-xs text-muted-foreground mt-1">Affiliates must reach this amount before requesting payout</p>
      </div>

      <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
        {saveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
        Save Commission Settings
      </Button>
    </div>
  );
}

// ─── DASHBOARD OVERVIEW ───────────────────────────────────────────────────────
function AffiliateDashboard({ referrals, users }) {
  const allAffiliateIds = [...new Set(referrals.map(r => r.referrer_id))];
  const totalAffiliates = allAffiliateIds.length;
  const activeAffiliates = allAffiliateIds.filter(id => referrals.some(r => r.referrer_id === id && r.status !== 'pending')).length;
  const totalReferrals = referrals.length;
  const converted = referrals.filter(r => ['registered', 'paid', 'rewarded'].includes(r.status)).length;
  const conversionRate = totalReferrals > 0 ? Math.round((converted / totalReferrals) * 100) : 0;
  const totalEarnings = referrals.reduce((s, r) => s + (r.reward_amount || 0), 0);
  const pendingPayouts = referrals.filter(r => r.reward_status === 'pending' && r.reward_amount > 0).reduce((s, r) => s + (r.reward_amount || 0), 0);
  const paidPayouts = referrals.filter(r => r.reward_status === 'paid').reduce((s, r) => s + (r.reward_amount || 0), 0);

  const stats = [
    { label: 'Total Affiliates',  value: totalAffiliates,  icon: Users,        color: 'text-primary bg-primary/10' },
    { label: 'Active Affiliates', value: activeAffiliates, icon: UserCheck,    color: 'text-success bg-success/10' },
    { label: 'Total Referrals',   value: totalReferrals,   icon: Gift,         color: 'text-accent bg-accent/10' },
    { label: 'Conversion Rate',   value: `${conversionRate}%`, icon: TrendingUp, color: 'text-blue-500 bg-blue-500/10' },
    { label: 'Total Earnings',    value: `MWK ${totalEarnings.toLocaleString()}`, icon: DollarSign, color: 'text-emerald-500 bg-emerald-500/10' },
    { label: 'Pending Payouts',   value: `MWK ${pendingPayouts.toLocaleString()}`, icon: Clock,  color: 'text-yellow-500 bg-yellow-500/10' },
    { label: 'Paid Out',          value: `MWK ${paidPayouts.toLocaleString()}`,   icon: CheckCircle2, color: 'text-success bg-success/10' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {stats.map(s => (
        <div key={s.label} className="bg-card rounded-xl border border-border p-4">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${s.color}`}>
            <s.icon className="w-4 h-4" />
          </div>
          <p className="text-xl font-bold font-display">{s.value}</p>
          <p className="text-xs text-muted-foreground">{s.label}</p>
        </div>
      ))}
    </div>
  );
}

// ─── AFFILIATE LIST + DETAIL ─────────────────────────────────────────────────
function AffiliateList({ referrals, users }) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const queryClient = useQueryClient();

  // Group referrals by referrer
  const affiliateMap = referrals.reduce((acc, r) => {
    if (!acc[r.referrer_id]) {
      acc[r.referrer_id] = {
        id: r.referrer_id,
        name: r.referrer_name || users.find(u => u.id === r.referrer_id)?.full_name || 'Unknown',
        code: r.referral_code,
        referrals: [],
        totalEarnings: 0,
        pendingEarnings: 0,
        paidEarnings: 0,
      };
    }
    acc[r.referrer_id].referrals.push(r);
    acc[r.referrer_id].totalEarnings += r.reward_amount || 0;
    if (r.reward_status === 'pending') acc[r.referrer_id].pendingEarnings += r.reward_amount || 0;
    if (r.reward_status === 'paid') acc[r.referrer_id].paidEarnings += r.reward_amount || 0;
    return acc;
  }, {});

  const affiliates = Object.values(affiliateMap).filter(a => {
    if (search && !a.name.toLowerCase().includes(search.toLowerCase()) && !a.code?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const updatePayoutMutation = useMutation({
    mutationFn: ({ id, reward_status }) => base44.entities.Referral.update(id, { reward_status }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['allReferrals'] }); toast.success('Payout status updated'); },
  });

  const selectedAffiliate = selected ? affiliateMap[selected] : null;

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search by name or referral code..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {affiliates.length === 0 && (
        <div className="text-center py-12 text-sm text-muted-foreground border border-dashed border-border rounded-xl">
          No affiliates found.
        </div>
      )}

      <div className="space-y-2">
        {affiliates.map(aff => {
          const converted = aff.referrals.filter(r => ['registered', 'paid', 'rewarded'].includes(r.status)).length;
          return (
            <div key={aff.id} className="border border-border rounded-xl bg-card p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm flex-shrink-0">
                  {aff.name?.[0]?.toUpperCase() || 'A'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold">{aff.name}</p>
                  <p className="text-xs text-muted-foreground">Code: <span className="font-mono">{aff.code}</span> · {aff.referrals.length} referrals · {converted} converted</p>
                </div>
                <div className="text-right hidden sm:block">
                  <p className="font-bold text-sm">MWK {aff.totalEarnings.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">total earnings</p>
                </div>
                {aff.pendingEarnings > 0 && (
                  <Badge className="bg-yellow-500/10 text-yellow-600 text-[10px]">
                    MWK {aff.pendingEarnings.toLocaleString()} pending
                  </Badge>
                )}
                <Button variant="ghost" size="sm" onClick={() => setSelected(selected === aff.id ? null : aff.id)}>
                  <Eye className="w-4 h-4 mr-1" /> {selected === aff.id ? 'Hide' : 'View'}
                </Button>
              </div>

              {selected === aff.id && selectedAffiliate && (
                <div className="mt-4 pt-4 border-t border-border space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Total Earnings', value: `MWK ${aff.totalEarnings.toLocaleString()}` },
                      { label: 'Pending Payout', value: `MWK ${aff.pendingEarnings.toLocaleString()}` },
                      { label: 'Total Paid Out', value: `MWK ${aff.paidEarnings.toLocaleString()}` },
                    ].map(m => (
                      <div key={m.label} className="bg-muted/30 rounded-lg p-3 text-center">
                        <p className="font-bold text-sm">{m.value}</p>
                        <p className="text-xs text-muted-foreground">{m.label}</p>
                      </div>
                    ))}
                  </div>

                  <h4 className="font-semibold text-sm">Referral History</h4>
                  <div className="space-y-1.5 max-h-64 overflow-y-auto">
                    {aff.referrals.map(r => (
                      <div key={r.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-border/50 bg-background text-sm">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{r.referred_name || r.referred_email || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground">{new Date(r.created_date).toLocaleDateString()}</p>
                        </div>
                        <Badge className={`text-[9px] ${STATUS_COLORS[r.status] || ''}`}>{r.status}</Badge>
                        {r.reward_amount > 0 && (
                          <span className="text-xs font-medium text-success">MWK {r.reward_amount.toLocaleString()}</span>
                        )}
                        <Select
                          value={r.reward_status || 'pending'}
                          onValueChange={v => updatePayoutMutation.mutate({ id: r.id, reward_status: v })}
                        >
                          <SelectTrigger className="h-6 w-28 text-[10px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="paid">Mark Paid</SelectItem>
                            <SelectItem value="cancelled">Cancel</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── PAYOUT MANAGEMENT ───────────────────────────────────────────────────────
function PayoutManagement({ referrals }) {
  const queryClient = useQueryClient();
  const pendingPayouts = referrals.filter(r => r.reward_status === 'pending' && (r.reward_amount || 0) > 0);
  const paidPayouts = referrals.filter(r => r.reward_status === 'paid');

  const approveAll = useMutation({
    mutationFn: async (affiliateId) => {
      const toApprove = pendingPayouts.filter(r => r.referrer_id === affiliateId);
      await Promise.all(toApprove.map(r => base44.entities.Referral.update(r.id, { reward_status: 'paid' })));
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['allReferrals'] }); toast.success('Payouts marked as paid'); },
  });

  // Group pending by affiliate
  const pendingByAffiliate = pendingPayouts.reduce((acc, r) => {
    const key = r.referrer_id;
    if (!acc[key]) acc[key] = { name: r.referrer_name || r.referrer_id, total: 0, items: [] };
    acc[key].total += r.reward_amount || 0;
    acc[key].items.push(r);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold mb-1">Pending Payouts</h3>
        <p className="text-sm text-muted-foreground">Affiliates with earned commissions awaiting payment</p>
      </div>

      {Object.keys(pendingByAffiliate).length === 0 && (
        <div className="text-center py-12 text-sm text-muted-foreground border border-dashed border-border rounded-xl">
          <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-success opacity-50" />
          No pending payouts. All commissions are settled.
        </div>
      )}

      <div className="space-y-3">
        {Object.entries(pendingByAffiliate).map(([id, aff]) => (
          <div key={id} className="border border-border rounded-xl bg-card p-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center font-bold text-yellow-600 text-sm flex-shrink-0">
                {aff.name?.[0]?.toUpperCase() || 'A'}
              </div>
              <div className="flex-1">
                <p className="font-semibold">{aff.name}</p>
                <p className="text-xs text-muted-foreground">{aff.items.length} pending referral{aff.items.length !== 1 ? 's' : ''}</p>
              </div>
              <div className="text-right">
                <p className="font-bold">MWK {aff.total.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">to pay out</p>
              </div>
              <Button size="sm" className="bg-success hover:bg-success/90 text-white"
                onClick={() => approveAll.mutate(id)}
                disabled={approveAll.isPending}>
                {approveAll.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4 mr-1" /> Mark Paid</>}
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div>
        <h3 className="font-semibold mb-3">Payout History</h3>
        <div className="space-y-2">
          {paidPayouts.slice(0, 20).map(r => (
            <div key={r.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card text-sm">
              <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
              <div className="flex-1">
                <p className="font-medium">{r.referrer_name || 'Affiliate'} → {r.referred_name || r.referred_email}</p>
                <p className="text-xs text-muted-foreground">{new Date(r.updated_date).toLocaleDateString()}</p>
              </div>
              <Badge className="bg-success/10 text-success text-[10px]">MWK {(r.reward_amount || 0).toLocaleString()}</Badge>
            </div>
          ))}
          {paidPayouts.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No paid payouts yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function AffiliateManagement() {
  const { data: referrals = [] } = useQuery({
    queryKey: ['allReferrals'],
    queryFn: () => base44.entities.Referral.list('-created_date', 500),
  });
  const { data: users = [] } = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => base44.entities.User.list('full_name', 500),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">Affiliate Management</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage referral programs, commission settings, and affiliate payouts</p>
      </div>

      <Tabs defaultValue="dashboard">
        <TabsList className="grid grid-cols-4 w-full max-w-xl">
          <TabsTrigger value="dashboard"><BarChart3 className="w-4 h-4 mr-1.5" /> Overview</TabsTrigger>
          <TabsTrigger value="affiliates"><Users className="w-4 h-4 mr-1.5" /> Affiliates</TabsTrigger>
          <TabsTrigger value="payouts"><DollarSign className="w-4 h-4 mr-1.5" /> Payouts</TabsTrigger>
          <TabsTrigger value="settings"><Settings className="w-4 h-4 mr-1.5" /> Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="dashboard" className="mt-5">
          <AffiliateDashboard referrals={referrals} users={users} />
        </TabsContent>
        <TabsContent value="affiliates" className="mt-5">
          <AffiliateList referrals={referrals} users={users} />
        </TabsContent>
        <TabsContent value="payouts" className="mt-5">
          <PayoutManagement referrals={referrals} />
        </TabsContent>
        <TabsContent value="settings" className="mt-5">
          <CommissionSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}