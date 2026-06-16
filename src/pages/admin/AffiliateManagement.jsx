import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Users, DollarSign, CheckCircle2, Gift, Search,
  Eye, Link2, Copy, Check, Smartphone, Building2, Save, Loader2
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
  const [isDirty, setIsDirty] = useState(false);
  const [settings, setSettings] = useState({
    commission_type: 'fixed',
    percentage_rate: 10,
    fixed_amount: 10000,
    tier1_referrals: 5,  tier1_rate: 10,
    tier2_referrals: 15, tier2_rate: 15,
    tier3_referrals: 30, tier3_rate: 20,
    min_payout: 5000,
    recurring_commission: false,
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
      if (res[0]?.value) setSettings(prev => ({ ...prev, ...res[0].value }));
      return res;
    },
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  const update = (updates) => { setSettings(prev => ({ ...prev, ...updates })); setIsDirty(true); };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const existing = await base44.entities.PlatformSettings.filter({ key: 'affiliate_commission' });
      if (existing[0]) return base44.entities.PlatformSettings.update(existing[0].id, { key: 'affiliate_commission', value: settings });
      return base44.entities.PlatformSettings.create({ key: 'affiliate_commission', value: settings });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['affiliateSettings'] }); setIsDirty(false); toast.success('Settings saved'); },
    onError: (e) => toast.error('Save failed: ' + (e?.message || 'Unknown error')),
  });

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center justify-between p-4 bg-card border border-border rounded-xl">
        <div>
          <p className="font-semibold text-sm">Affiliate Program</p>
          <p className="text-xs text-muted-foreground">Enable or disable the entire referral program</p>
        </div>
        <Switch checked={settings.enabled !== false} onCheckedChange={v => update({ enabled: v })} />
      </div>

      <div className="space-y-3 p-4 bg-card border border-border rounded-xl">
        <h4 className="font-semibold text-sm">Program Details</h4>
        <div>
          <Label className="text-xs">Program Name</Label>
          <Input className="mt-1" value={settings.program_name} onChange={e => update({ program_name: e.target.value })} />
        </div>
        <div>
          <Label className="text-xs">Description (shown to affiliates)</Label>
          <Input className="mt-1" value={settings.program_description} onChange={e => update({ program_description: e.target.value })} />
        </div>
      </div>

      <div className="space-y-3 p-4 bg-card border border-border rounded-xl">
        <h4 className="font-semibold text-sm">Commission Structure</h4>
        <div className="grid grid-cols-3 gap-3">
          {[
            { id: 'percentage', label: 'Percentage', desc: '% of payment' },
            { id: 'fixed',      label: 'Fixed',      desc: 'MWK per referral' },
            { id: 'tiered',     label: 'Tiered',     desc: 'Rate by volume' },
          ].map(opt => (
            <button key={opt.id} onClick={() => update({ commission_type: opt.id })}
              className={`p-3 rounded-xl border-2 text-left transition-all ${settings.commission_type === opt.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}>
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
                onChange={e => update({ percentage_rate: parseFloat(e.target.value) || 0 })} />
              <span className="text-sm text-muted-foreground">% of each payment</span>
            </div>
          </div>
        )}

        {settings.commission_type === 'fixed' && (
          <div className="mt-3">
            <Label className="text-xs">Fixed Amount (MWK)</Label>
            <Input type="number" className="w-36 mt-1" value={settings.fixed_amount}
              onChange={e => update({ fixed_amount: parseFloat(e.target.value) || 0 })} />
          </div>
        )}

        {settings.commission_type === 'tiered' && (
          <div className="space-y-3 mt-3">
            {[1, 2, 3].map(t => (
              <div key={t} className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Tier {t}: Min Referrals</Label>
                  <Input type="number" className="mt-1" value={settings[`tier${t}_referrals`]}
                    onChange={e => update({ [`tier${t}_referrals`]: parseInt(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label className="text-xs">Rate (%)</Label>
                  <Input type="number" className="mt-1" value={settings[`tier${t}_rate`]}
                    onChange={e => update({ [`tier${t}_rate`]: parseFloat(e.target.value) || 0 })} />
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-3">
          <Label className="text-xs">Minimum Payout Threshold (MWK)</Label>
          <Input type="number" className="w-40 mt-1" value={settings.min_payout}
            onChange={e => update({ min_payout: parseInt(e.target.value) || 0 })} />
        </div>
      </div>

      <div className="flex items-center justify-between p-4 bg-card border border-border rounded-xl">
        <div>
          <p className="font-semibold text-sm">Recurring Commission</p>
          <p className="text-xs text-muted-foreground">Award commission on every renewal, not just first payment</p>
        </div>
        <Switch checked={!!settings.recurring_commission} onCheckedChange={v => update({ recurring_commission: v })} />
      </div>

      <div className="space-y-3 p-4 bg-card border border-border rounded-xl">
        <h4 className="font-semibold text-sm">Payout Payment Methods</h4>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><Smartphone className="w-4 h-4 text-red-500" /><span className="text-sm font-medium">Airtel Money</span></div>
            <Switch checked={!!settings.payment_methods?.airtel_money}
              onCheckedChange={v => update({ payment_methods: { ...settings.payment_methods, airtel_money: v } })} />
          </div>
          {settings.payment_methods?.airtel_money && (
            <Input placeholder="Airtel Money number" value={settings.airtel_number || ''}
              onChange={e => update({ airtel_number: e.target.value })} />
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><Smartphone className="w-4 h-4 text-blue-500" /><span className="text-sm font-medium">TNM Mpamba</span></div>
            <Switch checked={!!settings.payment_methods?.tnm_mpamba}
              onCheckedChange={v => update({ payment_methods: { ...settings.payment_methods, tnm_mpamba: v } })} />
          </div>
          {settings.payment_methods?.tnm_mpamba && (
            <Input placeholder="TNM Mpamba number" value={settings.tnm_number || ''}
              onChange={e => update({ tnm_number: e.target.value })} />
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><Building2 className="w-4 h-4 text-muted-foreground" /><span className="text-sm font-medium">Bank Transfer</span></div>
            <Switch checked={!!settings.payment_methods?.bank_transfer}
              onCheckedChange={v => update({ payment_methods: { ...settings.payment_methods, bank_transfer: v } })} />
          </div>
          {settings.payment_methods?.bank_transfer && (
            <Input placeholder="Bank name, account number, account name" value={settings.bank_details || ''}
              onChange={e => update({ bank_details: e.target.value })} />
          )}
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        {isDirty && <p className="text-xs text-yellow-600 font-medium mr-auto">● Unsaved changes</p>}
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}
          className="gap-2 px-6 font-semibold"
          style={{ background: 'hsl(43 74% 52%)', color: 'hsl(222 47% 8%)', border: 'none' }}>
          {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Settings
        </Button>
      </div>
    </div>
  );
}

// ─── OVERVIEW STATS ───────────────────────────────────────────────────────────
function OverviewStats({ referrals }) {
  const totalAffiliates = new Set(referrals.map(r => r.referrer_id)).size;
  const paidReferrals   = referrals.filter(r => ['paid', 'rewarded'].includes(r.status)).length;
  const totalEarnings   = referrals.reduce((s, r) => s + (r.reward_amount || 0), 0);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[
        { label: 'Total Affiliates', value: totalAffiliates, icon: Users,         color: 'bg-primary/10 text-primary' },
        { label: 'Total Referrals',  value: referrals.length, icon: Gift,         color: 'bg-yellow-500/10 text-yellow-600' },
        { label: 'Conversions',      value: paidReferrals,    icon: CheckCircle2, color: 'bg-success/10 text-success' },
        { label: 'Total Paid Out',   value: `MWK ${totalEarnings.toLocaleString()}`, icon: DollarSign, color: 'bg-blue-500/10 text-blue-600' },
      ].map(s => {
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
  );
}

// ─── AFFILIATE LIST ───────────────────────────────────────────────────────────
function AffiliateList({ referrals, users }) {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(null);

  const affiliateMap = referrals.reduce((acc, r) => {
    if (!acc[r.referrer_id]) {
      acc[r.referrer_id] = {
        id: r.referrer_id,
        name: r.referrer_name || users.find(u => u.id === r.referrer_id)?.full_name || 'Unknown',
        code: r.referral_code,
        referrals: [],
        totalEarnings: 0,
      };
    }
    acc[r.referrer_id].referrals.push(r);
    acc[r.referrer_id].totalEarnings += r.reward_amount || 0;
    return acc;
  }, {});

  const affiliates = Object.values(affiliateMap).filter(a =>
    !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.code?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search affiliates..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      {affiliates.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground border border-dashed border-border rounded-xl">
          <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
          {search ? 'No affiliates match your search.' : 'No affiliates yet.'}
        </div>
      ) : (
        <div className="space-y-2">
          {affiliates.map(aff => (
            <div key={aff.id} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary flex-shrink-0">
                  {aff.name[0]?.toUpperCase() || 'A'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold">{aff.name}</p>
                  <p className="text-xs font-mono text-muted-foreground">{aff.code}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-bold text-sm">MWK {aff.totalEarnings.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{aff.referrals.length} referral{aff.referrals.length !== 1 ? 's' : ''}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setExpanded(expanded === aff.id ? null : aff.id)}>
                  <Eye className="w-4 h-4" />
                </Button>
              </div>
              {expanded === aff.id && (
                <div className="mt-4 border-t border-border pt-4 space-y-1">
                  {aff.referrals.slice(0, 10).map(r => (
                    <div key={r.id} className="flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg hover:bg-muted/30">
                      <span className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ background: r.status === 'paid' || r.status === 'rewarded' ? 'hsl(142 71% 45%)' : r.status === 'registered' ? 'hsl(217 91% 60%)' : 'hsl(48 96% 53%)' }} />
                      <span className="flex-1 truncate">{r.referred_name || r.referred_email}</span>
                      <span className="text-muted-foreground capitalize">{r.status}</span>
                      <span className="font-semibold">{['paid','rewarded'].includes(r.status) ? `MWK ${(r.reward_amount||0).toLocaleString()}` : '—'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
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
    mutationFn: ({ id, status, admin_notes }) => base44.entities.PayoutRequest.update(id, { status, admin_notes }),
    onSuccess: (_, vars) => { queryClient.invalidateQueries({ queryKey: ['allPayoutRequests'] }); toast.success(`Request ${vars.status}`); },
  });

  const pending  = requests.filter(r => r.status === 'pending');
  const resolved = requests.filter(r => r.status !== 'pending');
  const methodLabels = { airtel_money: 'Airtel Money', tnm_mpamba: 'TNM Mpamba', bank_transfer: 'Bank Transfer' };

  return (
    <div className="space-y-6">
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
                </div>
              </div>
              <div className="flex gap-2 items-center">
                <input className="flex-1 h-8 rounded-md border border-input bg-transparent px-3 py-1 text-xs"
                  placeholder="Admin note (optional)" value={notes[req.id] || ''}
                  onChange={e => setNotes(n => ({ ...n, [req.id]: e.target.value }))} />
                <Button size="sm" variant="outline" className="text-destructive hover:bg-destructive/10"
                  onClick={() => updateMutation.mutate({ id: req.id, status: 'rejected', admin_notes: notes[req.id] || '' })}
                  disabled={updateMutation.isPending}>Reject</Button>
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
                  <p className="text-xs text-muted-foreground">{methodLabels[req.payment_method]} · {new Date(req.updated_date).toLocaleDateString()}</p>
                </div>
                <Badge className={`text-[10px] capitalize flex-shrink-0 ${req.status === 'paid' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>{req.status}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── LINK GENERATOR ──────────────────────────────────────────────────────────
function LinkGenerator({ users }) {
  const [selectedUser, setSelectedUser] = useState('');
  const [customCode, setCustomCode] = useState('');
  const [copied, setCopied] = useState('');

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
      <p className="text-sm text-muted-foreground">Generate referral links for affiliates. Links auto-track sign-ups.</p>
      <div>
        <Label>Select Affiliate</Label>
        <Select value={selectedUser} onValueChange={setSelectedUser}>
          <SelectTrigger className="mt-1"><SelectValue placeholder="Choose a user..." /></SelectTrigger>
          <SelectContent>
            {users.map(u => <SelectItem key={u.id} value={u.id}>{u.full_name} ({u.email})</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Custom Code (optional)</Label>
        <Input className="mt-1 font-mono uppercase" placeholder="e.g. JOHN2024" value={customCode}
          onChange={e => setCustomCode(e.target.value.toUpperCase().replace(/\s/g, ''))} />
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

// ─── MAIN EXPORT ──────────────────────────────────────────────────────────────
export default function AffiliateManagement() {
  const { data: referrals = [] } = useQuery({
    queryKey: ['allReferrals'],
    queryFn: () => base44.entities.Referral.list('-created_date', 2000),
    staleTime: 30_000,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => base44.entities.User.list('full_name', 500),
    staleTime: 60_000,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">Affiliate Management</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage your referral program, commissions, and payouts</p>
      </div>
      <Tabs defaultValue="overview">
        <TabsList className="mb-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="affiliates">Affiliates</TabsTrigger>
          <TabsTrigger value="payouts">Payout Requests</TabsTrigger>
          <TabsTrigger value="links">Link Generator</TabsTrigger>
          <TabsTrigger value="settings">Commission Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="overview"><OverviewStats referrals={referrals} /></TabsContent>
        <TabsContent value="affiliates"><AffiliateList referrals={referrals} users={users} /></TabsContent>
        <TabsContent value="payouts"><PayoutRequests /></TabsContent>
        <TabsContent value="links"><LinkGenerator users={users} /></TabsContent>
        <TabsContent value="settings"><CommissionSettings /></TabsContent>
      </Tabs>
    </div>
  );
}
