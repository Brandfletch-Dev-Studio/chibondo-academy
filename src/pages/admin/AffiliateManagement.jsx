import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/api/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Users, DollarSign, Gift, TrendingUp, Clock, CheckCircle2,
  XCircle, ArrowUpRight, Search, Eye, Ban, RefreshCw, Loader2,
  UserCheck, Settings2, Copy, Check,
  Mail, ExternalLink, ShieldAlert, Plus, Pencil, Trash,
  Landmark, MessageSquare, Download, Image as ImageIcon,
  ShieldCheck
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow, format } from 'date-fns';

// ── Helpers ──────────────────────────────────────────────────────────────────
const formatMoney = (n) => `MWK ${Number(n || 0).toLocaleString()}`;

const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  try {
    return format(new Date(dateStr), 'MMM d, yyyy');
  } catch (e) {
    return 'N/A';
  }
};

const formatDistance = (dateStr) => {
  if (!dateStr) return 'N/A';
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
  } catch (e) {
    return 'N/A';
  }
};

const REFERRAL_STATUS = {
  pending:    { label: 'Pending',    color: 'bg-muted text-muted-foreground border-muted-foreground/10' },
  registered: { label: 'Registered', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  paid:       { label: 'Fees Paid',  color: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  rewarded:   { label: 'Rewarded',   color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
};

const PAYOUT_STATUS = {
  pending:    { label: 'Pending',    icon: Clock,        color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' },
  processing: { label: 'Processing', icon: ArrowUpRight, color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  completed:  { label: 'Completed',  icon: CheckCircle2, color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
  rejected:   { label: 'Rejected',   icon: XCircle,      color: 'bg-red-500/10 text-red-600 border-red-500/20' },
};

function AffiliateAvatar({ name, size = 'md' }) {
  const initial = name ? name[0].toUpperCase() : '?';
  const sizeClasses = size === 'lg' ? 'w-14 h-14 text-lg' : 'w-9 h-9 text-xs';
  return (
    <div className={`${sizeClasses} flex items-center justify-center font-bold rounded-full bg-gradient-to-br from-primary/10 to-primary/30 text-primary border border-primary/20 shadow-sm flex-shrink-0 select-none`}>
      {initial}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color, sub, badge }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow duration-200">
      <div className="flex justify-between items-start mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        {badge}
      </div>
      <p className="text-2xl font-bold tracking-tight">{value}</p>
      <p className="text-xs font-medium text-muted-foreground mt-1">{label}</p>
      {sub && <p className="text-[11px] mt-1.5 text-muted-foreground/80 leading-relaxed">{sub}</p>}
    </div>
  );
}

function CopyButton({ text, label = "Code" }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success(`${label} copied!`);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Button
      variant="ghost"
      size="icon"
      className="w-8 h-8 hover:bg-primary/10 hover:text-primary transition-colors duration-150"
      onClick={handleCopy}
    >
      {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
    </Button>
  );
}

function LoadingPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <Loader2 className="w-8 h-8 text-primary animate-spin" />
      <p className="text-sm text-muted-foreground animate-pulse font-medium">Loading details...</p>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function AffiliateManagement() {
  const qc = useQueryClient();
  const [tab, setTab] = useState('overview');

  // Shared state filters
  const [searchAffiliate, setSearchAffiliate] = useState('');
  const [searchReferral, setSearchReferral] = useState('');
  const [referralStatusFilter, setReferralStatusFilter] = useState('all');
  const [payoutFilter, setPayoutFilter] = useState('all');

  // Overlay states
  const [selectedAffiliate, setSelectedAffiliate] = useState(null);
  const [reviewPayout, setReviewPayout] = useState(null);
  const [payoutNotes, setPayoutNotes] = useState('');
  const [autoRewardReferrals, setAutoRewardReferrals] = useState(true);

  // Marketing material form states
  const [materialDialogOpen, setMaterialDialogOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState(null);
  const [materialForm, setMaterialForm] = useState({
    title: '',
    type: 'banner',
    file_url: '',
    thumbnail_url: '',
    description: ''
  });

  // Settings form states
  const [settingsForm, setSettingsForm] = useState({
    commission_amount: 10000,
    min_payout: 5000,
    cookie_days: 30,
    payout_frequency: 'weekly',
    enabled: true
  });

  // ── Data Fetching ──────────────────────────────────────────────────────────
  const { data: allReferrals = [], isLoading: loadingReferrals } = useQuery({
    queryKey: ['admin-all-referrals'],
    queryFn: async () => {
      try {
        return await db.entities.Referral.list('-created_date', 500);
      } catch (e) {
        console.error(e);
        return [];
      }
    },
    staleTime: 30_000,
    placeholderData: [],
  });

  const { data: allPayouts = [], isLoading: loadingPayouts } = useQuery({
    queryKey: ['admin-all-payouts'],
    queryFn: async () => {
      try {
        return await db.entities.PayoutRequest.list('-created_date', 200);
      } catch (e) {
        console.error(e);
        return [];
      }
    },
    staleTime: 30_000,
    placeholderData: [],
  });

  const { data: allUsers = [], isLoading: loadingUsers } = useQuery({
    queryKey: ['admin-users-list'],
    queryFn: async () => {
      try {
        return await db.entities.User.list('-created_date', 1000);
      } catch (e) {
        console.error(e);
        return [];
      }
    },
    staleTime: 60_000,
    placeholderData: [],
  });

  const { data: settingsRows = [], isLoading: loadingSettings } = useQuery({
    queryKey: ['affiliateSettings'],
    queryFn: async () => {
      try {
        return await db.entities.PlatformSettings.filter({ key: 'affiliate_commission' });
      } catch (e) {
        console.error(e);
        return [];
      }
    },
    staleTime: 60_000,
    placeholderData: [],
  });

  const { data: materials = [], isLoading: loadingMaterials } = useQuery({
    queryKey: ['admin-materials'],
    queryFn: async () => {
      try {
        return await db.entities.AffiliateMaterial.list('-created_date', 100);
      } catch (e) {
        console.error(e);
        return [];
      }
    },
    staleTime: 60_000,
    placeholderData: [],
  });

  // Settings resolver
  const settings        = settingsRows[0]?.value || {};
  const commissionAmt   = settings.commission_amount ?? settings.commissionAmount ?? settings.fixed_amount ?? 10000;
  const minPayout       = settings.min_payout ?? settings.minPayout ?? 5000;
  const referralURLTemplate = `${window.location.origin}/register?ref=REFERRAL_CODE`;

  // Filter affiliates list from users
  const affiliates = allUsers.filter(u => u.role === 'affiliate' || u.role === 'suspended_affiliate');

  // Initialize Settings Form on Load
  useEffect(() => {
    if (settingsRows.length > 0) {
      const val = settingsRows[0].value || {};
      setSettingsForm({
        commission_amount: val.commission_amount ?? val.commissionAmount ?? val.fixed_amount ?? 10000,
        min_payout: val.min_payout ?? val.minPayout ?? 5000,
        cookie_days: val.cookie_days ?? val.cookieDays ?? 30,
        payout_frequency: val.payout_frequency ?? val.payoutFrequency ?? 'weekly',
        enabled: val.enabled !== false
      });
    }
  }, [settingsRows]);

  // Sync payout notes when review payout changes
  useEffect(() => {
    if (reviewPayout) {
      setPayoutNotes(reviewPayout.admin_notes || '');
      setAutoRewardReferrals(true);
    }
  }, [reviewPayout]);

  // ── Global Stats ───────────────────────────────────────────────────────────
  const totalAffiliates  = affiliates.length;
  const totalReferrals   = allReferrals.length;
  const paidReferrals    = allReferrals.filter(r => ['paid', 'rewarded'].includes(r.status));
  const totalCommissions = paidReferrals.reduce((sum, r) => sum + (r.reward_amount || commissionAmt), 0);
  const totalPaidOut     = allPayouts.filter(p => p.status === 'completed').reduce((sum, p) => sum + (p.amount || 0), 0);
  const pendingPayouts   = allPayouts.filter(p => p.status === 'pending');

  // ── Mutations ──────────────────────────────────────────────────────────────
  const updatePayoutMut = useMutation({
    mutationFn: async ({ id, status, admin_notes }) => {
      return db.entities.PayoutRequest.update(id, { status, admin_notes: admin_notes || '' });
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['admin-all-payouts'] });
      toast.success(`Payout marked as ${vars.status}`);
      setReviewPayout(null);
      setPayoutNotes('');
    },
    onError: () => toast.error('Failed to update payout request'),
  });

  const updateReferralMut = useMutation({
    mutationFn: async ({ id, status }) => {
      return db.entities.Referral.update(id, { status });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-all-referrals'] });
      toast.success('Referral status updated');
    },
    onError: () => toast.error('Failed to update referral status'),
  });

  const updateAffiliateRoleMut = useMutation({
    mutationFn: async ({ id, newRole }) => {
      return db.entities.User.update(id, { role: newRole });
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['admin-users-list'] });
      toast.success(vars.newRole === 'suspended_affiliate' ? 'Affiliate suspended' : 'Affiliate reactivated');
      setSelectedAffiliate(prev => prev && prev.id === vars.id ? { ...prev, role: vars.newRole } : prev);
    },
    onError: () => toast.error('Failed to change affiliate status'),
  });

  const saveSettingsMut = useMutation({
    mutationFn: async (vals) => {
      const existing = settingsRows[0];
      const payload = {
        commission_amount: Number(vals.commission_amount),
        commissionAmount: Number(vals.commission_amount),
        min_payout: Number(vals.min_payout),
        minPayout: Number(vals.min_payout),
        cookie_days: Number(vals.cookie_days),
        cookieDays: Number(vals.cookie_days),
        payout_frequency: vals.payout_frequency,
        payoutFrequency: vals.payout_frequency,
        enabled: vals.enabled
      };
      if (existing) {
        return db.entities.PlatformSettings.update(existing.id, { value: payload });
      }
      return db.entities.PlatformSettings.create({ key: 'affiliate_commission', value: payload });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['affiliateSettings'] });
      toast.success('Affiliate program settings saved successfully!');
    },
    onError: () => toast.error('Failed to save settings'),
  });

  const createMaterialMut = useMutation({
    mutationFn: async (data) => db.entities.AffiliateMaterial.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-materials'] });
      toast.success('Marketing material added successfully!');
      setMaterialDialogOpen(false);
      resetMaterialForm();
    },
    onError: () => toast.error('Failed to add material'),
  });

  const updateMaterialMut = useMutation({
    mutationFn: async ({ id, data }) => db.entities.AffiliateMaterial.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-materials'] });
      toast.success('Marketing material updated successfully!');
      setMaterialDialogOpen(false);
      resetMaterialForm();
    },
    onError: () => toast.error('Failed to update material'),
  });

  const deleteMaterialMut = useMutation({
    mutationFn: async (id) => db.entities.AffiliateMaterial.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-materials'] });
      toast.success('Marketing material deleted!');
    },
    onError: () => toast.error('Failed to delete material'),
  });

  // ── Helper Handlers ────────────────────────────────────────────────────────
  const resetMaterialForm = () => {
    setMaterialForm({ title: '', type: 'banner', file_url: '', thumbnail_url: '', description: '' });
    setEditingMaterial(null);
  };

  const handleMaterialFormSubmit = (e) => {
    e.preventDefault();
    if (!materialForm.title.trim()) {
      toast.error('Title is required');
      return;
    }
    if (editingMaterial) {
      updateMaterialMut.mutate({ id: editingMaterial.id, data: materialForm });
    } else {
      createMaterialMut.mutate(materialForm);
    }
  };

  const handleReviewAction = async (newStatus) => {
    if (!reviewPayout) return;
    try {
      await updatePayoutMut.mutateAsync({
        id: reviewPayout.id,
        status: newStatus,
        admin_notes: payoutNotes
      });

      // If completing payout and auto-reward is checked, update relevant referrals
      if (newStatus === 'completed' && autoRewardReferrals) {
        const paidRefs = allReferrals.filter(
          r => r.referrer_id === reviewPayout.affiliate_id && r.status === 'paid'
        );
        if (paidRefs.length > 0) {
          toast.info(`Updating ${paidRefs.length} referrals to "Rewarded" status...`);
          await Promise.all(paidRefs.map(r => db.entities.Referral.update(r.id, { status: 'rewarded' })));
          qc.invalidateQueries({ queryKey: ['admin-all-referrals'] });
          toast.success(`Automatically updated ${paidRefs.length} referrals to "Rewarded" status!`);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleExportCSV = (referralsList) => {
    const headers = ['Referred Name', 'Email', 'Referred By', 'Status', 'Commission', 'Date'];
    const rows = referralsList.map(r => [
      r.referred_name || '',
      r.referred_email || '',
      r.referrer_name || '',
      r.status || '',
      r.reward_amount || commissionAmt,
      formatDate(r.created_date)
    ]);
    const csvContent = [headers, ...rows].map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `referrals_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('CSV Exported successfully!');
  };

  // ── Stats Calculations ─────────────────────────────────────────────────────
  // Affiliate leaderboard list (aggregated metrics)
  const affiliateStats = {};
  
  affiliates.forEach(aff => {
    affiliateStats[aff.id] = {
      id: aff.id,
      name: aff.full_name || aff.email || 'Anonymous',
      email: aff.email || '',
      avatarName: aff.full_name || aff.email,
      total: 0,
      paid: 0,
      earned: 0,
      hasPendingPayout: allPayouts.some(p => p.affiliate_id === aff.id && p.status === 'pending'),
      record: aff
    };
  });

  allReferrals.forEach(r => {
    if (!r.referrer_id) return;
    if (!affiliateStats[r.referrer_id]) {
      affiliateStats[r.referrer_id] = {
        id: r.referrer_id,
        name: r.referrer_name || 'Anonymous Affiliate',
        email: '',
        avatarName: r.referrer_name || '?',
        total: 0,
        paid: 0,
        earned: 0,
        hasPendingPayout: allPayouts.some(p => p.affiliate_id === r.referrer_id && p.status === 'pending'),
        record: null
      };
    }
    affiliateStats[r.referrer_id].total++;
    if (['paid', 'rewarded'].includes(r.status)) {
      affiliateStats[r.referrer_id].paid++;
      affiliateStats[r.referrer_id].earned += (r.reward_amount || commissionAmt);
    }
  });

  const topAffiliates = Object.values(affiliateStats)
    .sort((a, b) => b.earned - a.earned || b.total - a.total)
    .slice(0, 10);

  // ── Filters & Search ───────────────────────────────────────────────────────
  // Affiliates tab list filter
  const filteredAffiliates = Object.values(affiliateStats).filter(item => {
    const q = searchAffiliate.toLowerCase();
    const aff = item.record || {};
    const nameMatch = (aff.full_name || item.name || '').toLowerCase().includes(q);
    const emailMatch = (aff.email || item.email || '').toLowerCase().includes(q);
    const codeMatch = (aff.referral_code || '').toLowerCase().includes(q);
    return nameMatch || emailMatch || codeMatch;
  });

  // Referrals list filter
  const filteredReferrals = allReferrals.filter(r => {
    const q = searchReferral.toLowerCase();
    const matchSearch = !q ||
      (r.referred_name || '').toLowerCase().includes(q) ||
      (r.referred_email || '').toLowerCase().includes(q) ||
      (r.referrer_name || '').toLowerCase().includes(q);
    const matchStatus = referralStatusFilter === 'all' || r.status === referralStatusFilter;
    return matchSearch && matchStatus;
  });

  // Payouts list filter
  const filteredPayouts = allPayouts.filter(p => {
    return payoutFilter === 'all' || p.status === payoutFilter;
  });

  const recentReferrals = allReferrals.slice(0, 10);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground">Affiliate Hub</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Industry-standard administrative controls, tracking, referral payouts, and settings.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => {
            qc.invalidateQueries({ queryKey: ['admin-all-referrals'] });
            qc.invalidateQueries({ queryKey: ['admin-all-payouts'] });
            qc.invalidateQueries({ queryKey: ['admin-users-list'] });
            qc.invalidateQueries({ queryKey: ['admin-materials'] });
            qc.invalidateQueries({ queryKey: ['affiliateSettings'] });
            toast.success('Dashboard data refreshed!');
          }} className="border-border">
            <RefreshCw className="w-4 h-4 mr-1.5" /> Refresh
          </Button>
        </div>
      </div>

      {/* Global Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Affiliates"
          value={totalAffiliates}
          icon={Users}
          color="bg-primary/10 text-primary"
          sub="Registered affiliate partners"
        />
        <StatCard
          label="Total Referrals"
          value={totalReferrals}
          icon={Gift}
          color="bg-blue-500/10 text-blue-600"
          sub={`${paidReferrals.length} active fee-paying students`}
        />
        <StatCard
          label="Commissions Earned"
          value={formatMoney(totalCommissions)}
          icon={DollarSign}
          color="bg-emerald-500/10 text-emerald-600"
          sub={`${formatMoney(totalPaidOut)} disbursed to date`}
        />
        <StatCard
          label="Pending Payouts"
          value={pendingPayouts.length}
          icon={Clock}
          color="bg-yellow-500/10 text-yellow-600"
          sub={pendingPayouts.length > 0 ? 'Disbursement review required' : 'No payout requests outstanding'}
          badge={pendingPayouts.length > 0 ? (
            <Badge variant="destructive" className="animate-pulse font-semibold">Needs Action</Badge>
          ) : (
            <Badge variant="secondary" className="text-green-600 bg-green-500/10 border-green-500/20">All Clear</Badge>
          )}
        />
      </div>

      {/* Main Tabs Container */}
      <Tabs value={tab} onValueChange={setTab} className="space-y-6">
        <TabsList className="flex flex-wrap h-auto p-1 bg-muted/50 border border-border/80 rounded-xl max-w-full overflow-x-auto">
          <TabsTrigger value="overview" className="rounded-lg py-2 px-3 text-xs md:text-sm font-semibold transition-all">Overview</TabsTrigger>
          <TabsTrigger value="affiliates" className="rounded-lg py-2 px-3 text-xs md:text-sm font-semibold transition-all">Affiliates</TabsTrigger>
          <TabsTrigger value="referrals" className="rounded-lg py-2 px-3 text-xs md:text-sm font-semibold transition-all">Referrals</TabsTrigger>
          <TabsTrigger value="payouts" className="rounded-lg py-2 px-3 text-xs md:text-sm font-semibold transition-all">Payouts</TabsTrigger>
          <TabsTrigger value="materials" className="rounded-lg py-2 px-3 text-xs md:text-sm font-semibold transition-all">Materials Kit</TabsTrigger>
          <TabsTrigger value="settings" className="rounded-lg py-2 px-3 text-xs md:text-sm font-semibold transition-all">Settings</TabsTrigger>
        </TabsList>

        {/* ── TAB 1: OVERVIEW ── */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Leaderboard */}
            <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-5 shadow-sm">
              <div className="flex justify-between items-center mb-5 border-b border-border pb-3">
                <h3 className="text-base font-bold flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" /> Top Affiliates Leaderboard
                </h3>
                <span className="text-xs text-muted-foreground">Highest-earning affiliates</span>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12 text-center">Rank</TableHead>
                      <TableHead>Affiliate Name</TableHead>
                      <TableHead className="text-center">Total Referrals</TableHead>
                      <TableHead className="text-center">Paid Referrals</TableHead>
                      <TableHead className="text-right">Total Earned</TableHead>
                      <TableHead className="text-center">Action Needed</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topAffiliates.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground italic">
                          No active affiliates found
                        </TableCell>
                      </TableRow>
                    ) : (
                      topAffiliates.map((item, idx) => (
                        <TableRow key={item.id} className="hover:bg-muted/30 transition-colors">
                          <TableCell className="text-center font-bold">
                            {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                          </TableCell>
                          <TableCell className="font-semibold text-sm">
                            <div className="flex items-center gap-3">
                              <AffiliateAvatar name={item.avatarName} size="sm" />
                              <div className="truncate max-w-[150px]">
                                <p className="truncate font-bold text-foreground leading-none">{item.name}</p>
                                <p className="text-[10px] text-muted-foreground truncate mt-1">{item.email}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center font-semibold text-sm">{item.total}</TableCell>
                          <TableCell className="text-center font-semibold text-sm text-green-600">{item.paid}</TableCell>
                          <TableCell className="text-right font-black text-sm text-primary">{formatMoney(item.earned)}</TableCell>
                          <TableCell className="text-center">
                            {item.hasPendingPayout ? (
                              <Badge variant="destructive" className="text-[10px] px-2 py-0 animate-pulse font-bold">Payout Req</Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Recent activity */}
            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm flex flex-col">
              <h3 className="text-base font-bold flex items-center gap-2 mb-5 border-b border-border pb-3">
                <Clock className="w-4 h-4 text-primary" /> Recent Referral Activity
              </h3>
              <div className="space-y-4 overflow-y-auto max-h-[420px] flex-1 pr-1">
                {recentReferrals.length === 0 ? (
                  <p className="text-center py-12 text-muted-foreground italic text-sm">No referrals recorded yet</p>
                ) : (
                  recentReferrals.map((ref) => (
                    <div key={ref.id} className="flex gap-3 text-xs border-b border-border pb-3 last:border-0 last:pb-0">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary font-bold">
                        {ref.referred_name ? ref.referred_name[0].toUpperCase() : '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-foreground truncate">{ref.referred_name || 'Anonymous Student'}</p>
                        <p className="text-muted-foreground truncate">{ref.referred_email || 'No Email'}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Ref: <span className="font-semibold text-foreground">{ref.referrer_name || 'Unknown Affiliate'}</span>
                        </p>
                        <p className="text-[10px] text-muted-foreground/80 mt-0.5">{formatDistance(ref.created_date)}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <Badge className={`${REFERRAL_STATUS[ref.status]?.color || 'bg-muted'} text-[10px] py-0 px-2 font-semibold`}>
                          {REFERRAL_STATUS[ref.status]?.label || ref.status}
                        </Badge>
                        <span className="font-bold text-primary text-[11px]">{formatMoney(ref.reward_amount || commissionAmt)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ── TAB 2: AFFILIATES ── */}
        <TabsContent value="affiliates" className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
            <div className="relative w-full sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search affiliates by name, email, or code..."
                value={searchAffiliate}
                onChange={e => setSearchAffiliate(e.target.value)}
                className="pl-9 bg-card border-border"
              />
            </div>
            <span className="text-xs text-muted-foreground font-semibold">
              Showing {filteredAffiliates.length} of {totalAffiliates} affiliates
            </span>
          </div>

          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            {loadingUsers ? <LoadingPlaceholder /> : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Affiliate Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead className="text-center">Referral Code</TableHead>
                      <TableHead className="text-center">Total Referrals</TableHead>
                      <TableHead className="text-center">Paid Referrals</TableHead>
                      <TableHead className="text-right">Commissions</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAffiliates.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-12 text-muted-foreground italic">
                          No matching affiliate records found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredAffiliates.map((item) => {
                        const aff = item.record || {};
                        const isSuspended = aff.role === 'suspended_affiliate';
                        return (
                          <TableRow key={item.id} className="hover:bg-muted/30 transition-colors">
                            <TableCell className="font-semibold text-sm">
                              <div className="flex items-center gap-3">
                                <AffiliateAvatar name={item.avatarName} size="sm" />
                                <span className="font-bold text-foreground">{aff.full_name || 'No Name Set'}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm font-medium text-foreground/80">{aff.email || '—'}</TableCell>
                            <TableCell className="text-center">
                              {aff.referral_code ? (
                                <div className="inline-flex items-center gap-1.5 bg-muted/50 py-1 px-2.5 rounded-lg border border-border/80">
                                  <span className="font-mono text-xs font-bold text-foreground">{aff.referral_code}</span>
                                  <CopyButton text={aff.referral_code} label="Code" />
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground italic">None</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center font-bold text-sm">{item.total}</TableCell>
                            <TableCell className="text-center font-bold text-sm text-green-600">{item.paid}</TableCell>
                            <TableCell className="text-right font-black text-sm text-primary">{formatMoney(item.earned)}</TableCell>
                            <TableCell className="text-center">
                              <Badge className={isSuspended ? 'bg-red-500/10 text-red-600' : 'bg-green-500/10 text-green-600'}>
                                {isSuspended ? 'Suspended' : 'Active'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedAffiliate(aff)}
                                className="h-8 gap-1 border-border hover:bg-primary/5 hover:text-primary transition-all font-semibold"
                              >
                                <Eye className="w-3.5 h-3.5" /> Details
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── TAB 3: REFERRALS ── */}
        <TabsContent value="referrals" className="space-y-4">
          <div className="flex flex-col md:flex-row gap-3 justify-between items-start md:items-center">
            <div className="flex flex-col sm:flex-row gap-3 w-full md:max-w-xl">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search by referred student, email or affiliate..."
                  value={searchReferral}
                  onChange={e => setSearchReferral(e.target.value)}
                  className="pl-9 bg-card border-border"
                />
              </div>
              <Select value={referralStatusFilter} onValueChange={setReferralStatusFilter}>
                <SelectTrigger className="w-[180px] bg-card border-border">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="registered">Registered</SelectItem>
                  <SelectItem value="paid">Fees Paid</SelectItem>
                  <SelectItem value="rewarded">Rewarded</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExportCSV(filteredReferrals)}
              disabled={filteredReferrals.length === 0}
              className="border-border w-full sm:w-auto h-9 font-semibold gap-1.5"
            >
              <Download className="w-4 h-4" /> Export CSV
            </Button>
          </div>

          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            {loadingReferrals ? <LoadingPlaceholder /> : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Referred Student</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Affiliate / Referrer</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-right">Commission Amt</TableHead>
                      <TableHead>Referral Date</TableHead>
                      <TableHead className="text-right">Set Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredReferrals.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-12 text-muted-foreground italic">
                          No matching referrals found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredReferrals.map((ref) => (
                        <TableRow key={ref.id} className="hover:bg-muted/30 transition-colors">
                          <TableCell className="font-bold text-foreground text-sm">{ref.referred_name || 'Anonymous Student'}</TableCell>
                          <TableCell className="text-sm font-medium text-foreground/80">{ref.referred_email || '—'}</TableCell>
                          <TableCell className="font-medium text-xs">
                            <span className="text-foreground font-semibold">{ref.referrer_name || 'Unknown'}</span>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className={`${REFERRAL_STATUS[ref.status]?.color || 'bg-muted'} text-xs font-semibold`}>
                              {REFERRAL_STATUS[ref.status]?.label || ref.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-black text-sm text-primary">
                            {formatMoney(ref.reward_amount || commissionAmt)}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground font-semibold">
                            {formatDate(ref.created_date)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Select
                              value={ref.status}
                              onValueChange={(v) => updateReferralMut.mutate({ id: ref.id, status: v })}
                              disabled={updateReferralMut.isPending}
                            >
                              <SelectTrigger className="w-[125px] h-8 text-xs font-bold border-border bg-background ml-auto">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pending" className="text-xs">Pending</SelectItem>
                                <SelectItem value="registered" className="text-xs">Registered</SelectItem>
                                <SelectItem value="paid" className="text-xs">Fees Paid</SelectItem>
                                <SelectItem value="rewarded" className="text-xs">Rewarded</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── TAB 4: PAYOUTS ── */}
        <TabsContent value="payouts" className="space-y-4">
          {/* Warning Banner */}
          {pendingPayouts.length > 0 && (
            <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl shadow-sm">
              <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 animate-bounce" />
              <div className="flex-1 text-sm">
                <p className="font-semibold">Review Pending Payout Requests ({pendingPayouts.length})</p>
                <p className="text-xs opacity-90">There are affiliate payout requests that need administrative action.</p>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            {['all', 'pending', 'processing', 'completed', 'rejected'].map(status => {
              const count = status === 'all' ? allPayouts.length : allPayouts.filter(p => p.status === status).length;
              const isActive = payoutFilter === status;
              return (
                <Button
                  key={status}
                  variant={isActive ? 'default' : 'outline'}
                  size="sm"
                  className="rounded-full h-8 px-3.5 text-xs font-bold transition-all border-border"
                  onClick={() => setPayoutFilter(status)}
                >
                  <span className="capitalize">{status}</span>
                  <span className={`ml-2 px-2 py-0.2 rounded-full text-[10px] ${isActive ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                    {count}
                  </span>
                </Button>
              );
            })}
          </div>

          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            {loadingPayouts ? <LoadingPlaceholder /> : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Affiliate Name</TableHead>
                      <TableHead className="text-right">Requested Amount</TableHead>
                      <TableHead>Disbursement Destination</TableHead>
                      <TableHead className="text-center">Referrals Count</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead>Date Requested</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPayouts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-12 text-muted-foreground italic">
                          No payout requests found in this status category
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredPayouts.map((p) => {
                        const StatusIcon = PAYOUT_STATUS[p.status]?.icon || Clock;
                        return (
                          <TableRow key={p.id} className="hover:bg-muted/30 transition-colors">
                            <TableCell className="font-bold text-foreground text-sm">{p.affiliate_name || 'Anonymous'}</TableCell>
                            <TableCell className="text-right font-black text-sm text-primary">{formatMoney(p.amount)}</TableCell>
                            <TableCell>
                              <div className="text-xs">
                                <span className="font-semibold text-foreground capitalize flex items-center gap-1">
                                  <Landmark className="w-3.5 h-3.5 text-muted-foreground" />
                                  {p.payment_method?.replace('_', ' ')}
                                </span>
                                <span className="text-muted-foreground font-mono block mt-1 truncate max-w-[200px]">{p.payment_details}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center font-bold text-sm">{p.referral_count || '—'}</TableCell>
                            <TableCell className="text-center">
                              <Badge className={`${PAYOUT_STATUS[p.status]?.color || 'bg-muted'} text-xs font-semibold gap-1.5`}>
                                <StatusIcon className="w-3.5 h-3.5" />
                                {PAYOUT_STATUS[p.status]?.label || p.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground font-semibold">{formatDate(p.created_date)}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setReviewPayout(p)}
                                className="h-8 gap-1 border-border font-semibold hover:bg-primary/5 hover:text-primary transition-all"
                              >
                                <Eye className="w-3.5 h-3.5" /> Review
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── TAB 5: MATERIALS ── */}
        <TabsContent value="materials" className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center border-b border-border/40 pb-4">
            <div>
              <h3 className="text-lg font-bold text-foreground">Marketing & Creative Materials</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Add materials affiliates can access to promote Chibondo Academy in their dashboard.
              </p>
            </div>
            <Button size="sm" className="gap-1.5 font-bold" onClick={() => {
              resetMaterialForm();
              setMaterialDialogOpen(true);
            }}>
              <Plus className="w-4 h-4" /> Add Material
            </Button>
          </div>

          {loadingMaterials ? <LoadingPlaceholder /> : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {materials.length === 0 ? (
                <div className="col-span-full bg-card border border-border rounded-2xl py-16 text-center text-muted-foreground italic flex flex-col items-center justify-center gap-3">
                  <ImageIcon className="w-12 h-12 opacity-30 text-muted-foreground" />
                  <p className="text-sm">No promotional assets exist yet. Add one to get started!</p>
                </div>
              ) : (
                materials.map((item) => {
                  return (
                    <div key={item.id} className="bg-card border border-border rounded-2xl overflow-hidden flex flex-col shadow-sm group hover:border-primary/40 hover:shadow-md transition-all duration-300">
                      {/* Image Preview Block */}
                      <div className="relative aspect-video bg-muted/50 rounded-t-2xl overflow-hidden border-b border-border">
                        {item.type === 'whatsapp_msg' ? (
                          <div className="flex flex-col h-full justify-between p-4 bg-emerald-500/5">
                            <div className="flex items-center gap-2 text-emerald-700">
                              <MessageSquare className="w-4 h-4" />
                              <span className="text-xs font-bold uppercase tracking-wider">WhatsApp Message Template</span>
                            </div>
                            <div className="text-[11px] font-mono leading-relaxed truncate-3-lines italic bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 p-2.5 rounded-xl flex-1 mt-2.5 overflow-hidden">
                              {item.description || 'No description provided'}
                            </div>
                          </div>
                        ) : (item.thumbnail_url || item.file_url) ? (
                          <img src={item.thumbnail_url || item.file_url} alt={item.title} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                        ) : (
                          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-1 bg-muted/30">
                            <ImageIcon className="w-8 h-8 opacity-30" />
                            <span className="text-[10px] font-bold">NO PREVIEW IMAGE</span>
                          </div>
                        )}
                        <Badge className="absolute top-3 left-3 bg-black/60 backdrop-blur-md text-[10px] font-black uppercase text-white border-0">
                          {item.type}
                        </Badge>
                      </div>

                      {/* Info Block */}
                      <div className="p-4 flex-1 flex flex-col justify-between">
                        <div className="space-y-1">
                          <h4 className="font-bold text-foreground text-sm truncate">{item.title}</h4>
                          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed min-h-[32px]">{item.description || 'No description'}</p>
                          {item.file_url && (
                            <div className="pt-2 text-xs flex items-center justify-between">
                              <span className="text-[10px] text-muted-foreground truncate max-w-[200px] font-mono">{item.file_url}</span>
                              <CopyButton text={item.file_url} label="Resource Link" />
                            </div>
                          )}
                        </div>

                        {/* Bottom Actions */}
                        <div className="flex gap-2 border-t border-border/60 pt-3.5 mt-3.5">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 h-8 text-xs font-bold border-border"
                            onClick={() => {
                              setEditingMaterial(item);
                              setMaterialForm({
                                title: item.title,
                                type: item.type,
                                file_url: item.file_url || '',
                                thumbnail_url: item.thumbnail_url || '',
                                description: item.description || ''
                              });
                              setMaterialDialogOpen(true);
                            }}
                          >
                            <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="h-8 w-8 p-0"
                            disabled={deleteMaterialMut.isPending}
                            onClick={() => {
                              if (confirm('Are you sure you want to delete this marketing resource?')) {
                                deleteMaterialMut.mutate(item.id);
                              }
                            }}
                          >
                            <Trash className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </TabsContent>

        {/* ── TAB 6: SETTINGS ── */}
        <TabsContent value="settings" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Form Settings */}
            <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-5 shadow-sm space-y-6">
              <div className="border-b border-border pb-3">
                <h3 className="text-base font-bold flex items-center gap-2">
                  <Settings2 className="w-4 h-4 text-primary" /> Affiliate Program Configuration
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">Control global rules, commissions, tracking, and payout frequencies.</p>
              </div>

              {loadingSettings ? <LoadingPlaceholder /> : (
                <div className="space-y-5">
                  <div className="flex items-center justify-between p-4 bg-muted/40 border border-border rounded-xl">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-bold">Affiliate Program Enabled</Label>
                      <p className="text-xs text-muted-foreground">Enable or temporarily suspend referral registrations and payout requests.</p>
                    </div>
                    <Switch
                      checked={settingsForm.enabled}
                      onCheckedChange={(checked) => setSettingsForm(prev => ({ ...prev, enabled: checked }))}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Referral Commission (MWK)</Label>
                      <Input
                        type="number"
                        placeholder="e.g. 10000"
                        value={settingsForm.commission_amount}
                        onChange={e => setSettingsForm(prev => ({ ...prev, commission_amount: e.target.value }))}
                        className="bg-card border-border"
                      />
                      <p className="text-[10px] text-muted-foreground">Amount rewarded per student referral who pays tuition fees.</p>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Minimum Payout threshold (MWK)</Label>
                      <Input
                        type="number"
                        placeholder="e.g. 5000"
                        value={settingsForm.min_payout}
                        onChange={e => setSettingsForm(prev => ({ ...prev, min_payout: e.target.value }))}
                        className="bg-card border-border"
                      />
                      <p className="text-[10px] text-muted-foreground">Minimum commission balance an affiliate must earn before requesting payout.</p>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Cookie/Referral Link Duration (Days)</Label>
                      <Input
                        type="number"
                        placeholder="e.g. 30"
                        value={settingsForm.cookie_days}
                        onChange={e => setSettingsForm(prev => ({ ...prev, cookie_days: e.target.value }))}
                        className="bg-card border-border"
                      />
                      <p className="text-[10px] text-muted-foreground">Days of referral tracking validity on candidate devices after initial click.</p>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Payout Frequency Mode</Label>
                      <Select
                        value={settingsForm.payout_frequency}
                        onValueChange={(val) => setSettingsForm(prev => ({ ...prev, payout_frequency: val }))}
                      >
                        <SelectTrigger className="bg-card border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="biweekly">Bi-weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-[10px] text-muted-foreground">Designated timeframe showing expected regular payouts in active affiliate profile.</p>
                    </div>
                  </div>

                  <Button
                    onClick={() => saveSettingsMut.mutate(settingsForm)}
                    disabled={saveSettingsMut.isPending}
                    className="w-full sm:w-auto font-bold px-6 h-9"
                  >
                    {saveSettingsMut.isPending ? (
                      <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Saving Configuration…</>
                    ) : (
                      'Save Settings'
                    )}
                  </Button>
                </div>
              )}
            </div>

            {/* Template Card */}
            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm h-fit space-y-4">
              <h4 className="font-bold text-sm text-foreground flex items-center gap-1.5">
                <ExternalLink className="w-4 h-4 text-primary" /> Affiliate Tracking Link Template
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                This is the URL pattern partners use to register prospects on Chibondo Academy. When visited, cookie tracking associates subsequent sales with the affiliate.
              </p>
              <div className="p-3 bg-muted/60 border border-border/80 rounded-xl space-y-2">
                <span className="text-[11px] font-mono text-foreground break-all block">{referralURLTemplate}</span>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-1.5 h-8 font-semibold border-border bg-background"
                  onClick={() => copyToClipboard(referralURLTemplate, 'Link template copied!')}
                >
                  <Copy className="w-3.5 h-3.5" /> Copy Template
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* ── SHEET LAYER: AFFILIATE DETAILS ── */}
      <Sheet open={!!selectedAffiliate} onOpenChange={(open) => !open && setSelectedAffiliate(null)}>
        <SheetContent className="overflow-y-auto sm:max-w-md">
          <SheetHeader className="mb-6">
            <SheetTitle className="text-xl font-bold flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" /> Affiliate Profile Details
            </SheetTitle>
            <SheetDescription>
              View and manage details for this affiliate user.
            </SheetDescription>
          </SheetHeader>

          {selectedAffiliate && (() => {
            const aff = selectedAffiliate;
            const affRefs = allReferrals.filter(r => r.referrer_id === aff.id);
            const totalCount = affRefs.length;
            const paidCount = affRefs.filter(r => ['paid', 'rewarded'].includes(r.status)).length;
            const totalEarned = affRefs.filter(r => ['paid', 'rewarded'].includes(r.status)).reduce((sum, r) => sum + (r.reward_amount || commissionAmt), 0);
            const paidOut = allPayouts.filter(p => p.affiliate_id === aff.id && p.status === 'completed').reduce((sum, p) => sum + (p.amount || 0), 0);
            const balance = totalEarned - paidOut;

            const isSuspended = aff.role === 'suspended_affiliate';
            const refLink = `${window.location.origin}/register?ref=${aff.referral_code || ''}`;

            return (
              <div className="space-y-6 pb-8">
                {/* Header block with avatar and status */}
                <div className="flex items-center gap-4 bg-muted/30 p-4 rounded-2xl border border-border">
                  <AffiliateAvatar name={aff.full_name || aff.email} size="lg" />
                  <div className="min-w-0 flex-1">
                    <h4 className="font-bold text-base truncate">{aff.full_name || 'No Name'}</h4>
                    <p className="text-xs text-muted-foreground truncate">{aff.email}</p>
                    <div className="mt-2 flex items-center gap-1.5">
                      <Badge className={isSuspended ? 'bg-red-500/10 text-red-600' : 'bg-green-500/10 text-green-600'}>
                        {isSuspended ? 'Suspended' : 'Active'}
                      </Badge>
                      {aff.referral_code && (
                        <Badge variant="outline" className="font-mono text-[10px]">
                          Code: {aff.referral_code}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {/* Contact Details Section */}
                <div className="space-y-3">
                  <h5 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Contact Info</h5>
                  <div className="grid grid-cols-2 gap-3 bg-card border border-border p-3 rounded-xl text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Phone</p>
                      <p className="font-semibold text-foreground truncate mt-0.5">{aff.phone || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">WhatsApp</p>
                      <p className="font-semibold text-foreground truncate mt-0.5">{aff.whatsapp || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                {/* Stats Section */}
                <div className="space-y-3">
                  <h5 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Affiliate Statistics</h5>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-card border border-border p-3 rounded-xl text-center">
                      <p className="text-xs text-muted-foreground">Referrals (Total / Paid)</p>
                      <p className="text-lg font-bold text-foreground mt-0.5">{totalCount} / <span className="text-green-600">{paidCount}</span></p>
                    </div>
                    <div className="bg-card border border-border p-3 rounded-xl text-center">
                      <p className="text-xs text-muted-foreground">Total Earned</p>
                      <p className="text-lg font-bold text-primary mt-0.5">{formatMoney(totalEarned)}</p>
                    </div>
                    <div className="bg-card border border-border p-3 rounded-xl text-center">
                      <p className="text-xs text-muted-foreground">Paid Out</p>
                      <p className="text-lg font-bold text-foreground mt-0.5">{formatMoney(paidOut)}</p>
                    </div>
                    <div className="bg-card border border-border p-3 rounded-xl text-center bg-primary/5 border-primary/20">
                      <p className="text-xs text-primary font-medium">Available Balance</p>
                      <p className="text-lg font-black text-primary mt-0.5">{formatMoney(balance)}</p>
                    </div>
                  </div>
                </div>

                {/* Payment Info Section */}
                <div className="space-y-3">
                  <h5 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Payment Details</h5>
                  <div className="bg-card border border-border p-4 rounded-xl space-y-3 text-sm">
                    <div className="flex justify-between border-b border-border/60 pb-2">
                      <span className="text-muted-foreground">Preferred Method:</span>
                      <span className="font-semibold text-foreground capitalize">
                        {aff.preferred_payment_method?.replace('_', ' ') || 'Airtel Money'}
                      </span>
                    </div>
                    {aff.airtel_number && (
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-muted-foreground">Airtel Number:</span>
                        <span className="font-mono font-bold text-foreground">{aff.airtel_number}</span>
                      </div>
                    )}
                    {aff.tnm_number && (
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-muted-foreground">TNM Mpamba:</span>
                        <span className="font-mono font-bold text-foreground">{aff.tnm_number}</span>
                      </div>
                    )}
                    {aff.bank_name && (
                      <div className="pt-1 border-t border-dashed border-border/80 space-y-1.5 text-xs">
                        <p className="font-semibold text-foreground">Bank Information</p>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Bank:</span>
                          <span className="font-medium text-foreground">{aff.bank_name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Account:</span>
                          <span className="font-mono font-bold text-foreground">{aff.bank_account || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Holder:</span>
                          <span className="font-medium text-foreground">{aff.bank_holder || 'N/A'}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions Section */}
                <div className="space-y-3 pt-2">
                  <h5 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Actions</h5>
                  <div className="flex flex-col gap-2">
                    <Button
                      variant="outline"
                      className="w-full justify-start gap-2 border-border"
                      onClick={() => copyToClipboard(refLink, 'Referral link copied to clipboard!')}
                    >
                      <Copy className="w-4 h-4" /> Copy Referral Link
                    </Button>

                    <a href={`mailto:${aff.email}`} className="w-full block">
                      <Button variant="outline" className="w-full justify-start gap-2 border-border">
                        <Mail className="w-4 h-4" /> Send Email Notification
                      </Button>
                    </a>

                    <Button
                      variant={isSuspended ? 'default' : 'destructive'}
                      className="w-full justify-start gap-2"
                      disabled={updateAffiliateRoleMut.isPending}
                      onClick={() => {
                        const targetRole = isSuspended ? 'affiliate' : 'suspended_affiliate';
                        updateAffiliateRoleMut.mutate({ id: aff.id, newRole: targetRole });
                      }}
                    >
                      {updateAffiliateRoleMut.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : isSuspended ? (
                        <UserCheck className="w-4 h-4" />
                      ) : (
                        <Ban className="w-4 h-4" />
                      )}
                      {isSuspended ? 'Reactivate Affiliate' : 'Suspend Affiliate'}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })()}
        </SheetContent>
      </Sheet>

      {/* ── DIALOG LAYER: PAYOUT REVIEW ── */}
      <Dialog open={!!reviewPayout} onOpenChange={(open) => !open && setReviewPayout(null)}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Landmark className="w-5 h-5 text-primary" /> Review Payout Request
            </DialogTitle>
            <DialogDescription>
              Validate and complete the affiliate payout request.
            </DialogDescription>
          </DialogHeader>

          {reviewPayout && (() => {
            const p = reviewPayout;
            // Calculations for this affiliate
            const affRefs = allReferrals.filter(r => r.referrer_id === p.affiliate_id);
            const totalEarned = affRefs.filter(r => ['paid', 'rewarded'].includes(r.status)).reduce((sum, r) => sum + (r.reward_amount || commissionAmt), 0);
            const totalPaidOut = allPayouts.filter(pay => p.affiliate_id === pay.affiliate_id && pay.status === 'completed').reduce((sum, pay) => sum + (pay.amount || 0), 0);
            const availableBal = totalEarned - totalPaidOut;

            return (
              <div className="space-y-4 pt-3">
                {/* Details list */}
                <div className="bg-muted/40 border border-border p-4 rounded-2xl text-sm space-y-2.5">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Affiliate:</span>
                    <span className="font-bold text-foreground">{p.affiliate_name || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Amount Requested:</span>
                    <span className="font-black text-primary">{formatMoney(p.amount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Date Requested:</span>
                    <span className="font-medium text-foreground">{formatDate(p.created_date)}</span>
                  </div>
                  <div className="flex justify-between items-start pt-1.5 border-t border-border">
                    <span className="text-muted-foreground text-xs mt-0.5">Payment Method:</span>
                    <span className="font-bold text-foreground capitalize text-xs">
                      {p.payment_method?.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex justify-between items-start">
                    <span className="text-muted-foreground text-xs">Destination:</span>
                    <span className="font-mono text-xs text-foreground bg-background py-1 px-2 rounded border border-border break-all max-w-[200px] text-right font-bold">
                      {p.payment_details}
                    </span>
                  </div>
                </div>

                {/* Ledger verification */}
                <div className="bg-primary/5 border border-primary/20 p-3.5 rounded-xl space-y-2 text-xs">
                  <div className="flex items-center gap-1.5 text-primary font-bold">
                    <ShieldCheck className="w-4 h-4" /> Ledger Balance Audit
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div>
                      <span className="text-muted-foreground block">Lifetime Referral Earned:</span>
                      <span className="font-bold text-foreground">{formatMoney(totalEarned)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Disbursed Balance:</span>
                      <span className="font-bold text-foreground">{formatMoney(totalPaidOut)}</span>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-dashed border-primary/20 flex justify-between items-center">
                    <span className="font-medium text-muted-foreground">Audited Available Balance:</span>
                    <span className="font-black text-sm text-primary">{formatMoney(availableBal)}</span>
                  </div>
                </div>

                {/* Option to automatically convert referral records to rewarded */}
                {p.status === 'pending' && (
                  <div className="flex items-start gap-2 p-3 bg-muted/40 rounded-xl border border-border text-xs">
                    <Switch
                      checked={autoRewardReferrals}
                      onCheckedChange={setAutoRewardReferrals}
                      id="payout-auto-reward"
                    />
                    <div className="grid gap-0.5 leading-none">
                      <Label htmlFor="payout-auto-reward" className="font-bold cursor-pointer">
                        Mark "Fees Paid" referrals as "Rewarded"
                      </Label>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Transfers all matching referrals of this affiliate from "Fees Paid" to "Rewarded".
                      </p>
                    </div>
                  </div>
                )}

                {/* Notes Textarea */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Admin/Review Notes</Label>
                  <Textarea
                    placeholder="Enter payment confirmation reference or rejection reason..."
                    value={payoutNotes}
                    onChange={e => setPayoutNotes(e.target.value)}
                    className="bg-card border-border text-xs"
                    rows={3}
                  />
                </div>

                {/* Dialog Footer Actions */}
                <div className="flex flex-col sm:flex-row gap-2 pt-3 border-t border-border mt-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="text-xs font-semibold"
                    onClick={() => setReviewPayout(null)}
                  >
                    Cancel
                  </Button>
                  <div className="flex-1" />
                  
                  {p.status === 'pending' || p.status === 'processing' ? (
                    <div className="flex flex-wrap sm:flex-nowrap gap-2 w-full sm:w-auto">
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="flex-1 text-xs font-bold min-w-[80px]"
                        disabled={updatePayoutMut.isPending}
                        onClick={() => handleReviewAction('rejected')}
                      >
                        <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                      </Button>
                      
                      {p.status === 'pending' && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="flex-1 text-xs font-bold border-blue-500/40 text-blue-600 hover:bg-blue-500/10"
                          disabled={updatePayoutMut.isPending}
                          onClick={() => handleReviewAction('processing')}
                        >
                          <ArrowUpRight className="w-3.5 h-3.5 mr-1" /> Processing
                        </Button>
                      )}
                      
                      <Button
                        type="button"
                        size="sm"
                        className="flex-1 text-xs font-bold bg-green-600 hover:bg-green-700 text-white min-w-[90px]"
                        disabled={updatePayoutMut.isPending}
                        onClick={() => handleReviewAction('completed')}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Mark Paid
                      </Button>
                    </div>
                  ) : (
                    <Badge className={`${PAYOUT_STATUS[p.status]?.color || 'bg-muted'} text-xs font-semibold h-8 px-3 ml-auto`}>
                      Completed status: {p.status}
                    </Badge>
                  )}
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ── DIALOG LAYER: MARKETING MATERIAL EDIT/ADD ── */}
      <Dialog open={materialDialogOpen} onOpenChange={(open) => !open && setMaterialDialogOpen(false)}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5">
              <ImageIcon className="w-5 h-5 text-primary" /> {editingMaterial ? 'Edit Promotional Material' : 'Add Promotional Material'}
            </DialogTitle>
            <DialogDescription>
              {editingMaterial ? 'Update marketing kit asset details.' : 'Provide details for a new marketing kit asset.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleMaterialFormSubmit} className="space-y-4 pt-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Title</Label>
              <Input
                placeholder="e.g. Course Signup Facebook Banner"
                value={materialForm.title}
                onChange={e => setMaterialForm(prev => ({ ...prev, title: e.target.value }))}
                className="bg-card border-border"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Type</Label>
              <Select
                value={materialForm.type}
                onValueChange={(val) => setMaterialForm(prev => ({ ...prev, type: val }))}
              >
                <SelectTrigger className="bg-card border-border">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="banner">Banner</SelectItem>
                  <SelectItem value="social_graphic">Social Graphic</SelectItem>
                  <SelectItem value="whatsapp_msg">WhatsApp Message</SelectItem>
                  <SelectItem value="promo_image">Promo Image</SelectItem>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="other">Other Asset</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex justify-between">
                <span>Asset Source / File URL</span>
                <span className="text-[10px] text-muted-foreground font-normal">(Direct Link or share URL)</span>
              </Label>
              <Input
                placeholder="https://..."
                value={materialForm.file_url}
                onChange={e => setMaterialForm(prev => ({ ...prev, file_url: e.target.value }))}
                className="bg-card border-border font-mono text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex justify-between">
                <span>Thumbnail URL</span>
                <span className="text-[10px] text-muted-foreground font-normal">(Optional preview)</span>
              </Label>
              <Input
                placeholder="https://..."
                value={materialForm.thumbnail_url}
                onChange={e => setMaterialForm(prev => ({ ...prev, thumbnail_url: e.target.value }))}
                className="bg-card border-border font-mono text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Description / Message Content</Label>
              <Textarea
                placeholder="Provide brief copy details, dimensions or WhatsApp message text content here..."
                value={materialForm.description}
                onChange={e => setMaterialForm(prev => ({ ...prev, description: e.target.value }))}
                className="bg-card border-border text-xs"
                rows={4}
              />
            </div>

            <DialogFooter className="pt-3 border-t border-border">
              <Button
                type="button"
                variant="outline"
                onClick={() => setMaterialDialogOpen(false)}
                className="h-9 font-semibold"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="h-9 font-bold"
                disabled={createMaterialMut.isPending || updateMaterialMut.isPending}
              >
                {createMaterialMut.isPending || updateMaterialMut.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-1.5" /> Saving…</>
                ) : (
                  editingMaterial ? 'Update Resource' : 'Create Resource'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
