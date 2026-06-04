import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CreditCard, Search, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';

const STATUS_COLORS = {
  active: 'bg-success/10 text-success',
  expired: 'bg-destructive/10 text-destructive',
  cancelled: 'bg-muted text-muted-foreground',
  trial: 'bg-accent/10 text-accent',
};

const PLAN_COLORS = {
  free: 'bg-muted text-muted-foreground',
  monthly: 'bg-primary/10 text-primary',
  quarterly: 'bg-accent/10 text-accent',
  annual: 'bg-success/10 text-success',
};

export default function AdminSubscriptions() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPlan, setFilterPlan] = useState('all');

  const { data: subscriptions = [] } = useQuery({
    queryKey: ['allSubscriptions'],
    queryFn: () => base44.entities.Subscription.list('-created_date', 200),
  });

  const { data: payments = [] } = useQuery({
    queryKey: ['allPayments'],
    queryFn: () => base44.entities.Payment.list('-created_date', 200),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Subscription.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['allSubscriptions'] }),
  });

  const filtered = subscriptions.filter(s => {
    const matchesStatus = filterStatus === 'all' || s.status === filterStatus;
    const matchesPlan = filterPlan === 'all' || s.plan === filterPlan;
    return matchesStatus && matchesPlan;
  });

  const totalRevenue = payments.filter(p => p.status === 'completed').reduce((sum, p) => sum + (p.amount || 0), 0);
  const activeCount = subscriptions.filter(s => s.status === 'active').length;
  const premiumCount = subscriptions.filter(s => s.plan !== 'free' && s.status === 'active').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">Subscriptions & Payments</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage student subscriptions</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Revenue', value: `MWK ${totalRevenue.toLocaleString()}`, icon: CreditCard, color: 'text-success' },
          { label: 'Active Subscribers', value: activeCount, icon: CheckCircle2, color: 'text-primary' },
          { label: 'Premium Users', value: premiumCount, icon: CreditCard, color: 'text-accent' },
        ].map((stat, i) => (
          <div key={i} className="bg-card rounded-xl border border-border p-5">
            <stat.icon className={`w-5 h-5 ${stat.color} mb-2`} />
            <p className="text-2xl font-bold font-display">{stat.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="trial">Trial</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterPlan} onValueChange={setFilterPlan}>
          <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Plans</SelectItem>
            <SelectItem value="free">Free</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
            <SelectItem value="quarterly">Quarterly</SelectItem>
            <SelectItem value="annual">Annual</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Subscriptions Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Student ID</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Plan</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Started</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Expires</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Amount</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(sub => (
                <tr key={sub.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 text-sm font-mono text-xs text-muted-foreground">{sub.student_id?.slice(0, 12)}...</td>
                  <td className="px-4 py-3">
                    <Badge className={`text-[10px] ${PLAN_COLORS[sub.plan] || 'bg-muted'}`}>{sub.plan}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={`text-[10px] ${STATUS_COLORS[sub.status] || 'bg-muted'}`}>{sub.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {sub.start_date ? format(new Date(sub.start_date), 'MMM d, yyyy') : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {sub.end_date ? format(new Date(sub.end_date), 'MMM d, yyyy') : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium">
                    {sub.amount_paid > 0 ? `MWK ${sub.amount_paid.toLocaleString()}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {sub.status !== 'active' ? (
                      <Button size="sm" variant="outline" onClick={() => updateMutation.mutate({ id: sub.id, data: { status: 'active' } })}>
                        Activate
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" className="text-destructive" onClick={() => updateMutation.mutate({ id: sub.id, data: { status: 'cancelled' } })}>
                        Cancel
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-muted-foreground text-sm">No subscriptions found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Payments */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Recent Payments</h2>
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="divide-y divide-border">
            {payments.slice(0, 10).map(p => (
              <div key={p.id} className="flex items-center gap-4 p-4">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs ${p.status === 'completed' ? 'bg-success/10 text-success' : p.status === 'pending' ? 'bg-accent/10 text-accent' : 'bg-destructive/10 text-destructive'}`}>
                  {p.status === 'completed' ? <CheckCircle2 className="w-4 h-4" /> : p.status === 'pending' ? <Clock className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{p.student_name || 'Unknown'}</p>
                  <p className="text-xs text-muted-foreground">{p.method?.replace('_', ' ')} · {p.reference || 'No ref'}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold">MWK {p.amount?.toLocaleString()}</p>
                  <p className="text-[10px] text-muted-foreground">{format(new Date(p.created_date), 'MMM d')}</p>
                </div>
              </div>
            ))}
            {payments.length === 0 && (
              <div className="text-center py-10 text-muted-foreground text-sm">No payments recorded yet</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}