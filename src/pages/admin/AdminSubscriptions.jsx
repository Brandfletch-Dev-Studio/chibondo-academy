import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/api/supabaseClient';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  CreditCard, Search, CheckCircle2, XCircle, Clock, TrendingUp,
  Users, Banknote, CalendarDays, MoreVertical, Plus, Loader2, RefreshCw,
  Eye, X, ArrowRight, Mail, Send
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';
import { toast } from 'sonner';

const STATUS_COLORS = {
  active: 'bg-success/10 text-success border-success/20',
  expired: 'bg-destructive/10 text-destructive border-destructive/20',
  cancelled: 'bg-muted text-muted-foreground border-border',
  trial: 'bg-accent/10 text-accent border-accent/20',
  pending: 'bg-accent/10 text-accent border-accent/20',
};

// Map raw status values to display labels
const STATUS_LABELS = {
  active: 'Active',
  expired: 'Expired',
  cancelled: 'Cancelled',
  trial: 'Pending',
  pending: 'Pending',
};

const PLAN_COLORS = {
  free: 'bg-muted text-muted-foreground border-border',
  monthly: 'bg-primary/10 text-primary border-primary/20',
  quarterly: 'bg-accent/10 text-accent border-accent/20',
  annual: 'bg-success/10 text-success border-success/20',
  biannual: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
};

const PAYMENT_STATUS_COLORS = {
  completed: 'bg-success/10 text-success',
  pending: 'bg-accent/10 text-accent',
  failed: 'bg-destructive/10 text-destructive',
  refunded: 'bg-muted text-muted-foreground',
};

function StatCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-2xl font-bold font-display">{value}</p>
      <p className="text-sm font-medium mt-0.5">{label}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

export default function AdminSubscriptions() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPlan, setFilterPlan] = useState('all');
  const [grantOpen, setGrantOpen] = useState(false);
  const [sendingRecovery, setSendingRecovery] = useState(null); // payment id being sent
  const [grantStudentEmail, setGrantStudentEmail] = useState('');
  const [grantPlan, setGrantPlan] = useState('monthly');
  const [grantMonths, setGrantMonths] = useState(1);
  const [selectedSub, setSelectedSub] = useState(null); // membership detail drawer

  const { data: subscriptions = [], isLoading } = useQuery({
    queryKey: ['allSubscriptions'],
    queryFn: () => db.entities.Subscription.list('-created_date', 2000),
    staleTime: 30_000,
  });

  const { data: payments = [] } = useQuery({
    queryKey: ['allPayments'],
    queryFn: () => db.entities.Payment.list('-created_date', 2000),
    staleTime: 30_000,
  });

  // Fetch StudentProfiles directly — has user_id + full_name, no function call needed
  const { data: studentProfiles = [] } = useQuery({
    queryKey: ['allStudentProfiles'],
    queryFn: () => db.entities.StudentProfile.list('-created_date', 2000),
    staleTime: 60_000,
  });
  // Also try getAdminUsers for email/role data (best-effort, may fail)
  const { data: adminUsersResult = {} } = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => db.entities.User.list('-created_date', 2000).then(users => ({ users })).catch(() => ({ users: [] })),
    staleTime: 60_000,
  });
  const users = adminUsersResult.users || [];

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => db.entities.Subscription.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['allSubscriptions'] }); toast.success('Subscription updated'); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => db.entities.Subscription.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['allSubscriptions'] }); toast.success('Subscription removed'); },
  });

  // ── Grant access extra state ─────────────────────────────────────────────
  const [grantMode, setGrantMode] = useState('single'); // 'single' | 'bulk'
  const [grantSearch, setGrantSearch] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [customDays, setCustomDays] = useState('');
  const [grantDurationType, setGrantDurationType] = useState('preset'); // 'preset'|'custom'

  const computeGrantDays = () => {
    if (grantDurationType === 'custom') return Math.max(1, parseInt(customDays) || 30);
    return ({ monthly: 30, annual: 365, biannual: 730 }[grantPlan] || 30) * grantMonths;
  };

  const allGrantableUsers = React.useMemo(() => {
    const map = {};
    users.forEach(u => { map[u.id] = { id: u.id, email: u.email || '', full_name: u.full_name || '' }; });
    studentProfiles.forEach(p => {
      if (!map[p.user_id]) map[p.user_id] = { id: p.user_id, email: '', full_name: p.full_name || '' };
    });
    return Object.values(map).filter(u => u.email || u.full_name);
  }, [users, studentProfiles]);

  const filteredGrantUsers = allGrantableUsers.filter(u => {
    const q = grantSearch.toLowerCase();
    return !q || u.email.toLowerCase().includes(q) || u.full_name.toLowerCase().includes(q);
  });

  const toggleUserId = (id) => setSelectedUserIds(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  );

  const grantMutation = useMutation({
    mutationFn: async () => {
      const days = computeGrantDays();
      if (days < 1) throw new Error('Duration must be at least 1 day');

      let targets = [];
      if (grantMode === 'bulk') {
        if (selectedUserIds.length === 0) throw new Error('Select at least one student');
        targets = selectedUserIds.map(id => allGrantableUsers.find(u => u.id === id)).filter(Boolean);
      } else {
        const email = grantStudentEmail.trim().toLowerCase();
        if (!email) throw new Error('Enter a student email');
        // Pass email to backend — it will resolve the user
        targets = [{ email }];
      }

      const planLabel = grantDurationType === 'custom' ? 'custom' : grantPlan;

      // Use the service-role-backed endpoint — bypasses RLS
      const token = localStorage.getItem('aca_access_token');
      const resp = await fetch('/api/admin-grant-access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          targets: targets.filter(t => t.id).map(t => ({ id: t.id, email: t.email })),
          email:   targets.length === 1 && !targets[0].id ? targets[0].email : undefined,
          plan:    planLabel,
          days,
        }),
      });
      const result = await resp.json();
      if (!resp.ok || !result.success) {
        throw new Error(result.error || result.errors?.[0]?.error || 'Grant failed');
      }
      return result.granted;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['allSubscriptions'] });
      toast.success('Access granted to ' + count + (count > 1 ? ' students' : ' student') + ' ✓');
      setGrantOpen(false);
      setGrantStudentEmail('');
      setSelectedUserIds([]);
      setGrantSearch('');
      setGrantDurationType('preset');
      setCustomDays('');
    },
    onError: (err) => toast.error(err.message || 'Failed to grant access'),
  });

  // Build lookup: prefer User record (has email), fall back to StudentProfile (has full_name)
  const userMap = Object.fromEntries((users || []).map(u => [u.id, u]));
  const profileMap = Object.fromEntries(studentProfiles.map(p => [p.user_id, p]));
  const enriched = subscriptions.map(s => {
    const userRec = userMap[s.student_id];
    const profile = profileMap[s.student_id];
    return {
      ...s,
      _user: userRec
        ? { ...userRec, full_name: userRec.full_name || profile?.full_name || '' }
        : profile
          ? { id: s.student_id, full_name: profile.full_name, email: '', avatar_url: profile.avatar_url }
          : null,
    };
  });

  const filtered = enriched.filter(s => {
    const matchStatus = filterStatus === 'all' || s.status === filterStatus;
    const matchPlan = filterPlan === 'all' || s.plan === filterPlan;
    const matchSearch = !search || s._user?.full_name?.toLowerCase().includes(search.toLowerCase()) || s._user?.email?.toLowerCase().includes(search.toLowerCase()) || s.student_id?.includes(search);
    return matchStatus && matchPlan && matchSearch;
  });

  // Stats
  const totalRevenue = payments.filter(p => p.status === 'completed').reduce((sum, p) => sum + (p.amount || 0), 0);
  const activeCount = subscriptions.filter(s => s.status === 'active').length;
  const expiredCount = subscriptions.filter(s => s.status === 'expired').length;
  const pendingPayments = payments.filter(p => p.status === 'pending').length;

  const handleExtend = (sub, days) => {
    const newEnd = new Date((sub.expires_at ? new Date(sub.expires_at) : new Date()).getTime() + days * 86400000);
    updateMutation.mutate({ id: sub.id, data: { end_date: newEnd.toISOString(), status: 'active' } });
    toast.success(`Extended by ${days} days`);
  };

  // ── Manual recovery email — triggers the cron function for a single student ──
  const handleSendRecovery = async (payment) => {
    setSendingRecovery(payment.id);
    try {
      // Look up the student email from userMap or profileMap
      const email = userMap[payment.student_id]?.email || payment.student_email || '';
      if (!email) {
        toast.error('No email found for this student');
        return;
      }
      // Call the ACA's own cartRecoveryEmails function — self-contained, no external deps
      const nudgeRes = await fetch('https://chibondoacademy.com/api/cart-recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          force_student_id: payment.student_id,
          force_email: email,
          payment_id: payment.id,
          amount: payment.amount,
          description: payment.description,
          student_name: userMap[payment.student_id]?.full_name || '',
        }),
      });
      const res = await nudgeRes.json();
      if (!nudgeRes.ok || res?.error) throw new Error(res?.error || 'Nudge failed');
      toast.success(`Recovery email sent to ${email}`);
    } catch (e) {
      toast.error(e.message || 'Failed to send recovery email');
    } finally {
      setSendingRecovery(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page header — stacks on mobile, row on md+ */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-display font-bold leading-tight">School Fees &amp; Subscriptions</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage student fee payments and access</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            className="h-8 px-3 text-xs gap-1.5 border-border hover:bg-muted"
            onClick={async () => {
              const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
              const stale = subscriptions.filter(s =>
                ['trial', 'cancelled'].includes(s.status) && s.created_date < cutoff
              );
              if (stale.length === 0) { toast.info('No stale records to clean'); return; }
              await Promise.all(stale.map(s => db.entities.Subscription.delete(s.id)));
              queryClient.invalidateQueries({ queryKey: ['allSubscriptions'] });
              toast.success(`Cleaned ${stale.length} stale record(s)`);
            }}>
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Clean Stale</span>
          </Button>
          <Button
            size="sm"
            className="h-8 px-3 text-xs gap-1.5"
            onClick={() => setGrantOpen(true)}>
            <Plus className="w-3.5 h-3.5" />
            <span>Grant Access</span>
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Banknote} label="Total Revenue" value={`MWK ${totalRevenue.toLocaleString()}`} sub="Confirmed payments" color="bg-success/10 text-success" />
        <StatCard icon={CheckCircle2} label="Active Subscribers" value={activeCount} sub="Currently paying" color="bg-primary/10 text-primary" />
        <StatCard icon={XCircle} label="Expired" value={expiredCount} sub="Need renewal" color="bg-destructive/10 text-destructive" />
        <StatCard icon={Clock} label="Pending Payments" value={pendingPayments} sub="Awaiting confirmation" color="bg-accent/10 text-accent" />
      </div>

      <Tabs defaultValue="subscriptions">
        <TabsList>
          <TabsTrigger value="subscriptions"><Users className="w-4 h-4 mr-1.5" /> Subscriptions</TabsTrigger>
          <TabsTrigger value="payments"><CreditCard className="w-4 h-4 mr-1.5" /> Payment History</TabsTrigger>
        </TabsList>

        {/* SUBSCRIPTIONS TAB */}
        <TabsContent value="subscriptions" className="mt-5 space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search student..." className="pl-9 h-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="trial">Pending</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterPlan} onValueChange={setFilterPlan}>
              <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Plans</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="annual">Annual</SelectItem>
                <SelectItem value="biannual">Biannual</SelectItem>
                <SelectItem value="free">Free</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Membership Table */}
          <div className="bg-card rounded-2xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Student</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Plan</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground hidden md:table-cell">Start Date</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground hidden md:table-cell">End Date</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground hidden lg:table-cell">Amount</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {isLoading && (
                    <tr><td colSpan={7} className="text-center py-10 text-muted-foreground text-sm"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>
                  )}
                  {!isLoading && filtered.map(sub => {
                    const isExpiringSoon = sub.status === 'active' && sub.expires_at &&
                      (new Date(sub.expires_at) - new Date()) < 4 * 24 * 60 * 60 * 1000 &&
                      (new Date(sub.expires_at) - new Date()) > 0;
                    const isOverdue = sub.status === 'active' && sub.expires_at && new Date(sub.expires_at) < new Date();
                    return (
                    <tr key={sub.id} className="hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => setSelectedSub(sub)}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                            {sub._user?.full_name?.[0]?.toUpperCase() || '?'}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{sub._user?.full_name || 'Unknown'}</p>
                            <p className="text-[10px] text-muted-foreground">{sub._user?.email || sub.student_id?.slice(0, 14) + '...'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={`text-[10px] capitalize ${PLAN_COLORS[sub.plan] || 'bg-muted'}`}>{sub.plan}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={`text-[10px] capitalize ${STATUS_COLORS[sub.status] || 'bg-muted'}`}>
                          {STATUS_LABELS[sub.status] || sub.status}
                        </Badge>
                      </td>
                      {/* Start Date */}
                      <td className="px-4 py-3 hidden md:table-cell">
                        {sub.start_date ? (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <CalendarDays className="w-3 h-3 flex-shrink-0" />
                            {format(new Date(sub.start_date), 'MMM d, yyyy')}
                          </div>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </td>
                      {/* End Date */}
                      <td className="px-4 py-3 hidden md:table-cell">
                        {sub.expires_at ? (
                          <div className={`flex items-center gap-1 text-xs ${isOverdue ? 'text-destructive font-semibold' : isExpiringSoon ? 'text-amber-500 font-semibold' : 'text-muted-foreground'}`}>
                            <CalendarDays className="w-3 h-3 flex-shrink-0" />
                            {format(new Date(sub.expires_at), 'MMM d, yyyy')}
                            {isExpiringSoon && <span className="text-[9px] bg-amber-500/10 text-amber-500 px-1 rounded">Soon</span>}
                            {isOverdue && <span className="text-[9px] bg-destructive/10 text-destructive px-1 rounded">Overdue</span>}
                          </div>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs font-medium hidden lg:table-cell">
                        {sub.amount_paid > 0 ? `MWK ${sub.amount_paid.toLocaleString()}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedSub(sub)}>
                            <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {sub.status !== 'active' && (
                                <DropdownMenuItem onClick={() => updateMutation.mutate({ id: sub.id, data: { status: 'active' } })}>
                                  <CheckCircle2 className="w-4 h-4 mr-2 text-success" /> Activate
                                </DropdownMenuItem>
                              )}
                              {sub.status === 'active' && (
                                <DropdownMenuItem onClick={() => updateMutation.mutate({ id: sub.id, data: { status: 'cancelled' } })}>
                                  <XCircle className="w-4 h-4 mr-2 text-destructive" /> Cancel
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => handleExtend(sub, 30)}>
                                <RefreshCw className="w-4 h-4 mr-2" /> Extend 30 days
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleExtend(sub, 365)}>
                                <RefreshCw className="w-4 h-4 mr-2" /> Extend 1 year
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => deleteMutation.mutate(sub.id)}>
                                <XCircle className="w-4 h-4 mr-2" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  )})}
                  {!isLoading && filtered.length === 0 && (
                    <tr><td colSpan={7} className="text-center py-10 text-muted-foreground text-sm">No subscriptions found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* ── Membership Detail Drawer ────────────────────────────────────── */}
        {selectedSub && (() => {
          const s = selectedSub;
          const daysLeft = s.expires_at ? Math.ceil((new Date(s.expires_at) - new Date()) / 86400000) : null;
          const duration = s.start_date && s.expires_at
            ? Math.ceil((new Date(s.expires_at) - new Date(s.start_date)) / 86400000)
            : null;
          return (
            <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setSelectedSub(null)}>
              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
              <div
                className="relative bg-card border-l border-border w-full max-w-sm h-full overflow-y-auto shadow-2xl"
                onClick={e => e.stopPropagation()}
              >
                {/* Drawer header */}
                <div className="sticky top-0 bg-card border-b border-border px-5 py-4 flex items-center justify-between z-10">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                      {s._user?.full_name?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <p className="text-sm font-semibold leading-tight">{s._user?.full_name || 'Unknown'}</p>
                      <p className="text-[10px] text-muted-foreground">{s._user?.email || '—'}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedSub(null)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                <div className="p-5 space-y-5">
                  {/* Status + Plan badges */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={`capitalize ${STATUS_COLORS[s.status] || 'bg-muted'}`}>
                      {STATUS_LABELS[s.status] || s.status}
                    </Badge>
                    <Badge className={`capitalize ${PLAN_COLORS[s.plan] || 'bg-muted'}`}>{s.plan}</Badge>
                    {daysLeft !== null && daysLeft > 0 && (
                      <span className="text-[10px] text-muted-foreground">{daysLeft} day{daysLeft !== 1 ? 's' : ''} left</span>
                    )}
                    {daysLeft !== null && daysLeft <= 0 && (
                      <span className="text-[10px] text-destructive font-semibold">Expired {Math.abs(daysLeft)} day{Math.abs(daysLeft) !== 1 ? 's' : ''} ago</span>
                    )}
                  </div>

                  {/* Membership period */}
                  <div className="bg-muted/40 rounded-xl p-4 space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Membership Period</p>
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <p className="text-[10px] text-muted-foreground mb-0.5">Start Date</p>
                        <p className="text-sm font-semibold">
                          {s.start_date ? format(new Date(s.start_date), 'dd MMM yyyy') : '—'}
                        </p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-[10px] text-muted-foreground mb-0.5">End Date</p>
                        <p className={`text-sm font-semibold ${daysLeft !== null && daysLeft <= 0 ? 'text-destructive' : daysLeft !== null && daysLeft <= 3 ? 'text-amber-500' : ''}`}>
                          {s.expires_at ? format(new Date(s.expires_at), 'dd MMM yyyy') : '—'}
                        </p>
                      </div>
                    </div>
                    {duration && (
                      <p className="text-[10px] text-muted-foreground">Duration: {duration} days</p>
                    )}
                  </div>

                  {/* Payment details */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Payment</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: 'Amount Paid', value: s.amount_paid > 0 ? `MWK ${s.amount_paid.toLocaleString()}` : '—' },
                        { label: 'Currency',    value: s.currency || 'MWK' },
                        { label: 'Method',      value: s.payment_method?.replace(/_/g, ' ') || '—' },
                        { label: 'Auto-renew',  value: s.auto_renew ? 'Yes' : 'No' },
                      ].map(item => (
                        <div key={item.label} className="bg-muted/30 rounded-lg p-3">
                          <p className="text-[10px] text-muted-foreground">{item.label}</p>
                          <p className="text-xs font-semibold capitalize mt-0.5">{item.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Record metadata */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Record Info</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: 'Created',  value: s.created_date ? format(new Date(s.created_date), 'dd MMM yyyy HH:mm') : '—' },
                        { label: 'Updated',  value: s.updated_date ? format(new Date(s.updated_date), 'dd MMM yyyy HH:mm') : '—' },
                        { label: 'Record ID', value: s.id?.slice(0, 10) + '...' },
                        { label: 'Student ID', value: s.student_id?.slice(0, 10) + '...' },
                      ].map(item => (
                        <div key={item.label} className="bg-muted/30 rounded-lg p-3">
                          <p className="text-[10px] text-muted-foreground">{item.label}</p>
                          <p className="text-xs font-semibold mt-0.5 break-all">{item.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Quick actions */}
                  <div className="space-y-2 pb-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Quick Actions</p>
                    <div className="grid grid-cols-2 gap-2">
                      {s.status !== 'active' && (
                        <Button size="sm" className="h-9 text-xs" onClick={() => { updateMutation.mutate({ id: s.id, data: { status: 'active' } }); setSelectedSub(null); }}>
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Activate
                        </Button>
                      )}
                      {s.status === 'active' && (
                        <Button size="sm" variant="outline" className="h-9 text-xs" onClick={() => { updateMutation.mutate({ id: s.id, data: { status: 'cancelled' } }); setSelectedSub(null); }}>
                          <XCircle className="w-3.5 h-3.5 mr-1" /> Cancel
                        </Button>
                      )}
                      <Button size="sm" variant="outline" className="h-9 text-xs" onClick={() => { handleExtend(s, 30); setSelectedSub(null); }}>
                        <RefreshCw className="w-3.5 h-3.5 mr-1" /> +30 days
                      </Button>
                      <Button size="sm" variant="outline" className="h-9 text-xs" onClick={() => { handleExtend(s, 365); setSelectedSub(null); }}>
                        <RefreshCw className="w-3.5 h-3.5 mr-1" /> +1 year
                      </Button>
                      <Button size="sm" variant="destructive" className="h-9 text-xs col-span-2" onClick={() => { deleteMutation.mutate(s.id); setSelectedSub(null); }}>
                        <XCircle className="w-3.5 h-3.5 mr-1" /> Delete Record
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* PAYMENTS TAB */}
        <TabsContent value="payments" className="mt-5">
          <div className="bg-card rounded-2xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Student</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Method</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground hidden md:table-cell">Reference</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground hidden md:table-cell">Date</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Amount</th>
                     <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {payments.map(p => (
                    <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium">{p.student_name && p.student_name !== 'Unknown' ? p.student_name : (profileMap[p.student_id]?.full_name || userMap[p.student_id]?.full_name || 'Unknown')}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground capitalize">
                        {p.method?.replace(/_/g, ' ') || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${PAYMENT_STATUS_COLORS[p.status] || 'bg-muted'}`}>
                          {p.status === 'completed' && <CheckCircle2 className="w-3 h-3" />}
                          {p.status === 'pending' && <Clock className="w-3 h-3" />}
                          {p.status === 'failed' && <XCircle className="w-3 h-3" />}
                          {p.status}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-muted-foreground hidden md:table-cell">
                        {p.reference || '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell">
                        {p.created_date ? format(new Date(p.created_date), 'MMM d, yyyy HH:mm') : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`text-sm font-bold ${p.status === 'completed' ? 'text-success' : 'text-foreground'}`}>
                          MWK {p.amount?.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {p.status === 'pending' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-[11px] gap-1.5 border-accent/40 text-accent hover:bg-accent/10"
                            onClick={() => handleSendRecovery(p)}
                            disabled={sendingRecovery === p.id}
                            title="Manually send a cart recovery email to this student"
                          >
                            {sendingRecovery === p.id
                              ? <Loader2 className="w-3 h-3 animate-spin" />
                              : <Send className="w-3 h-3" />
                            }
                            {sendingRecovery === p.id ? 'Sending…' : 'Nudge'}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {payments.length === 0 && (
                    <tr><td colSpan={7} className="text-center py-10 text-muted-foreground text-sm">No payment records yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Grant Access Dialog */}
      <Dialog open={grantOpen} onOpenChange={(v) => {
        setGrantOpen(v);
        if (!v) {
          setSelectedUserIds([]);
          setGrantSearch('');
          setGrantMode('single');
          setGrantDurationType('preset');
          setCustomDays('');
        }
      }}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Grant Free Access</DialogTitle>
          </DialogHeader>

          {/* Mode toggle */}
          <div className="flex gap-1 bg-muted/50 p-1 rounded-xl">
            <button onClick={() => setGrantMode('single')}
              className={"flex-1 text-xs font-medium py-1.5 rounded-lg transition-all " + (grantMode === 'single' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground')}>
              Single Student
            </button>
            <button onClick={() => setGrantMode('bulk')}
              className={"flex-1 text-xs font-medium py-1.5 rounded-lg transition-all " + (grantMode === 'bulk' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground')}>
              Bulk / All Students
            </button>
          </div>

          {/* Single mode */}
          {grantMode === 'single' && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Student Email</Label>
              <Input value={grantStudentEmail} onChange={e => setGrantStudentEmail(e.target.value)}
                placeholder="student@example.com" type="email" />
            </div>
          )}

          {/* Bulk mode */}
          {grantMode === 'bulk' && (
            <div className="space-y-2 flex flex-col" style={{ minHeight: 0 }}>
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Select Students</Label>
                <div className="flex gap-2">
                  <button onClick={() => setSelectedUserIds(filteredGrantUsers.map(u => u.id))}
                    className="text-xs text-primary hover:underline">All</button>
                  <button onClick={() => setSelectedUserIds([])}
                    className="text-xs text-muted-foreground hover:underline">None</button>
                </div>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input placeholder="Search name or email" value={grantSearch}
                  onChange={e => setGrantSearch(e.target.value)} className="pl-8 h-8 text-xs" />
              </div>
              <div className="border border-border rounded-xl overflow-y-auto divide-y divide-border/50" style={{ maxHeight: '180px' }}>
                {filteredGrantUsers.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-6">No students found</p>
                )}
                {filteredGrantUsers.map(u => (
                  <label key={u.id} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/30 transition-colors">
                    <input type="checkbox" checked={selectedUserIds.includes(u.id)}
                      onChange={() => toggleUserId(u.id)}
                      className="w-4 h-4 accent-primary rounded" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{u.full_name || '—'}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{u.email}</p>
                    </div>
                  </label>
                ))}
              </div>
              {selectedUserIds.length > 0 && (
                <p className="text-xs text-primary font-medium">
                  {selectedUserIds.length}{selectedUserIds.length > 1 ? ' students' : ' student'} selected
                </p>
              )}
            </div>
          )}

          {/* Duration */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Duration</Label>
            <div className="flex gap-1 bg-muted/50 p-1 rounded-xl">
              <button onClick={() => setGrantDurationType('preset')}
                className={"flex-1 text-xs font-medium py-1.5 rounded-lg transition-all " + (grantDurationType === 'preset' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground')}>
                Preset Plan
              </button>
              <button onClick={() => setGrantDurationType('custom')}
                className={"flex-1 text-xs font-medium py-1.5 rounded-lg transition-all " + (grantDurationType === 'custom' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground')}>
                Custom Days
              </button>
            </div>
            {grantDurationType === 'preset' ? (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Plan</Label>
                  <Select value={grantPlan} onValueChange={setGrantPlan}>
                    <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly (30 days)</SelectItem>
                      <SelectItem value="annual">Annual (365 days)</SelectItem>
                      <SelectItem value="biannual">Biannual (730 days)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Months</Label>
                  <Input type="number" min={1} max={24} value={grantMonths}
                    onChange={e => setGrantMonths(Math.max(1, parseInt(e.target.value) || 1))}
                    className="mt-1 h-9" />
                </div>
              </div>
            ) : (
              <div>
                <Label className="text-xs text-muted-foreground">Number of days</Label>
                <Input type="number" min={1} max={3650} value={customDays}
                  onChange={e => setCustomDays(e.target.value)} placeholder="e.g. 30"
                  className="mt-1 h-9" />
              </div>
            )}
            <div className="bg-primary/5 border border-primary/20 rounded-lg px-3 py-2 text-xs text-primary font-medium">
              {computeGrantDays()}{computeGrantDays() !== 1 ? ' days' : ' day'}{' access'}
              {grantMode === 'bulk' && selectedUserIds.length > 0 && (
                <span>{' for '}{selectedUserIds.length}{selectedUserIds.length > 1 ? ' students' : ' student'}</span>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setGrantOpen(false)}>Cancel</Button>
            <Button className="flex-1" onClick={() => grantMutation.mutate()}
              disabled={
                grantMutation.isPending ||
                (grantMode === 'single' && !grantStudentEmail) ||
                (grantMode === 'bulk' && selectedUserIds.length === 0) ||
                (grantDurationType === 'custom' && (!customDays || parseInt(customDays) < 1))
              }>
              {grantMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Plus className="w-4 h-4 mr-1.5" />}
              Grant Access
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}