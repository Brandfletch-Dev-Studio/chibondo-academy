import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/api/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  Users, DollarSign, Gift, TrendingUp, Clock, CheckCircle2,
  XCircle, ArrowUpRight, Search, Eye, Ban, RefreshCw, Loader2,
  Wallet, BarChart3, UserCheck, Settings2, ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow, format } from 'date-fns';

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n) => `MWK ${Number(n || 0).toLocaleString()}`;

const REFERRAL_STATUS = {
  pending:    { label: 'Pending',    color: 'bg-muted text-muted-foreground' },
  registered: { label: 'Registered', color: 'bg-blue-500/10 text-blue-600' },
  paid:       { label: 'Fees Paid',  color: 'bg-yellow-500/10 text-yellow-600' },
  rewarded:   { label: 'Rewarded',   color: 'bg-green-500/10 text-green-600' },
};

const PAYOUT_STATUS = {
  pending:    { label: 'Pending',    icon: Clock,        color: 'bg-yellow-500/10 text-yellow-600' },
  processing: { label: 'Processing', icon: ArrowUpRight, color: 'bg-blue-500/10 text-blue-600' },
  completed:  { label: 'Completed',  icon: CheckCircle2, color: 'bg-green-500/10 text-green-600' },
  rejected:   { label: 'Rejected',   icon: XCircle,      color: 'bg-red-500/10 text-red-600' },
};

function StatCard({ label, value, icon: Icon, color, sub }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      {sub && <p className="text-[11px] mt-1 text-muted-foreground">{sub}</p>}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AffiliateManagement() {
  const qc = useQueryClient();
  const [tab, setTab] = useState('overview');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [payoutDialog, setPayoutDialog] = useState(null); // payout object being reviewed
  const [rejectNote, setRejectNote] = useState('');
  const [settingsDialog, setSettingsDialog] = useState(false);
  const [settingsForm, setSettingsForm] = useState({});

  // ── Data fetching ──────────────────────────────────────────────────────────
  const { data: allReferrals = [], isLoading: loadingRef } = useQuery({queryKey: ['admin-all-referrals'],
    queryFn: async () => { try { return await db.entities.Referral.list('-created_date', 500); } catch(e) { console.error(e); return []; } },
    staleTime: 0, refetchOnWindowFocus: true, refetchInterval: 30_000,
    placeholderData: [],}));

  const { data: allPayouts = [], isLoading: loadingPay } = useQuery({queryKey: ['admin-all-payouts'],
    queryFn: async () => { try { return await db.entities.PayoutRequest.list('-created_date', 200); } catch(e) { console.error(e); return []; } },
    staleTime: 0, refetchOnWindowFocus: true, refetchInterval: 30_000,
    placeholderData: [],}));

  const { data: affiliates = [] } = useQuery({queryKey: ['admin-affiliates'],
    queryFn: async () => { try { return await db.entities.User.filter({ role: 'affiliate' }, 'full_name', 200); } catch(e) { console.error(e); return []; } },
    staleTime: 60_000,
    placeholderData: [],}));

  const { data: settingsRows = [] } = useQuery({queryKey: ['affiliateSettings'],
    queryFn: async () => { try { return await db.entities.PlatformSettings.filter({ key: 'affiliate_commission' }); } catch(e) { console.error(e); return []; } },
    staleTime: 60_000,
    placeholderData: [],}));

  const settings        = settingsRows[0]?.value || {};
  const commissionAmt   = settings.commission_amount ?? settings.fixed_amount ?? 10000;
  const minPayout       = settings.min_payout ?? 5000;

  // ── Stats ──────────────────────────────────────────────────────────────────
  const totalAffiliates  = affiliates.length;
  const totalReferrals   = allReferrals.length;
  const paidReferrals    = allReferrals.filter(r => ['paid', 'rewarded'].includes(r.status));
  const totalCommissions = paidReferrals.reduce((s, r) => s + (r.reward_amount || commissionAmt), 0);
  const totalPaidOut     = allPayouts.filter(p => p.status === 'completed').reduce((s, p) => s + (p.amount || 0), 0);
  const pendingPayouts   = allPayouts.filter(p => p.status === 'pending');

  // ── Mutations ──────────────────────────────────────────────────────────────
  const updatePayoutMut = useMutation({
    mutationFn: ({ id, status, admin_notes }) =>
      db.entities.PayoutRequest.update(id, { status, admin_notes: admin_notes || '' }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['admin-all-payouts'] });
      toast.success(`Payout marked as ${vars.status}`);
      setPayoutDialog(null);
      setRejectNote('');
    },
    onError: () => toast.error('Failed to update payout'),
  });

  const updateReferralMut = useMutation({
    mutationFn: ({ id, status }) => db.entities.Referral.update(id, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-all-referrals'] });
      toast.success('Referral status updated');
    },
    onError: () => toast.error('Failed to update referral'),
  });

  const saveSettingsMut = useMutation({
    mutationFn: async (vals) => {
      const existing = settingsRows[0];
      if (existing) {
        return db.entities.PlatformSettings.update(existing.id, { value: { ...existing.value, ...vals } });
      }
      return db.entities.PlatformSettings.create({ key: 'affiliate_commission', value: vals });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['affiliateSettings'] });
      toast.success('Settings saved');
      setSettingsDialog(false);
    },
    onError: () => toast.error('Failed to save settings'),
  });

  // ── Filtered referrals ─────────────────────────────────────────────────────
  const filteredReferrals = allReferrals.filter(r => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      (r.referred_name || '').toLowerCase().includes(q) ||
      (r.referred_email || '').toLowerCase().includes(q) ||
      (r.referrer_name || '').toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  // ── Top affiliates ─────────────────────────────────────────────────────────
  const affiliateStats = {};
  allReferrals.forEach(r => {
    if (!r.referrer_id) return;
    if (!affiliateStats[r.referrer_id]) {
      affiliateStats[r.referrer_id] = { name: r.referrer_name || r.referrer_id, total: 0, paid: 0, earned: 0 };
    }
    affiliateStats[r.referrer_id].total++;
    if (['paid', 'rewarded'].includes(r.status)) {
      affiliateStats[r.referrer_id].paid++;
      affiliateStats[r.referrer_id].earned += (r.reward_amount || commissionAmt);
    }
  });
  const topAffiliates = Object.values(affiliateStats).sort((a, b) => b.earned - a.earned).slice(0, 10);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Affiliate Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage affiliates, referrals, commissions and payouts</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => {
            qc.invalidateQueries({ queryKey: ['admin-all-referrals'] });
            qc.invalidateQueries({ queryKey: ['admin-all-payouts'] });
          }}>
            <RefreshCw className="w-4 h-4 mr-1.5" /> Refresh
          </Button>
          <Button size="sm" onClick={() => {
            setSettingsForm({
              commission_amount: commissionAmt,
              min_payout: minPayout,
              enabled: settings.enabled !== false,
            });
            setSettingsDialog(true);
          }}>
            <Settings2 className="w-4 h-4 mr-1.5" /> Settings
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Active Affiliates"   value={totalAffiliates}       icon={Users}      color="bg-primary/10 text-primary" />
        <StatCard label="Total Referrals"     value={totalReferrals}        icon={Gift}       color="bg-blue-500/10 text-blue-600" />
        <StatCard label="Total Commissions"   value={fmt(totalCommissions)} icon={DollarSign} color="bg-green-500/10 text-green-600" sub={`${fmt(totalPaidOut)} paid out`} />
        <StatCard label="Pending Payouts"     value={pendingPayouts.length} icon={Clock}      color="bg-yellow-500/10 text-yellow-600" sub={pendingPayouts.length > 0 ? 'Needs action' : 'All clear'} />
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="referrals">
            Referrals {allReferrals.length > 0 && <span className="ml-1.5 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">{allReferrals.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="payouts">
            Payouts {pendingPayouts.length > 0 && <span className="ml-1.5 text-[10px] bg-yellow-500/10 text-yellow-600 px-1.5 py-0.5 rounded-full">{pendingPayouts.length}</span>}
          </TabsTrigger>
        </TabsList>

        {/* ── Overview Tab ── */}
        <TabsContent value="overview" className="mt-5 space-y-5">
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              <h2 className="font-semibold">Top Affiliates</h2>
            </div>
            {topAffiliates.length === 0 ? (
              <div className="p-10 text-center text-muted-foreground text-sm">No affiliate data yet</div>
            ) : (
              <div className="divide-y divide-border/50">
                {topAffiliates.map((a, i) => (
                  <div key={i} className="flex items-center gap-4 px-5 py-3">
                    <span className="w-6 text-center text-sm font-bold text-muted-foreground">#{i + 1}</span>
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                      {(a.name || '?')[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{a.name}</p>
                      <p className="text-xs text-muted-foreground">{a.total} referrals · {a.paid} paid</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-green-600">{fmt(a.earned)}</p>
                      <p className="text-[10px] text-muted-foreground">earned</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent activity */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              <h2 className="font-semibold">Recent Referrals</h2>
            </div>
            <div className="divide-y divide-border/50">
              {allReferrals.slice(0, 8).map(r => {
                const cfg = REFERRAL_STATUS[r.status] || REFERRAL_STATUS.pending;
                return (
                  <div key={r.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{r.referred_name || r.referred_email || 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground">Referred by <span className="font-medium">{r.referrer_name || '—'}</span></p>
                    </div>
                    <Badge className={`text-[10px] shrink-0 ${cfg.color}`}>{cfg.label}</Badge>
                    <p className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {r.created_date ? formatDistanceToNow(new Date(r.created_date), { addSuffix: true }) : ''}
                    </p>
                  </div>
                );
              })}
              {allReferrals.length === 0 && (
                <div className="p-10 text-center text-sm text-muted-foreground">No referrals yet</div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ── Referrals Tab ── */}
        <TabsContent value="referrals" className="mt-5 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search by name, email or referrer…" value={search}
                onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40 shrink-0"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {Object.entries(REFERRAL_STATUS).map(([v, c]) => (
                  <SelectItem key={v} value={v}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            {loadingRef ? (
              <div className="flex items-center justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : filteredReferrals.length === 0 ? (
              <div className="py-16 text-center text-sm text-muted-foreground">No referrals found</div>
            ) : (
              <div className="divide-y divide-border/50">
                {filteredReferrals.map(r => {
                  const cfg = REFERRAL_STATUS[r.status] || REFERRAL_STATUS.pending;
                  const isPaid = ['paid', 'rewarded'].includes(r.status);
                  return (
                    <div key={r.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{r.referred_name || r.referred_email || 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground">
                          by <span className="font-medium">{r.referrer_name || '—'}</span>
                          {r.referred_email ? ` · ${r.referred_email}` : ''}
                        </p>
                      </div>
                      <Badge className={`text-[10px] shrink-0 ${cfg.color}`}>{cfg.label}</Badge>
                      <p className="text-sm font-medium text-green-600 w-24 text-right shrink-0">
                        {isPaid ? fmt(r.reward_amount || commissionAmt) : '—'}
                      </p>
                      {/* Quick status change */}
                      {r.status !== 'rewarded' && (
                        <Select
                          value={r.status}
                          onValueChange={(val) => updateReferralMut.mutate({ id: r.id, status: val })}
                        >
                          <SelectTrigger className="w-32 h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(REFERRAL_STATUS).map(([v, c]) => (
                              <SelectItem key={v} value={v} className="text-xs">{c.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── Payouts Tab ── */}
        <TabsContent value="payouts" className="mt-5 space-y-4">
          {pendingPayouts.length > 0 && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-3 flex items-center gap-2 text-sm text-yellow-700 dark:text-yellow-400">
              <Clock className="w-4 h-4 shrink-0" />
              <span>{pendingPayouts.length} payout request{pendingPayouts.length > 1 ? 's' : ''} awaiting review</span>
            </div>
          )}

          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            {loadingPay ? (
              <div className="flex items-center justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : allPayouts.length === 0 ? (
              <div className="py-16 text-center text-sm text-muted-foreground">No payout requests yet</div>
            ) : (
              <div className="divide-y divide-border/50">
                {allPayouts.map(p => {
                  const cfg = PAYOUT_STATUS[p.status] || PAYOUT_STATUS.pending;
                  const Icon = cfg.icon;
                  return (
                    <div key={p.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{p.affiliate_name || 'Unknown affiliate'}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.payment_method?.replace('_', ' ')} · {p.payment_details?.slice(0, 30)}
                        </p>
                        {p.admin_notes && <p className="text-xs text-muted-foreground mt-0.5 italic">{p.admin_notes}</p>}
                      </div>
                      <p className="text-sm font-bold shrink-0">{fmt(p.amount)}</p>
                      <Badge className={`text-[10px] shrink-0 flex items-center gap-1 ${cfg.color}`}>
                        <Icon className="w-3 h-3" />{cfg.label}
                      </Badge>
                      {p.status === 'pending' && (
                        <Button size="sm" variant="outline" className="h-7 text-xs shrink-0"
                          onClick={() => { setPayoutDialog(p); setRejectNote(''); }}>
                          Review
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Payout Review Dialog ── */}
      <Dialog open={!!payoutDialog} onOpenChange={() => setPayoutDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Review Payout Request</DialogTitle>
          </DialogHeader>
          {payoutDialog && (
            <div className="space-y-4">
              <div className="bg-muted/40 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Affiliate</span><span className="font-medium">{payoutDialog.affiliate_name}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span className="font-bold text-green-600">{fmt(payoutDialog.amount)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Method</span><span className="capitalize">{payoutDialog.payment_method?.replace('_', ' ')}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Details</span><span className="font-mono text-xs">{payoutDialog.payment_details}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Requested</span><span>{payoutDialog.created_date ? format(new Date(payoutDialog.created_date), 'dd MMM yyyy') : '—'}</span></div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Admin Note (optional)</label>
                <Textarea value={rejectNote} onChange={e => setRejectNote(e.target.value)}
                  placeholder="e.g. Payment sent via Airtel Money at 10:30am" className="text-sm resize-none" rows={2} />
              </div>
              <div className="flex gap-2 pt-1">
                <Button className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  disabled={updatePayoutMut.isPending}
                  onClick={() => updatePayoutMut.mutate({ id: payoutDialog.id, status: 'completed', admin_notes: rejectNote })}>
                  {updatePayoutMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4 mr-1.5" />Mark Paid</>}
                </Button>
                <Button variant="outline" className="flex-1"
                  disabled={updatePayoutMut.isPending}
                  onClick={() => updatePayoutMut.mutate({ id: payoutDialog.id, status: 'processing', admin_notes: rejectNote })}>
                  <ArrowUpRight className="w-4 h-4 mr-1.5" />Processing
                </Button>
                <Button variant="destructive" className="flex-1"
                  disabled={updatePayoutMut.isPending}
                  onClick={() => updatePayoutMut.mutate({ id: payoutDialog.id, status: 'rejected', admin_notes: rejectNote })}>
                  <XCircle className="w-4 h-4 mr-1.5" />Reject
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Settings Dialog ── */}
      <Dialog open={settingsDialog} onOpenChange={setSettingsDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Affiliate Program Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Commission per Referral (MWK)</label>
              <Input type="number" value={settingsForm.commission_amount ?? commissionAmt}
                onChange={e => setSettingsForm(f => ({ ...f, commission_amount: Number(e.target.value) }))} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Minimum Payout (MWK)</label>
              <Input type="number" value={settingsForm.min_payout ?? minPayout}
                onChange={e => setSettingsForm(f => ({ ...f, min_payout: Number(e.target.value) }))} />
            </div>
            <div className="flex items-center gap-3 py-2">
              <input type="checkbox" id="prog-enabled" checked={settingsForm.enabled !== false}
                onChange={e => setSettingsForm(f => ({ ...f, enabled: e.target.checked }))}
                className="w-4 h-4 accent-primary" />
              <label htmlFor="prog-enabled" className="text-sm font-medium">Program enabled</label>
            </div>
            <Button className="w-full" disabled={saveSettingsMut.isPending}
              onClick={() => saveSettingsMut.mutate(settingsForm)}>
              {saveSettingsMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Save Settings
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
