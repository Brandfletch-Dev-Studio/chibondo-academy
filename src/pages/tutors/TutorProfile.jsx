import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import SEO from '@/components/SEO';
import {
  Star, Users, BookOpen, PlayCircle, Clock, ChevronDown,
  ChevronUp, GraduationCap, Award, CreditCard, ArrowLeft,
  MessageCircle, Calendar, FileText
} from 'lucide-react';

// ─── Brand colours (matching index.css) ──────────────────────────────────────
// primary  = navy  hsl(222 47% 18%)
// accent   = gold  hsl(43 74% 52%)
// The page renders OUTSIDE the AppLayout shell so it owns its own background.

// ─── Utility ─────────────────────────────────────────────────────────────────
function stripHtml(html = '') {
  return html.replace(/<[^>]+>/g, '').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#[0-9]+;/g,'').trim();
}

// ─── Star rating display ──────────────────────────────────────────────────────
function Stars({ rating = 0, size = 'sm' }) {
  const full  = Math.floor(rating);
  const half  = rating % 1 >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  const cls   = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';
  return (
    <span className="flex items-center gap-0.5">
      {Array(full ).fill(0).map((_,i) => <Star key={`f${i}`} className={`${cls} fill-amber-400 text-amber-400`}/>)}
      {half === 1  && <Star className={`${cls} fill-amber-200 text-amber-400`}/>}
      {Array(empty).fill(0).map((_,i) => <Star key={`e${i}`} className={`${cls} text-muted-foreground/30`}/>)}
    </span>
  );
}

// ─── Stat row item (used in the header stats widget) ─────────────────────────
function StatItem({ icon: Icon, value, label }) {
  return (
    <div className="flex items-center gap-2.5 py-1">
      <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      <span className="text-sm text-foreground">
        <span className="font-semibold">{value}</span>
        {' '}<span className="text-muted-foreground">{label}</span>
      </span>
    </div>
  );
}

// ─── Subject card ─────────────────────────────────────────────────────────────
function SubjectCard({ subject, navigate }) {
  return (
    <button
      onClick={() => navigate(`/subjects/${subject.id}`)}
      className="w-full text-left group"
    >
      <div className="flex items-center gap-3 py-3 border-b border-border last:border-0">
        {/* Thumbnail */}
        <div className="w-14 h-14 rounded-lg overflow-hidden bg-primary/10 flex-shrink-0 relative">
          {subject.cover_image
            ? <img src={subject.cover_image} alt="" loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"/>
            : <div className="w-full h-full flex items-center justify-center"><BookOpen className="w-5 h-5 text-primary/30"/></div>
          }
        </div>
        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm leading-snug line-clamp-2 group-hover:text-accent transition-colors">
            {subject.name}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {subject.form_name}{subject.total_lessons > 0 && ` · ${subject.total_lessons} lessons`}
          </p>
        </div>
        <PlayCircle className="w-5 h-5 text-muted-foreground/40 group-hover:text-accent transition-colors flex-shrink-0"/>
      </div>
    </button>
  );
}

// ─── Blog post card ───────────────────────────────────────────────────────────
function BlogCard({ post, navigate }) {
  const date = post.published_at
    ? new Date(post.published_at).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})
    : '';
  return (
    <button
      onClick={() => navigate(`/blog/${post.id}`)}
      className="w-full text-left group"
    >
      <div className="flex gap-3 py-3 border-b border-border last:border-0">
        {post.cover_image && (
          <div className="w-20 h-16 rounded-lg overflow-hidden flex-shrink-0">
            <img src={post.cover_image} alt="" loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"/>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm leading-snug line-clamp-2 group-hover:text-accent transition-colors">{post.title}</p>
          {post.excerpt && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{post.excerpt}</p>}
          {date && <p className="text-[11px] text-muted-foreground/60 mt-1 flex items-center gap-1"><Calendar className="w-3 h-3"/>{date}</p>}
        </div>
      </div>
    </button>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────
function Section({ title, icon: Icon, children }) {
  return (
    <div className="border-t border-border">
      <div className="px-4 py-5">
        <h2 className="flex items-center gap-2 text-base font-bold text-foreground mb-4">
          {Icon && <Icon className="w-4 h-4 text-accent"/>}
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}

// ─── Sticky bottom CTA ────────────────────────────────────────────────────────
function BottomCTA({ isAuthenticated, isSubscribed, navigate }) {
  if (isSubscribed) return null; // subscriber: no sticky bar needed

  const label   = isAuthenticated ? 'Pay Fees & Unlock All Lessons' : 'Pay Fees & Unlock Access';
  const subtext = isAuthenticated ? null : 'Sign up for a free trial first';

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border px-4 pt-3 pb-5 safe-area-pb shadow-2xl">
      <button
        onClick={() => navigate(isAuthenticated ? '/subscription' : '/subscription')}
        className="w-full py-4 rounded-2xl font-bold text-base tracking-wide transition-all active:scale-95"
        style={{ background: 'hsl(222 47% 18%)', color: 'hsl(43 74% 66%)' }}
      >
        {label}
      </button>
      {subtext && (
        <p className="text-center text-xs text-muted-foreground mt-2">{subtext}</p>
      )}
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function TutorProfilePage() {
  const { slug }   = useParams();
  const navigate   = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const [bioOpen, setBioOpen] = useState(false);

  // Tutor data
  const { data: tutors = [], isLoading } = useQuery({
    queryKey: ['tutor-profile', slug],
    queryFn:  () => base44.entities.TutorProfile.filter({ slug, status: 'active', is_visible: true }, 'full_name', 1),
    enabled:  !!slug,
    staleTime: 60_000,
  });
  const tutor = tutors[0];

  // Subjects linked to this tutor
  const { data: subjects = [] } = useQuery({
    queryKey: ['tutor-subjects', tutor?.id],
    queryFn:  () => base44.entities.Subject.filter({ tutor_profile_id: tutor.id, status: 'published' }, 'name', 50),
    enabled:  !!tutor?.id,
    staleTime: 60_000,
  });

  // Blog posts (only fetch if tutor exists)
  const { data: posts = [] } = useQuery({
    queryKey: ['tutor-posts', tutor?.id],
    queryFn:  () => base44.entities.BlogPost.filter({ tutor_profile_id: tutor.id, status: 'published' }, '-published_at', 20),
    enabled:  !!tutor?.id,
    staleTime: 60_000,
  });

  // Subscription check
  const { data: subs = [] } = useQuery({
    queryKey: ['my-sub', user?.id],
    queryFn:  () => base44.entities.Subscription.filter({ student_id: user.id, status: 'active' }, '-created_date', 1),
    enabled:  !!user?.id,
    staleTime: 30_000,
  });
  const isSubscribed = subs.length > 0;

  // ── Loading ──
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="flex gap-1.5">
            {[0,1,2].map(i=>(
              <div key={i} className="w-2 h-2 rounded-full bg-accent"
                style={{animation:`bounce 1.2s ease-in-out ${i*0.15}s infinite`}}/>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Loading profile…</p>
          <style>{`@keyframes bounce{0%,80%,100%{transform:translateY(0);opacity:.4}40%{transform:translateY(-6px);opacity:1}}`}</style>
        </div>
      </div>
    );
  }

  // ── Not found ──
  if (!tutor) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center space-y-4">
          <GraduationCap className="w-14 h-14 mx-auto text-muted-foreground/20"/>
          <p className="font-bold text-lg">Tutor not found</p>
          <button onClick={()=>navigate('/tutors')}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold"
            style={{background:'hsl(222 47% 18%)',color:'hsl(43 74% 66%)'}}>
            ← All Tutors
          </button>
        </div>
      </div>
    );
  }

  const bioText  = stripHtml(tutor.biography || '');
  const bioLong  = bioText.length > 280;
  const bioShown = bioLong && !bioOpen ? bioText.slice(0, 280) + '…' : bioText;

  // Contact href
  const contactHref = tutor.whatsapp
    ? `https://wa.me/${tutor.whatsapp.replace(/\D/g,'')}`
    : tutor.email ? `mailto:${tutor.email}` : null;

  return (
    <>
      <SEO
        title={`${tutor.full_name} | Chibondo Academy`}
        description={`${tutor.full_name}${tutor.professional_title ? ` — ${tutor.professional_title}` : ''}. ${tutor.tagline||''}`}
        canonical={`https://aca.base44.app/tutors/${slug}`}
        ogImage={tutor.profile_photo || 'https://media.base44.com/images/public/6a212896f8e71114ad51c36f/3fd7d6af7_FB_IMG_1780187860438.jpg'}
      />

      {/* ── Sticky bottom CTA ── */}
      <BottomCTA isAuthenticated={isAuthenticated} isSubscribed={isSubscribed} navigate={navigate}/>

      {/* ════════════════════════════════════════════
          ROOT — owns full viewport, no AppLayout shell
          pb-28 leaves space above sticky CTA
      ════════════════════════════════════════════ */}
      <div className="bg-background min-h-screen pb-28">

        {/* ── Back button ── */}
        <div className="px-4 pt-4 pb-2">
          <button
            onClick={()=>navigate('/tutors')}
            className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4"/> All Tutors
          </button>
        </div>

        {/* ════════════════════════════════════════════
            SECTION 1 — HERO
            Udemy-style: photo left, stats right
        ════════════════════════════════════════════ */}
        <div className="px-4 py-4">

          {/* Name heading — full width above the two-col layout */}
          <h1 className="font-display font-bold text-xl leading-tight text-foreground mb-0.5">
            {tutor.full_name}
          </h1>
          {tutor.professional_title && (
            <p className="text-sm text-muted-foreground mb-3">{tutor.professional_title}</p>
          )}

          {/* Two-col: photo | stats */}
          <div className="flex items-start gap-5">
            {/* Photo — circular, Udemy style */}
            <div className="flex-shrink-0">
              <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-border bg-muted shadow-md">
                {tutor.profile_photo
                  ? <img src={tutor.profile_photo} alt={tutor.full_name} className="w-full h-full object-cover"/>
                  : (
                    <div className="w-full h-full flex items-center justify-center"
                      style={{background:'hsl(222 47% 18%)'}}>
                      <span className="text-3xl font-bold" style={{color:'hsl(43 74% 66%)'}}>
                        {tutor.full_name?.[0]}
                      </span>
                    </div>
                  )
                }
              </div>
            </div>

            {/* Stats widget — exactly like Udemy reference */}
            <div className="flex-1 space-y-0.5 pt-1">
              {/* Rating — only if > 0 */}
              {(tutor.avg_rating > 0) && (
                <StatItem icon={Star} value={tutor.avg_rating?.toFixed(1)} label="Instructor Rating"/>
              )}
              {/* Courses count */}
              {subjects.length > 0 && (
                <StatItem icon={PlayCircle} value={subjects.length} label={subjects.length === 1 ? 'Course' : 'Courses'}/>
              )}
              {/* Experience */}
              {tutor.years_teaching > 0 && (
                <StatItem icon={Clock} value={`${tutor.years_teaching}+`} label="Years Teaching"/>
              )}
              {/* Articles */}
              {posts.length > 0 && (
                <StatItem icon={FileText} value={posts.length} label={posts.length === 1 ? 'Article' : 'Articles'}/>
              )}
            </div>
          </div>

          {/* Subject chips */}
          {tutor.subjects?.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {tutor.subjects.map(s => (
                <span key={s}
                  className="px-3 py-1 rounded-full text-xs font-semibold border"
                  style={{
                    borderColor: 'hsl(43 74% 52% / 0.4)',
                    color:       'hsl(43 60% 40%)',
                    background:  'hsl(43 74% 52% / 0.08)',
                  }}>
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ════════════════════════════════════════════
            SECTION 2 — ABOUT (expandable)
        ════════════════════════════════════════════ */}
        {bioText && (
          <Section title="About" icon={null}>
            <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line">
              {bioShown}
            </p>
            {bioLong && (
              <button
                onClick={()=>setBioOpen(v=>!v)}
                className="flex items-center gap-1 mt-3 text-sm font-semibold transition-colors"
                style={{color:'hsl(222 47% 35%)'}}
              >
                {bioOpen
                  ? <><ChevronUp className="w-4 h-4"/>Show less</>
                  : <><ChevronDown className="w-4 h-4"/>Show more</>
                }
              </button>
            )}

            {/* Qualifications + Certs inside About when expanded */}
            {bioOpen && (tutor.qualifications?.length > 0 || tutor.certifications?.length > 0) && (
              <div className="mt-5 space-y-4">
                {tutor.qualifications?.length > 0 && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Qualifications</p>
                    <div className="space-y-2">
                      {tutor.qualifications.map((q,i)=>(
                        <div key={i} className="flex items-start gap-2">
                          <GraduationCap className="w-4 h-4 text-accent flex-shrink-0 mt-0.5"/>
                          <div>
                            <p className="text-sm font-semibold">{q.name}</p>
                            <p className="text-xs text-muted-foreground">{q.institution}{q.year&&` · ${q.year}`}</p>
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
                      {tutor.certifications.map((c,i)=>(
                        <div key={i} className="flex items-start gap-2">
                          <Award className="w-4 h-4 text-accent flex-shrink-0 mt-0.5"/>
                          <div>
                            <p className="text-sm font-semibold">{c.name}</p>
                            <p className="text-xs text-muted-foreground">{c.organization}{c.date_issued&&` · ${c.date_issued}`}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </Section>
        )}

        {/* ════════════════════════════════════════════
            SECTION 3 — SUBJECTS / COURSES
        ════════════════════════════════════════════ */}
        {subjects.length > 0 && (
          <Section title={`Courses (${subjects.length})`} icon={BookOpen}>
            <div>
              {subjects.map(s=>(
                <SubjectCard key={s.id} subject={s} navigate={navigate}/>
              ))}
            </div>

            {/* Inline unlock CTA for non-subscribers */}
            {!isSubscribed && (
              <div className="mt-4 rounded-2xl border border-border bg-card p-4 flex flex-col gap-3">
                <div>
                  <p className="font-bold text-sm">Unlock all {subjects.length} courses</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isAuthenticated
                      ? 'Subscribe to access every lesson and resource'
                      : 'Create an account or sign in, then subscribe for full access'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={()=>navigate('/subscription')}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95"
                    style={{background:'hsl(222 47% 18%)',color:'hsl(43 74% 66%)'}}>
                    {isSubscribed ? 'Start Learning' : 'Pay Fees'}
                  </button>
                  {!isAuthenticated && (
                    <button
                      onClick={()=>navigate('/register')}
                      className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-border hover:border-accent/40 transition-colors">
                      Free Trial
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Start learning CTA for subscribers */}
            {isSubscribed && (
              <button
                onClick={()=>navigate('/subjects')}
                className="mt-4 w-full py-3 rounded-2xl text-sm font-bold transition-all active:scale-95 flex items-center justify-center gap-2"
                style={{background:'hsl(222 47% 18%)',color:'hsl(43 74% 66%)'}}>
                <PlayCircle className="w-4 h-4"/> Start Learning
              </button>
            )}
          </Section>
        )}

        {/* ════════════════════════════════════════════
            SECTION 4 — BLOG (only if posts exist)
        ════════════════════════════════════════════ */}
        {posts.length > 0 && (
          <Section title={`Articles by ${tutor.full_name.split(' ')[0]}`} icon={FileText}>
            {posts.map(p=>(
              <BlogCard key={p.id} post={p} navigate={navigate}/>
            ))}
          </Section>
        )}

        {/* ════════════════════════════════════════════
            Contact row — only if contact info exists
        ════════════════════════════════════════════ */}
        {contactHref && (
          <div className="border-t border-border px-4 py-4">
            <a
              href={contactHref}
              className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <MessageCircle className="w-4 h-4 text-accent"/>
              Contact {tutor.full_name.split(' ')[0]}
            </a>
          </div>
        )}

      </div>{/* end root */}
    </>
  );
}
