import React, { useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import SEO from '@/components/SEO';
import { Progress } from '@/components/ui/progress';
import {
  ArrowLeft, BookOpen, PlayCircle, GraduationCap, Award, FileText,
  Phone, Mail, Facebook, Linkedin, Youtube, Twitter,
  Users, Star, Clock, ChevronRight, MessageSquare, Zap
} from 'lucide-react';

/* ── helpers ───────────────────────────────────────────────────────────────── */
function stripHtml(html = '') {
  return html.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ')
    .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').trim();
}

/* ── Sticky CTA ────────────────────────────────────────────────────────────── */
function StickyCTA({ isAuthenticated, isSubscribed, navigate }) {
  if (isSubscribed) return null;
  return (
    <div className="lg:hidden fixed bottom-16 left-0 right-0 z-40 px-4 py-2.5 bg-background/95 backdrop-blur border-t border-border shadow-2xl">
      <button
        onClick={() => navigate(isAuthenticated ? '/subscription' : '/register')}
        className="w-full py-3 rounded-2xl font-bold text-sm active:scale-95 transition-all"
        style={{ background:'hsl(222 47% 18%)', color:'hsl(43 74% 66%)' }}
      >
        {isAuthenticated ? 'Start Learning' : 'Start Learning'}
      </button>
    </div>
  );
}

/* ── Subject card (horizontal) ─────────────────────────────────────────────── */
function SubjectRow({ subject, navigate }) {
  return (
    <button
      onClick={() => navigate(`/subjects/${subject.id}`)}
      className="w-full text-left group flex items-center gap-3 p-3 rounded-xl hover:bg-muted/40 transition-colors"
    >
      <div className="w-12 h-12 rounded-xl overflow-hidden bg-primary/10 flex-shrink-0">
        {subject.cover_image
          ? <img src={subject.cover_image} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
          : <div className="w-full h-full flex items-center justify-center"><BookOpen className="w-5 h-5 text-primary/30" /></div>
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm leading-snug group-hover:text-accent transition-colors">{subject.name}</p>
        <p className="text-xs text-muted-foreground">{subject.form_name}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-accent transition-colors flex-shrink-0" />
    </button>
  );
}

/* ── Main component ─────────────────────────────────────────────────────────── */
export default function TutorProfilePage() {
  const { slug }   = useParams();
  const navigate   = useNavigate();
  const { user }   = useOutletContext();
  const [avatarErr, setAvatarErr] = useState(false);
  const [bioOpen, setBioOpen] = useState(false);

  const isAuthenticated = !!user?.id;
  const isSubscribed    = user?.subscription_status === 'active';

  /* ── Data ── */
  const { data: tutors = [], isLoading } = useQuery({
    queryKey: ['tutor-by-slug', slug],
    queryFn: () => base44.entities.TutorProfile.filter({ slug, status: 'active' }, 'full_name', 1),
    staleTime: 120_000,
  });
  const tutor = tutors[0];

  const { data: subjects = [] } = useQuery({
    queryKey: ['tutor-subjects', tutor?.id],
    queryFn: () => base44.entities.Subject.filter({ tutor_profile_id: tutor.id, status: 'published' }, 'name', 50),
    enabled: !!tutor?.id,
    staleTime: 60_000,
  });

  const subjectIds = subjects.map(s => s.id);

  // Blog posts by this tutor
  const { data: blogPosts = [] } = useQuery({
    queryKey: ['tutor-blog', tutor?.id],
    queryFn: () => base44.entities.BlogPost.filter({ status: 'published' }, '-published_at', 6),
    enabled: !!tutor?.id,
    staleTime: 120_000,
  });
  // Filter to this tutor's posts client-side (tutor_profile_id or author match)
  const tutorPosts = blogPosts.filter(p =>
    p.tutor_profile_id === tutor?.id || p.author_id === tutor?.user_id
  );

  const { data: tutorEnrollments = [] } = useQuery({
    queryKey: ['tutor-enrollments', tutor?.id, subjectIds.join(',')],
    queryFn: async () => {
      if (!subjectIds.length) return [];
      const batches = await Promise.all(
        subjectIds.slice(0,10).map(sid =>
          base44.entities.Enrollment.filter({ subject_id: sid }, '-created_date', 500)
        )
      );
      return batches.flat();
    },
    enabled: subjectIds.length > 0,
    staleTime: 60_000,
  });

  const liveStudentCount = useMemo(() => {
    return new Set(tutorEnrollments.map(e => e.student_id)).size;
  }, [tutorEnrollments]);

  /* ── Loading ── */
  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex gap-1.5">
        {[0,1,2].map(i => (
          <div key={i} className="w-2 h-2 rounded-full bg-accent"
            style={{ animation:`bounce 1.2s ${i*0.15}s infinite` }} />
        ))}
      </div>
      <style>{`@keyframes bounce{0%,80%,100%{transform:translateY(0);opacity:.3}40%{transform:translateY(-7px);opacity:1}}`}</style>
    </div>
  );

  if (!tutor) return (
    <div className="text-center py-24 space-y-3">
      <GraduationCap className="w-14 h-14 mx-auto text-muted-foreground/20" />
      <p className="font-bold text-lg">Tutor not found</p>
      <button onClick={() => navigate('/tutors')}
        className="px-5 py-2.5 rounded-xl text-sm font-bold"
        style={{ background:'hsl(222 47% 18%)', color:'hsl(43 74% 66%)' }}>
        ← View All Tutors
      </button>
    </div>
  );

  const bioText    = stripHtml(tutor.biography || '');
  const bioPreview = bioText.slice(0, 280);
  const hasBioMore = bioText.length > 280;

  const socials = [
    { href: tutor.email    && `mailto:${tutor.email}`,  Icon: Mail,     label: 'Email'    },
    { href: tutor.phone    && `tel:${tutor.phone}`,      Icon: Phone,    label: 'Phone'    },
    { href: tutor.linkedin,                              Icon: Linkedin, label: 'LinkedIn' },
    { href: tutor.facebook,                              Icon: Facebook, label: 'Facebook' },
    { href: tutor.youtube,                               Icon: Youtube,  label: 'YouTube'  },
    { href: tutor.twitter_x,                             Icon: Twitter,  label: 'Twitter'  },
  ].filter(s => s.href);

  return (
    <>
      <SEO
        title={`${tutor.full_name} | Chibondo Academy`}
        description={`${tutor.full_name}${tutor.professional_title ? ` — ${tutor.professional_title}` : ''}. ${tutor.tagline || ''}`}
        canonical={`https://aca.base44.app/tutors/${slug}`}
        ogImage={tutor.cover_photo || tutor.profile_photo}
      />

      <StickyCTA isAuthenticated={isAuthenticated} isSubscribed={isSubscribed} navigate={navigate} />

      {/* Full-width breakout — negative margin cancels AppLayout padding */}
      <div className="pb-28 lg:pb-10 -mt-4 lg:-mt-6">

        {/* ══════════════════════════════════════════
            SLIM BRANDED HEADER (no cover photo)
        ══════════════════════════════════════════ */}
        <div className="relative -mx-4 lg:-mx-6 px-4 lg:px-6 pt-5 pb-16"
          style={{ background: 'linear-gradient(135deg, hsl(222 47% 14%) 0%, hsl(222 47% 18%) 60%, hsl(43 74% 30% / 0.3) 100%)' }}>
          <div className="absolute inset-0 pointer-events-none"
            style={{ backgroundImage: 'radial-gradient(ellipse at 80% 50%, hsl(43 74% 52% / 0.15) 0%, transparent 60%)' }} />
          <button
            onClick={() => navigate('/tutors')}
            className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-sm border border-white/20 text-white hover:bg-white/10 transition-colors w-fit"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> All Tutors
          </button>
        </div>

        {/* ══════════════════════════════════════════
            PROFILE IDENTITY — avatar overlapping cover
        ══════════════════════════════════════════ */}
        <div className="px-4 lg:px-6">
          {/* Avatar — pulls up 40px into the cover */}
          <div className="relative -mt-10 mb-4">
            <div
              className="w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden border-4 shadow-2xl"
              style={{ borderColor:'hsl(222 47% 14%)', background:'hsl(222 47% 18%)' }}
            >
              {tutor.profile_photo ? (
                <img src={tutor.profile_photo} alt={tutor.full_name} loading="eager" decoding="async" onError={() => setAvatarErr(true)} className="w-full h-full object-cover object-top" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-3xl font-bold" style={{ color:'hsl(43 74% 66%)' }}>
                    {tutor.full_name?.[0]}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Name + title */}
          <h1 className="font-display font-bold text-2xl sm:text-3xl leading-tight">
            {tutor.full_name}
          </h1>
          {tutor.professional_title && (
            <p className="text-sm font-medium mt-0.5" style={{ color:'hsl(43 74% 52%)' }}>
              {tutor.professional_title}
            </p>
          )}
          {tutor.tagline && (
            <p className="text-sm text-muted-foreground italic mt-1">"{tutor.tagline}"</p>
          )}

          {/* Quick stats row */}
          <div className="flex flex-wrap gap-4 mt-4 py-4 border-y border-border">
            {subjects.length > 0 && (
              <div className="flex items-center gap-1.5 text-sm">
                <BookOpen className="w-4 h-4 text-accent" />
                <span className="font-bold">{subjects.length}</span>
                <span className="text-muted-foreground">{subjects.length === 1 ? 'Course' : 'Courses'}</span>
              </div>
            )}
            {liveStudentCount > 0 && (
              <div className="flex items-center gap-1.5 text-sm">
                <Users className="w-4 h-4 text-accent" />
                <span className="font-bold">{liveStudentCount.toLocaleString()}</span>
                <span className="text-muted-foreground">Students</span>
              </div>
            )}
            {tutor.years_teaching > 0 && (
              <div className="flex items-center gap-1.5 text-sm">
                <Clock className="w-4 h-4 text-accent" />
                <span className="font-bold">{tutor.years_teaching}</span>
                <span className="text-muted-foreground">{tutor.years_teaching === 1 ? 'year' : 'years'} experience</span>
              </div>
            )}
            {tutor.subjects?.length > 0 && (
              <div className="flex items-center gap-1.5 text-sm">
                <Star className="w-4 h-4 text-accent" />
                <span className="text-muted-foreground">{tutor.subjects.join(' · ')}</span>
              </div>
            )}
          </div>

          {/* Social links */}
          {socials.length > 0 && (
            <div className="flex gap-2.5 mt-4 flex-wrap">
              {socials.map(({ href, Icon, label }) => (
                <a key={label} href={href} target="_blank" rel="noopener noreferrer"
                  className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-accent hover:border-accent/40 transition-colors"
                  title={label}>
                  <Icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════════
            TWO-COLUMN BODY
        ══════════════════════════════════════════ */}
        <div className="px-4 lg:px-6 mt-6 grid lg:grid-cols-3 gap-6">

          {/* ── LEFT / main ── */}
          <div className="lg:col-span-2 space-y-6">

            {/* Biography */}
            {bioText && (
              <section className="bg-card border border-border rounded-2xl p-5">
                <h2 className="font-display font-bold text-base mb-3 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-accent" /> About
                </h2>
                <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line">
                  {bioOpen ? bioText : bioPreview}
                  {hasBioMore && !bioOpen && '…'}
                </p>
                {hasBioMore && (
                  <button onClick={() => setBioOpen(v => !v)}
                    className="mt-2 text-xs font-semibold text-accent hover:underline">
                    {bioOpen ? 'Show less' : 'Read more'}
                  </button>
                )}
              </section>
            )}

            {/* Courses */}
            {subjects.length > 0 && (
              <section className="bg-card border border-border rounded-2xl p-5">
                <h2 className="font-display font-bold text-base mb-3 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-accent" /> Courses Taught
                </h2>
                <div className="space-y-1">
                  {subjects.map(s => <SubjectRow key={s.id} subject={s} navigate={navigate} />)}
                </div>
              </section>
            )}

            {/* Blog / Articles */}
            {tutorPosts.length > 0 && (
              <section className="bg-card border border-border rounded-2xl p-5">
                <h2 className="font-display font-bold text-base mb-4 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-accent" /> Articles & Resources
                </h2>
                <div className="space-y-3">
                  {tutorPosts.map(post => (
                    <div key={post.id} className="flex gap-3 p-3 rounded-xl hover:bg-muted/40 transition-colors cursor-pointer group"
                      onClick={() => navigate(`/blog/${post.id}`)}>
                      {post.cover_image && (
                        <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0">
                          <img src={post.cover_image} alt="" loading="lazy" decoding="async"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm line-clamp-2 group-hover:text-accent transition-colors">{post.title}</p>
                        {post.excerpt && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{post.excerpt}</p>}
                        {post.published_at && (
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {new Date(post.published_at).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}
                          </p>
                        )}
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-accent flex-shrink-0 self-center transition-colors" />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Qualifications */}
            {tutor.qualifications?.length > 0 && (
              <section className="bg-card border border-border rounded-2xl p-5">
                <h2 className="font-display font-bold text-base mb-3 flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-accent" /> Qualifications
                </h2>
                <div className="space-y-3">
                  {tutor.qualifications.map((q, i) => (
                    <div key={i} className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <GraduationCap className="w-4 h-4 text-accent" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{q.name}</p>
                        <p className="text-xs text-muted-foreground">{[q.institution, q.year].filter(Boolean).join(' · ')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Certifications */}
            {tutor.certifications?.length > 0 && (
              <section className="bg-card border border-border rounded-2xl p-5">
                <h2 className="font-display font-bold text-base mb-3 flex items-center gap-2">
                  <Award className="w-4 h-4 text-accent" /> Certifications
                </h2>
                <div className="space-y-3">
                  {tutor.certifications.map((c, i) => (
                    <div key={i} className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Award className="w-4 h-4 text-accent" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{c.name}</p>
                        <p className="text-xs text-muted-foreground">{[c.organization, c.date_issued].filter(Boolean).join(' · ')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* ── RIGHT / sidebar ── */}
          <div className="space-y-4">

            {/* CTA card — desktop only */}
            {!isSubscribed && (
              <div className="hidden lg:block bg-card border border-border rounded-2xl p-5 text-center space-y-3 sticky top-6">
                <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mx-auto">
                  <Zap className="w-6 h-6 text-accent" />
                </div>
                <p className="font-display font-bold">Learn with {tutor.full_name.split(' ')[0]}</p>
                <p className="text-xs text-muted-foreground">Get full access to all courses and lessons</p>
                <button
                  onClick={() => navigate(isAuthenticated ? '/subscription' : '/register')}
                  className="w-full py-2.5 rounded-xl text-sm font-bold active:scale-95 transition-all"
                  style={{ background:'hsl(222 47% 18%)', color:'hsl(43 74% 66%)' }}
                >
                  {isAuthenticated ? 'Start Learning' : 'Start Learning'}
                </button>
              </div>
            )}

            {/* Contact */}
            {(tutor.email || tutor.phone || tutor.whatsapp) && (
              <div className="bg-card border border-border rounded-2xl p-5">
                <h3 className="font-bold text-sm mb-3">Contact</h3>
                <div className="space-y-2.5">
                  {tutor.email && (
                    <a href={`mailto:${tutor.email}`}
                      className="flex items-center gap-2.5 text-sm text-muted-foreground hover:text-accent transition-colors">
                      <Mail className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">{tutor.email}</span>
                    </a>
                  )}
                  {tutor.phone && (
                    <a href={`tel:${tutor.phone}`}
                      className="flex items-center gap-2.5 text-sm text-muted-foreground hover:text-accent transition-colors">
                      <Phone className="w-4 h-4 flex-shrink-0" />
                      <span>{tutor.phone}</span>
                    </a>
                  )}
                  {tutor.whatsapp && (
                    <a href={`https://wa.me/${tutor.whatsapp.replace(/\D/g,'')}`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2.5 text-sm text-green-600 hover:text-green-500 transition-colors">
                      <Phone className="w-4 h-4 flex-shrink-0" />
                      <span>WhatsApp</span>
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Experience */}
            {(tutor.current_position || tutor.previous_schools || tutor.years_teaching > 0) && (
              <div className="bg-card border border-border rounded-2xl p-5">
                <h3 className="font-bold text-sm mb-3">Experience</h3>
                <div className="space-y-2 text-sm">
                  {tutor.current_position && (
                    <p className="text-muted-foreground"><span className="font-medium text-foreground">Current:</span> {tutor.current_position}</p>
                  )}
                  {tutor.previous_schools && (
                    <p className="text-muted-foreground"><span className="font-medium text-foreground">Previously:</span> {tutor.previous_schools}</p>
                  )}
                  {tutor.years_teaching > 0 && (
                    <p className="text-muted-foreground"><span className="font-medium text-foreground">{tutor.years_teaching} years</span> teaching experience</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
