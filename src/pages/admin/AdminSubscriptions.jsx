import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  CreditCard, Search, CheckCircle2, XCircle, Clock, TrendingUp,
  Users, Banknote, CalendarDays, MoreVertical, Plus, Loader2, RefreshCw
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';
import { toast } from 'sonner';

const STATUS_COLORS = {
  active: 'bg-success/10 text-success border-success/20',
  expired: 'bg-destructive/10 text-destructive border-destructive/20',
  cancelled: 'bg-muted text-muted-foreground border-border',
  trial: 'bg-accent/10 text-accent border-accent/20',
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
  const [grantStudentId, setGrantStudentId] = useState('');
  const [grantPlan, setGrantPlan] = useState('monthly');
  const [grantMonths, setGrantMonths] = useState(1);

  const { data: subscriptions = [], isLoading } = useQuery({
    queryKey: ['allSubscriptions'],
    queryFn: () => base44.entities.Subscription.list('-created_date', 500),
  });

  const { data: payments = [] } = useQuery({
    queryKey: ['allPayments'],
    queryFn: () => base44.entities.Payment.list('-created_date', 200),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => base44.entities.User.list('-created_date', 500),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Subscription.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['allSubscriptions'] }); toast.success('Subscription updated'); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Subscription.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['allSubscriptions'] }); toast.success('Subscription removed'); },
  });

  const grantMutation = useMutation({
    mutationFn: async () => {
      const planDurations = { monthly: 30, annual: 365, biannual: 730 };
      const days = (planDurations[grantPlan] || 30) * grantMonths;
      const start = new Date();
      const end = new Date(Date.now() + days * 86400000);
      await base44.entities.Subscription.create({
        student_id: grantStudentId,
        plan: grantPlan,
        status: 'active',
        start_date: start.toISOString(),
        end_date: end.toISOString(),
        amount_paid: 0,
        currency: 'MWK',
        payment_method: 'free',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allSubscriptions'] });
      toast.success('Subscription granted successfully');
      setGrantOpen(false);
      setGrantStudentId('');
    },
  });

  // Enrich subscriptions with user data
  const userMap = Object.fromEntries(users.map(u => [u.id, u]));
  const enriched = subscriptions.map(s => ({ ...s, _user: userMap[s.student_id] }));

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
    const newEnd = new Date((sub.end_date ? new Date(sub.end_date) : new Date()).getTime() + days * 86400000);
    updateMutation.mutate({ id: sub.id, data: { end_date: newEnd.toISOString(), status: 'active' } });
    toast.success(`Extended by ${days} days`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">School Fees & Subscriptions</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage student fee payments and access</p>
        </div>
        <Button size="sm" onClick={() => setGrantOpen(true)}>
          <Plus className="w-4 h-4 mr-1" /> Grant Access
        </Button>
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

          {/* Table */}
          <div className="bg-card rounded-2xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Student</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Plan</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground hidden md:table-cell">Expires</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground hidden lg:table-cell">Amount Paid</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {isLoading && (
                    <tr><td colSpan={6} className="text-center py-10 text-muted-foreground text-sm"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>
                  )}
                  {!isLoading && filtered.map(sub => (
                    <tr key={sub.id} className="hover:bg-muted/20 transition-colors">
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
                        <Badge className={`text-[10px] capitalize ${STATUS_COLORS[sub.status] || 'bg-muted'}`}>{sub.status === 'trial' ? 'pending' : sub.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell">
                        {sub.end_date ? format(new Date(sub.end_date), 'MMM d, yyyy') : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium hidden lg:table-cell">
                        {sub.amount_paid > 0 ? `MWK ${sub.amount_paid.toLocaleString()}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
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
                      </td>
                    </tr>
                  ))}
                  {!isLoading && filtered.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-10 text-muted-foreground text-sm">No subscriptions found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

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
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {payments.map(p => (
                    <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium">{p.student_name || 'Unknown'}</p>
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
                    </tr>
                  ))}
                  {payments.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-10 text-muted-foreground text-sm">No payment records yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Grant Access Dialog */}
      <Dialog open={grantOpen} onOpenChange={setGrantOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Grant Free Access</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Manually grant a student subscription access without payment.</p>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Student User ID</Label>
              <Input className="mt-1 font-mono text-xs" value={grantStudentId} onChange={e => setGrantStudentId(e.target.value)} placeholder="Paste student user ID..." />
              <p className="text-[11px] text-muted-foreground mt-1">Find IDs in User Management</p>
            </div>
            <div>
              <Label>Plan</Label>
              <Select value={grantPlan} onValueChange={setGrantPlan}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="annual">Annual</SelectItem>
                  <SelectItem value="biannual">Biannual (2 Years)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setGrantOpen(false)}>Cancel</Button>
              <Button className="flex-1" onClick={() => grantMutation.mutate()} disabled={!grantStudentId || grantMutation.isPending}>
                {grantMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                Grant Access
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}