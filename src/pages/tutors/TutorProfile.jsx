import React, { useState, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import SEO from '@/components/SEO';
import {
  ArrowLeft, Star, Users, BookOpen, Clock, ChevronRight,
  Award, Briefcase, GraduationCap, Mail, Phone, MessageCircle,
  Facebook, Linkedin, Youtube, Twitter, ChevronDown, ChevronUp,
  FileText, Calendar, PlayCircle, CreditCard, Zap, Tag
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

// ─────────────────────────────────────────────────────────────────────────────
// STAT PILL
// ─────────────────────────────────────────────────────────────────────────────
function StatPill({ icon: Icon, value, label }) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-4 py-2">
      <div className="flex items-center gap-1">
        {Icon && <Icon className="w-3.5 h-3.5 text-primary" />}
        <span className="font-display font-bold text-lg leading-none text-foreground">{value}</span>
      </div>
      <span className="text-[11px] text-muted-foreground text-center leading-tight">{label}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COURSE CARD
// ─────────────────────────────────────────────────────────────────────────────
function CourseCard({ subject, isSubscribed, navigate }) {
  const handleClick = useCallback(() => {
    navigate(`/subjects/${subject.id}`);
  }, [subject.id, navigate]);

  return (
    <button
      onClick={handleClick}
      className="w-full text-left bg-card border border-border rounded-2xl overflow-hidden hover:border-primary/50 hover:shadow-md active:scale-[0.99] transition-all duration-150 group flex flex-col"
    >
      {/* Thumbnail */}
      <div className="relative w-full aspect-video bg-gradient-to-br from-primary/20 to-accent/10 overflow-hidden flex-shrink-0">
        {subject.cover_image ? (
          <img
            src={subject.cover_image}
            alt={subject.name}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <BookOpen className="w-10 h-10 text-primary/20" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        {subject.form_name && (
          <span className="absolute top-2 left-2 text-[10px] font-semibold text-white bg-black/50 backdrop-blur-sm px-2 py-0.5 rounded-full">
            {subject.form_name}
          </span>
        )}
        {subject.is_premium && (
          <span className="absolute top-2 right-2 text-[10px] font-semibold text-white bg-primary/80 px-2 py-0.5 rounded-full">
            Premium
          </span>
        )}
      </div>
      {/* Body */}
      <div className="p-4 flex flex-col flex-1 gap-2">
        <h3 className="font-semibold text-sm leading-snug line-clamp-2">{subject.name}</h3>
        {subject.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{subject.description}</p>
        )}
        <div className="flex items-center justify-between mt-auto pt-2">
          {subject.total_lessons > 0 && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <PlayCircle className="w-3.5 h-3.5" />{subject.total_lessons} lessons
            </span>
          )}
          <span className={`ml-auto text-xs font-semibold px-3 py-1 rounded-full transition-colors ${
            isSubscribed
              ? 'bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground'
              : 'bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary'
          }`}>
            {isSubscribed ? 'Start Learning →' : 'Preview'}
          </span>
        </div>
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BLOG CARD
// ─────────────────────────────────────────────────────────────────────────────
function BlogCard({ post, navigate }) {
  const date = post.published_at
    ? new Date(post.published_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';
  return (
    <button
      onClick={() => navigate(`/blog/${post.id}`)}
      className="w-full text-left bg-card border border-border rounded-2xl overflow-hidden hover:border-primary/40 hover:shadow-md active:scale-[0.99] transition-all duration-150 group flex sm:flex-row flex-col"
    >
      {post.cover_image && (
        <div className="w-full sm:w-32 h-32 sm:h-auto flex-shrink-0 overflow-hidden bg-muted">
          <img src={post.cover_image} alt={post.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        </div>
      )}
      <div className="p-4 flex flex-col gap-1.5 flex-1 min-w-0">
        {date && (
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Calendar className="w-3 h-3" />{date}
          </span>
        )}
        <h3 className="font-semibold text-sm leading-snug line-clamp-2">{post.title}</h3>
        {post.excerpt && (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{post.excerpt}</p>
        )}
        {post.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {post.tags.slice(0, 3).map(t => (
              <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary/80">
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STICKY CTA BAR
// ─────────────────────────────────────────────────────────────────────────────
function StickyCTA({ isAuthenticated, isSubscribed, tutorName, navigate }) {
  if (isSubscribed) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-sidebar/95 backdrop-blur-md border-t border-border px-4 py-3 flex gap-3">
        <button
          onClick={() => navigate('/subjects')}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm active:scale-95 transition-transform"
        >
          <PlayCircle className="w-4 h-4" /> Continue Learning
        </button>
      </div>
    );
  }
  if (isAuthenticated) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-sidebar/95 backdrop-blur-md border-t border-border px-4 py-3 flex gap-3">
        <button
          onClick={() => navigate('/subscription')}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm active:scale-95 transition-transform"
        >
          <CreditCard className="w-4 h-4" /> Pay Fees & Unlock All Lessons
        </button>
      </div>
    );
  }
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-sidebar/95 backdrop-blur-md border-t border-border px-4 py-3 flex gap-3">
      <button
        onClick={() => navigate('/subscription')}
        className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm active:scale-95 transition-transform"
      >
        <CreditCard className="w-4 h-4" /> Pay Fees & Unlock Lessons
      </button>
      <button
        onClick={() => navigate('/register')}
        className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-border bg-card text-sm font-medium active:scale-95 transition-transform"
      >
        <Zap className="w-4 h-4" /> Free Trial
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function TutorProfilePage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const [bioExpanded, setBioExpanded] = useState(false);

  // ── Data fetching ──
  const { data: tutors = [], isLoading } = useQuery({
    queryKey: ['tutor-by-slug', slug],
    queryFn: () => base44.entities.TutorProfile.filter(
      { slug, status: 'active', is_visible: true }, 'full_name', 1
    ),
    enabled: !!slug,
    staleTime: 60_000,
  });
  const tutor = tutors[0];

  const { data: linkedSubjects = [] } = useQuery({
    queryKey: ['tutor-subjects', tutor?.id],
    queryFn: () => base44.entities.Subject.filter(
      { tutor_profile_id: tutor.id, status: 'published' }, 'name', 50
    ),
    enabled: !!tutor?.id,
    staleTime: 60_000,
  });

  const { data: blogPosts = [] } = useQuery({
    queryKey: ['tutor-blog', tutor?.id],
    queryFn: () => base44.entities.BlogPost.filter(
      { tutor_profile_id: tutor.id, status: 'published' }, '-published_at', 10
    ),
    enabled: !!tutor?.id,
    staleTime: 60_000,
  });

  const { data: subscriptions = [] } = useQuery({
    queryKey: ['my-subscription', user?.id],
    queryFn: () => base44.entities.Subscription.filter(
      { student_id: user.id, status: 'active' }, '-created_date', 1
    ),
    enabled: !!user?.id,
    staleTime: 30_000,
  });
  const isSubscribed = subscriptions.length > 0;

  // ── Loading ──
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'hsl(222 47% 8%)' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="flex gap-1.5">
            {[0,1,2].map(i => (
              <div key={i} className="w-2.5 h-2.5 rounded-full bg-primary"
                style={{ animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Loading profile…</p>
        </div>
        <style>{`@keyframes pulse{0%,80%,100%{transform:scale(0.4);opacity:0.3}40%{transform:scale(1);opacity:1}}`}</style>
      </div>
    );
  }

  // ── Not found ──
  if (!tutor) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'hsl(222 47% 8%)' }}>
        <div className="text-center">
          <GraduationCap className="w-16 h-16 mx-auto text-muted-foreground/20 mb-4" />
          <h1 className="text-xl font-display font-bold">Tutor Not Found</h1>
          <p className="text-muted-foreground mt-2 text-sm">This profile doesn't exist or isn't public.</p>
          <button
            onClick={() => navigate('/tutors')}
            className="inline-flex items-center gap-2 mt-5 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4" /> Browse Tutors
          </button>
        </div>
      </div>
    );
  }

  const seoTitle = `${tutor.full_name} | ${tutor.professional_title || 'Tutor'} | Chibondo Academy`;
  const seoDesc = `${tutor.full_name}${tutor.professional_title ? ` — ${tutor.professional_title}` : ''}. ${tutor.tagline || 'Expert tutor at Chibondo Academy.'}`;
  const contactHref = tutor.whatsapp
    ? `https://wa.me/${tutor.whatsapp.replace(/\D/g,'')}`
    : tutor.email ? `mailto:${tutor.email}`
    : tutor.phone ? `tel:${tutor.phone}` : null;

  const bioText = tutor.biography?.replace(/<[^>]+>/g, '') || '';
  const bioShort = bioText.length > 240;
  const displayBio = bioShort && !bioExpanded ? bioText.slice(0, 240) + '…' : bioText;

  return (
    <>
      <SEO
        title={seoTitle}
        description={seoDesc}
        canonical={`https://aca.base44.app/tutors/${slug}`}
        ogImage={tutor.profile_photo || 'https://media.base44.com/images/public/6a212896f8e71114ad51c36f/3fd7d6af7_FB_IMG_1780187860438.jpg'}
        ogType="profile"
      />

      {/* ── Sticky CTA (mobile only) ── */}
      <StickyCTA
        isAuthenticated={isAuthenticated}
        isSubscribed={isSubscribed}
        tutorName={tutor.full_name}
        navigate={navigate}
      />

      <div className="min-h-screen pb-24 lg:pb-8" style={{ background: 'hsl(222 47% 8%)' }}>

        {/* ── BACK NAV ── */}
        <div className="px-4 pt-4 pb-2">
          <button
            onClick={() => navigate('/tutors')}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> All Tutors
          </button>
        </div>

        {/* ════════════════════════════════════════════════════════
            HERO — full width, no inner container
        ════════════════════════════════════════════════════════ */}
        <div className="relative w-full">
          {/* Banner */}
          <div className="w-full h-40 sm:h-52 bg-gradient-to-br from-primary/50 via-primary/30 to-accent/20 overflow-hidden relative">
            {tutor.profile_photo && (
              <img
                src={tutor.profile_photo}
                alt=""
                className="w-full h-full object-cover opacity-15 scale-105 blur-sm"
              />
            )}
            {/* Dark overlay for readability */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/20 to-black/60" />
          </div>

          {/* Profile content overlaying the banner bottom */}
          <div className="px-4 sm:px-6 -mt-14 relative z-10">
            <div className="flex flex-col sm:flex-row sm:items-end gap-4">
              {/* Avatar */}
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl border-4 border-background overflow-hidden bg-card shadow-2xl flex-shrink-0">
                {tutor.profile_photo ? (
                  <img src={tutor.profile_photo} alt={tutor.full_name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-primary/10">
                    <span className="text-4xl font-bold text-primary">{tutor.full_name?.[0]}</span>
                  </div>
                )}
              </div>

              {/* Name + title (desktop: inline with avatar) */}
              <div className="flex-1 min-w-0 pb-1">
                <h1 className="text-2xl sm:text-3xl font-display font-bold leading-tight text-foreground">
                  {tutor.full_name}
                </h1>
                {tutor.professional_title && (
                  <p className="text-primary font-medium mt-0.5 text-sm sm:text-base">{tutor.professional_title}</p>
                )}
                {tutor.tagline && (
                  <p className="text-muted-foreground text-sm mt-0.5 italic">"{tutor.tagline}"</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── SUBJECT TAGS ── */}
        {tutor.subjects?.length > 0 && (
          <div className="px-4 sm:px-6 mt-4 flex flex-wrap gap-2">
            {tutor.subjects.map(s => (
              <span key={s} className="px-3 py-1 rounded-full text-xs font-semibold border border-primary/30 text-primary bg-primary/10">
                {s}
              </span>
            ))}
          </div>
        )}

        {/* ── STATS ROW ── */}
        <div className="mt-4 mx-4 sm:mx-6 bg-card border border-border rounded-2xl overflow-hidden">
          <div className="flex divide-x divide-border overflow-x-auto scrollbar-hide">
            {tutor.years_teaching > 0 && (
              <StatPill icon={Clock} value={`${tutor.years_teaching}+`} label="Years Teaching" />
            )}
            <StatPill icon={BookOpen} value={linkedSubjects.length || '—'} label="Courses" />
            {tutor.subjects?.length > 0 && (
              <StatPill icon={GraduationCap} value={tutor.subjects.length} label="Subjects" />
            )}
            {blogPosts.length > 0 && (
              <StatPill icon={FileText} value={blogPosts.length} label="Articles" />
            )}
          </div>
        </div>

        {/* ── CTA ROW (desktop visible, mobile in sticky bar) ── */}
        <div className="hidden lg:flex px-4 sm:px-6 mt-4 gap-3">
          {isSubscribed ? (
            <button
              onClick={() => navigate('/subjects')}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors"
            >
              <PlayCircle className="w-4 h-4" /> Continue Learning
            </button>
          ) : isAuthenticated ? (
            <>
              <button
                onClick={() => navigate('/subscription')}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors"
              >
                <CreditCard className="w-4 h-4" /> Pay Fees & Unlock All Lessons
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => navigate('/subscription')}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors"
              >
                <CreditCard className="w-4 h-4" /> Pay Fees & Unlock Lessons
              </button>
              <button
                onClick={() => navigate('/register')}
                className="flex items-center gap-2 px-5 py-3 rounded-xl border border-border text-sm font-medium hover:border-primary/40 transition-colors"
              >
                <Zap className="w-4 h-4" /> Start Free Trial
              </button>
            </>
          )}
          {contactHref && (
            <a
              href={contactHref}
              className="flex items-center gap-2 px-5 py-3 rounded-xl border border-border text-sm font-medium hover:border-primary/40 transition-colors"
            >
              <MessageCircle className="w-4 h-4" /> Contact
            </a>
          )}
        </div>

        {/* ════════════════════════════════════════════════════════
            CONTENT — two-col on desktop, single col mobile
        ════════════════════════════════════════════════════════ */}
        <div className="mt-5 px-4 sm:px-6 grid lg:grid-cols-3 gap-4">

          {/* ── MAIN COLUMN ── */}
          <div className="lg:col-span-2 space-y-4">

            {/* About */}
            {bioText && (
              <section className="bg-card border border-border rounded-2xl p-5">
                <h2 className="font-display font-bold text-base mb-3">About</h2>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                  {displayBio}
                </p>
                {bioShort && (
                  <button
                    onClick={() => setBioExpanded(v => !v)}
                    className="flex items-center gap-1 mt-3 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
                  >
                    {bioExpanded ? <><ChevronUp className="w-3.5 h-3.5" /> Show less</> : <><ChevronDown className="w-3.5 h-3.5" /> Show more</>}
                  </button>
                )}

                {/* Qualifications + Certs inline in about (when expanded) */}
                {bioExpanded && (
                  <div className="mt-5 pt-5 border-t border-border space-y-4">
                    {tutor.qualifications?.length > 0 && (
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Qualifications</p>
                        <div className="space-y-2">
                          {tutor.qualifications.map((q, i) => (
                            <div key={i} className="flex gap-3 items-start">
                              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                <GraduationCap className="w-3.5 h-3.5 text-primary" />
                              </div>
                              <div>
                                <p className="text-sm font-semibold">{q.name}</p>
                                <p className="text-xs text-muted-foreground">{q.institution}{q.year && ` · ${q.year}`}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {tutor.certifications?.length > 0 && (
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Certifications</p>
                        <div className="space-y-2">
                          {tutor.certifications.map((c, i) => (
                            <div key={i} className="flex gap-3 items-start">
                              <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                <Award className="w-3.5 h-3.5 text-primary" />
                              </div>
                              <div>
                                <p className="text-sm font-semibold">{c.name}</p>
                                <p className="text-xs text-muted-foreground">{c.organization}{c.date_issued && ` · ${c.date_issued}`}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {(tutor.current_position || tutor.previous_schools) && (
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Experience</p>
                        {tutor.current_position && (
                          <div className="flex gap-3 items-start mb-2">
                            <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                            <div>
                              <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Current</p>
                              <p className="text-sm">{tutor.current_position}</p>
                            </div>
                          </div>
                        )}
                        {tutor.previous_schools && (
                          <div className="flex gap-3 items-start">
                            <div className="w-2 h-2 rounded-full bg-muted-foreground/30 mt-1.5 flex-shrink-0" />
                            <p className="text-sm text-muted-foreground whitespace-pre-line">{tutor.previous_schools}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </section>
            )}

            {/* Courses */}
            {linkedSubjects.length > 0 && (
              <section id="tutor-courses" className="bg-card border border-border rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-display font-bold text-base flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-primary" />
                    Courses ({linkedSubjects.length})
                  </h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {linkedSubjects.map(s => (
                    <CourseCard key={s.id} subject={s} isSubscribed={isSubscribed} navigate={navigate} />
                  ))}
                </div>

                {/* Inline CTA below courses */}
                {!isSubscribed && (
                  <div className="mt-4 pt-4 border-t border-border flex flex-col sm:flex-row gap-3 items-center">
                    <div className="flex-1">
                      <p className="text-sm font-semibold">Unlock all {linkedSubjects.length} courses</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Subscribe to get full access to every lesson</p>
                    </div>
                    <button
                      onClick={() => navigate(isAuthenticated ? '/subscription' : '/register')}
                      className="flex-shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 active:scale-95 transition-all"
                    >
                      <CreditCard className="w-4 h-4" />
                      {isAuthenticated ? 'Pay Fees' : 'Get Started'}
                    </button>
                  </div>
                )}
              </section>
            )}

            {/* Blog — ONLY render if posts exist */}
            {blogPosts.length > 0 && (
              <section className="bg-card border border-border rounded-2xl p-5">
                <h2 className="font-display font-bold text-base mb-4 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  Articles by {tutor.full_name.split(' ')[0]}
                </h2>
                <div className="space-y-3">
                  {blogPosts.map(post => (
                    <BlogCard key={post.id} post={post} navigate={navigate} />
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* ── SIDEBAR (desktop only) ── */}
          <div className="hidden lg:flex flex-col gap-4">

            {/* Contact card */}
            {contactHref && (
              <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
                <h3 className="font-semibold text-sm">Contact {tutor.full_name.split(' ')[0]}</h3>
                {tutor.email && (
                  <a href={`mailto:${tutor.email}`} className="flex items-center gap-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                    <Mail className="w-4 h-4 text-primary/50 flex-shrink-0" /> {tutor.email}
                  </a>
                )}
                {tutor.phone && (
                  <a href={`tel:${tutor.phone}`} className="flex items-center gap-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                    <Phone className="w-4 h-4 text-primary/50 flex-shrink-0" /> {tutor.phone}
                  </a>
                )}
                {tutor.whatsapp && (
                  <a href={`https://wa.me/${tutor.whatsapp.replace(/\D/g,'')}`} className="flex items-center gap-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                    <MessageCircle className="w-4 h-4 text-primary/50 flex-shrink-0" /> WhatsApp
                  </a>
                )}
              </div>
            )}

            {/* Social links */}
            {(tutor.facebook || tutor.linkedin || tutor.youtube || tutor.twitter_x) && (
              <div className="bg-card border border-border rounded-2xl p-5">
                <h3 className="font-semibold text-sm mb-3">Follow</h3>
                <div className="flex flex-wrap gap-2">
                  {tutor.facebook  && <a href={tutor.facebook}  target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"><Facebook  className="w-3.5 h-3.5"/>Facebook</a>}
                  {tutor.linkedin  && <a href={tutor.linkedin}  target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"><Linkedin  className="w-3.5 h-3.5"/>LinkedIn</a>}
                  {tutor.youtube   && <a href={tutor.youtube}   target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"><Youtube   className="w-3.5 h-3.5"/>YouTube</a>}
                  {tutor.twitter_x && <a href={tutor.twitter_x} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"><Twitter   className="w-3.5 h-3.5"/>X</a>}
                </div>
              </div>
            )}
          </div>

        </div>{/* end grid */}

        {/* Mobile contact row (above sticky bar space) */}
        {(tutor.facebook || tutor.linkedin || tutor.youtube || tutor.twitter_x || contactHref) && (
          <div className="lg:hidden mt-4 px-4 sm:px-6 flex flex-wrap gap-2">
            {contactHref && (
              <a href={contactHref} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-xs text-muted-foreground hover:border-primary/40 transition-colors">
                <MessageCircle className="w-3.5 h-3.5" /> Contact
              </a>
            )}
            {tutor.facebook  && <a href={tutor.facebook}  target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-xs text-muted-foreground hover:border-primary/40 transition-colors"><Facebook  className="w-3.5 h-3.5"/>FB</a>}
            {tutor.linkedin  && <a href={tutor.linkedin}  target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-xs text-muted-foreground hover:border-primary/40 transition-colors"><Linkedin  className="w-3.5 h-3.5"/>LinkedIn</a>}
            {tutor.youtube   && <a href={tutor.youtube}   target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-xs text-muted-foreground hover:border-primary/40 transition-colors"><Youtube   className="w-3.5 h-3.5"/>YT</a>}
            {tutor.twitter_x && <a href={tutor.twitter_x} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-xs text-muted-foreground hover:border-primary/40 transition-colors"><Twitter   className="w-3.5 h-3.5"/>X</a>}
          </div>
        )}

      </div>
    </>
  );
}
