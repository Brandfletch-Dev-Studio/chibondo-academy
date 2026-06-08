import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Users, Search, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

const STATUS_CONFIG = {
  pending:    { label: 'Pending',    color: 'bg-muted text-muted-foreground' },
  registered: { label: 'Registered', color: 'bg-blue-500/10 text-blue-600' },
  paid:       { label: 'Fees Paid',  color: 'bg-yellow-500/10 text-yellow-600' },
  rewarded:   { label: 'Rewarded',   color: 'bg-green-500/10 text-green-600' },
};

export default function AffiliateReferrals() {
  const { user } = useOutletContext();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: referrals = [], isLoading } = useQuery({
    queryKey: ['myReferrals', user?.id],
    queryFn: () => base44.entities.Referral.filter({ referrer_id: user?.id }, '-created_date', 200),
    enabled: !!user?.id,
  });

  const filtered = referrals.filter(r => {
    const matchSearch = !search || 
      (r.referred_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.referred_email || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-5">
      {/* Summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total',      value: referrals.length,                                             color: 'text-foreground' },
          { label: 'Registered', value: referrals.filter(r => r.status !== 'pending').length,         color: 'text-blue-500' },
          { label: 'Fees Paid',  value: referrals.filter(r => ['paid','rewarded'].includes(r.status)).length, color: 'text-yellow-500' },
          { label: 'Rewarded',   value: referrals.filter(r => r.status === 'rewarded').length,        color: 'text-green-500' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-4 text-center">
            <p className={`text-2xl font-display font-bold ${color}`}>{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search by name or email…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {['all', 'pending', 'registered', 'paid', 'rewarded'].map(s => (
            <button key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-2 rounded-xl text-xs font-medium capitalize transition-all ${
                statusFilter === s
                  ? 'text-[hsl(222_47%_11%)] font-bold'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted'
              }`}
              style={statusFilter === s ? { background: 'hsl(43 74% 52%)' } : {}}>
              {s === 'all' ? 'All' : STATUS_CONFIG[s]?.label || s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Loading referrals…</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Users className="w-12 h-12 mx-auto text-muted-foreground/20 mb-3" />
            <p className="text-sm text-muted-foreground">
              {referrals.length === 0 ? 'No referrals yet. Share your link to start earning!' : 'No results match your search.'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table header */}
            <div className="hidden sm:grid grid-cols-5 gap-4 px-5 py-3 border-b border-border bg-muted/30">
              <p className="text-xs font-semibold text-muted-foreground uppercase col-span-2">Student</p>
              <p className="text-xs font-semibold text-muted-foreground uppercase">Registered</p>
              <p className="text-xs font-semibold text-muted-foreground uppercase">Fees Status</p>
              <p className="text-xs font-semibold text-muted-foreground uppercase text-right">Commission</p>
            </div>
            <div className="divide-y divide-border">
              {filtered.map(r => (
                <div key={r.id} className="grid grid-cols-1 sm:grid-cols-5 gap-2 sm:gap-4 px-5 py-4 hover:bg-muted/20 transition-colors">
                  {/* Name */}
                  <div className="sm:col-span-2 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-xs font-bold text-primary">
                      {(r.referred_name || r.referred_email || '?')[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{r.referred_name || 'Pending registration'}</p>
                      <p className="text-xs text-muted-foreground truncate">{r.referred_email || '—'}</p>
                    </div>
                  </div>
                  {/* Date */}
                  <div className="sm:flex sm:items-center">
                    <span className="text-xs text-muted-foreground sm:text-sm">
                      <span className="sm:hidden font-medium text-foreground">Registered: </span>
                      {new Date(r.created_date).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })}
                    </span>
                  </div>
                  {/* Status */}
                  <div className="flex items-center gap-2">
                    <span className="sm:hidden text-xs text-muted-foreground">Fees: </span>
                    <Badge className={`text-xs capitalize ${STATUS_CONFIG[r.status]?.color || 'bg-muted text-muted-foreground'}`}>
                      {STATUS_CONFIG[r.status]?.label || r.status}
                    </Badge>
                  </div>
                  {/* Commission */}
                  <div className="sm:flex sm:items-center sm:justify-end">
                    {r.reward_amount > 0 ? (
                      <span className={`text-sm font-semibold ${r.reward_status === 'paid' ? 'text-green-500' : 'text-yellow-500'}`}>
                        +MWK {r.reward_amount.toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
