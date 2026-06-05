import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, Check, Gift, Users, DollarSign, Share2, ChevronRight, Trophy, Medal } from 'lucide-react';
import { toast } from 'sonner';

const statusColors = {
  pending: 'bg-muted text-muted-foreground',
  registered: 'bg-blue-100 text-blue-700',
  paid: 'bg-yellow-100 text-yellow-700',
  rewarded: 'bg-green-100 text-green-700',
};

export default function ReferralsPage() {
  const { user } = useOutletContext();
  const [copied, setCopied] = useState(false);

  // Use custom code if set, otherwise fall back to deterministic code from user ID
  const referralCode = user?.referral_code || (user?.id ? `CHIB-${user.id.slice(-6).toUpperCase()}` : '');
  const referralLink = `${window.location.origin}/register?ref=${referralCode}`;

  const { data: referrals = [], isLoading } = useQuery({
    queryKey: ['referrals', user?.id],
    queryFn: () => base44.entities.Referral.filter({ referrer_id: user.id }, '-created_date', 50),
    enabled: !!user?.id,
  });

  // All referrals for leaderboard
  const { data: allReferrals = [] } = useQuery({
    queryKey: ['all-referrals-leaderboard'],
    queryFn: () => base44.entities.Referral.list('-created_date', 500),
  });

  // Aggregate leaderboard
  const leaderboard = Object.values(
    allReferrals.reduce((acc, r) => {
      if (!r.referrer_id) return acc;
      if (!acc[r.referrer_id]) {
        acc[r.referrer_id] = {
          referrer_id: r.referrer_id,
          name: r.referrer_name || 'Unknown',
          total: 0,
          paid: 0,
        };
      }
      acc[r.referrer_id].total += 1;
      if (['paid', 'rewarded'].includes(r.status)) acc[r.referrer_id].paid += 1;
      return acc;
    }, {})
  )
    .sort((a, b) => b.paid - a.paid || b.total - a.total)
    .slice(0, 10);

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const shareMessage = `📚 *The Chibondo Academy* is an online secondary school that offers MSCE lessons in all subjects.

Fees start from *MK10,000 per month* and that unlocks access to both Form 3 and Form 4 content.

Register for free through this link 👇
${referralLink}`;

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Join Chibondo Academy',
        text: shareMessage,
        url: referralLink,
      });
    } else {
      handleCopy(shareMessage);
    }
  };

  const handleWhatsApp = () => {
    const encoded = encodeURIComponent(shareMessage);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  };

  const stats = {
    total: referrals.length,
    registered: referrals.filter(r => ['registered', 'paid', 'rewarded'].includes(r.status)).length,
    paid: referrals.filter(r => ['paid', 'rewarded'].includes(r.status)).length,
    earned: referrals.filter(r => r.reward_status === 'paid').reduce((acc, r) => acc + (r.reward_amount || 0), 0),
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold flex items-center gap-2">
          <Gift className="w-6 h-6 text-accent" /> Referral Program
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Invite friends & earn rewards when they pay their fees</p>
      </div>

      {/* How it works */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <h2 className="font-semibold mb-4 text-sm uppercase tracking-wide text-muted-foreground">How It Works</h2>
        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            { step: '1', label: 'Share your code', desc: 'Send your unique link to friends' },
            { step: '2', label: 'They register', desc: 'Friend signs up using your link' },
            { step: '3', label: 'Earn rewards', desc: 'Get rewarded when they pay fees' },
          ].map(({ step, label, desc }) => (
            <div key={step} className="space-y-1.5">
              <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center mx-auto text-sm font-bold text-accent">{step}</div>
              <p className="text-xs font-semibold">{label}</p>
              <p className="text-[11px] text-muted-foreground leading-snug">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Referral Code Card */}
      <div className="bg-gradient-to-br from-primary to-primary/80 rounded-2xl p-6 text-primary-foreground">
        <p className="text-xs font-medium opacity-70 mb-2 uppercase tracking-wide">Your Referral Code</p>
        <div className="flex items-center gap-3 mb-4">
          <span className="text-3xl font-display font-bold tracking-widest">{referralCode}</span>
        </div>
        <div className="bg-white/10 rounded-xl p-3 text-xs font-mono break-all mb-4 opacity-80">
          {referralLink}
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            size="sm"
            variant="secondary"
            className="flex-1 bg-white/20 hover:bg-white/30 text-primary-foreground border-0"
            onClick={() => handleCopy(referralCode)}
          >
            {copied ? <Check className="w-4 h-4 mr-1.5" /> : <Copy className="w-4 h-4 mr-1.5" />}
            Copy Code
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="flex-1 bg-green-500/80 hover:bg-green-500 text-white border-0"
            onClick={handleWhatsApp}
          >
            <Share2 className="w-4 h-4 mr-1.5" />
            WhatsApp
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="w-full bg-white/10 hover:bg-white/20 text-primary-foreground border-0"
            onClick={handleShare}
          >
            <Share2 className="w-4 h-4 mr-1.5" />
            Share Message
          </Button>
        </div>

        {/* Preview of message */}
        <div className="mt-4 bg-white/10 rounded-xl p-3 text-xs leading-relaxed whitespace-pre-line opacity-80">
          {shareMessage}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Referrals', value: stats.total, icon: Users },
          { label: 'Registered', value: stats.registered, icon: ChevronRight },
          { label: 'Fees Paid', value: stats.paid, icon: DollarSign },
          { label: 'MWK Earned', value: stats.earned.toLocaleString(), icon: Gift },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-4 text-center">
            <Icon className="w-5 h-5 text-accent mx-auto mb-1.5" />
            <p className="text-xl font-bold font-display">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {/* Referrals List */}
      <div>
        <h2 className="font-semibold mb-3">Your Referrals</h2>
        {isLoading ? (
          <div className="space-y-2">
            {[1,2,3].map(i => <div key={i} className="h-14 bg-muted animate-pulse rounded-xl" />)}
          </div>
        ) : referrals.length === 0 ? (
          <div className="text-center py-12 bg-card border border-border rounded-2xl">
            <Users className="w-12 h-12 mx-auto text-muted-foreground/20 mb-3" />
            <p className="text-muted-foreground text-sm">No referrals yet. Share your code to get started!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {referrals.map(r => (
              <div key={r.id} className="bg-card border border-border rounded-xl px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{r.referred_name || r.referred_email || 'Pending registration'}</p>
                  <p className="text-xs text-muted-foreground">{new Date(r.created_date).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  {r.reward_amount > 0 && (
                    <span className="text-xs font-semibold text-accent">+MWK {r.reward_amount.toLocaleString()}</span>
                  )}
                  <Badge className={`text-xs capitalize ${statusColors[r.status]}`}>{r.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Leaderboard */}
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
              const rankBg = ['bg-yellow-500/10', 'bg-slate-400/10', 'bg-amber-600/10'];
              const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null;

              return (
                <div
                  key={entry.referrer_id}
                  className={`flex items-center gap-4 px-5 py-3 transition-colors ${isMe ? 'bg-accent/5 border-l-2 border-accent' : ''}`}
                >
                  {/* Rank */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${idx < 3 ? rankBg[idx] : 'bg-muted'} ${idx < 3 ? rankColors[idx] : 'text-muted-foreground'}`}>
                    {medal || idx + 1}
                  </div>

                  {/* Name */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold truncate ${isMe ? 'text-accent' : ''}`}>
                      {entry.name} {isMe && <span className="text-xs font-normal text-muted-foreground">(you)</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">{entry.total} invited · {entry.paid} paid</p>
                  </div>

                  {/* Score */}
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

      {/* Contact for payout */}
      <div className="text-center text-xs text-muted-foreground pb-6">
        <p>For reward payouts, contact us at <span className="text-primary">admin@chibondo.ac.mw</span></p>
      </div>
    </div>
  );
}