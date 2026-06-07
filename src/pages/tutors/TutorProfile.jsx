import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import SEO from '@/components/SEO';
import {
  Star, BookOpen, PlayCircle, Clock, ChevronDown, ChevronUp,
  GraduationCap, Award, ArrowLeft, MessageCircle, Calendar,
  FileText, CreditCard, Zap, Phone, Mail, Facebook,
  Linkedin, Youtube, Twitter
} from 'lucide-react';

/* ─────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────── */
function stripHtml(html = '') {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>')
    .trim();
}

/* ─────────────────────────────────────────────────────────────
   STAT ITEM  — mirrors the Udemy reference exactly
   Icon | bold-value label
───────────────────────────────────────────────────────────── */
function StatItem({ icon: Icon, value, label, accent }) {
  return (
    <div className="flex items-center gap-2.5 py-1.5">
      <Icon className={`w-4 h-4 flex-shrink-0 ${accent ? 'text-accent' : 'text-muted-foreground'}`} />
      <span className="text-sm">
        <span className="font-bold text-foreground">{value}</span>
        {' '}
        <span className="text-muted-foreground">{label}</span>
      </span>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   SUBJECT ROW — thumbnail + name + lessons count
───────────────────────────────────────────────────────────── */
function SubjectRow({ subject, navigate }) {
  return (
    <button
      onClick={() => navigate(`/subjects/${subject.id}`)}
      className="w-full text-left group flex items-center gap-3 py-3 border-b border-border last:border-0 hover:bg-muted/30 -mx-1 px-1 rounded-lg transition-colors"
    >
      <div className="w-14 h-14 rounded-xl overflow-hidden bg-primary/10 flex-shrink-0">
        {subject.cover_image
          ? <img src={subject.cover_image} alt="" loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
          : <div className="w-full h-full flex items-center justify-center"><BookOpen className="w-5 h-5 text-primary/30" /></div>
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm leading-snug line-clamp-2 group-hover:text-accent transition-colors">{subject.name}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {[subject.form_name, subject.total_lessons > 0 && `${subject.total_lessons} lessons`].filter(Boolean).join(' · ')}
        </p>
      </div>
      <PlayCircle className="w-5 h-5 text-muted-foreground/30 group-hover:text-accent transition-colors flex-shrink-0" />
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────
   BLOG CARD
───────────────────────────────────────────────────────────── */
function BlogPostCard({ post, navigate }) {
  const date = post.published_at
    ? new Date(post.published_at).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })
    : '';
  return (
    <button
      onClick={() => navigate(`/blog/${post.id}`)}
      className="w-full text-left group flex gap-3 py-3 border-b border-border last:border-0 hover:bg-muted/30 -mx-1 px-1 rounded-lg transition-colors"
    >
      {post.cover_image && (
        <div className="w-20 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-muted">
          <img src={post.cover_image} alt="" loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm leading-snug line-clamp-2 group-hover:text-accent transition-colors">{post.title}</p>
        {post.excerpt && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{post.excerpt}</p>}
        {date && (
          <p className="text-[11px] text-muted-foreground/60 mt-1 flex items-center gap-1">
            <Calendar className="w-3 h-3" />{date}
          </p>
        )}
      </div>
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────
   DIVIDER SECTION HEADING
───────────────────────────────────────────────────────────── */
function SectionHeading({ icon: Icon, title }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      {Icon && (
        <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: 'hsl(43 74% 52% / 0.15)' }}>
          <Icon className="w-3.5 h-3.5" style={{ color: 'hsl(43 60% 38%)' }} />
        </div>
      )}
      <h2 className="font-display font-bold text-base text-foreground">{title}</h2>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   STICKY CTA BAR
   – visible only when user is not subscribed
───────────────────────────────────────────────────────────── */
function StickyCTA({ isAuthenticated, isSubscribed, navigate }) {
  if (isSubscribed) return null;
  return (
    /* lg:hidden so desktop layout shows inline CTA instead */
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-t border-border px-4 pt-3 pb-5 flex flex-col gap-2 shadow-2xl">
      <button
        onClick={() => navigate('/subscription')}
        className="w-full py-3.5 rounded-2xl font-bold text-[15px] tracking-wide active:scale-95 transition-transform"
        style={{ background: 'hsl(222 47% 18%)', color: 'hsl(43 74% 66%)' }}
      >
        {isAuthenticated ? 'Pay Fees & Unlock All Lessons' : 'Pay Fees & Unlock Lessons'}
      </button>
      {!isAuthenticated && (
        <button
          onClick={() => navigate('/register')}
          className="w-full py-3 rounded-2xl font-semibold text-sm border border-border hover:border-primary/30 transition-colors"
        >
          Start Free Trial
        </button>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   MAIN PAGE
   Rendered INSIDE AppLayout — uses useOutletContext for user
───────────────────────────────────────────────────────────── */
export default function TutorProfilePage() {
  const { slug }        = useParams();
  const navigate        = useNavigate();
  const outlet          = useOutletContext?.() || {};
  const user            = outlet?.user || null;
  const isAuthenticated = !!user;

  const [bioOpen, setBioOpen] = useState(false);

  /* ── Queries ── */
  const { data: tutors = [], isLoading } = useQuery({
    queryKey: ['tutor-profile', slug],
    queryFn:  () => base44.entities.TutorProfile.filter(
      { slug, status: 'active', is_visible: true }, 'full_name', 1
    ),
    enabled:  !!slug,
    staleTime: 60_000,
  });
  const tutor = tutors[0];

  const { data: subjects = [] } = useQuery({
    queryKey: ['tutor-subjects', tutor?.id],
    queryFn:  () => base44.entities.Subject.filter(
      { tutor_profile_id: tutor.id, status: 'published' }, 'name', 50
    ),
    enabled:  !!tutor?.id,
    staleTime: 60_000,
  });

  // Live student count — unique students enrolled across this tutor's subjects
  const subjectIds = subjects.map(s => s.id);
  const { data: tutorEnrollments = [] } = useQuery({
    queryKey: ['tutor-enrollments', tutor?.id, subjectIds.join(',')],
    queryFn:  async () => {
      if (!subjectIds.length) return [];
      // Fetch enrollments for all subjects in parallel (max 10)
      const batches = await Promise.all(
        subjectIds.slice(0, 10).map(sid =>
          base44.entities.Enrollment.filter({ subject_id: sid }, '-created_date', 500)
        )
      );
      return batches.flat();
    },
    enabled:  subjectIds.length > 0,
    staleTime: 60_000,
  });

  const liveStudentCount = React.useMemo(() => {
    const unique = new Set(tutorEnrollments.map(e => e.student_id));
    return unique.size;
  }, [tutorEnrollments]);

  const { data: posts = [] } = useQuery({
    queryKey: ['tutor-posts', tutor?.id],
    queryFn:  () => base44.entities.BlogPost.filter(
      { tutor_profile_id: tutor.id, status: 'published' }, '-published_at', 20
    ),
    enabled:  !!tutor?.id,
    staleTime: 60_000,
  });

  const { data: subs = [] } = useQuery({
    queryKey: ['my-sub', user?.id],
    queryFn:  () => base44.entities.Subscription.filter(
      { student_id: user.id, status: 'active' }, '-created_date', 1
    ),
    enabled:  !!user?.id,
    staleTime: 30_000,
  });
  const isSubscribed = subs.length > 0;

  /* ── Loading ── */
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="flex gap-1.5">
            {[0,1,2].map(i => (
              <div key={i} className="w-2 h-2 rounded-full"
                style={{ background:'hsl(43 74% 52%)', animation:`bounce 1.2s ease-in-out ${i*0.15}s infinite` }} />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Loading profile…</p>
        </div>
        <style>{`@keyframes bounce{0%,80%,100%{transform:translateY(0);opacity:.3}40%{transform:translateY(-7px);opacity:1}}`}</style>
      </div>
    );
  }

  /* ── Not found ── */
  if (!tutor) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-center px-4">
        <GraduationCap className="w-14 h-14 text-muted-foreground/20" />
        <p className="font-bold text-lg">Tutor not found</p>
        <p className="text-sm text-muted-foreground">This profile doesn't exist or isn't public yet.</p>
        <button
          onClick={() => navigate('/tutors')}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold"
          style={{ background:'hsl(222 47% 18%)', color:'hsl(43 74% 66%)' }}
        >
          ← All Tutors
        </button>
      </div>
    );
  }

  const bioText  = stripHtml(tutor.biography || '');
  const bioLong  = bioText.length > 300;
  const bioShown = bioLong && !bioOpen ? bioText.slice(0, 300) + '…' : bioText;

  const contactHref = tutor.whatsapp
    ? `https://wa.me/${tutor.whatsapp.replace(/\D/g, '')}`
    : tutor.email ? `mailto:${tutor.email}` : tutor.phone ? `tel:${tutor.phone}` : null;

  const firstName = tutor.full_name?.split(' ')[0] || tutor.full_name;

  return (
    <>
      <SEO
        title={`${tutor.full_name} | Chibondo Academy`}
        description={`${tutor.full_name}${tutor.professional_title ? ` — ${tutor.professional_title}` : ''}. ${tutor.tagline || ''}`}
        canonical={`https://aca.base44.app/tutors/${slug}`}
        ogImage={tutor.profile_photo || 'https://media.base44.com/images/public/6a212896f8e71114ad51c36f/3fd7d6af7_FB_IMG_1780187860438.jpg'}
      />

      {/* Sticky CTA — mobile/tablet only, above bottom nav */}
      <StickyCTA isAuthenticated={isAuthenticated} isSubscribed={isSubscribed} navigate={navigate} />

      {/*
        IMPORTANT: This page is inside AppLayout.
        AppLayout already provides the sidebar + topbar + main padding.
        We deliberately use -mx-4 lg:-mx-6 to break out of the main
        padding for full-width sections, then re-add px where needed.
        pb-32 gives breathing room above the sticky CTA on mobile.
      */}
      <div className="pb-32 lg:pb-8 -mt-4 lg:-mt-6">

        {/* ══════════════════════════════════════════════
            HERO — navy banner + profile info
        ══════════════════════════════════════════════ */}
        <div
          className="w-full px-4 lg:px-8 pt-6 pb-5"
          style={{ background: 'hsl(222 47% 14%)' }}
        >
          {/* Back nav */}
          <button
            onClick={() => navigate('/tutors')}
            className="flex items-center gap-1.5 text-sm font-medium mb-5 transition-colors"
            style={{ color: 'hsl(43 74% 66% / 0.7)' }}
            onMouseEnter={e => e.currentTarget.style.color = 'hsl(43 74% 66%)'}
            onMouseLeave={e => e.currentTarget.style.color = 'hsl(43 74% 66% / 0.7)'}
          >
            <ArrowLeft className="w-4 h-4" /> All Tutors
          </button>

          {/* Name + title — full width above the two-col */}
          <h1 className="font-display font-bold text-2xl sm:text-3xl leading-tight mb-0.5"
            style={{ color: 'hsl(43 20% 94%)' }}>
            {tutor.full_name}
          </h1>
          {tutor.professional_title && (
            <p className="text-sm mb-4" style={{ color: 'hsl(43 74% 66% / 0.8)' }}>
              {tutor.professional_title}
            </p>
          )}
          {tutor.tagline && (
            <p className="text-sm italic mb-4" style={{ color: 'hsl(43 20% 75% / 0.7)' }}>
              "{tutor.tagline}"
            </p>
          )}

          {/* Two-col: photo | stats (Udemy layout) */}
          <div className="flex items-start gap-5">
            {/* Circular photo */}
            <div className="flex-shrink-0">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden border-2 shadow-xl"
                style={{ borderColor: 'hsl(43 74% 52% / 0.4)' }}>
                {tutor.profile_photo
                  ? <img src={tutor.profile_photo} alt={tutor.full_name} className="w-full h-full object-cover" />
                  : (
                    <div className="w-full h-full flex items-center justify-center"
                      style={{ background: 'hsl(222 47% 22%)' }}>
                      <span className="text-4xl font-bold" style={{ color: 'hsl(43 74% 66%)' }}>
                        {tutor.full_name?.[0]}
                      </span>
                    </div>
                  )
                }
              </div>
            </div>

            {/* Stats widget */}
            <div className="flex-1 pt-1" style={{ color: 'hsl(43 20% 88%)' }}>
              {tutor.avg_rating > 0 && (
                <div className="flex items-center gap-2.5 py-1.5">
                  <Star className="w-4 h-4 flex-shrink-0 fill-amber-400 text-amber-400" />
                  <span className="text-sm">
                    <span className="font-bold">{Number(tutor.avg_rating).toFixed(1)}</span>
                    {' '}<span style={{ color: 'hsl(43 20% 65%)' }}>Instructor Rating</span>
                  </span>
                </div>
              )}
              {subjects.length > 0 && (
                <div className="flex items-center gap-2.5 py-1.5">
                  <PlayCircle className="w-4 h-4 flex-shrink-0" style={{ color: 'hsl(43 74% 52%)' }} />
                  <span className="text-sm">
                    <span className="font-bold">{subjects.length}</span>
                    {' '}<span style={{ color: 'hsl(43 20% 65%)' }}>{subjects.length === 1 ? 'Course' : 'Courses'}</span>
                  </span>
                </div>
              )}
              {liveStudentCount > 0 && (
                <div className="flex items-center gap-2.5 py-1.5">
                  <Users className="w-4 h-4 flex-shrink-0" style={{ color: 'hsl(43 74% 52%)' }} />
                  <span className="text-sm">
                    <span className="font-bold">{liveStudentCount.toLocaleString()}</span>
                    {' '}<span style={{ color: 'hsl(43 20% 65%)' }}>{liveStudentCount === 1 ? 'Student' : 'Students'}</span>
                  </span>
                </div>
              )}
              {tutor.years_teaching > 0 && (
                <div className="flex items-center gap-2.5 py-1.5">
                  <Clock className="w-4 h-4 flex-shrink-0" style={{ color: 'hsl(43 74% 52%)' }} />
                  <span className="text-sm">
                    <span className="font-bold">{tutor.years_teaching}+</span>
                    {' '}<span style={{ color: 'hsl(43 20% 65%)' }}>Years Teaching</span>
                  </span>
                </div>
              )}
              {posts.length > 0 && (
                <div className="flex items-center gap-2.5 py-1.5">
                  <FileText className="w-4 h-4 flex-shrink-0" style={{ color: 'hsl(43 74% 52%)' }} />
                  <span className="text-sm">
                    <span className="font-bold">{posts.length}</span>
                    {' '}<span style={{ color: 'hsl(43 20% 65%)' }}>{posts.length === 1 ? 'Article' : 'Articles'}</span>
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Subject chips */}
          {tutor.subjects?.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-5">
              {tutor.subjects.map(s => (
                <span key={s}
                  className="px-3 py-1 rounded-full text-xs font-semibold border"
                  style={{
                    borderColor: 'hsl(43 74% 52% / 0.35)',
                    color:       'hsl(43 74% 72%)',
                    background:  'hsl(43 74% 52% / 0.1)',
                  }}
                >{s}</span>
              ))}
            </div>
          )}

          {/* Desktop CTA — inline in hero */}
          <div className="hidden lg:flex gap-3 mt-6">
            {isSubscribed ? (
              <button
                onClick={() => navigate('/subjects')}
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm active:scale-95 transition-transform"
                style={{ background: 'hsl(43 74% 52%)', color: 'hsl(222 47% 11%)' }}
              >
                <PlayCircle className="w-4 h-4" /> Start Learning
              </button>
            ) : (
              <>
                <button
                  onClick={() => navigate('/subscription')}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm active:scale-95 transition-transform"
                  style={{ background: 'hsl(43 74% 52%)', color: 'hsl(222 47% 11%)' }}
                >
                  <CreditCard className="w-4 h-4" /> Pay Fees & Unlock Lessons
                </button>
                {!isAuthenticated && (
                  <button
                    onClick={() => navigate('/register')}
                    className="flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm border transition-colors"
                    style={{ borderColor: 'hsl(43 74% 52% / 0.3)', color: 'hsl(43 74% 72%)' }}
                  >
                    <Zap className="w-4 h-4" /> Free Trial
                  </button>
                )}
              </>
            )}
            {contactHref && (
              <a
                href={contactHref}
                className="flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm border transition-colors"
                style={{ borderColor: 'hsl(43 74% 52% / 0.3)', color: 'hsl(43 74% 72%)' }}
              >
                <MessageCircle className="w-4 h-4" /> Contact
              </a>
            )}
          </div>
        </div>

        {/* ══════════════════════════════════════════════
            BODY — white/card background, full width
        ══════════════════════════════════════════════ */}
        <div className="w-full">

          {/* ── ABOUT ── */}
          {bioText && (
            <div className="border-b border-border px-4 lg:px-8 py-6">
              <SectionHeading title="About" />
              <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line">{bioShown}</p>
              {bioLong && (
                <button
                  onClick={() => setBioOpen(v => !v)}
                  className="flex items-center gap-1 mt-3 text-sm font-bold transition-colors"
                  style={{ color: 'hsl(222 47% 35%)' }}
                >
                  {bioOpen
                    ? <><ChevronUp className="w-4 h-4" />Show less</>
                    : <><ChevronDown className="w-4 h-4" />Show more</>
                  }
                </button>
              )}

              {/* Qualifications + Certs revealed on expand */}
              {bioOpen && (
                <div className="mt-6 space-y-5">
                  {tutor.qualifications?.length > 0 && (
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Qualifications</p>
                      <div className="space-y-3">
                        {tutor.qualifications.map((q, i) => (
                          <div key={i} className="flex items-start gap-3">
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                              style={{ background: 'hsl(43 74% 52% / 0.12)' }}>
                              <GraduationCap className="w-3.5 h-3.5" style={{ color: 'hsl(43 60% 38%)' }} />
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
                      <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Certifications</p>
                      <div className="space-y-3">
                        {tutor.certifications.map((c, i) => (
                          <div key={i} className="flex items-start gap-3">
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                              style={{ background: 'hsl(43 74% 52% / 0.12)' }}>
                              <Award className="w-3.5 h-3.5" style={{ color: 'hsl(43 60% 38%)' }} />
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
                      <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Experience</p>
                      {tutor.current_position && (
                        <div className="flex items-start gap-3 mb-2">
                          <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: 'hsl(43 74% 52%)' }} />
                          <div>
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Current</p>
                            <p className="text-sm">{tutor.current_position}</p>
                          </div>
                        </div>
                      )}
                      {tutor.previous_schools && (
                        <div className="flex items-start gap-3">
                          <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0 bg-muted-foreground/30" />
                          <p className="text-sm text-muted-foreground whitespace-pre-line">{tutor.previous_schools}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── COURSES / SUBJECTS ── */}
          {subjects.length > 0 && (
            <div className="border-b border-border px-4 lg:px-8 py-6">
              <SectionHeading icon={BookOpen} title={`Courses (${subjects.length})`} />
              <div>
                {subjects.map(s => <SubjectRow key={s.id} subject={s} navigate={navigate} />)}
              </div>

              {/* Inline CTA below courses */}
              {!isSubscribed && (
                <div
                  className="mt-5 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3"
                  style={{ background: 'hsl(222 47% 14%)', border: '1px solid hsl(222 47% 22%)' }}
                >
                  <div className="flex-1">
                    <p className="font-bold text-sm" style={{ color: 'hsl(43 20% 92%)' }}>
                      Unlock all {subjects.length} {subjects.length === 1 ? 'course' : 'courses'}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'hsl(43 20% 65%)' }}>
                      Subscribe for full access to every lesson and resource
                    </p>
                  </div>
                  <button
                    onClick={() => navigate('/subscription')}
                    className="flex-shrink-0 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm active:scale-95 transition-transform"
                    style={{ background: 'hsl(43 74% 52%)', color: 'hsl(222 47% 11%)' }}
                  >
                    <CreditCard className="w-4 h-4" />
                    {isAuthenticated ? 'Pay Fees' : 'Get Started'}
                  </button>
                </div>
              )}
              {isSubscribed && (
                <button
                  onClick={() => navigate('/subjects')}
                  className="mt-4 w-full py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform"
                  style={{ background: 'hsl(222 47% 18%)', color: 'hsl(43 74% 66%)' }}
                >
                  <PlayCircle className="w-4 h-4" /> Start Learning
                </button>
              )}
            </div>
          )}

          {/* ── BLOG — only renders if posts exist ── */}
          {posts.length > 0 && (
            <div className="border-b border-border px-4 lg:px-8 py-6">
              <SectionHeading icon={FileText} title={`Articles by ${firstName}`} />
              <div>
                {posts.map(p => <BlogPostCard key={p.id} post={p} navigate={navigate} />)}
              </div>
            </div>
          )}

          {/* ── CONTACT / SOCIAL ── */}
          {(contactHref || tutor.facebook || tutor.linkedin || tutor.youtube || tutor.twitter_x) && (
            <div className="px-4 lg:px-8 py-6">
              <SectionHeading icon={MessageCircle} title="Connect" />
              <div className="flex flex-wrap gap-2">
                {tutor.whatsapp && (
                  <a href={`https://wa.me/${tutor.whatsapp.replace(/\D/g,'')}`}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors">
                    <MessageCircle className="w-4 h-4" /> WhatsApp
                  </a>
                )}
                {tutor.email && (
                  <a href={`mailto:${tutor.email}`}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors">
                    <Mail className="w-4 h-4" /> Email
                  </a>
                )}
                {tutor.phone && (
                  <a href={`tel:${tutor.phone}`}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors">
                    <Phone className="w-4 h-4" /> Call
                  </a>
                )}
                {tutor.facebook  && <a href={tutor.facebook}  className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"><Facebook  className="w-4 h-4"/>Facebook</a>}
                {tutor.linkedin  && <a href={tutor.linkedin}  className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"><Linkedin  className="w-4 h-4"/>LinkedIn</a>}
                {tutor.youtube   && <a href={tutor.youtube}   className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"><Youtube   className="w-4 h-4"/>YouTube</a>}
                {tutor.twitter_x && <a href={tutor.twitter_x} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"><Twitter   className="w-4 h-4"/>X</a>}
              </div>
            </div>
          )}

        </div>{/* end body */}
      </div>
    </>
  );
}
