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
import { Switch } from '@/components/ui/switch';
import {
  Users, DollarSign, TrendingUp, Clock, CheckCircle2,
  Gift, Settings, Search, Eye, BarChart3, Loader2,
  UserCheck, Copy, Check, Link2, AlertCircle, Smartphone, Building2
} from 'lucide-react';
import { toast } from 'sonner';

const STATUS_COLORS = {
  pending:    'bg-yellow-500/10 text-yellow-600',
  registered: 'bg-blue-500/10 text-blue-600',
  paid:       'bg-success/10 text-success',
  rewarded:   'bg-primary/10 text-primary',
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
    payment_methods: { airtel_money: true, tnm_mpamba: true, bank_transfer: false },
    airtel_number: '',
    tnm_number: '',
    bank_details: '',
    program_name: 'Chibondo Referral Program',
    program_description: 'Earn rewards for every student you refer who pays fees.',
    enabled: true,
  });

  useQuery({
    queryKey: ['affiliateSettings'],
    queryFn: async () => {
      const res = await base44.entities.PlatformSettings.filter({ key: 'affiliate_commission' });
      if (res[0]?.value) setSettings(s => ({ ...s, ...res[0].value }));
      return res;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const existing = await base44.entities.PlatformSettings.filter({ key: 'affiliate_commission' });
      if (existing[0]) return base44.entities.PlatformSettings.update(existing[0].id, { value: settings });
      return base44.entities.PlatformSettings.create({ key: 'affiliate_commission', value: settings });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['affiliateSettings'] }); toast.success('Settings saved'); },
  });

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Program toggle */}
      <div className="flex items-center justify-between p-4 bg-card border border-border rounded-xl">
        <div>
          <p className="font-semibold text-sm">Affiliate Program</p>
          <p className="text-xs text-muted-foreground">Enable or disable the entire referral program</p>
        </div>
        <Switch checked={settings.enabled !== false} onCheckedChange={v => setSettings(s => ({ ...s, enabled: v }))} />
      </div>

      {/* Program info */}
      <div className="space-y-3 p-4 bg-card border border-border rounded-xl">
        <h4 className="font-semibold text-sm">Program Details</h4>
        <div>
          <Label className="text-xs">Program Name</Label>
          <Input className="mt-1" value={settings.program_name} onChange={e => setSettings(s => ({ ...s, program_name: e.target.value }))} />
        </div>
        <div>
          <Label className="text-xs">Description (shown to affiliates)</Label>
          <Input className="mt-1" value={settings.program_description} onChange={e => setSettings(s => ({ ...s, program_description: e.target.value }))} />
        </div>
      </div>

      {/* Commission type */}
      <div className="space-y-3 p-4 bg-card border border-border rounded-xl">
        <h4 className="font-semibold text-sm">Commission Structure</h4>
        <div className="grid grid-cols-3 gap-3">
          {[
            { id: 'percentage', label: 'Percentage', desc: '% of payment' },
            { id: 'fixed',      label: 'Fixed',      desc: 'MWK per referral' },
            { id: 'tiered',     label: 'Tiered',     desc: 'Rate by volume' },
          ].map(opt => (
            <button key={opt.id}
              onClick={() => setSettings(s => ({ ...s, commission_type: opt.id }))}
              className={`p-3 rounded-xl border-2 text-left transition-all ${settings.commission_type === opt.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}
            >
              <p className="font-semibold text-sm">{opt.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
            </button>
          ))}
        </div>

        {settings.commission_type === 'percentage' && (
          <div className="mt-3">
            <Label className="text-xs">Commission Rate (%)</Label>
            <div className="flex items-center gap-3 mt-1">
              <Input type="number" className="w-28" value={settings.percentage_rate}
                onChange={e => setSettings(s => ({ ...s, percentage_rate: parseFloat(e.target.value) || 0 }))} />
              <span className="text-sm text-muted-foreground">% of each payment</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              e.g. 10,000 MWK payment → affiliate earns MWK {((settings.percentage_rate / 100) * 10000).toLocaleString()}
            </p>
          </div>
        )}

        {settings.commission_type === 'fixed' && (
          <div className="mt-3">
            <Label className="text-xs">Fixed Amount (MWK)</Label>
            <Input type="number" className="w-36 mt-1" value={settings.fixed_amount}
              onChange={e => setSettings(s => ({ ...s, fixed_amount: parseFloat(e.target.value) || 0 }))} />
          </div>
        )}

        {settings.commission_type === 'tiered' && (
          <div className="space-y-3 mt-3">
            {[1, 2, 3].map(t => (
              <div key={t} className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Tier {t}: Min Referrals</Label>
                  <Input type="number" className="mt-1" value={settings[`tier${t}_referrals`]}
                    onChange={e => setSettings(s => ({ ...s, [`tier${t}_referrals`]: parseInt(e.target.value) || 0 }))} />
                </div>
                <div>
                  <Label className="text-xs">Rate (%)</Label>
                  <Input type="number" className="mt-1" value={settings[`tier${t}_rate`]}
                    onChange={e => setSettings(s => ({ ...s, [`tier${t}_rate`]: parseFloat(e.target.value) || 0 }))} />
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-3">
          <Label className="text-xs">Minimum Payout Threshold (MWK)</Label>
          <Input type="number" className="w-40 mt-1" value={settings.min_payout}
            onChange={e => setSettings(s => ({ ...s, min_payout: parseInt(e.target.value) || 0 }))} />
          <p className="text-xs text-muted-foreground mt-1">Min balance before payout can be requested</p>
        </div>
      </div>

      {/* Payment Methods */}
      <div className="space-y-3 p-4 bg-card border border-border rounded-xl">
        <h4 className="font-semibold text-sm">Payout Payment Methods</h4>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-red-500" />
              <span className="text-sm font-medium">Airtel Money</span>
            </div>
            <Switch checked={!!settings.payment_methods?.airtel_money} onCheckedChange={v => setSettings(s => ({ ...s, payment_methods: { ...s.payment_methods, airtel_money: v } }))} />
          </div>
          {settings.payment_methods?.airtel_money && (
            <Input placeholder="Airtel Money number" value={settings.airtel_number || ''} onChange={e => setSettings(s => ({ ...s, airtel_number: e.target.value }))} />
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-medium">TNM Mpamba</span>
            </div>
            <Switch checked={!!settings.payment_methods?.tnm_mpamba} onCheckedChange={v => setSettings(s => ({ ...s, payment_methods: { ...s.payment_methods, tnm_mpamba: v } }))} />
          </div>
          {settings.payment_methods?.tnm_mpamba && (
            <Input placeholder="TNM Mpamba number" value={settings.tnm_number || ''} onChange={e => setSettings(s => ({ ...s, tnm_number: e.target.value }))} />
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Bank Transfer</span>
            </div>
            <Switch checked={!!settings.payment_methods?.bank_transfer} onCheckedChange={v => setSettings(s => ({ ...s, payment_methods: { ...s.payment_methods, bank_transfer: v } }))} />
          </div>
          {settings.payment_methods?.bank_transfer && (
            <Input placeholder="Bank name, account number, account name" value={settings.bank_details || ''} onChange={e => setSettings(s => ({ ...s, bank_details: e.target.value }))} />
          )}
        </div>
      </div>

      <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
        {saveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
        Save Settings
      </Button>
    </div>
  );
}

// ─── AFFILIATE OVERVIEW ───────────────────────────────────────────────────────
function AffiliateOverview({ referrals, commissionSettings }) {
  const allAffiliateIds = [...new Set(referrals.map(r => r.referrer_id))];
  const totalAffiliates = allAffiliateIds.length;
  const activeAffiliates = allAffiliateIds.filter(id => referrals.some(r => r.referrer_id === id && r.status !== 'pending')).length;
  const totalReferrals = referrals.length;
  const converted = referrals.filter(r => ['registered', 'paid', 'rewarded'].includes(r.status)).length;
  const conversionRate = totalReferrals > 0 ? Math.round((converted / totalReferrals) * 100) : 0;
  const totalEarnings = referrals.reduce((s, r) => s + (r.reward_amount || 0), 0);
  const pendingPayouts = referrals.filter(r => r.reward_status === 'pending' && r.reward_amount > 0).reduce((s, r) => s + (r.reward_amount || 0), 0);
  const paidPayouts = referrals.filter(r => r.reward_status === 'paid').reduce((s, r) => s + (r.reward_amount || 0), 0);

  const type = commissionSettings?.commission_type || 'percentage';
  const rateDisplay = type === 'percentage' ? `${commissionSettings?.percentage_rate || 0}% per payment`
    : type === 'fixed' ? `MWK ${(commissionSettings?.fixed_amount || 0).toLocaleString()} per referral`
    : `Tiered (${commissionSettings?.tier1_rate || 0}% / ${commissionSettings?.tier2_rate || 0}% / ${commissionSettings?.tier3_rate || 0}%)`;

  const stats = [
    { label: 'Total Affiliates',  value: totalAffiliates,  color: 'text-primary bg-primary/10',    icon: Users },
    { label: 'Active Affiliates', value: activeAffiliates, color: 'text-success bg-success/10',    icon: UserCheck },
    { label: 'Total Referrals',   value: totalReferrals,   color: 'text-accent bg-accent/10',      icon: Gift },
    { label: 'Conversion Rate',   value: `${conversionRate}%`, color: 'text-blue-500 bg-blue-500/10', icon: TrendingUp },
    { label: 'Total Earnings',    value: `MWK ${totalEarnings.toLocaleString()}`, color: 'text-emerald-500 bg-emerald-500/10', icon: DollarSign },
    { label: 'Pending Payouts',   value: `MWK ${pendingPayouts.toLocaleString()}`, color: 'text-yellow-500 bg-yellow-500/10', icon: Clock },
    { label: 'Paid Out',          value: `MWK ${paidPayouts.toLocaleString()}`,   color: 'text-success bg-success/10',        icon: CheckCircle2 },
  ];

  return (
    <div className="space-y-4">
      {/* Commission rate banner */}
      <div className="flex items-center gap-3 p-4 bg-primary/5 border border-primary/20 rounded-xl">
        <DollarSign className="w-5 h-5 text-primary flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold">Active Commission Rate</p>
          <p className="text-xs text-muted-foreground">{rateDisplay} · Min payout: MWK {(commissionSettings?.min_payout || 0).toLocaleString()}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {stats.map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-card rounded-xl border border-border p-4">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${s.color}`}>
                <Icon className="w-4 h-4" />
              </div>
              <p className="text-xl font-bold font-display">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── LINK GENERATOR ──────────────────────────────────────────────────────────
function LinkGenerator({ users }) {
  const [selectedUser, setSelectedUser] = useState('');
  const [customCode, setCustomCode] = useState('');
  const [copied, setCopied] = useState('');

  const affiliateUsers = users.filter(u => u.role === 'user' || u.role === 'admin');

  const getCode = () => {
    if (customCode.trim()) return customCode.trim().toUpperCase();
    if (selectedUser) return `CHIB-${selectedUser.slice(-6).toUpperCase()}`;
    return '';
  };

  const link = getCode() ? `${window.location.origin}/register?ref=${getCode()}` : '';

  const copy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    toast.success('Copied!');
    setTimeout(() => setCopied(''), 2000);
  };

  return (
    <div className="space-y-4 max-w-lg">
      <p className="text-sm text-muted-foreground">Generate referral links for any affiliate. Links auto-track sign-ups.</p>

      <div>
        <Label>Select Affiliate (User)</Label>
        <Select value={selectedUser} onValueChange={setSelectedUser}>
          <SelectTrigger className="mt-1"><SelectValue placeholder="Choose a user..." /></SelectTrigger>
          <SelectContent>
            {affiliateUsers.map(u => <SelectItem key={u.id} value={u.id}>{u.full_name} ({u.email})</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Custom Code (optional)</Label>
        <Input className="mt-1 font-mono uppercase" placeholder="e.g. JOHN2024" value={customCode}
          onChange={e => setCustomCode(e.target.value.toUpperCase().replace(/\s/g, ''))} />
        <p className="text-xs text-muted-foreground mt-1">Leave blank to use auto-generated code from user ID</p>
      </div>

      {getCode() && (
        <div className="space-y-3 p-4 bg-card border border-border rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Referral Code</p>
              <p className="font-mono font-bold text-lg tracking-widest">{getCode()}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => copy(getCode(), 'code')}>
              {copied === 'code' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-mono text-muted-foreground break-all flex-1">{link}</p>
            <Button variant="outline" size="sm" className="flex-shrink-0" onClick={() => copy(link, 'link')}>
              {copied === 'link' ? <Check className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── PAYOUT REQUESTS ─────────────────────────────────────────────────────────
function PayoutRequests() {
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState({});

  const { data: requests = [] } = useQuery({
    queryKey: ['allPayoutRequests'],
    queryFn: () => base44.entities.PayoutRequest.list('-created_date', 100),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status, admin_notes }) =>
      base44.entities.PayoutRequest.update(id, { status, admin_notes }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['allPayoutRequests'] });
      toast.success(`Request ${vars.status}`);
    },
  });

  const pending  = requests.filter(r => r.status === 'pending');
  const resolved = requests.filter(r => r.status !== 'pending');

  const methodLabels = { airtel_money: 'Airtel Money', tnm_mpamba: 'TNM Mpamba', bank_transfer: 'Bank Transfer' };
  const reqStatusColors = {
    pending:  'bg-yellow-500/10 text-yellow-600',
    approved: 'bg-blue-500/10 text-blue-600',
    paid:     'bg-success/10 text-success',
    rejected: 'bg-destructive/10 text-destructive',
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold mb-0.5">Payout Requests</h3>
        <p className="text-sm text-muted-foreground">Review and approve affiliate payout requests</p>
      </div>

      {pending.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground border border-dashed border-border rounded-xl">
          <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-success opacity-40" />
          No pending payout requests.
        </div>
      ) : (
        <div className="space-y-3">
          {pending.map(req => (
            <div key={req.id} className="border border-yellow-500/20 rounded-xl bg-card p-4 space-y-3">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center font-bold text-yellow-600 text-sm flex-shrink-0">
                  {req.affiliate_name?.[0]?.toUpperCase() || 'A'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold">{req.affiliate_name || 'Affiliate'}</p>
                  <p className="text-xs text-muted-foreground">MWK {(req.amount || 0).toLocaleString()} · {methodLabels[req.payment_method] || req.payment_method}</p>
                  <p className="text-xs font-mono mt-0.5 text-muted-foreground">{req.payment_details}</p>
                  <p className="text-xs text-muted-foreground">{new Date(req.created_date).toLocaleDateString()}</p>
                </div>
                <Badge className="bg-yellow-500/10 text-yellow-600 text-[10px] flex-shrink-0">Pending</Badge>
              </div>
              <div className="flex gap-2 items-center">
                <input
                  className="flex-1 h-8 rounded-md border border-input bg-transparent px-3 py-1 text-xs"
                  placeholder="Admin note (optional)"
                  value={notes[req.id] || ''}
                  onChange={e => setNotes(n => ({ ...n, [req.id]: e.target.value }))}
                />
                <Button size="sm" variant="outline" className="text-destructive hover:bg-destructive/10"
                  onClick={() => updateMutation.mutate({ id: req.id, status: 'rejected', admin_notes: notes[req.id] || '' })}
                  disabled={updateMutation.isPending}>
                  Reject
                </Button>
                <Button size="sm" className="bg-success hover:bg-success/90 text-white"
                  onClick={() => updateMutation.mutate({ id: req.id, status: 'paid', admin_notes: notes[req.id] || '' })}
                  disabled={updateMutation.isPending}>
                  <CheckCircle2 className="w-4 h-4 mr-1" /> Mark Paid
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {resolved.length > 0 && (
        <div>
          <h3 className="font-semibold mb-3">History</h3>
          <div className="space-y-2">
            {resolved.slice(0, 30).map(req => (
              <div key={req.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card text-sm">
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{req.affiliate_name} · MWK {(req.amount || 0).toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{methodLabels[req.payment_method]} · {new Date(req.updated_date).toLocaleDateString()}
                    {req.admin_notes && <> · <em>{req.admin_notes}</em></>}
                  </p>
                </div>
                <Badge className={`text-[10px] capitalize flex-shrink-0 ${reqStatusColors[req.status]}`}>{req.status}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── AFFILIATE LIST ───────────────────────────────────────────────────────────
function AffiliateList({ referrals, users }) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const queryClient = useQueryClient();

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

  const affiliates = Object.values(affiliateMap).filter(a =>
    !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.code?.toLowerCase().includes(search.toLowerCase())
  );

  const updatePayoutMutation = useMutation({
    mutationFn: ({ id, reward_status }) => base44.entities.Referral.update(id, { reward_status }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['allReferrals'] }); toast.success('Updated'); },
  });

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search by name or code..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {affiliates.length === 0 && (
        <div className="text-center py-12 text-sm text-muted-foreground border border-dashed border-border rounded-xl">No affiliates found.</div>
      )}

      <div className="space-y-2">
        {affiliates.map(aff => {
          const converted = aff.referrals.filter(r => ['registered', 'paid', 'rewarded'].includes(r.status)).length;
          const isOpen = selected === aff.id;
          return (
            <div key={aff.id} className="border border-border rounded-xl bg-card overflow-hidden">
              <div className="flex items-center gap-4 p-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm flex-shrink-0">
                  {aff.name?.[0]?.toUpperCase() || 'A'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold">{aff.name}</p>
                  <p className="text-xs text-muted-foreground">Code: <span className="font-mono">{aff.code}</span> · {aff.referrals.length} referrals · {converted} converted</p>
                </div>
                <div className="text-right hidden sm:block mr-2">
                  <p className="font-bold text-sm">MWK {aff.totalEarnings.toLocaleString()}</p>
                  {aff.pendingEarnings > 0 && <p className="text-xs text-yellow-600">MWK {aff.pendingEarnings.toLocaleString()} pending</p>}
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelected(isOpen ? null : aff.id)}>
                  <Eye className="w-4 h-4 mr-1" /> {isOpen ? 'Hide' : 'View'}
                </Button>
              </div>

              {isOpen && (
                <div className="border-t border-border p-4 bg-muted/20 space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Total Earnings', value: `MWK ${aff.totalEarnings.toLocaleString()}` },
                      { label: 'Pending', value: `MWK ${aff.pendingEarnings.toLocaleString()}` },
                      { label: 'Paid Out', value: `MWK ${aff.paidEarnings.toLocaleString()}` },
                    ].map(m => (
                      <div key={m.label} className="bg-card rounded-lg p-3 text-center border border-border">
                        <p className="font-bold text-sm">{m.value}</p>
                        <p className="text-xs text-muted-foreground">{m.label}</p>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-1.5 max-h-60 overflow-y-auto">
                    {aff.referrals.map(r => (
                      <div key={r.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-border/50 bg-background text-sm">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{r.referred_name || r.referred_email || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground">{new Date(r.created_date).toLocaleDateString()}</p>
                        </div>
                        <Badge className={`text-[9px] ${STATUS_COLORS[r.status] || ''}`}>{r.status}</Badge>
                        {r.reward_amount > 0 && <span className="text-xs font-medium text-success">MWK {r.reward_amount.toLocaleString()}</span>}
                        <Select value={r.reward_status || 'pending'} onValueChange={v => updatePayoutMutation.mutate({ id: r.id, reward_status: v })}>
                          <SelectTrigger className="h-6 w-24 text-[10px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="paid">Paid</SelectItem>
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

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function AffiliateManagement() {
  const { data: referrals = [] } = useQuery({
    queryKey: ['allReferrals'],
    queryFn: () => base44.entities.Referral.list('-created_date', 500),
  });
  const { data: users = [] } = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => base44.entities.User.list('full_name', 500),
  });
  const { data: commissionSettingsData = [] } = useQuery({
    queryKey: ['affiliateSettings'],
    queryFn: () => base44.entities.PlatformSettings.filter({ key: 'affiliate_commission' }),
  });
  const commissionSettings = commissionSettingsData[0]?.value || {};

  const { data: payoutRequests = [] } = useQuery({
    queryKey: ['allPayoutRequests'],
    queryFn: () => base44.entities.PayoutRequest.list('-created_date', 100),
  });
  const pendingCount = payoutRequests.filter(r => r.status === 'pending').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">Affiliate Management</h1>
        <p className="text-sm text-muted-foreground mt-1">Referral program, commissions, and payout management</p>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex flex-wrap gap-1 h-auto">
          <TabsTrigger value="overview"><BarChart3 className="w-4 h-4 mr-1.5" /> Overview</TabsTrigger>
          <TabsTrigger value="affiliates"><Users className="w-4 h-4 mr-1.5" /> Affiliates</TabsTrigger>
          <TabsTrigger value="payouts" className="relative">
            <DollarSign className="w-4 h-4 mr-1.5" /> Payouts
            {pendingCount > 0 && <Badge className="ml-1.5 text-[9px] bg-yellow-500 text-white border-0 px-1.5 py-0">{pendingCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="links"><Link2 className="w-4 h-4 mr-1.5" /> Link Generator</TabsTrigger>
          <TabsTrigger value="settings"><Settings className="w-4 h-4 mr-1.5" /> Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-5"><AffiliateOverview referrals={referrals} users={users} commissionSettings={commissionSettings} /></TabsContent>
        <TabsContent value="affiliates" className="mt-5"><AffiliateList referrals={referrals} users={users} /></TabsContent>
        <TabsContent value="payouts" className="mt-5"><PayoutRequests /></TabsContent>
        <TabsContent value="links" className="mt-5"><LinkGenerator users={users} /></TabsContent>
        <TabsContent value="settings" className="mt-5"><CommissionSettings /></TabsContent>
      </Tabs>
    </div>
  );
}