import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import SEO from '@/components/SEO';
import { formatDistanceToNow } from 'date-fns';
import {
  BookOpen, Users, MessageSquare, Play, ChevronRight,
  Star, CheckCircle, Zap, Award, Clock, TrendingUp, GraduationCap,
  ArrowRight, Newspaper, Share2
} from 'lucide-react';

const SUBJECT_META = {
  biology:              { icon: '🧬', color: '#10b981' },
  chemistry:            { icon: '⚗️',  color: '#3b82f6' },
  physics:              { icon: '⚡',  color: '#f59e0b' },
  mathematics:          { icon: '📐',  color: '#8b5cf6' },
  'additional mathematics': { icon: '∑',  color: '#6366f1' },
  english:              { icon: '📖',  color: '#f43f5e' },
  'english language':   { icon: '📖',  color: '#f43f5e' },
  'english literature': { icon: '📚',  color: '#ec4899' },
  chichewa:             { icon: '🗣️',  color: '#f97316' },
  agriculture:          { icon: '🌱',  color: '#84cc16' },
  geography:            { icon: '🌍',  color: '#14b8a6' },
  history:              { icon: '📜',  color: '#f59e0b' },
};
function getMeta(name = '') {
  return SUBJECT_META[name.toLowerCase()] || { icon: '💡', color: '#6b7280' };
}
function readTime(content = '') {
  return Math.max(1, Math.ceil(content.replace(/<[^>]*>/g, '').split(/\s+/).length / 200));
}

function CTAButton({ to = '/register', children, secondary = false, large = false }) {
  const base = `inline-flex items-center justify-center gap-2 font-bold rounded-2xl transition-all duration-200 active:scale-95 ${large ? 'px-8 py-4 text-base' : 'px-6 py-3 text-sm'}`;
  const pri  = 'text-[hsl(222,47%,11%)] shadow-lg shadow-yellow-500/20 hover:brightness-110';
  const sec  = 'border-2 border-border hover:border-accent/60 hover:text-accent text-muted-foreground';
  return (
    <Link to={to} className={`${base} ${secondary ? sec : pri}`}
      style={secondary ? {} : { background: 'hsl(43,74%,52%)' }}>
      {children}
    </Link>
  );
}

function StatBadge({ value, label, icon: Icon }) {
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <div className="w-10 h-10 rounded-2xl flex items-center justify-center mb-1"
        style={{ background: 'hsl(43,74%,52%,0.15)' }}>
        <Icon className="w-5 h-5" style={{ color: 'hsl(43,74%,52%)' }} />
      </div>
      <span className="text-2xl font-black font-display" style={{ color: 'hsl(43,74%,66%)' }}>{value}</span>
      <span className="text-xs text-muted-foreground leading-tight">{label}</span>
    </div>
  );
}

const STATIC_SUBJECTS = [
  { name: 'Biology',     icon: '🧬', color: '#10b981' },
  { name: 'Chemistry',   icon: '⚗️',  color: '#3b82f6' },
  { name: 'Physics',     icon: '⚡',  color: '#f59e0b' },
  { name: 'Mathematics', icon: '📐',  color: '#8b5cf6' },
  { name: 'English',     icon: '📖',  color: '#f43f5e' },
  { name: 'History',     icon: '📜',  color: '#f59e0b' },
  { name: 'Geography',   icon: '🌍',  color: '#14b8a6' },
  { name: 'Agriculture', icon: '🌱',  color: '#84cc16' },
];

const PLANS = [
  { label: 'Free Trial', price: 'Free',       note: 'Get started',    badge: null,      features: ['Sample lessons', 'Forum read access', 'Blog articles', 'Mobile-friendly'] },
  { label: 'Monthly',    price: 'MWK 10,000', note: 'per month',      badge: '🔥 Popular', features: ['All subjects — Form 3 & 4', 'Full video library', 'Forum discussions', 'Assignments & quizzes'] },
  { label: 'Quarterly',  price: 'MWK 25,000', note: 'every 3 months', badge: null,      features: ['Everything in Monthly', 'Save MWK 5,000', 'Past papers library', 'Progress analytics'] },
  { label: 'Lifetime',   price: 'Ask us',     note: 'one-time',       badge: '💎 Best',    features: ['Unlimited lifetime access', 'All future subjects', 'Priority support', 'Printable materials'] },
];

const STATIC_FORUM = [
  { subj: 'Mathematics', icon: '📐', color: '#8b5cf6', q: 'How do I factorise quadratic expressions?', replies: 8 },
  { subj: 'Biology',     icon: '🧬', color: '#10b981', q: 'What is the difference between meiosis and mitosis?', replies: 14 },
  { subj: 'Chemistry',   icon: '⚗️',  color: '#3b82f6', q: 'Help with balancing chemical equations (Form 4)', replies: 5 },
];

export default function LandingPage() {
  const { data: subjects = [] } = useQuery({
    queryKey: ['landing-subjects'],
    queryFn: () => base44.entities.Subject.filter({ status: 'published' }, 'name', 20),
    staleTime: 5 * 60_000,
  });

  const { data: blogPosts = [] } = useQuery({
    queryKey: ['landing-blog'],
    queryFn: async () => {
      try { return await base44.entities.BlogPost.filter({ status: 'published' }, '-published_at', 3); }
      catch { return []; }
    },
    staleTime: 5 * 60_000,
  });

  const { data: threads = [] } = useQuery({
    queryKey: ['landing-threads'],
    queryFn: async () => {
      try { return await base44.entities.Discussion.filter({ status: 'active' }, '-created_date', 3); }
      catch { return []; }
    },
    staleTime: 5 * 60_000,
  });

  const displaySubjects = subjects.length > 0 ? subjects.slice(0, 8) : STATIC_SUBJECTS;
  const forumItems = threads.length > 0
    ? threads.map(t => ({ thread: t, subject: subjects.find(s => s.id === t.subject_id) }))
    : null;

  return (
    <>
      <SEO
        title="The Chibondo Academy — Malawi's Online MSCE Learning Platform"
        description="Study Form 3 & 4 online with expert video lessons, interactive forums, and past papers. Join thousands of students preparing for MSCE exams."
      />

      {/* ── NAV ── */}
      <nav className="sticky top-0 z-50 bg-sidebar/95 backdrop-blur-md border-b border-sidebar-border">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <BookOpen className="w-5 h-5" style={{ color: 'hsl(43,74%,52%)' }} />
            <span className="font-display font-black text-base tracking-tight">
              <span style={{ color: 'hsl(43,74%,66%)' }}>Chibondo</span>
              <span className="text-foreground hidden sm:inline"> Academy</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/login" className="px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors rounded-xl">
              Login
            </Link>
            <Link to="/register"
              className="px-5 py-2 text-sm font-bold rounded-xl transition-all active:scale-95 hover:brightness-110"
              style={{ background: 'hsl(43,74%,52%)', color: 'hsl(222,47%,11%)' }}>
              Join Free
            </Link>
          </div>
        </div>
      </nav>

      <main>

        {/* ── HERO ── */}
        <section className="relative overflow-hidden min-h-[90vh] flex items-center"
          style={{ background: 'linear-gradient(160deg,hsl(222,47%,9%) 0%,hsl(222,47%,14%) 60%,hsl(43,74%,20%,0.35) 100%)' }}>
          <div className="absolute inset-0 opacity-[0.03]"
            style={{ backgroundImage: 'radial-gradient(circle,hsl(43,74%,66%) 1px,transparent 1px)', backgroundSize: '32px 32px' }} />
          <div className="absolute top-1/4 right-1/4 w-96 h-96 rounded-full blur-3xl opacity-20 pointer-events-none"
            style={{ background: 'hsl(43,74%,52%)' }} />

          <div className="relative max-w-6xl mx-auto px-4 py-20 lg:py-28 w-full">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold mb-6"
                style={{ borderColor: 'hsl(43,74%,52%,0.4)', background: 'hsl(43,74%,52%,0.1)', color: 'hsl(43,74%,66%)' }}>
                <Zap className="w-3 h-3" /> Malawi's #1 Online MSCE Platform
              </div>

              <h1 className="font-display font-black text-4xl sm:text-5xl lg:text-6xl leading-[1.1] text-white mb-6">
                Master MSCE <span style={{ color: 'hsl(43,74%,66%)' }}>Exams</span><br />From Anywhere.
              </h1>

              <p className="text-lg text-white/70 leading-relaxed mb-8 max-w-xl">
                Expert-taught video lessons for <strong className="text-white/90">all Form 3 &amp; 4 subjects</strong>.
                Study at your own pace, join the discussion, and pass your MSCE with confidence.
              </p>

              <div className="flex flex-wrap gap-3 mb-12">
                <CTAButton to="/register" large>
                  Start Learning Free <ArrowRight className="w-4 h-4" />
                </CTAButton>
                <CTAButton to="/subjects" secondary large>
                  Browse Subjects
                </CTAButton>
              </div>

              <div className="grid grid-cols-3 gap-6 sm:gap-10 max-w-xs">
                <StatBadge value="19+" label="Subjects" icon={BookOpen} />
                <StatBadge value="266+" label="Lessons"  icon={Play} />
                <StatBadge value="Free" label="To Start"  icon={Star} />
              </div>
            </div>
          </div>
        </section>

        {/* ── DISCOVER ACA ── */}
        <section className="py-20 px-4 max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'hsl(43,74%,52%)' }}>Discover ACA</p>
              <h2 className="font-display font-black text-3xl sm:text-4xl leading-tight mb-5">
                Built for Malawian Students.<br />By Educators Who Care.
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-5">
                The Chibondo Academy is an online secondary school offering MSCE lessons in all subjects.
                We believe every student in Malawi deserves quality education — regardless of where they live.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-8">
                Our lessons are taught by experienced Malawian educators, structured around the official
                MSCE curriculum, and delivered through modern video content you can revisit anytime.
              </p>
              <div className="flex flex-col gap-3">
                {['All Form 3 & 4 subjects in one place','MSCE-aligned curriculum and past papers','Learn at your pace — no fixed schedule','Designed for mobile-first access'].map(f => (
                  <div key={f} className="flex items-center gap-3">
                    <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: 'hsl(43,74%,52%)' }} />
                    <span className="text-sm text-foreground/80">{f}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: GraduationCap, title: 'Expert Tutors',   desc: 'Qualified Malawian educators teaching the MSCE curriculum.' },
                { icon: Clock,         title: 'Study Anytime',   desc: 'Access lessons 24/7 from your phone or computer.' },
                { icon: Award,         title: 'MSCE Aligned',    desc: 'Content structured exactly to Malawi exam requirements.' },
                { icon: TrendingUp,    title: 'Track Progress',  desc: 'See how you are improving across every subject.' },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="bg-card border border-border rounded-2xl p-5 hover:border-accent/30 transition-colors">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                    style={{ background: 'hsl(43,74%,52%,0.12)' }}>
                    <Icon className="w-5 h-5" style={{ color: 'hsl(43,74%,52%)' }} />
                  </div>
                  <h3 className="font-bold text-sm mb-1">{title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── SUBJECTS / VIDEO ── */}
        <section className="py-20 px-4" style={{ background: 'hsl(222,47%,9%)' }}>
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'hsl(43,74%,52%)' }}>Learn Through Online Video</p>
              <h2 className="font-display font-black text-3xl sm:text-4xl text-white mb-4">All MSCE Subjects. One Platform.</h2>
              <p className="text-white/60 max-w-xl mx-auto">
                HD video lessons, structured by topic and form, taught by real teachers. Pause, rewind, and replay until you've mastered every concept.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
              {displaySubjects.map((subject, idx) => {
                const meta = subject.id ? getMeta(subject.name) : { icon: subject.icon, color: subject.color };
                return (
                  <Link key={subject.id || idx} to={subject.id ? `/subjects/${subject.id}` : '/subjects'}
                    className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-3 hover:border-accent/40 transition-all group">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                      style={{ background: `${meta.color}20` }}>{meta.icon}</div>
                    <p className="font-semibold text-sm group-hover:text-accent transition-colors leading-tight">{subject.name}</p>
                  </Link>
                );
              })}
            </div>

            {/* Video CTA */}
            <div className="rounded-3xl overflow-hidden border border-border/40"
              style={{ background: 'linear-gradient(135deg,hsl(222,47%,14%),hsl(43,74%,20%,0.2))' }}>
              <div className="grid lg:grid-cols-2">
                <div className="p-8 lg:p-10 flex flex-col justify-center">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold mb-5 w-fit"
                    style={{ background: 'hsl(43,74%,52%,0.15)', color: 'hsl(43,74%,66%)' }}>
                    <Play className="w-3 h-3" /> Video-First Learning
                  </div>
                  <h3 className="font-display font-black text-2xl text-white mb-4">Watch. Learn.<br />Pass Your Exams.</h3>
                  <p className="text-white/60 text-sm leading-relaxed mb-6">
                    Every lesson is broken into short, focused videos. Watch on any device, any time — even with limited data.
                  </p>
                  <CTAButton to="/subjects">
                    Explore All Subjects <ChevronRight className="w-4 h-4" />
                  </CTAButton>
                </div>
                <div className="p-8 lg:p-10 flex items-center justify-center border-t lg:border-t-0 lg:border-l border-border/30">
                  <div className="w-full max-w-xs">
                    <div className="rounded-2xl aspect-video bg-muted border border-border flex items-center justify-center relative overflow-hidden">
                      <div className="absolute inset-0 opacity-5"
                        style={{ backgroundImage: 'radial-gradient(circle,hsl(43,74%,66%) 1px,transparent 1px)', backgroundSize: '20px 20px' }} />
                      <div className="w-16 h-16 rounded-full flex items-center justify-center shadow-2xl"
                        style={{ background: 'hsl(43,74%,52%)' }}>
                        <Play className="w-6 h-6 ml-1" style={{ color: 'hsl(222,47%,11%)' }} />
                      </div>
                      <div className="absolute bottom-3 left-3 right-3">
                        <div className="h-1.5 bg-border rounded-full overflow-hidden">
                          <div className="h-full w-2/5 rounded-full" style={{ background: 'hsl(43,74%,52%)' }} />
                        </div>
                      </div>
                    </div>
                    <p className="text-center text-xs text-white/40 mt-3">Sample: Biology — Cell Structure</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── FORUMS ── */}
        <section className="py-20 px-4 max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-start">
            <div className="lg:sticky lg:top-24">
              <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'hsl(43,74%,52%)' }}>Interact With Fellow Students</p>
              <h2 className="font-display font-black text-3xl sm:text-4xl leading-tight mb-5">
                You Don't Have To<br />Study Alone.
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-6">
                Every subject has its own discussion forum. Students ask questions, share notes, and help each other.
                Teachers are in there too — to verify answers and guide discussions.
              </p>
              <div className="flex flex-col gap-3 mb-8">
                {['Ask questions in any subject forum','Get answers from teachers & peers','Pin verified solutions to help others','Live — threads update in real time'].map(f => (
                  <div key={f} className="flex items-center gap-3">
                    <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: 'hsl(43,74%,52%)' }} />
                    <span className="text-sm text-foreground/80">{f}</span>
                  </div>
                ))}
              </div>
              <CTAButton to="/forums">
                View All Forums <MessageSquare className="w-4 h-4" />
              </CTAButton>
            </div>

            <div className="space-y-3">
              {forumItems
                ? forumItems.map((s, i) => {
                    const meta = getMeta(s.subject?.name || '');
                    return (
                      <div key={i} className="bg-card border border-border rounded-2xl p-4 flex gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                          style={{ background: `${meta.color}18` }}>{meta.icon}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: meta.color }}>
                            {s.subject?.name || 'General'}
                          </p>
                          <p className="text-sm font-medium leading-snug truncate">{s.thread?.title}</p>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {s.thread?.reply_count || 0} replies ·{' '}
                            {s.thread?.created_date ? formatDistanceToNow(new Date(s.thread.created_date), { addSuffix: true }) : 'recently'}
                          </p>
                        </div>
                      </div>
                    );
                  })
                : STATIC_FORUM.map(({ subj, icon, color, q, replies }) => (
                    <div key={subj} className="bg-card border border-border rounded-2xl p-4 flex gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                        style={{ background: `${color}18` }}>{icon}</div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color }}>{subj}</p>
                        <p className="text-sm font-medium">{q}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">{replies} replies · recently</p>
                      </div>
                    </div>
                  ))
              }
              <Link to="/forums"
                className="flex items-center justify-center gap-2 py-3 rounded-2xl border border-dashed border-border text-sm text-muted-foreground hover:text-accent hover:border-accent/40 transition-colors">
                <MessageSquare className="w-4 h-4" /> See all subject forums <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </section>

        {/* ── BLOG ── */}
        <section className="py-20 px-4" style={{ background: 'hsl(222,47%,9%)' }}>
          <div className="max-w-6xl mx-auto">
            <div className="flex items-end justify-between mb-10 gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'hsl(43,74%,52%)' }}>Read and Learn More</p>
                <h2 className="font-display font-black text-3xl text-white leading-tight">
                  Study Tips, Subject Guides<br />&amp; Exam Strategies.
                </h2>
              </div>
              <Link to="/blog" className="hidden sm:flex items-center gap-1.5 text-sm font-semibold hover:text-accent transition-colors flex-shrink-0"
                style={{ color: 'hsl(43,74%,52%)' }}>
                All Articles <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {blogPosts.length > 0 ? blogPosts.map(post => (
                <Link key={post.id} to={`/blog/${post.slug || post.id}`}
                  className="bg-card border border-border rounded-2xl overflow-hidden hover:border-accent/30 hover:shadow-xl transition-all group flex flex-col">
                  <div className="aspect-video bg-muted overflow-hidden">
                    {post.cover_image
                      ? <img src={post.cover_image} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                      : <div className="w-full h-full flex items-center justify-center"
                          style={{ background: 'linear-gradient(135deg,hsl(222,47%,14%),hsl(43,74%,30%,0.3))' }}>
                          <Newspaper className="w-10 h-10 opacity-20" />
                        </div>
                    }
                  </div>
                  <div className="p-5 flex flex-col flex-1">
                    {post.category && <span className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'hsl(43,74%,52%)' }}>{post.category}</span>}
                    <h3 className="font-bold text-sm leading-snug mb-2 group-hover:text-accent transition-colors line-clamp-2">{post.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 mb-3 flex-1">
                      {post.excerpt || post.content?.replace(/<[^>]*>/g,'').slice(0,100)}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground pt-3 border-t border-border">
                      <Clock className="w-3 h-3" />
                      <span>{readTime(post.content || '')} min read</span>
                    </div>
                  </div>
                </Link>
              )) : (
                [
                  { title: 'How to Study Effectively for MSCE Exams', cat: 'Study Tips', mins: 4 },
                  { title: 'Top 5 Mistakes Students Make in Biology',  cat: 'Biology',    mins: 3 },
                  { title: 'MSCE Exam Strategy: A Complete Guide',     cat: 'Exam Tips',  mins: 6 },
                ].map(({ title, cat, mins }) => (
                  <Link key={title} to="/blog"
                    className="bg-card border border-border rounded-2xl overflow-hidden hover:border-accent/30 transition-all group">
                    <div className="aspect-video flex items-center justify-center"
                      style={{ background: 'linear-gradient(135deg,hsl(222,47%,14%),hsl(43,74%,30%,0.3))' }}>
                      <Newspaper className="w-10 h-10 opacity-20" />
                    </div>
                    <div className="p-5">
                      <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'hsl(43,74%,52%)' }}>{cat}</span>
                      <h3 className="font-bold text-sm mt-1 mb-2 group-hover:text-accent transition-colors">{title}</h3>
                      <p className="text-[10px] text-muted-foreground">{mins} min read</p>
                    </div>
                  </Link>
                ))
              )}
            </div>
            <div className="mt-6 text-center sm:hidden">
              <Link to="/blog" className="text-sm font-semibold" style={{ color: 'hsl(43,74%,52%)' }}>View all articles →</Link>
            </div>
          </div>
        </section>

        {/* ── PRICING ── */}
        <section className="py-20 px-4 max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'hsl(43,74%,52%)' }}>Simple Pricing</p>
            <h2 className="font-display font-black text-3xl sm:text-4xl leading-tight mb-4">Start Free. Unlock Everything.</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Begin with a free trial — no credit card needed. Upgrade when you're ready for full access.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {PLANS.map(({ label, price, note, badge, features }) => (
              <div key={label}
                className={`relative rounded-2xl border p-5 flex flex-col gap-4 transition-all ${badge ? 'border-accent/50 shadow-lg' : 'border-border'}`}
                style={badge ? { background: 'hsl(43,74%,52%,0.06)' } : {}}>
                {badge && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-black whitespace-nowrap"
                    style={{ background: 'hsl(43,74%,52%)', color: 'hsl(222,47%,11%)' }}>
                    {badge}
                  </span>
                )}
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">{label}</p>
                  <p className="text-2xl font-black font-display" style={badge ? { color: 'hsl(43,74%,66%)' } : {}}>{price}</p>
                  <p className="text-xs text-muted-foreground">{note}</p>
                </div>
                <ul className="space-y-2 flex-1">
                  {features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-xs text-foreground/80">
                      <CheckCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: 'hsl(43,74%,52%)' }} />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link to="/register"
                  className={`block text-center py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95 ${badge ? '' : 'border border-border hover:border-accent/40 hover:text-accent text-muted-foreground'}`}
                  style={badge ? { background: 'hsl(43,74%,52%)', color: 'hsl(222,47%,11%)' } : {}}>
                  Get Started
                </Link>
              </div>
            ))}
          </div>
        </section>

        {/* ── FINAL CTA ── */}
        <section className="py-24 px-4 relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg,hsl(222,47%,9%),hsl(43,74%,20%,0.3))' }}>
          <div className="absolute inset-0 opacity-[0.04]"
            style={{ backgroundImage: 'radial-gradient(circle,hsl(43,74%,66%) 1px,transparent 1px)', backgroundSize: '28px 28px' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full blur-3xl opacity-10 pointer-events-none"
            style={{ background: 'hsl(43,74%,52%)' }} />

          <div className="relative max-w-2xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border mb-8 text-sm font-semibold"
              style={{ borderColor: 'hsl(43,74%,52%,0.4)', background: 'hsl(43,74%,52%,0.08)', color: 'hsl(43,74%,66%)' }}>
              <Star className="w-4 h-4" /> Join Thousands of Students
            </div>
            <h2 className="font-display font-black text-4xl sm:text-5xl text-white leading-tight mb-6">
              Your MSCE Journey<br />Starts Today.
            </h2>
            <p className="text-white/65 text-lg mb-10 max-w-lg mx-auto">
              Register for free and get instant access to sample lessons across all subjects.
              No commitment — just learning.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <CTAButton to="/register" large>
                Create Free Account <ArrowRight className="w-4 h-4" />
              </CTAButton>
              <CTAButton to="/subjects" secondary large>
                Explore Subjects
              </CTAButton>
            </div>
            <p className="mt-6 text-xs text-white/30">Free to start · No credit card required · Cancel anytime</p>
          </div>
        </section>

        {/* ── FOOTER ── */}
        <footer className="border-t border-border py-10 px-4" style={{ background: 'hsl(222,47%,8%)' }}>
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2.5">
              <BookOpen className="w-5 h-5" style={{ color: 'hsl(43,74%,52%)' }} />
              <span className="font-display font-black text-sm">
                <span style={{ color: 'hsl(43,74%,66%)' }}>Chibondo</span>
                <span className="text-foreground"> Academy</span>
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-5 text-xs text-muted-foreground">
              {[['Subjects','/subjects'],['Forums','/forums'],['Blog','/blog'],['Login','/login'],['Register','/register']].map(([label, to]) => (
                <Link key={to} to={to} className="hover:text-accent transition-colors">{label}</Link>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground/40">&copy; {new Date().getFullYear()} The Chibondo Academy</p>
          </div>
        </footer>
      </main>
    </>
  );
}
