import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import SEO from '@/components/SEO';
import { formatDistanceToNow, format } from 'date-fns';
import {
  BookOpen, Play, MessageSquare, ChevronRight, ArrowRight,
  CheckCircle, Zap, Crown, Award, GraduationCap,
  Users, Lock, Newspaper, Clock
} from 'lucide-react';

/* ── subject icon map (mirrors SubjectsPage) ────────────────────────────── */
const SUBJECT_ICONS = {
  biology: '🧬', chemistry: '⚗️', physics: '⚡', mathematics: '📐',
  'additional mathematics': '∑', english: '📖', 'english language': '📖',
  'english literature': '📚', chichewa: '🗣️', agriculture: '🌱',
  geography: '🌍', history: '📜',
};
function subjectIcon(name = '') {
  return SUBJECT_ICONS[name.toLowerCase()] || '📘';
}
function readTime(content = '') {
  return Math.max(1, Math.ceil(content.replace(/<[^>]*>/g, '').split(/\s+/).length / 200));
}

/* ═══════════════════════════════════════════════════════════════════════════
   LANDING PAGE — feels exactly like being inside the app
═══════════════════════════════════════════════════════════════════════════ */
export default function LandingPage() {
  const navigate = useNavigate();

  /* Live pricing from platform (same as SubscriptionPage) */
  const [pricing, setPricing] = useState({
    monthly_price: 10000,
    annual_price: 80000,
    biannual_price: 150000,
  });

  useQuery({
    queryKey: ['pricing'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getPricing', {});
      return res.data.pricing;
    },
    onSuccess: (data) => {
      if (data) setPricing({ monthly_price: data.monthly_price || 10000, annual_price: data.annual_price || 80000, biannual_price: data.biannual_price || 150000 });
    },
  });

  /* Featured subjects — 3 published */
  const { data: subjects = [] } = useQuery({
    queryKey: ['landing-subjects'],
    queryFn: () => base44.entities.Subject.filter({ status: 'published' }, 'order', 6),
    staleTime: 5 * 60_000,
  });

  /* Recent blog posts */
  const { data: blogPosts = [] } = useQuery({
    queryKey: ['landing-blog'],
    queryFn: async () => {
      try { return await base44.entities.BlogPost.filter({ status: 'published' }, '-published_at', 3); }
      catch { return []; }
    },
    staleTime: 5 * 60_000,
  });

  /* Active forums: latest threads per subject for last-activity calc */
  const { data: recentThreads = [] } = useQuery({
    queryKey: ['landing-forum-activity'],
    queryFn: async () => {
      try { return await base44.entities.Discussion.filter({ status: 'active' }, '-created_date', 50); }
      catch { return []; }
    },
    staleTime: 2 * 60_000,
  });

  // Build per-forum activity: { subjectId → { lastActivity, threadCount } }
  const forumActivity = React.useMemo(() => {
    const map = {};
    recentThreads.forEach(t => {
      if (!t.subject_id || t.parent_id) return; // only top-level threads
      if (!map[t.subject_id]) map[t.subject_id] = { lastActivity: t.created_date, threadCount: 0 };
      map[t.subject_id].threadCount += 1;
      if (new Date(t.created_date) > new Date(map[t.subject_id].lastActivity)) {
        map[t.subject_id].lastActivity = t.created_date;
      }
    });
    return map;
  }, [recentThreads]);

  // Sort subjects by last activity, take top 3 active ones
  const activeForums = React.useMemo(() => {
    return subjects
      .filter(s => forumActivity[s.id])
      .sort((a, b) => new Date(forumActivity[b.id]?.lastActivity || 0) - new Date(forumActivity[a.id]?.lastActivity || 0))
      .slice(0, 3);
  }, [subjects, forumActivity]);

  const fmt = (n) => Number(n).toLocaleString('en-MW');
  const plans = [
    {
      id: 'monthly', name: 'Monthly', icon: Zap, price: pricing.monthly_price,
      period: 'per month', popular: true,
      features: ['All lessons & videos', 'Quizzes & tests', 'Past papers', 'Assignment submissions', 'Progress tracking'],
    },
    {
      id: 'annual', name: 'Annual', icon: Crown, price: pricing.annual_price,
      period: 'per year',
      features: ['Everything in Monthly', 'Priority support', 'Exam tips & strategies', 'Revision resources', `Save MWK ${fmt(pricing.monthly_price * 12 - pricing.annual_price)}`],
    },
    {
      id: 'biannual', name: 'Biannual', icon: Award, price: pricing.biannual_price,
      period: 'for 2 years',
      features: ['Everything in Annual', 'Certificate of completion', 'Dedicated support', `Save MWK ${fmt(pricing.monthly_price * 24 - pricing.biannual_price)}`],
    },
  ];

  return (
    <>
      <SEO
        title="Welcome to The Chibondo Academy"
        description="Malawi's online MSCE learning platform. Expert video lessons for Form 3 & 4. Study at your own pace."
      />

      <div className="space-y-10">

        {/* ── 1. HERO ───────────────────────────────────────────────────────── */}
        <div className="relative rounded-2xl overflow-hidden" style={{ background: 'hsl(222 47% 14%)' }}>
          {/* Subtle radial glow — same as SubscriptionPage hero */}
          <div className="absolute inset-0 pointer-events-none"
            style={{ backgroundImage: 'radial-gradient(ellipse at 10% 50%, hsl(43 74% 52% / 0.18) 0%, transparent 55%), radial-gradient(ellipse at 90% 10%, hsl(222 47% 55% / 0.15) 0%, transparent 50%)' }} />

          <div className="relative px-6 py-10 sm:px-10 sm:py-14">
            <div className="max-w-xl">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full mb-5"
                style={{ background: 'hsl(43 74% 52% / 0.15)', color: 'hsl(43 74% 66%)' }}>
                <Zap className="w-3 h-3" /> Malawi's Online MSCE Platform
              </span>

              <h1 className="font-display font-extrabold text-3xl sm:text-4xl leading-tight text-white mb-4">
                Study smarter.<br />
                <span style={{ color: 'hsl(43 74% 66%)' }}>Pass your MSCE.</span>
              </h1>

              <p className="text-white/65 text-sm leading-relaxed mb-8 max-w-md">
                Video lessons, quizzes, and past papers for every Form 3 &amp; 4 subject —
                taught by Malawian educators, available anytime on your phone.
              </p>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => navigate('/register')}
                  className="px-5 py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-95 hover:brightness-110"
                  style={{ background: 'hsl(43 74% 52%)', color: 'hsl(222 47% 11%)' }}>
                  Create Free Account
                </button>
                <button
                  onClick={() => navigate('/subjects')}
                  className="px-5 py-2.5 rounded-xl font-semibold text-sm border border-white/20 text-white/80 hover:border-white/40 hover:text-white transition-colors">
                  Browse Subjects
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── 2. ABOUT ─────────────────────────────────────────────────────── */}
        <div>
          <h2 className="font-display font-bold text-base mb-1">About Chibondo Academy</h2>
          <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold mb-4"
            style={{ color: 'hsl(43 74% 52%)' }}>Discover ACA</p>

          <div className="bg-card rounded-2xl border border-border p-5 sm:p-6 space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              The Chibondo Academy is an online secondary school offering MSCE lessons in all subjects.
              We believe every student in Malawi deserves quality education — regardless of where they live or which school they attend.
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                { icon: GraduationCap, text: 'Qualified Malawian educators' },
                { icon: BookOpen, text: 'All Form 3 & 4 subjects' },
                { icon: Play, text: 'Video-first lesson delivery' },
                { icon: CheckCircle, text: 'MSCE curriculum aligned' },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: 'hsl(43 74% 52% / 0.12)' }}>
                    <Icon className="w-3.5 h-3.5" style={{ color: 'hsl(43 74% 52%)' }} />
                  </div>
                  <span className="text-sm text-foreground/80">{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── 3. FEATURED SUBJECTS ─────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-display font-bold text-base">Learn Through Online Video</h2>
            <Link to="/subjects"
              className="flex items-center gap-1 text-xs font-semibold hover:text-accent transition-colors"
              style={{ color: 'hsl(43 74% 52%)' }}>
              All subjects <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <p className="text-xs text-muted-foreground mb-4">Featured courses</p>

          <div className="space-y-2">
            {subjects.slice(0, 3).map(subject => (
              <Link
                key={subject.id}
                to={`/subjects/${subject.id}`}
                className="flex items-center gap-4 p-4 bg-card border border-border rounded-xl hover:border-accent/40 transition-colors group"
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 bg-muted">
                  {subjectIcon(subject.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm group-hover:text-accent transition-colors">{subject.name}</p>
                  {subject.description && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{subject.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Lock className="w-3.5 h-3.5 text-muted-foreground/40" />
                  <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-accent transition-colors" />
                </div>
              </Link>
            ))}

            {/* If data not loaded yet, show skeleton */}
            {subjects.length === 0 && [1,2,3].map(i => (
              <div key={i} className="h-16 bg-card border border-border rounded-xl animate-pulse" />
            ))}
          </div>
        </div>

        {/* ── 4. COMMUNITY FORUMS ──────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-display font-bold text-base">Interact With Fellow Students</h2>
            <Link to="/forums"
              className="flex items-center gap-1 text-xs font-semibold hover:text-accent transition-colors"
              style={{ color: 'hsl(43 74% 52%)' }}>
              All forums <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <p className="text-xs text-muted-foreground mb-4">Live discussions</p>

          <div className="space-y-2">
            {activeForums.length > 0 ? activeForums.map(subject => {
              const activity = forumActivity[subject.id];
              return (
                <div key={subject.id}
                  className="flex items-center gap-4 p-4 bg-card border border-border rounded-xl hover:border-accent/40 transition-colors group">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 bg-muted">
                    {subjectIcon(subject.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm group-hover:text-accent transition-colors">{subject.forum_name || subject.name}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                      <MessageSquare className="w-3 h-3" />
                      <span>{activity.threadCount} {activity.threadCount === 1 ? 'thread' : 'threads'}</span>
                      <span className="opacity-40">·</span>
                      <span>Active {activity.lastActivity ? formatDistanceToNow(new Date(activity.lastActivity), { addSuffix: true }) : ''}</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-accent transition-colors flex-shrink-0" />
                </div>
              );
            }) : (
              /* Skeleton while loading */
              [1,2,3].map(i => (
                <div key={i} className="h-16 bg-card border border-border rounded-xl animate-pulse" />
              ))
            )}

            <button
              onClick={() => navigate('/register')}
              className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95 hover:brightness-110 mt-1"
              style={{ background: 'hsl(222 47% 18%)', color: 'hsl(43 74% 66%)' }}>
              Join the conversation
            </button>
          </div>
        </div>

        {/* ── 5. BLOG ──────────────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-display font-bold text-base">Read and Learn More</h2>
            <Link to="/blog"
              className="flex items-center gap-1 text-xs font-semibold hover:text-accent transition-colors"
              style={{ color: 'hsl(43 74% 52%)' }}>
              All posts <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <p className="text-xs text-muted-foreground mb-4">Latest articles</p>

          <div className="space-y-3">
            {blogPosts.slice(0, 3).map((post, i) => (
              <Link
                key={post.id}
                to={`/blog/${post.slug || post.id}`}
                className={`flex gap-4 p-4 bg-card border border-border rounded-xl hover:border-accent/40 transition-colors group ${i === 0 ? 'flex-col sm:flex-row' : 'flex-row items-center'}`}
              >
                {/* Cover */}
                <div className={`rounded-lg overflow-hidden flex-shrink-0 bg-muted ${i === 0 ? 'w-full sm:w-40 aspect-video sm:aspect-square sm:h-24 sm:w-24' : 'w-14 h-14'}`}>
                  {post.cover_image
                    ? <img src={post.cover_image} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                    : <div className="w-full h-full flex items-center justify-center bg-muted">
                        <Newspaper className="w-5 h-5 text-muted-foreground/30" />
                      </div>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  {post.category && (
                    <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'hsl(43 74% 52%)' }}>{post.category}</p>
                  )}
                  <p className={`font-semibold group-hover:text-accent transition-colors leading-snug ${i === 0 ? 'text-sm' : 'text-xs'} line-clamp-2`}>{post.title}</p>
                  <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    <span>{readTime(post.content || '')} min read</span>
                    {post.published_at && (
                      <>
                        <span className="opacity-40">·</span>
                        <span>{format(new Date(post.published_at), 'dd MMM yyyy')}</span>
                      </>
                    )}
                  </div>
                </div>
              </Link>
            ))}

            {blogPosts.length === 0 && [1,2,3].map(i => (
              <div key={i} className="h-20 bg-card border border-border rounded-xl animate-pulse" />
            ))}
          </div>
        </div>

        {/* ── 6. PRICING ───────────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-display font-bold text-base">School Fees</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-4">Affordable access to quality education</p>

          {/* Free tier callout */}
          <div className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card mb-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-muted">
              <BookOpen className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm">Free Trial</p>
              <p className="text-xs text-muted-foreground">Sample lessons, forum read access, blog articles</p>
            </div>
            <span className="text-sm font-bold" style={{ color: 'hsl(43 74% 52%)' }}>Free</span>
          </div>

          <div className="space-y-3">
            {plans.map(({ id, name, icon: Icon, price, period, popular, features }) => (
              <div key={id}
                className={`rounded-xl border p-4 transition-all ${popular ? 'border-accent/50' : 'border-border bg-card'}`}
                style={popular ? { background: 'hsl(43 74% 52% / 0.05)', borderColor: 'hsl(43 74% 52% / 0.5)' } : {}}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: popular ? 'hsl(43 74% 52% / 0.15)' : 'hsl(var(--muted))' }}>
                      <Icon className="w-4 h-4" style={{ color: popular ? 'hsl(43 74% 52%)' : 'hsl(var(--muted-foreground))' }} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm">{name}</p>
                        {popular && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={{ background: 'hsl(43 74% 52%)', color: 'hsl(222 47% 11%)' }}>Popular</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{period}</p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-extrabold text-base font-display"
                      style={popular ? { color: 'hsl(43 74% 66%)' } : {}}>
                      MWK {fmt(price)}
                    </p>
                  </div>
                </div>
                <ul className="flex flex-wrap gap-x-4 gap-y-1 mb-3">
                  {features.slice(0, 3).map(f => (
                    <li key={f} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <CheckCircle className="w-3 h-3 flex-shrink-0" style={{ color: 'hsl(43 74% 52%)' }} />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <p className="text-xs text-muted-foreground text-center mt-3">
            Payments via Airtel Money &amp; TNM Mpamba
          </p>
        </div>

        {/* ── 7. FINAL CTA ─────────────────────────────────────────────────── */}
        <div className="rounded-2xl overflow-hidden relative" style={{ background: 'hsl(222 47% 14%)' }}>
          <div className="absolute inset-0 pointer-events-none"
            style={{ backgroundImage: 'radial-gradient(ellipse at 80% 50%, hsl(43 74% 52% / 0.15) 0%, transparent 60%)' }} />
          <div className="relative p-6 sm:p-8 text-center space-y-4">
            <GraduationCap className="w-10 h-10 mx-auto" style={{ color: 'hsl(43 74% 52%)' }} />
            <h2 className="font-display font-extrabold text-xl text-white leading-snug">
              Your MSCE journey starts here.
            </h2>
            <p className="text-white/60 text-sm max-w-sm mx-auto">
              Register for free and start with sample lessons today. No credit card required.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1">
              <button
                onClick={() => navigate('/register')}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-95 hover:brightness-110"
                style={{ background: 'hsl(43 74% 52%)', color: 'hsl(222 47% 11%)' }}>
                Create Free Account <ArrowRight className="inline w-4 h-4 ml-1" />
              </button>
              <button
                onClick={() => navigate('/login')}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-semibold text-sm border border-white/20 text-white/70 hover:border-white/40 hover:text-white transition-colors">
                Already have an account?
              </button>
            </div>
          </div>
        </div>

      </div>
    </>
  );
}
