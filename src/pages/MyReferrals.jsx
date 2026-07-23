import React, { useState } from 'react'; // v2
import { useOutletContext } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/api/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import {
  Gift, DollarSign, Users, Copy, Check, Share2,
  Loader2, Wallet, Settings, Link2, BarChart3, Clock, CheckCircle2,
  Trophy, Image, MessageSquare, Download, Video, Plus, Trash2, Edit2,
  UserCog, Smartphone, Building2, Bell, Save
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const statusColors = {
  pending: 'bg-muted text-muted-foreground',
  registered: 'bg-blue-100 text-blue-700',
  paid: 'bg-yellow-100 text-yellow-700',
  rewarded: 'bg-green-100 text-green-700',
};

function AffiliateOverview({ referrals, commissionSettings }) {
  const stats = {
    total: referrals.length,
    registered: referrals.filter(r => ['registered', 'paid', 'rewarded'].includes(r.status)).length,
    paid: referrals.filter(r => ['paid', 'rewarded'].includes(r.status)).length,
    earned: referrals.filter(r => r.reward_status === 'paid').reduce((acc, r) => acc + (r.reward_amount || 0), 0),
    pending: referrals.filter(r => r.reward_status === 'pending' && r.reward_amount > 0).reduce((acc, r) => acc + (r.reward_amount || 0), 0),
  };

  const type = commissionSettings?.commission_type || 'percentage';
  const rateDisplay = type === 'percentage' 
    ? `${commissionSettings?.percentage_rate || 0}% of each payment`
    : type === 'fixed' 
    ? `MWK ${(commissionSettings?.fixed_amount || 0).toLocaleString()} per referral`
    : `Tiered rates available`;

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-accent/10 to-accent/5 border border-accent/20 rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center flex-shrink-0">
            <DollarSign className="w-5 h-5 text-accent" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-sm mb-1">Your Commission Rate</h3>
            <p className="text-lg font-bold text-accent">{rateDisplay}</p>
            <p className="text-xs text-muted-foreground mt-1">Minimum payout: MWK {(commissionSettings?.min_payout || 5000).toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Total Referrals', value: stats.total, icon: Users, color: 'text-primary bg-primary/10' },
          { label: 'Registered', value: stats.registered, icon: CheckCircle2, color: 'text-blue-500 bg-blue-500/10' },
          { label: 'Paid Fees', value: stats.paid, icon: DollarSign, color: 'text-success bg-success/10' },
          { label: 'Earned', value: `MWK ${stats.earned.toLocaleString()}`, icon: Gift, color: 'text-accent bg-accent/10' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-4">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${color}`}>
              <Icon className="w-4 h-4" />
            </div>
            <p className="text-xl font-bold font-display">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {stats.pending > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 flex items-center gap-3">
          <Clock className="w-5 h-5 text-yellow-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-yellow-700">Pending Payout</p>
            <p className="text-xs text-yellow-600">MWK {stats.pending.toLocaleString()} waiting to be paid out</p>
          </div>
        </div>
      )}
    </div>
  );
}

function LinkGenerator({ referralCode }) {
  const [copied, setCopied] = useState('');
  const referralLink = `${window.location.origin}/register?ref=${referralCode}`;

  const shareMessage = `📚 *The Chibondo Academy* is an online secondary school that offers MSCE lessons in all subjects.

Fees start from *MWK10,000 per month* and that unlocks access to both Form 3 and Form 4 content.

Register for free through this link 👇
${referralLink}`;

  const copy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopied(''), 2000);
  };

  const handleWhatsApp = () => {
    const encoded = encodeURIComponent(shareMessage);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: 'Join Chibondo Academy', text: shareMessage, url: referralLink });
    } else {
      copy(shareMessage);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold mb-1">Your Referral Code</h3>
        <p className="text-sm text-muted-foreground">Share this code or link to earn rewards</p>
      </div>

      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <div className="text-center py-4 bg-muted/50 rounded-xl">
          <p className="text-xs text-muted-foreground mb-2">Your Code</p>
          <p className="text-2xl font-bold font-mono tracking-widest text-primary">{referralCode}</p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-mono text-muted-foreground flex-1 truncate">{referralLink}</p>
            <Button variant="outline" size="sm" onClick={() => copy(referralLink, 'link')}>
              {copied === 'link' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => copy(referralCode, 'code')} className="text-sm">
              {copied === 'code' ? <Check className="w-4 h-4 mr-1.5" /> : <Copy className="w-4 h-4 mr-1.5" />}
              Copy Code
            </Button>
            <Button variant="outline" onClick={handleWhatsApp} className="text-sm bg-green-500/10 text-green-600 hover:bg-green-500/20 border-green-500/20">
              <Share2 className="w-4 h-4 mr-1.5" />
              WhatsApp
            </Button>
          </div>

          <Button variant="outline" onClick={handleShare} className="w-full">
            <Share2 className="w-4 h-4 mr-2" />
            Share Message
          </Button>
        </div>

        <div className="bg-card/10 rounded-xl p-3 text-xs leading-relaxed whitespace-pre-line opacity-80 mt-3">
          {shareMessage}
        </div>
      </div>
    </div>
  );
}

function PayoutsTab({ referrals, commissionSettings }) {
  const queryClient = useQueryClient();
  const { user } = useOutletContext() ?? {};
  const [requestDialog, setRequestDialog] = useState(false);
  const [payoutData, setPayoutData] = useState({ amount: '', method: 'airtel_money', details: '' });

  const { data: payoutRequests = [] } = useQuery({
    queryKey: ['myPayoutRequests', user?.id],
    queryFn: () => db.entities.PayoutRequest.filter({ affiliate_id: user?.id }, '-created_date', 50),
    enabled: !!user?.id,
  });

  const pendingEarnings = referrals.filter(r => r.reward_status === 'pending' && r.reward_amount > 0).reduce((acc, r) => acc + (r.reward_amount || 0), 0);
  const paidEarnings = referrals.filter(r => r.reward_status === 'paid').reduce((acc, r) => acc + (r.reward_amount || 0), 0);
  const minPayout = commissionSettings?.min_payout || 5000;
  const canRequestPayout = pendingEarnings >= minPayout;

  const requestMutation = useMutation({
    mutationFn: async () => {
      await db.entities.PayoutRequest.create({
        affiliate_id: user.id,
        affiliate_name: user.full_name,
        amount: parseFloat(payoutData.amount) || pendingEarnings,
        payment_method: payoutData.method,
        payment_details: payoutData.details,
        status: 'pending',
        referral_ids: referrals.filter(r => r.reward_status === 'pending').map(r => r.id),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myPayoutRequests'] });
      toast.success('Payout request submitted!');
      setRequestDialog(false);
      setPayoutData({ amount: '', method: 'airtel_money', details: '' });
    },
  });

  const methodLabels = { airtel_money: 'Airtel Money', tnm_mpamba: 'TNM Mpamba', bank_transfer: 'Bank Transfer' };
  const payoutStatusColors = { pending: 'bg-yellow-500/10 text-yellow-600', approved: 'bg-blue-500/10 text-blue-600', paid: 'bg-success/10 text-success', rejected: 'bg-destructive/10 text-destructive' };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Pending</p>
          <p className="text-2xl font-bold text-yellow-600">MWK {pendingEarnings.toLocaleString()}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Paid Out</p>
          <p className="text-2xl font-bold text-success">MWK {paidEarnings.toLocaleString()}</p>
        </div>
      </div>

      <Dialog open={requestDialog} onOpenChange={setRequestDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Request Payout</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Amount (MWK)</Label>
              <Input type="number" value={payoutData.amount || pendingEarnings} onChange={e => setPayoutData({ ...payoutData, amount: e.target.value })} className="mt-1" />
              <p className="text-xs text-muted-foreground mt-1">Min: MWK {minPayout.toLocaleString()} · Available: MWK {pendingEarnings.toLocaleString()}</p>
            </div>
            <div>
              <Label>Payment Method</Label>
              <select className="w-full mt-1 h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm" value={payoutData.method} onChange={e => setPayoutData({ ...payoutData, method: e.target.value })}>
                <option value="airtel_money">Airtel Money</option>
                <option value="tnm_mpamba">TNM Mpamba</option>
                <option value="bank_transfer">Bank Transfer</option>
              </select>
            </div>
            <div>
              <Label>Payment Details</Label>
              <Input placeholder={payoutData.method === 'bank_transfer' ? 'Bank account details' : 'Phone number'} value={payoutData.details} onChange={e => setPayoutData({ ...payoutData, details: e.target.value })} className="mt-1" />
            </div>
            <Button className="w-full" onClick={() => requestMutation.mutate()} disabled={requestMutation.isPending || !canRequestPayout}>
              {requestMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting...</> : 'Submit Request'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {!canRequestPayout ? (
        <div className="bg-muted/50 border border-border rounded-xl p-6 text-center">
          <Wallet className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-sm font-semibold mb-1">Minimum Payout Not Reached</p>
          <p className="text-xs text-muted-foreground">You need MWK {minPayout.toLocaleString()} to request a payout. Keep referring more students!</p>
        </div>
      ) : (
        <Button className="w-full" onClick={() => setRequestDialog(true)}>
          <DollarSign className="w-4 h-4 mr-2" />
          Request Payout (MWK {pendingEarnings.toLocaleString()})
        </Button>
      )}

      {payoutRequests.length > 0 && (
        <div>
          <h3 className="font-semibold mb-3">Payout History</h3>
          <div className="space-y-2">
            {payoutRequests.map(req => (
              <div key={req.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card text-sm">
                <div className="flex-1">
                  <p className="font-medium">MWK {(req.amount || 0).toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{methodLabels[req.payment_method]} · {new Date(req.created_date).toLocaleDateString()}</p>
                </div>
                <Badge className={`text-[10px] capitalize ${payoutStatusColors[req.status]}`}>{req.status}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AffiliateSettings() {
  const { user } = useOutletContext() ?? {};
  const queryClient = useQueryClient();
  const [customCode, setCustomCode] = useState(() => user?.referral_code || '');
  const [notifications, setNotifications] = useState(true);
  const [checkStatus, setCheckStatus] = useState(null); // null | 'checking' | 'available' | 'taken' | 'yours'
  const debounceRef = React.useRef(null);

  React.useEffect(() => {
    if (user?.referral_code) setCustomCode(user.referral_code);
  }, [user?.referral_code]);

  // Real-time availability check — debounced 500ms
  const handleCodeChange = (e) => {
    const val = e.target.value.toUpperCase().replace(/\s/g, '');
    setCustomCode(val);
    setCheckStatus(null);
    clearTimeout(debounceRef.current);
    if (val.length < 4) return;
    if (val === user?.referral_code) { setCheckStatus('yours'); return; }
    setCheckStatus('checking');
    debounceRef.current = setTimeout(async () => {
      try {
        const existing = await db.entities.User.filter({ referral_code: val });
        const taken = existing.find(u => u.id !== user.id);
        setCheckStatus(taken ? 'taken' : 'available');
      } catch { setCheckStatus(null); }
    }, 500);
  };

  const updateMutation = useMutation({
    mutationFn: async () => {
      const code = customCode.trim().toUpperCase();
      if (!code) throw new Error('Referral code cannot be empty');
      if (code.length < 4) throw new Error('Code must be at least 4 characters');
      if (checkStatus === 'taken') throw new Error('This code is already taken. Please choose another.');
      return db.auth.updateMe({ referral_code: code });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
      queryClient.invalidateQueries({ queryKey: ['myReferrals'] });
      setCheckStatus('yours');
      toast.success('Referral code saved!', { description: `Your new code: ${customCode.trim().toUpperCase()}` });
    },
    onError: (error) => {
      toast.error('Could not save code', { description: error.message });
    },
  });

  const statusInfo = {
    checking:  { color: 'text-muted-foreground', icon: '⏳', text: 'Checking availability…' },
    available: { color: 'text-green-600',         icon: '✓',  text: 'Available! This code is yours to take.' },
    taken:     { color: 'text-red-500',            icon: '✕',  text: 'Already taken — try a different code.' },
    yours:     { color: 'text-blue-500',           icon: '✓',  text: 'This is your current code.' },
  };
  const status = checkStatus ? statusInfo[checkStatus] : null;
  const canSave = customCode.trim().length >= 4 && checkStatus !== 'taken' && checkStatus !== 'checking' && !updateMutation.isPending;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold mb-1">Custom Referral Code</h3>
        <p className="text-sm text-muted-foreground">Personalize your referral code — availability checked in real time</p>
      </div>

      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div>
          <Label>Your Code</Label>
          <div className="relative mt-1">
            <Input
              value={customCode}
              onChange={handleCodeChange}
              placeholder="MYCODE123"
              className={`font-mono pr-10 transition-colors ${
                checkStatus === 'available' ? 'border-green-500 focus-visible:ring-green-500' :
                checkStatus === 'taken'     ? 'border-red-500 focus-visible:ring-red-500' : ''
              }`}
              maxLength={20}
            />
            {checkStatus === 'checking' && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
            )}
            {checkStatus === 'available' && (
              <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-600" />
            )}
          </div>
          {status && (
            <p className={`text-xs mt-1.5 font-medium ${status.color}`}>
              {status.icon} {status.text}
            </p>
          )}
          {!status && customCode.length > 0 && customCode.length < 4 && (
            <p className="text-xs mt-1.5 text-muted-foreground">Min. 4 characters</p>
          )}
        </div>

        {/* Success/error notice after save */}
        {updateMutation.isSuccess && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium bg-green-500/10 text-green-700 border border-green-500/20">
            <Check className="w-4 h-4 flex-shrink-0" />
            Code saved! Share it to start earning.
          </div>
        )}
        {updateMutation.isError && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium bg-red-500/10 text-red-700 border border-red-500/20">
            <span className="flex-shrink-0">✕</span>
            {updateMutation.error?.message || 'Save failed. Try again.'}
          </div>
        )}

        <Button
          className="w-full"
          onClick={() => updateMutation.mutate()}
          disabled={!canSave}
        >
          {updateMutation.isPending
            ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</>
            : 'Save Code'}
        </Button>
      </div>

      <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
        <div>
          <p className="font-semibold text-sm">WhatsApp Notifications</p>
          <p className="text-xs text-muted-foreground">Get notified when referrals pay fees</p>
        </div>
        <Switch checked={notifications} onCheckedChange={setNotifications} />
      </div>
    </div>
  );
}

function Leaderboard() {
  const { user } = useOutletContext() ?? {};
  const { data: allReferrals = [] } = useQuery({ queryKey: ['all-referrals-leaderboard'], queryFn: () => db.entities.Referral.list('-created_date', 500) });

  const leaderboard = Object.values(allReferrals.reduce((acc, r) => {
    if (!r.referrer_id) return acc;
    if (!acc[r.referrer_id]) { acc[r.referrer_id] = { referrer_id: r.referrer_id, name: r.referrer_name || 'Unknown', total: 0, paid: 0 }; }
    acc[r.referrer_id].total += 1;
    if (['paid', 'rewarded'].includes(r.status)) acc[r.referrer_id].paid += 1;
    return acc;
  }, {})).sort((a, b) => b.paid - a.paid || b.total - a.total).slice(0, 10);

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
        <Trophy className="w-5 h-5 text-accent" />
        <h2 className="font-semibold">Top Referrers</h2>
        <span className="text-xs text-muted-foreground ml-auto">Ranked by paid referrals</span>
      </div>
      {leaderboard.length === 0 ? (
        <div className="text-center py-10">
          <Trophy className="w-10 h-10 mx-auto text-muted-foreground/20 mb-2" />
          <p className="text-sm text-muted-foreground">No referrals yet — be the first!</p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {leaderboard.map((entry, idx) => {
            const isMe = entry.referrer_id === user?.id;
            const rankColors = ['text-yellow-500', 'text-slate-400', 'text-amber-600'];
            const rankBg = ['bg-yellow-500/10', 'bg-muted/10', 'bg-amber-600/10'];
            const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null;
            return (
              <div key={entry.referrer_id} className={`flex items-center gap-4 px-5 py-3 transition-colors ${isMe ? 'bg-accent/5 border-l-2 border-accent' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${idx < 3 ? rankBg[idx] : 'bg-muted'} ${idx < 3 ? rankColors[idx] : 'text-muted-foreground'}`}>
                  {medal || idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold truncate ${isMe ? 'text-accent' : ''}`}>{entry.name} {isMe && <span className="text-xs font-normal text-muted-foreground">(you)</span>}</p>
                  <p className="text-xs text-muted-foreground">{entry.total} invited · {entry.paid} paid</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`text-lg font-bold font-display ${idx < 3 ? rankColors[idx] : 'text-foreground'}`}>{entry.paid}</p>
                  <p className="text-[10px] text-muted-foreground">paid</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── MARKETING MATERIALS TAB ──────────────────────────────────────────────────
const MATERIAL_TYPES = {
  banner:         { label: 'Banner',           icon: Image,         color: 'bg-blue-500/10 text-blue-600' },
  social_graphic: { label: 'Social Graphic',   icon: Image,         color: 'bg-purple-500/10 text-purple-600' },
  whatsapp_msg:   { label: 'WhatsApp Message', icon: MessageSquare, color: 'bg-green-500/10 text-green-600' },
  promo_image:    { label: 'Promo Image',      icon: Image,         color: 'bg-yellow-500/10 text-yellow-600' },
  video:          { label: 'Video',            icon: Video,         color: 'bg-red-500/10 text-red-600' },
  other:          { label: 'Other',            icon: Download,      color: 'bg-muted text-muted-foreground' },
};

function MaterialsTab({ user }) {
  const isAdmin = user?.role === 'admin';
  const qc = useQueryClient();
  const [typeFilter, setTypeFilter] = React.useState('all');
  const [dialog, setDialog] = React.useState(false);
  const [editing, setEditing] = React.useState(null);
  const [form, setForm] = React.useState({ title: '', description: '', type: 'banner', file_url: '', thumbnail_url: '', content: '' });

  const { data: materials = [], isLoading } = useQuery({
    queryKey: ['affiliateMaterials'],
    queryFn: () => db.entities.AffiliateMaterial.filter({}, '-created_date', 100),
    staleTime: 30_000,
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!form.title) throw new Error('Title is required');
      if (editing) return db.entities.AffiliateMaterial.update(editing.id, form);
      return db.entities.AffiliateMaterial.create({ ...form, created_by_name: user.full_name });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['affiliateMaterials'] });
      toast.success(editing ? 'Updated!' : 'Material added!');
      setDialog(false); setEditing(null);
      setForm({ title: '', description: '', type: 'banner', file_url: '', thumbnail_url: '', content: '' });
    },
    onError: e => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: id => db.entities.AffiliateMaterial.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['affiliateMaterials'] }); toast.success('Deleted'); },
  });

  const openEdit = (item) => {
    setEditing(item);
    setForm({ title: item.title, description: item.description || '', type: item.type, file_url: item.file_url || '', thumbnail_url: item.thumbnail_url || '', content: item.content || '' });
    setDialog(true);
  };

  const filtered = typeFilter === 'all' ? materials : materials.filter(m => m.type === typeFilter);

  return (
    <div className="space-y-5">
      {/* Filter + Add */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1.5 flex-wrap">
          {['all', ...Object.keys(MATERIAL_TYPES)].map(k => {
            const label = k === 'all' ? 'All' : MATERIAL_TYPES[k].label;
            const active = typeFilter === k;
            return (
              <button key={k} onClick={() => setTypeFilter(k)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${active ? 'font-bold' : 'bg-muted/50 text-muted-foreground'}`}
                style={active ? { background:'hsl(var(--primary))', color:'hsl(var(--primary-foreground))' } : {}}>
                {label}
              </button>
            );
          })}
        </div>
        {isAdmin && (
          <Button onClick={() => { setEditing(null); setForm({ title: '', description: '', type: 'banner', file_url: '', thumbnail_url: '', content: '' }); setDialog(true); }} size="sm"
            style={{ background:'hsl(var(--primary))', color:'hsl(var(--primary-foreground))' }}>
            <Plus className="w-4 h-4 mr-1.5" /> Add Material
          </Button>
        )}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-48 bg-card border border-border rounded-2xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center">
          <Image className="w-12 h-12 mx-auto text-muted-foreground/20 mb-3" />
          <p className="text-sm text-muted-foreground">
            {isAdmin ? 'No materials yet. Add banners, graphics, or message templates.' : 'No marketing materials yet — check back soon!'}
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(item => {
            const cfg = MATERIAL_TYPES[item.type] || MATERIAL_TYPES.other;
            const Icon = cfg.icon;
            const isText = item.type === 'whatsapp_msg';
            return (
              <div key={item.id} className="bg-card border border-border rounded-2xl overflow-hidden hover:border-primary/30 transition-all">
                {item.thumbnail_url || item.file_url ? (
                  <div className="aspect-video bg-muted/30 overflow-hidden">
                    <img src={item.thumbnail_url || item.file_url} alt={item.title} className="w-full h-full object-cover" onError={e => { e.target.style.display = 'none'; }} />
                  </div>
                ) : isText ? (
                  <div className="p-4 bg-green-500/5 border-b border-border min-h-[80px]">
                    <p className="text-sm text-foreground/80 leading-relaxed line-clamp-4 whitespace-pre-line">{item.content}</p>
                  </div>
                ) : (
                  <div className="aspect-video bg-muted/30 flex items-center justify-center">
                    <Icon className="w-10 h-10 text-muted-foreground/30" />
                  </div>
                )}
                <div className="p-4 space-y-3">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{item.title}</p>
                      {item.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.description}</p>}
                    </div>
                    <Badge className={`text-[10px] flex-shrink-0 ${cfg.color}`}>{cfg.label}</Badge>
                  </div>
                  <div className="flex gap-2">
                    {isText ? (
                      <button onClick={() => { navigator.clipboard.writeText(item.content); toast.success('Copied!'); }}
                        className="flex-1 py-2 rounded-xl text-xs font-semibold border border-border hover:bg-muted transition-colors flex items-center justify-center gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5" /> Copy Message
                      </button>
                    ) : item.file_url ? (
                      <a href={item.file_url} target="_blank" rel="noopener noreferrer"
                        className="flex-1 py-2 rounded-xl text-xs font-semibold border border-border hover:bg-muted transition-colors flex items-center justify-center gap-1.5">
                        <Download className="w-3.5 h-3.5" /> Download
                      </a>
                    ) : null}
                    {isAdmin && (
                      <>
                        <button onClick={() => openEdit(item)} className="p-2 rounded-xl border border-border hover:bg-muted transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => deleteMut.mutate(item.id)} className="p-2 rounded-xl border border-red-500/20 hover:bg-red-500/10 text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? 'Edit Material' : 'Add Marketing Material'}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. A4 Banner — English" />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(MATERIAL_TYPES).map(([k, v]) => (<SelectItem key={k} value={k}>{v.label}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            {form.type === 'whatsapp_msg' ? (
              <div className="space-y-1.5">
                <Label>Message Content</Label>
                <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                  placeholder="WhatsApp message template..." rows={5}
                  className="w-full px-3 py-2 text-sm border border-input rounded-md bg-transparent resize-none focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label>File URL</Label>
                  <Input value={form.file_url} onChange={e => setForm(f => ({ ...f, file_url: e.target.value }))} placeholder="https://..." />
                </div>
                <div className="space-y-1.5">
                  <Label>Thumbnail URL (optional)</Label>
                  <Input value={form.thumbnail_url} onChange={e => setForm(f => ({ ...f, thumbnail_url: e.target.value }))} placeholder="https://..." />
                </div>
              </>
            )}
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief description" />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialog(false)} className="flex-1">Cancel</Button>
              <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} className="flex-1"
                style={{ background:'hsl(var(--primary))', color:'hsl(var(--primary-foreground))' }}>
                {saveMut.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</> : 'Save'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── PROFILE & PAYMENT TAB ────────────────────────────────────────────────────
function ProfileTab({ user }) {
  const qc = useQueryClient();
  const [profile, setProfile] = React.useState({
    full_name: user?.full_name || '', email: user?.email || '',
    phone: user?.phone || '', whatsapp: user?.whatsapp || '',
  });
  const [payment, setPayment] = React.useState({
    airtel_number: user?.airtel_number || '',
    tnm_number: user?.tnm_number || '',
    bank_name: user?.bank_name || '',
    bank_account: user?.bank_account || '',
    bank_holder: user?.bank_holder || '',
  });
  const [notifs, setNotifs] = React.useState({
    whatsapp_notifications: user?.whatsapp_notifications !== false,
    inapp_notifications: user?.inapp_notifications !== false,
  });

  React.useEffect(() => {
    if (user) {
      setProfile({ full_name: user.full_name || '', email: user.email || '', phone: user.phone || '', whatsapp: user.whatsapp || '' });
      setPayment({ airtel_number: user.airtel_number || '', tnm_number: user.tnm_number || '', bank_name: user.bank_name || '', bank_account: user.bank_account || '', bank_holder: user.bank_holder || '' });
      setNotifs({ whatsapp_notifications: user.whatsapp_notifications !== false, inapp_notifications: user.inapp_notifications !== false });
    }
  }, [user?.id]);

  const saveMut = useMutation({
    mutationFn: () => db.auth.updateMe({ ...profile, ...payment, ...notifs }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['currentUser'] }); toast.success('Profile saved!'); },
    onError: () => toast.error('Failed to save. Try again.'),
  });

  const SectionBox = ({ title, icon: Icon, children }) => (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-border">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <h3 className="font-semibold text-sm">{title}</h3>
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  );

  return (
    <div className="space-y-5 max-w-xl">
      <SectionBox title="Personal Information" icon={UserCog}>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5"><Label>Full Name</Label><Input value={profile.full_name} onChange={e => setProfile(p => ({ ...p, full_name: e.target.value }))} placeholder="Your full name" /></div>
          <div className="space-y-1.5"><Label>Email</Label><Input value={profile.email} onChange={e => setProfile(p => ({ ...p, email: e.target.value }))} type="email" /></div>
          <div className="space-y-1.5"><Label>Phone</Label><Input value={profile.phone} onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))} placeholder="+265 9XX XXX XXX" /></div>
          <div className="space-y-1.5"><Label>WhatsApp</Label><Input value={profile.whatsapp} onChange={e => setProfile(p => ({ ...p, whatsapp: e.target.value }))} placeholder="+265 9XX XXX XXX" /></div>
        </div>
      </SectionBox>

      <SectionBox title="Payment Methods" icon={Smartphone}>
        <p className="text-xs text-muted-foreground -mt-1">Set up how you want to receive your commissions.</p>
        <div className="space-y-2">
          <div className="flex items-center gap-2"><div className="w-6 h-6 rounded-md bg-red-500/10 flex items-center justify-center"><Smartphone className="w-3.5 h-3.5 text-red-500" /></div><p className="text-sm font-medium">Airtel Money</p></div>
          <Input value={payment.airtel_number} onChange={e => setPayment(p => ({ ...p, airtel_number: e.target.value }))} placeholder="Airtel Money phone number" />
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2"><div className="w-6 h-6 rounded-md bg-blue-500/10 flex items-center justify-center"><Smartphone className="w-3.5 h-3.5 text-blue-500" /></div><p className="text-sm font-medium">TNM Mpamba</p></div>
          <Input value={payment.tnm_number} onChange={e => setPayment(p => ({ ...p, tnm_number: e.target.value }))} placeholder="TNM Mpamba phone number" />
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2"><div className="w-6 h-6 rounded-md bg-muted flex items-center justify-center"><Building2 className="w-3.5 h-3.5 text-muted-foreground" /></div><p className="text-sm font-medium">Bank Account</p></div>
          <div className="grid sm:grid-cols-3 gap-2">
            <Input value={payment.bank_name} onChange={e => setPayment(p => ({ ...p, bank_name: e.target.value }))} placeholder="Bank name" />
            <Input value={payment.bank_account} onChange={e => setPayment(p => ({ ...p, bank_account: e.target.value }))} placeholder="Account number" />
            <Input value={payment.bank_holder} onChange={e => setPayment(p => ({ ...p, bank_holder: e.target.value }))} placeholder="Account holder" />
          </div>
        </div>
      </SectionBox>

      <SectionBox title="Notification Preferences" icon={Bell}>
        {[
          { key: 'whatsapp_notifications', label: 'WhatsApp Notifications', sub: 'Get notified via WhatsApp when referrals register or pay fees' },
          { key: 'inapp_notifications', label: 'In-App Notifications', sub: 'Receive notifications inside the platform' },
        ].map(({ key, label, sub }) => (
          <div key={key} className="flex items-center justify-between gap-3">
            <div><p className="text-sm font-medium">{label}</p><p className="text-xs text-muted-foreground">{sub}</p></div>
            <Switch checked={notifs[key]} onCheckedChange={v => setNotifs(n => ({ ...n, [key]: v }))} />
          </div>
        ))}
      </SectionBox>

      <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} className="w-full"
        style={{ background:'hsl(var(--primary))', color:'hsl(var(--primary-foreground))' }}>
        {saveMut.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</> : <><Save className="w-4 h-4 mr-2" />Save Profile</>}
      </Button>
    </div>
  );
}

export default function MyReferrals() {
  const { user } = useOutletContext() ?? {};
  const referralCode = user?.referral_code || (user?.id ? `CHIB-${user.id.slice(-6).toUpperCase()}` : '');
  const queryClient = useQueryClient();

  const { data: referrals = [] } = useQuery({ queryKey: ['myReferrals', user?.id], queryFn: () => db.entities.Referral.filter({ referrer_id: user?.id }, '-created_date', 50), enabled: !!user?.id });
  const { data: commissionSettingsData = [] } = useQuery({ queryKey: ['affiliateSettings'], queryFn: () => db.entities.PlatformSettings.filter({ key: 'affiliate_commission' }) });
  const commissionSettings = commissionSettingsData[0]?.value || {};

  if (!user) return (
    <div className="space-y-4 animate-pulse max-w-4xl mx-auto">
      <div className="h-8 bg-muted rounded-xl w-48" />
      <div className="h-4 bg-muted rounded w-72" />
      <div className="grid grid-cols-2 gap-3">
        {[1,2,3,4].map(i => <div key={i} className="h-24 bg-muted rounded-xl" />)}
      </div>
    </div>
  );

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-display font-bold flex items-center gap-2">
          <Gift className="w-6 h-6 text-accent" /> Affiliate Program
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Invite friends & earn rewards when they pay their fees</p>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex flex-wrap gap-1 h-auto">
          <TabsTrigger value="overview"><BarChart3 className="w-4 h-4 mr-1.5" /> Overview</TabsTrigger>
          <TabsTrigger value="links"><Link2 className="w-4 h-4 mr-1.5" /> Share Links</TabsTrigger>
          <TabsTrigger value="payouts"><DollarSign className="w-4 h-4 mr-1.5" /> Payouts</TabsTrigger>
          <TabsTrigger value="settings"><Settings className="w-4 h-4 mr-1.5" /> Settings</TabsTrigger>
          <TabsTrigger value="marketing"><Image className="w-4 h-4 mr-1.5" /> Marketing</TabsTrigger>
          <TabsTrigger value="profile"><UserCog className="w-4 h-4 mr-1.5" /> Profile & Payment</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-5"><AffiliateOverview referrals={referrals} commissionSettings={commissionSettings} /></TabsContent>
        <TabsContent value="links" className="mt-5"><LinkGenerator referralCode={referralCode} /></TabsContent>
        <TabsContent value="payouts" className="mt-5"><PayoutsTab referrals={referrals} commissionSettings={commissionSettings} /></TabsContent>
        <TabsContent value="settings" className="mt-5"><AffiliateSettings /></TabsContent>
        <TabsContent value="marketing" className="mt-5"><MaterialsTab user={user} /></TabsContent>
        <TabsContent value="profile" className="mt-5"><ProfileTab user={user} /></TabsContent>
      </Tabs>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-semibold">Your Referrals</h2>
            <p className="text-xs text-muted-foreground">{referrals.length} total referrals</p>
          </div>
          {referrals.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 mx-auto text-muted-foreground/20 mb-3" />
              <p className="text-sm text-muted-foreground">No referrals yet. Start sharing your link!</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {referrals.map(r => (
                <div key={r.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{r.referred_name || r.referred_email || 'Pending'}</p>
                    <p className="text-xs text-muted-foreground">{new Date(r.created_date).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {r.reward_amount > 0 && <span className="text-xs font-semibold text-accent">+MWK {r.reward_amount.toLocaleString()}</span>}
                    <Badge className={`text-xs capitalize ${statusColors[r.status]}`}>{r.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <Leaderboard />
      </div>

      <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3 text-sm">
        <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
          <Gift className="w-4 h-4 text-accent" />
        </div>
        <div>
          <p className="font-medium">Questions about rewards or payouts?</p>
          <p className="text-xs text-muted-foreground">Contact us at <a href="mailto:support@chibondoacademy.com" className="text-primary hover:underline">support@chibondoacademy.com</a></p>
        </div>
      </div>
    </div>
  );
}