import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import SEO from '@/components/SEO';
import {
  GraduationCap, BookOpen, Mail, Phone, Award, Briefcase,
  Facebook, Linkedin, Youtube, Twitter, ArrowLeft, ExternalLink,
  MessageCircle, Clock, ChevronRight
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

function SocialLink({ href, icon: Icon, label }) {
  if (!href) return null;
  const url = href.startsWith('http') ? href : `https://${href}`;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 px-3 py-2 rounded-xl bg-card border border-border hover:border-primary/40 text-sm text-muted-foreground hover:text-foreground transition-colors"
      aria-label={label}
    >
      <Icon className="w-4 h-4" />
      <span className="hidden sm:inline">{label}</span>
    </a>
  );
}

function QualificationCard({ qual }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex gap-3">
      <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
        <GraduationCap className="w-4 h-4 text-primary" />
      </div>
      <div>
        <p className="font-semibold text-sm">{qual.name}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{qual.institution}</p>
        {qual.year && <p className="text-xs text-primary/70 mt-0.5">{qual.year}</p>}
      </div>
    </div>
  );
}

function CertCard({ cert }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex gap-3">
      <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
        <Award className="w-4 h-4 text-accent-foreground" />
      </div>
      <div>
        <p className="font-semibold text-sm">{cert.name}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{cert.organization}</p>
        {cert.date_issued && <p className="text-xs text-muted-foreground/60 mt-0.5">{cert.date_issued}</p>}
      </div>
    </div>
  );
}

function SubjectCourseCard({ subject }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex gap-3 items-center hover:border-primary/40 transition-colors">
      <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-primary/10 flex-shrink-0">
        {subject.cover_image ? (
          <img src={subject.cover_image} alt={subject.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <BookOpen className="w-6 h-6 text-primary/30" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate">{subject.name}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{subject.form_name}</p>
        {subject.total_lessons > 0 && (
          <p className="text-xs text-primary/70 mt-0.5">{subject.total_lessons} lessons</p>
        )}
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
    </div>
  );
}

export default function TutorProfilePage() {
  const { slug } = useParams();

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

  if (!tutor) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'hsl(222 47% 8%)' }}>
        <div className="text-center">
          <GraduationCap className="w-16 h-16 mx-auto text-muted-foreground/20 mb-4" />
          <h1 className="text-xl font-display font-bold text-foreground">Tutor Not Found</h1>
          <p className="text-muted-foreground mt-2">This tutor profile doesn't exist or is not public.</p>
          <Link to="/tutors" className="inline-flex items-center gap-2 mt-4 text-sm text-primary hover:underline">
            <ArrowLeft className="w-4 h-4" /> Back to Tutors
          </Link>
        </div>
      </div>
    );
  }

  const seoTitle = `${tutor.full_name} | ${tutor.professional_title || 'Tutor'} | Chibondo Academy`;
  const seoDesc = `Learn from ${tutor.full_name}, ${tutor.professional_title || 'an experienced tutor'} at Chibondo Academy. ${tutor.tagline || ''}`.trim();

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
        {/* Back nav */}
        <div className="max-w-4xl mx-auto px-4 pt-6">
          <Link to="/tutors" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" /> All Tutors
          </Link>
        </div>

        {/* Hero */}
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            {/* Cover / photo area */}
            <div className="h-32 bg-gradient-to-br from-primary/30 to-accent/20 relative">
              <div className="absolute -bottom-12 left-6">
                <div className="w-24 h-24 rounded-2xl border-4 border-card overflow-hidden bg-primary/20 shadow-xl">
                  {tutor.profile_photo ? (
                    <img src={tutor.profile_photo} alt={tutor.full_name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-4xl font-bold text-primary">{tutor.full_name?.[0]}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-16 px-6 pb-6">
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-display font-bold">{tutor.full_name}</h1>
                  {tutor.professional_title && (
                    <p className="text-primary text-sm font-medium mt-0.5">{tutor.professional_title}</p>
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

                {/* CTA */}
                <div className="flex flex-wrap gap-2">
                  <Link
                    to="/login"
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                  >
                    <BookOpen className="w-4 h-4" /> View Courses
                  </Link>
                  {(tutor.whatsapp || tutor.phone || tutor.email) && (
                    <a
                      href={tutor.whatsapp ? `https://wa.me/${tutor.whatsapp.replace(/\D/g,'')}` : tutor.email ? `mailto:${tutor.email}` : `tel:${tutor.phone}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-card text-sm font-medium hover:border-primary/40 transition-colors"
                    >
                      <MessageCircle className="w-4 h-4" /> Contact
                    </a>
                  )}
                </div>
              </div>

              {/* Stats row */}
              <div className="flex flex-wrap gap-4 mt-5 pt-5 border-t border-border">
                {tutor.years_teaching > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="w-4 h-4 text-primary/60" />
                    <span className="font-semibold">{tutor.years_teaching}</span>
                    <span className="text-muted-foreground">yrs teaching</span>
                  </div>
                )}
                {linkedSubjects.length > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <BookOpen className="w-4 h-4 text-primary/60" />
                    <span className="font-semibold">{linkedSubjects.length}</span>
                    <span className="text-muted-foreground">{linkedSubjects.length === 1 ? 'course' : 'courses'}</span>
                  </div>
                )}
                {tutor.subjects?.length > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <GraduationCap className="w-4 h-4 text-primary/60" />
                    <span className="font-semibold">{tutor.subjects.length}</span>
                    <span className="text-muted-foreground">subjects</span>
                  </div>
                )}
              </div>

              {/* Social links */}
              {(tutor.facebook || tutor.linkedin || tutor.youtube || tutor.twitter_x || tutor.tiktok) && (
                <div className="flex flex-wrap gap-2 mt-4">
                  <SocialLink href={tutor.facebook} icon={Facebook} label="Facebook" />
                  <SocialLink href={tutor.linkedin} icon={Linkedin} label="LinkedIn" />
                  <SocialLink href={tutor.youtube} icon={Youtube} label="YouTube" />
                  <SocialLink href={tutor.twitter_x} icon={Twitter} label="X / Twitter" />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 pb-12 space-y-6">
          {/* Biography */}
          {tutor.biography && (
            <section className="bg-card border border-border rounded-2xl p-6">
              <h2 className="font-display font-bold text-lg mb-4">About</h2>
              <div
                className="prose prose-sm prose-invert max-w-none text-muted-foreground leading-relaxed"
                dangerouslySetInnerHTML={{ __html: tutor.biography }}
              />
            </section>
          )}

          {/* Qualifications */}
          {tutor.qualifications?.length > 0 && (
            <section className="bg-card border border-border rounded-2xl p-6">
              <h2 className="font-display font-bold text-lg mb-4 flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-primary" /> Qualifications
              </h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {tutor.qualifications.map((q, i) => <QualificationCard key={i} qual={q} />)}
              </div>
            </section>
          )}

          {/* Certifications */}
          {tutor.certifications?.length > 0 && (
            <section className="bg-card border border-border rounded-2xl p-6">
              <h2 className="font-display font-bold text-lg mb-4 flex items-center gap-2">
                <Award className="w-5 h-5 text-primary" /> Certifications
              </h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {tutor.certifications.map((c, i) => <CertCard key={i} cert={c} />)}
              </div>
            </section>
          )}

          {/* Experience */}
          {(tutor.current_position || tutor.previous_schools) && (
            <section className="bg-card border border-border rounded-2xl p-6">
              <h2 className="font-display font-bold text-lg mb-4 flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-primary" /> Experience
              </h2>
              <div className="space-y-3">
                {tutor.current_position && (
                  <div className="flex gap-3">
                    <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Current Position</p>
                      <p className="text-sm font-medium mt-0.5">{tutor.current_position}</p>
                    </div>
                  </div>
                )}
                {tutor.previous_schools && (
                  <div className="flex gap-3">
                    <div className="w-2 h-2 rounded-full bg-muted-foreground/40 mt-1.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Previous Institutions</p>
                      <p className="text-sm text-muted-foreground mt-0.5">{tutor.previous_schools}</p>
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Courses */}
          {linkedSubjects.length > 0 && (
            <section className="bg-card border border-border rounded-2xl p-6">
              <h2 className="font-display font-bold text-lg mb-4 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-primary" /> Courses by {tutor.full_name}
              </h2>
              <div className="space-y-3">
                {linkedSubjects.map(s => <SubjectCourseCard key={s.id} subject={s} />)}
              </div>
              <div className="mt-4 text-center">
                <Link to="/login" className="text-sm text-primary hover:underline">
                  Sign in to enroll in these courses →
                </Link>
              </div>
            </section>
          )}

          {/* Contact */}
          {(tutor.email || tutor.phone || tutor.whatsapp) && (
            <section className="bg-card border border-border rounded-2xl p-6">
              <h2 className="font-display font-bold text-lg mb-4 flex items-center gap-2">
                <Mail className="w-5 h-5 text-primary" /> Contact
              </h2>
              <div className="space-y-2">
                {tutor.email && (
                  <a href={`mailto:${tutor.email}`} className="flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground transition-colors">
                    <Mail className="w-4 h-4 text-primary/60" /> {tutor.email}
                  </a>
                )}
                {tutor.phone && (
                  <a href={`tel:${tutor.phone}`} className="flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground transition-colors">
                    <Phone className="w-4 h-4 text-primary/60" /> {tutor.phone}
                  </a>
                )}
                {tutor.whatsapp && (
                  <a href={`https://wa.me/${tutor.whatsapp.replace(/\D/g,'')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground transition-colors">
                    <MessageCircle className="w-4 h-4 text-primary/60" /> WhatsApp: {tutor.whatsapp}
                  </a>
                )}
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
