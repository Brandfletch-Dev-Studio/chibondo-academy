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
  Link2, Copy, Check, Smartphone, Building2,
  Save, Loader2, TrendingUp, Percent,
  Layers, Clock, XCircle, ChevronDown, ChevronUp,
} from 'lucide-react';
import { toast } from 'sonner';

const G = {
  navy:    'bg-gradient-to-br from-[hsl(222,47%,18%)] to-[hsl(222,47%,12%)]',
  gold:    'bg-gradient-to-br from-[hsl(43,74%,52%)] to-[hsl(38,70%,42%)]',
  success: 'bg-gradient-to-br from-[hsl(160,60%,40%)] to-[hsl(160,60%,30%)]',
  blue:    'bg-gradient-to-br from-[hsl(217,91%,50%)] to-[hsl(217,91%,38%)]',
};

function StatCard({ label, value, sub, icon: Icon, gradient, loading }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl p-5 ${gradient} transition-all duration-200 hover:scale-[1.01] hover:shadow-xl`}>
      <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-white/5 pointer-events-none" />
      <div className="absolute -right-2 -bottom-6 w-16 h-16 rounded-full bg-white/5 pointer-events-none" />
      <div className="relative z-10">
        <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center mb-4">
          <Icon className="w-5 h-5 text-white" />
        </div>
        {loading
          ? <Loader2 className="w-6 h-6 text-white/50 animate-spin" />
          : <p className="text-3xl font-display font-bold text-white leading-none">{value}</p>
        }
        <p className="text-sm font-semibold text-white/80 mt-1">{label}</p>
        {sub && <p className="text-xs text-white/50 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

const STATUS_CONFIG = {
  pending:    { label: 'Pending',    cls: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' },
  registered: { label: 'Registered', cls: 'bg-blue-500/10   text-blue-600   border-blue-500/20' },
  paid:       { label: 'Paid',       cls: 'bg-success/10    text-success    border-success/20' },
  rewarded:   { label: 'Rewarded',   cls: 'bg-primary/10    text-primary    border-primary/20' },
  rejected:   { label: 'Rejected',   cls: 'bg-destructive/10 text-destructive border-destructive/20' },
};
function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { label: status, cls: 'bg-muted text-muted-foreground border-border' };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cfg.cls}`}>{cfg.label}</span>;
}

function OverviewTab({ referrals, loading }) {
  const totalAffiliates  = new Set(referrals.map(r => r.referrer_id)).size;
  const paidReferrals    = referrals.filter(r => ['paid','rewarded'].includes(r.status)).length;
  const pendingReferrals = referrals.filter(r => r.status === 'pending').length;
  const totalPaidOut     = referrals.reduce((s, r) => s + (r.reward_amount || 0), 0);
  const conversionRate   = referrals.length > 0 ? Math.round((paidReferrals / referrals.length) * 100) : 0;
  const recent           = [...referrals].sort((a, b) => new Date(b.created_date) - new Date(a.created_date)).slice(0, 8);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Total Affiliates" value={totalAffiliates}                         sub="Active referrers"         icon={Users}        gradient={G.navy}    loading={loading} />
        <StatCard label="Total Referrals"  value={referrals.length}                        sub={`${pendingReferrals} pending`} icon={Gift}     gradient={G.gold}    loading={loading} />
        <StatCard label="Conversions"      value={paidReferrals}                           sub={`${conversionRate}% rate`}     icon={CheckCircle2} gradient={G.success} loading={loading} />
        <StatCard label="Total Paid Out"   value={`MWK ${totalPaidOut.toLocaleString()}`} sub="All time"                 icon={DollarSign}   gradient={G.blue}    loading={loading} />
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 className="font-display font-bold text-sm">Recent Referrals</h3>
          <TrendingUp className="w-4 h-4 text-accent" />
        </div>
        {recent.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <Gift className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No referrals yet</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {recent.map(r => (
              <div key={r.id} className="flex items-center gap-3 px-5 py-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs flex-shrink-0">
                  {(r.referred_name || r.referred_email || '?')[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{r.referred_name || r.referred_email}</p>
                  <p className="text-xs text-muted-foreground">via <span className="font-mono text-accent">{r.referral_code}</span> · {new Date(r.created_date).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {['paid','rewarded'].includes(r.status) && (
                    <span className="text-xs font-bold text-success">+MWK {(r.reward_amount||0).toLocaleString()}</span>
                  )}
                  <StatusBadge status={r.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AffiliatesTab({ referrals, users }) {
  const [search,   setSearch]   = useState('');
  const [expanded, setExpanded] = useState(null);

  const affiliateMap = referrals.reduce((acc, r) => {
    const id = r.referrer_id;
    if (!id) return acc;
    if (!acc[id]) {
      const user = users.find(u => u.id === id);
      acc[id] = {
        id,
        name:         r.referrer_name || user?.full_name || 'Unknown',
        email:        user?.email || '',
        avatar:       (r.referrer_name || user?.full_name || '?')[0].toUpperCase(),
        code:         r.referral_code,
        referrals:    [],
        totalEarnings: 0,
        conversions:  0,
      };
    }
    acc[id].referrals.push(r);
    acc[id].totalEarnings += r.reward_amount || 0;
    if (['paid','rewarded'].includes(r.status)) acc[id].conversions++;
    return acc;
  }, {});

  const affiliates = Object.values(affiliateMap)
    .sort((a, b) => b.totalEarnings - a.totalEarnings)
    .filter(a => !search
      || a.name.toLowerCase().includes(search.toLowerCase())
      || a.code?.toLowerCase().includes(search.toLowerCase())
      || a.email.toLowerCase().includes(search.toLowerCase())
    );

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input className="pl-9 rounded-xl" placeholder="Search by name, email or code…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {affiliates.length === 0 ? (
        <div className="text-center py-14 border border-dashed border-border rounded-2xl">
          <Users className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">{search ? 'No affiliates match your search.' : 'No affiliates yet.'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {affiliates.map((aff, idx) => (
            <div key={aff.id} className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="flex items-center gap-3 p-4">
                <span className="text-xs font-bold text-muted-foreground w-5 text-center flex-shrink-0">#{idx+1}</span>
                <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                  style={{ background: 'hsl(222,47%,18%)', color: 'hsl(43,74%,66%)' }}>
                  {aff.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{aff.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{aff.email}</p>
                </div>
                <span className="hidden sm:inline-flex items-center gap-1 text-xs font-mono px-2 py-1 bg-accent/10 text-accent rounded-lg border border-accent/20 flex-shrink-0">
                  <Link2 className="w-3 h-3" />{aff.code}
                </span>
                <div className="text-right flex-shrink-0 mr-1">
                  <p className="font-bold text-sm">MWK {aff.totalEarnings.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{aff.referrals.length} referral{aff.referrals.length !== 1 ? 's' : ''} · {aff.conversions} paid</p>
                </div>
                <button onClick={() => setExpanded(expanded === aff.id ? null : aff.id)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted/50 transition-colors flex-shrink-0">
                  {expanded === aff.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>
              {expanded === aff.id && (
                <div className="border-t border-border bg-muted/20 px-4 py-3 space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Referral History</p>
                  {aff.referrals.slice(0, 15).map(r => (
                    <div key={r.id} className="flex items-center gap-2 text-xs px-3 py-2 rounded-xl hover:bg-muted/40 transition-colors">
                      <span className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ background: ['paid','rewarded'].includes(r.status) ? 'hsl(160,60%,40%)' : r.status === 'registered' ? 'hsl(217,91%,60%)' : 'hsl(48,96%,53%)' }} />
                      <span className="flex-1 truncate font-medium">{r.referred_name || r.referred_email}</span>
                      <span className="text-muted-foreground">{new Date(r.created_date).toLocaleDateString()}</span>
                      <StatusBadge status={r.status} />
                      <span className="font-bold w-24 text-right">{['paid','rewarded'].includes(r.status) ? `MWK ${(r.reward_amount||0).toLocaleString()}` : '—'}</span>
                    </div>
                  ))}
                  {aff.referrals.length > 15 && (
                    <p className="text-xs text-center text-muted-foreground pt-1">+{aff.referrals.length - 15} more referrals</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PayoutsTab() {
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState({});
  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['allPayoutRequests'],
    queryFn: () => base44.entities.PayoutRequest.list('-created_date', 100),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status, admin_notes }) => base44.entities.PayoutRequest.update(id, { status, admin_notes }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['allPayoutRequests'] });
      toast.success(`Request ${vars.status === 'paid' ? 'marked as paid ✓' : 'rejected'}`);
    },
  });

  const pending  = requests.filter(r => r.status === 'pending');
  const resolved = requests.filter(r => r.status !== 'pending');
  const totalPending = pending.reduce((s, r) => s + (r.amount || 0), 0);
  const METHOD = { airtel_money: 'Airtel Money', tnm_mpamba: 'TNM Mpamba', bank_transfer: 'Bank Transfer' };

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      {pending.length > 0 && (
        <div className="flex items-center gap-4 px-5 py-4 rounded-2xl border border-yellow-500/20 bg-yellow-500/5">
          <div className="w-10 h-10 rounded-xl bg-yellow-500/15 flex items-center justify-center flex-shrink-0">
            <Clock className="w-5 h-5 text-yellow-600" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-sm">{pending.length} pending payout{pending.length !== 1 ? 's' : ''}</p>
            <p className="text-xs text-muted-foreground">MWK {totalPending.toLocaleString()} total awaiting approval</p>
          </div>
        </div>
      )}
      {pending.length === 0 ? (
        <div className="text-center py-14 border border-dashed border-border rounded-2xl">
          <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-success opacity-40" />
          <p className="text-sm text-muted-foreground font-medium">All caught up — no pending payouts</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pending.map(req => (
            <div key={req.id} className="bg-card border border-yellow-500/20 rounded-2xl p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                  style={{ background: 'hsl(222,47%,18%)', color: 'hsl(43,74%,66%)' }}>
                  {(req.affiliate_name || 'A')[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold">{req.affiliate_name || 'Affiliate'}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-sm font-bold" style={{ color: 'hsl(43,74%,52%)' }}>MWK {(req.amount || 0).toLocaleString()}</span>
                    <span className="text-xs text-muted-foreground">· {METHOD[req.payment_method] || req.payment_method}</span>
                  </div>
                  {req.payment_details && <p className="text-xs font-mono text-muted-foreground mt-0.5 truncate">{req.payment_details}</p>}
                </div>
                <span className="text-xs text-muted-foreground flex-shrink-0">{new Date(req.created_date).toLocaleDateString()}</span>
              </div>
              <div className="flex gap-2 items-center pt-1">
                <Input className="flex-1 h-8 text-xs rounded-xl" placeholder="Admin note (optional)"
                  value={notes[req.id] || ''} onChange={e => setNotes(n => ({ ...n, [req.id]: e.target.value }))} />
                <Button size="sm" variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10 rounded-xl gap-1 flex-shrink-0"
                  onClick={() => updateMutation.mutate({ id: req.id, status: 'rejected', admin_notes: notes[req.id] || '' })}
                  disabled={updateMutation.isPending}>
                  <XCircle className="w-3.5 h-3.5" /> Reject
                </Button>
                <Button size="sm" className="rounded-xl gap-1 flex-shrink-0 text-white"
                  style={{ background: 'hsl(160,60%,40%)' }}
                  onClick={() => updateMutation.mutate({ id: req.id, status: 'paid', admin_notes: notes[req.id] || '' })}
                  disabled={updateMutation.isPending}>
                  <CheckCircle2 className="w-3.5 h-3.5" /> Mark Paid
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      {resolved.length > 0 && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border">
            <h3 className="font-display font-bold text-sm">Payout History</h3>
          </div>
          <div className="divide-y divide-border">
            {resolved.slice(0, 30).map(req => (
              <div key={req.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{req.affiliate_name}</p>
                  <p className="text-xs text-muted-foreground">{METHOD[req.payment_method]} · {new Date(req.updated_date).toLocaleDateString()}</p>
                </div>
                <span className="font-semibold flex-shrink-0">MWK {(req.amount || 0).toLocaleString()}</span>
                <StatusBadge status={req.status} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LinkGeneratorTab({ users }) {
  const [selectedUser, setSelectedUser] = useState('');
  const [customCode,   setCustomCode]   = useState('');
  const [copied,       setCopied]       = useState('');

  const getCode = () => {
    if (customCode.trim()) return customCode.trim().toUpperCase();
    if (selectedUser)      return `CHIB-${selectedUser.slice(-6).toUpperCase()}`;
    return '';
  };
  const link = getCode() ? `${window.location.origin}/register?ref=${getCode()}` : '';
  const copy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopied(''), 2000);
  };

  return (
    <div className="space-y-4 max-w-lg">
      <p className="text-sm text-muted-foreground">Generate referral links for affiliates. Links automatically track sign-ups and attribute commissions.</p>
      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <div>
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Select Affiliate</Label>
          <Select value={selectedUser} onValueChange={setSelectedUser}>
            <SelectTrigger className="mt-1.5 rounded-xl"><SelectValue placeholder="Choose a user…" /></SelectTrigger>
            <SelectContent>
              {users.map(u => <SelectItem key={u.id} value={u.id}>{u.full_name} ({u.email})</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Custom Code <span className="normal-case font-normal">(optional)</span></Label>
          <Input className="mt-1.5 font-mono uppercase rounded-xl" placeholder="e.g. JOHN2024"
            value={customCode} onChange={e => setCustomCode(e.target.value.toUpperCase().replace(/\s/g, ''))} />
        </div>
      </div>
      {getCode() && (
        <div className="bg-card border border-accent/30 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-1">Referral Code</p>
              <p className="font-mono font-bold text-2xl tracking-widest" style={{ color: 'hsl(43,74%,52%)' }}>{getCode()}</p>
            </div>
            <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={() => copy(getCode(), 'code')}>
              {copied === 'code' ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
              {copied === 'code' ? 'Copied' : 'Copy'}
            </Button>
          </div>
          <div className="pt-3 border-t border-border">
            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-2">Referral Link</p>
            <div className="flex items-center gap-2">
              <p className="text-xs font-mono text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 flex-1 break-all">{link}</p>
              <Button variant="outline" size="sm" className="rounded-xl gap-1.5 flex-shrink-0" onClick={() => copy(link, 'link')}>
                {copied === 'link' ? <Check className="w-4 h-4 text-success" /> : <Link2 className="w-4 h-4" />}
                {copied === 'link' ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CommissionSettingsTab() {
  const queryClient = useQueryClient();
  const [isDirty, setIsDirty] = useState(false);
  const [settings, setSettings] = useState({
    commission_type: 'fixed', percentage_rate: 10, fixed_amount: 10000,
    tier1_referrals: 5,  tier1_rate: 10,
    tier2_referrals: 15, tier2_rate: 15,
    tier3_referrals: 30, tier3_rate: 20,
    min_payout: 5000, recurring_commission: false,
    recurring_rate_type: 'same',    // 'same' = follows main commission structure, 'custom' = separate config
    recurring_commission_type: 'fixed',
    recurring_percentage_rate: 5,
    recurring_fixed_amount: 5000,
    recurring_tier1_rate: 5,  recurring_tier2_rate: 8,  recurring_tier3_rate: 12,
    payment_methods: { airtel_money: true, tnm_mpamba: true, bank_transfer: false },
    airtel_number: '', tnm_number: '', bank_details: '',
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
    staleTime: 0, refetchOnWindowFocus: false,
  });

  const update = (u) => { setSettings(p => ({ ...p, ...u })); setIsDirty(true); };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const ex = await base44.entities.PlatformSettings.filter({ key: 'affiliate_commission' });
      if (ex[0]) return base44.entities.PlatformSettings.update(ex[0].id, { key: 'affiliate_commission', value: settings });
      return base44.entities.PlatformSettings.create({ key: 'affiliate_commission', value: settings });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['affiliateSettings'] }); setIsDirty(false); toast.success('Settings saved ✓'); },
    onError: e => toast.error('Save failed: ' + (e?.message || 'Unknown error')),
  });

  const S = 'bg-card border border-border rounded-2xl p-5 space-y-4';

  return (
    <div className="space-y-4 max-w-xl">
      {/* Toggle */}
      <div className="bg-card border border-border rounded-2xl p-5 flex items-center justify-between">
        <div>
          <p className="font-semibold text-sm">Affiliate Program</p>
          <p className="text-xs text-muted-foreground mt-0.5">Enable or disable the entire referral program</p>
        </div>
        <Switch checked={settings.enabled !== false} onCheckedChange={v => update({ enabled: v })} />
      </div>

      {/* Program Details */}
      <div className={S}>
        <h4 className="font-display font-bold text-sm">Program Details</h4>
        <div>
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Program Name</Label>
          <Input className="mt-1.5 rounded-xl" value={settings.program_name} onChange={e => update({ program_name: e.target.value })} />
        </div>
        <div>
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Description</Label>
          <Input className="mt-1.5 rounded-xl" value={settings.program_description} onChange={e => update({ program_description: e.target.value })} />
        </div>
      </div>

      {/* Commission Structure */}
      <div className={S}>
        <h4 className="font-display font-bold text-sm">Commission Structure</h4>
        <div className="grid grid-cols-3 gap-2">
          {[
            { id: 'percentage', label: 'Percentage', desc: '% of payment',    icon: Percent },
            { id: 'fixed',      label: 'Fixed',      desc: 'MWK per referral', icon: DollarSign },
            { id: 'tiered',     label: 'Tiered',     desc: 'Rate by volume',   icon: Layers },
          ].map(opt => {
            const Icon = opt.icon;
            return (
              <button key={opt.id} onClick={() => update({ commission_type: opt.id })}
                className={`p-3 rounded-xl border-2 text-left transition-all ${settings.commission_type === opt.id ? 'border-accent bg-accent/5' : 'border-border hover:border-accent/40'}`}>
                <Icon className={`w-4 h-4 mb-1.5 ${settings.commission_type === opt.id ? 'text-accent' : 'text-muted-foreground'}`} />
                <p className="font-semibold text-xs">{opt.label}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{opt.desc}</p>
              </button>
            );
          })}
        </div>
        {settings.commission_type === 'percentage' && (
          <div>
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Commission Rate</Label>
            <div className="flex items-center gap-3 mt-1.5">
              <Input type="number" className="w-24 rounded-xl" value={settings.percentage_rate}
                onChange={e => update({ percentage_rate: parseFloat(e.target.value) || 0 })} />
              <span className="text-sm text-muted-foreground">% of each payment</span>
            </div>
          </div>
        )}
        {settings.commission_type === 'fixed' && (
          <div>
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Fixed Amount (MWK)</Label>
            <Input type="number" className="w-36 mt-1.5 rounded-xl" value={settings.fixed_amount}
              onChange={e => update({ fixed_amount: parseFloat(e.target.value) || 0 })} />
          </div>
        )}
        {settings.commission_type === 'tiered' && (
          <div className="space-y-3">
            {[1,2,3].map(t => (
              <div key={t} className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Tier {t}: Min Referrals</Label>
                  <Input type="number" className="mt-1 rounded-xl" value={settings[`tier${t}_referrals`]}
                    onChange={e => update({ [`tier${t}_referrals`]: parseInt(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label className="text-xs">Rate (%)</Label>
                  <Input type="number" className="mt-1 rounded-xl" value={settings[`tier${t}_rate`]}
                    onChange={e => update({ [`tier${t}_rate`]: parseFloat(e.target.value) || 0 })} />
                </div>
              </div>
            ))}
          </div>
        )}
        <div>
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Min Payout (MWK)</Label>
          <Input type="number" className="w-40 mt-1.5 rounded-xl" value={settings.min_payout}
            onChange={e => update({ min_payout: parseInt(e.target.value) || 0 })} />
        </div>
      </div>

      {/* Recurring Commission */}
      <div className={S}>
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-display font-bold text-sm">Recurring Commission</h4>
            <p className="text-xs text-muted-foreground mt-0.5">Award commission on every renewal, not just first payment</p>
          </div>
          <Switch checked={!!settings.recurring_commission} onCheckedChange={v => update({ recurring_commission: v })} />
        </div>

        {settings.recurring_commission && (
          <div className="space-y-4 pt-3 border-t border-border">
            {/* Rate mode selector */}
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Recurring Rate</Label>
              <div className="grid grid-cols-2 gap-2 mt-1.5">
                {[
                  { id: 'same',   label: 'Same as Initial', desc: 'Follows main commission structure' },
                  { id: 'custom', label: 'Custom Rate',      desc: 'Set a different recurring rate' },
                ].map(opt => (
                  <button key={opt.id} onClick={() => update({ recurring_rate_type: opt.id })}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${
                      (settings.recurring_rate_type || 'same') === opt.id
                        ? 'border-accent bg-accent/5' : 'border-border hover:border-accent/40'
                    }`}>
                    <p className="font-semibold text-xs">{opt.label}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom recurring commission config — mirrors main commission structure */}
            {(settings.recurring_rate_type === 'custom') && (
              <div className="space-y-3">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Recurring Commission Type</Label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'percentage', label: 'Percentage', icon: Percent },
                    { id: 'fixed',      label: 'Fixed',      icon: DollarSign },
                    { id: 'tiered',     label: 'Tiered',     icon: Layers },
                  ].map(opt => {
                    const Icon = opt.icon;
                    return (
                      <button key={opt.id} onClick={() => update({ recurring_commission_type: opt.id })}
                        className={`p-2.5 rounded-xl border-2 text-left transition-all ${
                          (settings.recurring_commission_type || 'fixed') === opt.id
                            ? 'border-accent bg-accent/5' : 'border-border hover:border-accent/40'
                        }`}>
                        <Icon className={`w-3.5 h-3.5 mb-1 ${
                          (settings.recurring_commission_type || 'fixed') === opt.id ? 'text-accent' : 'text-muted-foreground'
                        }`} />
                        <p className="font-semibold text-[11px]">{opt.label}</p>
                      </button>
                    );
                  })}
                </div>

                {(settings.recurring_commission_type || 'fixed') === 'percentage' && (
                  <div>
                    <Label className="text-xs">Recurring Rate (%)</Label>
                    <div className="flex items-center gap-3 mt-1">
                      <Input type="number" className="w-24 rounded-xl" value={settings.recurring_percentage_rate || 5}
                        onChange={e => update({ recurring_percentage_rate: parseFloat(e.target.value) || 0 })} />
                      <span className="text-sm text-muted-foreground">% of each renewal</span>
                    </div>
                  </div>
                )}

                {(settings.recurring_commission_type || 'fixed') === 'fixed' && (
                  <div>
                    <Label className="text-xs">Recurring Fixed Amount (MWK)</Label>
                    <Input type="number" className="w-36 mt-1 rounded-xl" value={settings.recurring_fixed_amount || 5000}
                      onChange={e => update({ recurring_fixed_amount: parseFloat(e.target.value) || 0 })} />
                  </div>
                )}

                {(settings.recurring_commission_type || 'fixed') === 'tiered' && (
                  <div className="space-y-2">
                    {[1,2,3].map(t => (
                      <div key={t} className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-12">Tier {t}</span>
                        <Input type="number" className="w-20 rounded-xl" placeholder="Rate %"
                          value={settings[`recurring_tier${t}_rate`] || 0}
                          onChange={e => update({ [`recurring_tier${t}_rate`]: parseFloat(e.target.value) || 0 })} />
                        <span className="text-xs text-muted-foreground">%</span>
                      </div>
                    ))}
                    <p className="text-[10px] text-muted-foreground">Uses same referral thresholds as main tiers above</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Payment methods */}
      <div className={S}>
        <h4 className="font-display font-bold text-sm">Payout Methods</h4>
        <div className="space-y-3">
          {[
            { key: 'airtel_money',  label: 'Airtel Money',  icon: Smartphone, color: 'text-red-500',  bg: 'bg-red-500/10',   field: 'airtel_number', ph: 'Airtel Money number' },
            { key: 'tnm_mpamba',    label: 'TNM Mpamba',    icon: Smartphone, color: 'text-blue-500', bg: 'bg-blue-500/10',  field: 'tnm_number',   ph: 'TNM Mpamba number' },
            { key: 'bank_transfer', label: 'Bank Transfer', icon: Building2,  color: 'text-muted-foreground', bg: 'bg-muted', field: 'bank_details', ph: 'Bank name, account number, account name' },
          ].map(m => {
            const Icon = m.icon;
            return (
              <div key={m.key}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-lg ${m.bg} flex items-center justify-center`}>
                      <Icon className={`w-3.5 h-3.5 ${m.color}`} />
                    </div>
                    <span className="text-sm font-medium">{m.label}</span>
                  </div>
                  <Switch checked={!!settings.payment_methods?.[m.key]}
                    onCheckedChange={v => update({ payment_methods: { ...settings.payment_methods, [m.key]: v } })} />
                </div>
                {settings.payment_methods?.[m.key] && (
                  <Input className="mt-2 rounded-xl text-sm" placeholder={m.ph}
                    value={settings[m.field] || ''} onChange={e => update({ [m.field]: e.target.value })} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center justify-end gap-3 pt-1">
        {isDirty && <p className="text-xs text-yellow-600 font-medium mr-auto">● Unsaved changes</p>}
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}
          className="rounded-xl gap-2" style={{ background: 'hsl(43,74%,52%)', color: 'hsl(222,47%,8%)' }}>
          {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Settings
        </Button>
      </div>
    </div>
  );
}

export default function AffiliateManagement() {
  const { data: referrals = [], isLoading } = useQuery({
    queryKey: ['allReferrals'],
    queryFn: () => base44.entities.Referral.list('-created_date', 2000),
    staleTime: 30_000,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['allUsers'],
    queryFn: async () => {
      try {
        const res = await base44.functions.invoke('getAdminUsers', {});
        if (res?.users?.length) return res.users;
      } catch (_) {}
      return base44.entities.User.list('full_name', 500);
    },
    staleTime: 60_000,
  });

  const pendingPayouts = referrals.filter(r => r.status === 'pending').length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold">Affiliate Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage your referral program, commissions &amp; payouts</p>
        </div>
        {pendingPayouts > 0 && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-yellow-500/10 text-yellow-600 border border-yellow-500/20 flex-shrink-0">
            <Clock className="w-3.5 h-3.5" />
            {pendingPayouts} payout{pendingPayouts !== 1 ? 's' : ''} pending
          </span>
        )}
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="w-full justify-start bg-muted/50 rounded-xl p-1 h-auto flex-wrap gap-0.5 mb-1">
          {[
            { v: 'overview',   l: 'Overview' },
            { v: 'affiliates', l: 'Affiliates' },
            { v: 'payouts',    l: pendingPayouts > 0 ? `Payouts (${pendingPayouts})` : 'Payouts' },
            { v: 'links',      l: 'Link Generator' },
            { v: 'settings',   l: 'Settings' },
          ].map(t => (
            <TabsTrigger key={t.v} value={t.v}
              className="rounded-lg text-xs font-semibold data-[state=active]:bg-card data-[state=active]:shadow-sm px-3 py-1.5">
              {t.l}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="overview"   className="mt-4"><OverviewTab referrals={referrals} loading={isLoading} /></TabsContent>
        <TabsContent value="affiliates" className="mt-4"><AffiliatesTab referrals={referrals} users={users} /></TabsContent>
        <TabsContent value="payouts"    className="mt-4"><PayoutsTab /></TabsContent>
        <TabsContent value="links"      className="mt-4"><LinkGeneratorTab users={users} /></TabsContent>
        <TabsContent value="settings"   className="mt-4"><CommissionSettingsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
