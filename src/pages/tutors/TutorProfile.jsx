import React from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import SEO from '@/components/SEO';
import {
  GraduationCap, BookOpen, Mail, Phone, Award, Briefcase,
  Facebook, Linkedin, Youtube, Twitter, ArrowLeft,
  MessageCircle, Clock, ChevronRight, PlayCircle,
  FileText, Calendar, Tag
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

// ── helpers ──────────────────────────────────────────────────────────────────

function SocialLink({ href, icon: Icon, label }) {
  if (!href) return null;
  const url = href.startsWith('http') ? href : `https://${href}`;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      className="flex items-center gap-2 px-3 py-2 rounded-xl bg-card border border-border hover:border-primary/40 text-sm text-muted-foreground hover:text-foreground transition-colors"
      aria-label={label}>
      <Icon className="w-4 h-4" />
      <span className="hidden sm:inline">{label}</span>
    </a>
  );
}

function SubjectCard({ subject, onEnroll }) {
  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden hover:border-primary/40 hover:shadow-lg transition-all duration-200 group flex flex-col">
      {/* Thumbnail */}
      <div className="relative h-36 bg-gradient-to-br from-primary/20 to-accent/10 overflow-hidden flex-shrink-0">
        {subject.cover_image ? (
          <img src={subject.cover_image} alt={subject.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <BookOpen className="w-10 h-10 text-primary/20" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        {subject.form_name && (
          <span className="absolute top-2 left-2 text-[10px] text-white/90 font-medium bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded-full">
            {subject.form_name}
          </span>
        )}
      </div>
      {/* Body */}
      <div className="p-3 flex flex-col flex-1 gap-2">
        <p className="font-semibold text-sm leading-snug line-clamp-2">{subject.name}</p>
        {subject.total_lessons > 0 && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <PlayCircle className="w-3 h-3" />{subject.total_lessons} lessons
          </p>
        )}
        <button
          onClick={() => onEnroll(subject)}
          className="mt-auto flex items-center justify-center gap-1.5 w-full px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground text-xs font-medium transition-all duration-150"
        >
          <BookOpen className="w-3.5 h-3.5" /> View Course
        </button>
      </div>
    </div>
  );
}

function BlogCard({ post }) {
  const date = post.published_at
    ? new Date(post.published_at).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })
    : '';
  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden hover:border-primary/40 hover:shadow-lg transition-all duration-200 group flex flex-col">
      {post.cover_image && (
        <div className="h-40 overflow-hidden flex-shrink-0">
          <img src={post.cover_image} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        </div>
      )}
      <div className="p-4 flex flex-col flex-1 gap-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {date && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{date}</span>}
        </div>
        <h3 className="font-semibold text-sm leading-snug line-clamp-2">{post.title}</h3>
        {post.excerpt && <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">{post.excerpt}</p>}
        {post.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {post.tags.slice(0,3).map(t => (
              <span key={t} className="flex items-center gap-0.5 text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary/80">
                <Tag className="w-2.5 h-2.5" />{t}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TutorProfilePage() {
  const { slug } = useParams();
  const navigate = useNavigate();

  // Check if user is already authenticated
  const { isAuthenticated } = useAuth ? useAuth() : { isAuthenticated: false };

  const { data: tutors = [], isLoading } = useQuery({
    queryKey: ['tutor-by-slug', slug],
    queryFn: () => base44.entities.TutorProfile.filter({ slug, status: 'active', is_visible: true }, 'full_name', 1),
    enabled: !!slug,
  });
  const tutor = tutors[0];

  const { data: linkedSubjects = [] } = useQuery({
    queryKey: ['tutor-subjects', tutor?.id],
    queryFn: () => base44.entities.Subject.filter({ tutor_profile_id: tutor.id, status: 'published' }, 'name', 50),
    enabled: !!tutor?.id,
  });

  const { data: blogPosts = [] } = useQuery({
    queryKey: ['tutor-blog', tutor?.id],
    queryFn: () => base44.entities.BlogPost.filter({ tutor_profile_id: tutor.id, status: 'published' }, '-published_at', 20),
    enabled: !!tutor?.id,
  });

  // When a logged-in user clicks "View Course" — go straight to subject, no login redirect
  const handleEnroll = (subject) => {
    if (isAuthenticated) {
      navigate(`/subjects/${subject.id}`);
    } else {
      navigate(`/subjects/${subject.id}`); // ProtectedRoute will redirect if needed
    }
  };

  // Contact href
  const contactHref = tutor?.whatsapp
    ? `https://wa.me/${tutor.whatsapp.replace(/\D/g,'')}`
    : tutor?.email
    ? `mailto:${tutor.email}`
    : tutor?.phone
    ? `tel:${tutor.phone}`
    : null;

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'hsl(222 47% 8%)' }}>
        <div className="flex gap-1.5">
          {[0,1,2].map(i => (
            <div key={i} className="w-2 h-2 rounded-full bg-primary" style={{ animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
          ))}
        </div>
        <style>{`@keyframes bounce{0%,80%,100%{transform:scale(0);opacity:0.3}40%{transform:scale(1);opacity:1}}`}</style>
      </div>
    );
  }

  // Not found
  if (!isLoading && !tutor) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'hsl(222 47% 8%)' }}>
        <div className="text-center px-4">
          <GraduationCap className="w-16 h-16 mx-auto text-muted-foreground/20 mb-4" />
          <h1 className="text-xl font-display font-bold">Tutor Not Found</h1>
          <p className="text-muted-foreground mt-2 text-sm">This profile doesn't exist or isn't public.</p>
          <Link to="/tutors" className="inline-flex items-center gap-2 mt-4 text-sm text-primary hover:underline">
            <ArrowLeft className="w-4 h-4" /> Back to Tutors
          </Link>
        </div>
      </div>
    );
  }

  const seoTitle = `${tutor.full_name} | ${tutor.professional_title || 'Tutor'} | Chibondo Academy`;
  const seoDesc = `Learn from ${tutor.full_name}${tutor.professional_title ? `, ${tutor.professional_title}` : ''} at Chibondo Academy. ${tutor.tagline || ''}`.trim();

  return (
    <>
      <SEO
        title={seoTitle}
        description={seoDesc}
        canonical={`https://aca.base44.app/tutors/${slug}`}
        ogImage={tutor.profile_photo || 'https://media.base44.com/images/public/6a212896f8e71114ad51c36f/3fd7d6af7_FB_IMG_1780187860438.jpg'}
        ogType="profile"
      />

      <div className="min-h-screen" style={{ background: 'hsl(222 47% 8%)' }}>

        {/* ── Back nav ── */}
        <div className="w-full px-4 sm:px-6 lg:px-8 pt-5">
          <div className="max-w-screen-xl mx-auto">
            <Link to="/tutors" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" /> All Tutors
            </Link>
          </div>
        </div>

        {/* ── HERO CARD (full width) ── */}
        <div className="w-full px-4 sm:px-6 lg:px-8 py-5">
          <div className="max-w-screen-xl mx-auto">
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              {/* Cover banner */}
              <div className="h-36 sm:h-48 bg-gradient-to-br from-primary/40 via-primary/20 to-accent/20 relative">
                {tutor.profile_photo && (
                  <img src={tutor.profile_photo} alt="" className="w-full h-full object-cover opacity-20" />
                )}
                {/* Avatar anchored to bottom-left */}
                <div className="absolute -bottom-14 left-6">
                  <div className="w-28 h-28 rounded-2xl border-4 border-card overflow-hidden bg-card shadow-2xl">
                    {tutor.profile_photo ? (
                      <img src={tutor.profile_photo} alt={tutor.full_name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-primary/10">
                        <span className="text-5xl font-bold text-primary">{tutor.full_name?.[0]}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Profile info */}
              <div className="pt-18 px-6 pb-6" style={{ paddingTop: '72px' }}>
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
                  {/* Left: name + tags */}
                  <div className="flex-1 min-w-0">
                    <h1 className="text-2xl sm:text-3xl font-display font-bold leading-tight">{tutor.full_name}</h1>
                    {tutor.professional_title && (
                      <p className="text-primary font-medium mt-1">{tutor.professional_title}</p>
                    )}
                    {tutor.tagline && (
                      <p className="text-muted-foreground text-sm mt-1 italic">"{tutor.tagline}"</p>
                    )}
                    {tutor.subjects?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {tutor.subjects.map(s => (
                          <Badge key={s} variant="outline" className="text-xs border-primary/30 text-primary/80">{s}</Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Right: CTAs */}
                  <div className="flex flex-wrap gap-2 flex-shrink-0">
                    {linkedSubjects.length > 0 && (
                      <button
                        onClick={() => {
                          const el = document.getElementById('tutor-courses');
                          if (el) el.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                      >
                        <BookOpen className="w-4 h-4" /> View Courses
                      </button>
                    )}
                    {contactHref && (
                      <a
                        href={contactHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border bg-card text-sm font-medium hover:border-primary/40 transition-colors"
                      >
                        <MessageCircle className="w-4 h-4" /> Contact
                      </a>
                    )}
                  </div>
                </div>

                {/* Stats row */}
                <div className="flex flex-wrap gap-5 mt-5 pt-5 border-t border-border">
                  {tutor.years_teaching > 0 && (
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="w-4 h-4 text-primary/60" />
                      <span className="font-bold">{tutor.years_teaching}</span>
                      <span className="text-muted-foreground">yrs experience</span>
                    </div>
                  )}
                  {linkedSubjects.length > 0 && (
                    <div className="flex items-center gap-2 text-sm">
                      <BookOpen className="w-4 h-4 text-primary/60" />
                      <span className="font-bold">{linkedSubjects.length}</span>
                      <span className="text-muted-foreground">{linkedSubjects.length === 1 ? 'course' : 'courses'}</span>
                    </div>
                  )}
                  {tutor.subjects?.length > 0 && (
                    <div className="flex items-center gap-2 text-sm">
                      <GraduationCap className="w-4 h-4 text-primary/60" />
                      <span className="font-bold">{tutor.subjects.length}</span>
                      <span className="text-muted-foreground">subjects</span>
                    </div>
                  )}
                  {blogPosts.length > 0 && (
                    <div className="flex items-center gap-2 text-sm">
                      <FileText className="w-4 h-4 text-primary/60" />
                      <span className="font-bold">{blogPosts.length}</span>
                      <span className="text-muted-foreground">{blogPosts.length === 1 ? 'article' : 'articles'}</span>
                    </div>
                  )}
                </div>

                {/* Social links */}
                {(tutor.facebook || tutor.linkedin || tutor.youtube || tutor.twitter_x || tutor.tiktok) && (
                  <div className="flex flex-wrap gap-2 mt-4">
                    <SocialLink href={tutor.facebook}  icon={Facebook}  label="Facebook" />
                    <SocialLink href={tutor.linkedin}  icon={Linkedin}  label="LinkedIn" />
                    <SocialLink href={tutor.youtube}   icon={Youtube}   label="YouTube" />
                    <SocialLink href={tutor.twitter_x} icon={Twitter}   label="X / Twitter" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── CONTENT GRID (wide) ── */}
        <div className="w-full px-4 sm:px-6 lg:px-8 pb-16">
          <div className="max-w-screen-xl mx-auto grid lg:grid-cols-3 gap-6">

            {/* ── LEFT COLUMN (main content) ── */}
            <div className="lg:col-span-2 space-y-6">

              {/* About */}
              {tutor.biography && (
                <section className="bg-card border border-border rounded-2xl p-6">
                  <h2 className="font-display font-bold text-lg mb-4">About {tutor.full_name}</h2>
                  <div
                    className="prose prose-sm prose-invert max-w-none text-muted-foreground leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: tutor.biography }}
                  />
                </section>
              )}

              {/* Courses */}
              {linkedSubjects.length > 0 && (
                <section id="tutor-courses" className="bg-card border border-border rounded-2xl p-6">
                  <h2 className="font-display font-bold text-lg mb-5 flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-primary" />
                    Courses by {tutor.full_name}
                  </h2>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {linkedSubjects.map(s => (
                      <SubjectCard key={s.id} subject={s} onEnroll={handleEnroll} />
                    ))}
                  </div>
                  {!isAuthenticated && (
                    <p className="text-center text-xs text-muted-foreground mt-4">
                      <Link to="/login" className="text-primary hover:underline">Sign in</Link> to enroll and access full lesson content
                    </p>
                  )}
                </section>
              )}

              {/* Blog Posts */}
              {blogPosts.length > 0 && (
                <section className="bg-card border border-border rounded-2xl p-6">
                  <h2 className="font-display font-bold text-lg mb-5 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-primary" />
                    Articles & Blog Posts
                  </h2>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {blogPosts.map(post => (
                      <BlogCard key={post.id} post={post} />
                    ))}
                  </div>
                </section>
              )}
            </div>

            {/* ── RIGHT SIDEBAR ── */}
            <div className="space-y-6">

              {/* Qualifications */}
              {tutor.qualifications?.length > 0 && (
                <section className="bg-card border border-border rounded-2xl p-5">
                  <h2 className="font-display font-bold text-base mb-4 flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-primary" /> Qualifications
                  </h2>
                  <div className="space-y-3">
                    {tutor.qualifications.map((q, i) => (
                      <div key={i} className="flex gap-3">
                        <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <GraduationCap className="w-3.5 h-3.5 text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{q.name}</p>
                          <p className="text-xs text-muted-foreground">{q.institution}</p>
                          {q.year && <p className="text-xs text-primary/60">{q.year}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Certifications */}
              {tutor.certifications?.length > 0 && (
                <section className="bg-card border border-border rounded-2xl p-5">
                  <h2 className="font-display font-bold text-base mb-4 flex items-center gap-2">
                    <Award className="w-4 h-4 text-primary" /> Certifications
                  </h2>
                  <div className="space-y-3">
                    {tutor.certifications.map((c, i) => (
                      <div key={i} className="flex gap-3">
                        <div className="w-8 h-8 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Award className="w-3.5 h-3.5 text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{c.name}</p>
                          <p className="text-xs text-muted-foreground">{c.organization}</p>
                          {c.date_issued && <p className="text-xs text-muted-foreground/60">{c.date_issued}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Experience */}
              {(tutor.current_position || tutor.previous_schools) && (
                <section className="bg-card border border-border rounded-2xl p-5">
                  <h2 className="font-display font-bold text-base mb-4 flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-primary" /> Experience
                  </h2>
                  <div className="space-y-3">
                    {tutor.current_position && (
                      <div className="flex gap-3">
                        <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Current</p>
                          <p className="text-sm font-medium mt-0.5">{tutor.current_position}</p>
                        </div>
                      </div>
                    )}
                    {tutor.previous_schools && (
                      <div className="flex gap-3">
                        <div className="w-2 h-2 rounded-full bg-muted-foreground/30 mt-2 flex-shrink-0" />
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Previous</p>
                          <p className="text-sm text-muted-foreground mt-0.5 whitespace-pre-line">{tutor.previous_schools}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* Contact */}
              {(tutor.email || tutor.phone || tutor.whatsapp) && (
                <section className="bg-card border border-border rounded-2xl p-5">
                  <h2 className="font-display font-bold text-base mb-4 flex items-center gap-2">
                    <Mail className="w-4 h-4 text-primary" /> Contact
                  </h2>
                  <div className="space-y-2">
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
                      <a href={`https://wa.me/${tutor.whatsapp.replace(/\D/g,'')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                        <MessageCircle className="w-4 h-4 text-primary/50 flex-shrink-0" /> {tutor.whatsapp}
                      </a>
                    )}
                  </div>
                </section>
              )}

            </div>{/* end right sidebar */}
          </div>
        </div>

      </div>
    </>
  );
}
