import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import SEO from '@/components/SEO';
import { Search, GraduationCap, BookOpen, Users, Clock, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';

/* ── Tutor card with cover + avatar overlap ─────────────────────────────────── */
function TutorCard({ tutor, courseCount, studentCount = 0 }) {
  const [coverErr, setCoverErr] = useState(false);
  const [avatarErr, setAvatarErr] = useState(false);
  const initials = (tutor.full_name || '?').split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
  return (
    <Link
      to={`/tutors/${tutor.slug}`}
      className="bg-card border border-border rounded-2xl overflow-hidden hover:border-primary/40 hover:shadow-xl transition-all duration-200 group flex flex-col"
    >
      {/* Cover photo / gradient banner */}
      <div className="relative h-28 w-full flex-shrink-0 overflow-hidden">
        {tutor.cover_photo && !coverErr ? (
          <img
            src={tutor.cover_photo}
            alt="Cover"
            loading="eager"
            decoding="async"
            onError={() => setCoverErr(true)}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : tutor.profile_photo && !avatarErr ? (
          <div className="relative w-full h-full overflow-hidden">
            <img src={tutor.profile_photo} alt="" loading="eager" decoding="async"
              onError={() => setAvatarErr(true)}
              className="w-full h-full object-cover scale-150 blur-2xl opacity-50 saturate-150" />
            <div className="absolute inset-0"
              style={{ background:'linear-gradient(135deg, hsl(222 47% 14% / 0.75), hsl(43 74% 40% / 0.25))' }} />
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center"
            style={{ background:'linear-gradient(135deg, hsl(222 47% 14%) 0%, hsl(222 47% 20%) 60%, hsl(43 74% 30% / 0.4) 100%)' }}>
            <span className="text-5xl font-display font-bold opacity-15 select-none" style={{ color:'hsl(43 74% 66%)' }}>{initials}</span>
          </div>
        )}
        {/* Fade to card bottom */}
        <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />

        {/* Years badge */}
        {tutor.years_teaching > 0 && (
          <div className="absolute top-2.5 right-2.5">
            <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background:'hsl(43 74% 52% / 0.15)', color:'hsl(43 60% 38%)', border:'1px solid hsl(43 74% 52% / 0.3)', backdropFilter:'blur(4px)' }}>
              <Clock className="w-2.5 h-2.5" />{tutor.years_teaching}yr
            </span>
          </div>
        )}
      </div>

      {/* Avatar — overlaps cover */}
      <div className="relative px-4 -mt-8 pb-1 flex items-end gap-3">
        <div className="w-16 h-16 rounded-full overflow-hidden border-4 shadow-lg flex-shrink-0"
          style={{ borderColor:'hsl(var(--card))', background:'hsl(222 47% 18%)' }}>
          {tutor.profile_photo && !avatarErr ? (
            <img
              src={tutor.profile_photo}
              alt={tutor.full_name}
              loading="eager"
              decoding="async"
              onError={() => setAvatarErr(true)}
              className="w-full h-full object-cover object-top"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-xl font-bold select-none" style={{ color:'hsl(43 74% 66%)' }}>
                {initials}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Identity + meta */}
      <div className="px-4 pb-4 flex flex-col flex-1">
        <p className="font-display font-bold text-sm leading-snug group-hover:text-accent transition-colors line-clamp-1">
          {tutor.full_name}
        </p>
        {tutor.professional_title && (
          <p className="text-xs mt-0.5 font-medium" style={{ color:'hsl(43 74% 52%)' }}>
            {tutor.professional_title}
          </p>
        )}
        {tutor.tagline && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
            {tutor.tagline}
          </p>
        )}

        {/* Subjects tags */}
        {tutor.subjects?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {tutor.subjects.slice(0,3).map(s => (
              <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{s}</span>
            ))}
          </div>
        )}

        {/* Stats row */}
        <div className="flex items-center gap-3 mt-auto pt-3 border-t border-border/50">
          {courseCount > 0 && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <BookOpen className="w-3 h-3" />{courseCount} {courseCount === 1 ? 'course' : 'courses'}
            </span>
          )}
          {studentCount > 0 && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="w-3 h-3" />{studentCount.toLocaleString()} {studentCount === 1 ? 'student' : 'students'}
            </span>
          )}
          <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-accent transition-colors ml-auto" />
        </div>
      </div>
    </Link>
  );
}

/* ── Main ───────────────────────────────────────────────────────────────────── */
export default function TutorsPage() {
  const { user } = useOutletContext();
  const [search, setSearch] = useState('');

  const { data: tutors = [], isLoading } = useQuery({
    queryKey: ['tutors'],
    queryFn: () => base44.entities.TutorProfile.filter({ status: 'active', is_visible: true }, 'full_name', 100),
    staleTime: 120_000,
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects-for-tutors'],
    queryFn: () => base44.entities.Subject.filter({ status: 'published' }, 'name', 200),
    staleTime: 120_000,
  });

  const { data: allEnrollments = [] } = useQuery({
    queryKey: ['all-enrollments-for-tutors'],
    queryFn: () => base44.entities.Enrollment.filter({}, '-created_date', 1000),
    staleTime: 60_000,
  });

  const courseCountByTutor = useMemo(() => {
    const map = {};
    subjects.forEach(s => {
      if (s.tutor_profile_id) map[s.tutor_profile_id] = (map[s.tutor_profile_id] || 0) + 1;
    });
    return map;
  }, [subjects]);

  const studentCountByTutor = useMemo(() => {
    const subjectToTutor = {};
    subjects.forEach(s => { if (s.tutor_profile_id) subjectToTutor[s.id] = s.tutor_profile_id; });
    const map = {};
    allEnrollments.forEach(e => {
      const tid = subjectToTutor[e.subject_id];
      if (tid) {
        if (!map[tid]) map[tid] = new Set();
        map[tid].add(e.student_id);
      }
    });
    const counts = {};
    Object.entries(map).forEach(([tid, set]) => { counts[tid] = set.size; });
    return counts;
  }, [subjects, allEnrollments]);

  const filtered = useMemo(() =>
    !search ? tutors : tutors.filter(t =>
      t.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      t.professional_title?.toLowerCase().includes(search.toLowerCase()) ||
      t.subjects?.some(s => s.toLowerCase().includes(search.toLowerCase()))
    ), [tutors, search]);

  return (
    <>
      <SEO
        title="Our Tutors — Chibondo Academy"
        description="Meet the expert tutors at Chibondo Academy. Qualified MSCE teachers for Biology, Chemistry, Physics, Mathematics, English and more."
        canonical={`${window.location.origin}/tutors`}
        schema={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          "name": "Chibondo Academy Tutors",
          "description": "Expert MSCE tutors at The Chibondo Academy",
          "url": `${window.location.origin}/tutors`
        }}
      />
      <div className="space-y-5">

        {/* Hero header */}
        <div className="rounded-2xl p-6" style={{ background:'hsl(222 47% 14%)' }}>
          <div className="flex items-center gap-2 mb-2">
            <GraduationCap className="w-5 h-5" style={{ color:'hsl(43 74% 66%)' }} />
            <span className="text-sm font-medium" style={{ color:'hsl(43 74% 66% / 0.8)' }}>Chibondo Academy</span>
          </div>
          <h1 className="text-2xl font-display font-bold mb-1" style={{ color:'hsl(43 20% 94%)' }}>Our Tutors</h1>
          <p className="text-sm mb-4" style={{ color:'hsl(43 20% 65%)' }}>
            {tutors.length} expert tutors ready to help you excel
          </p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search tutors or subjects…"
              className="pl-9 bg-white text-foreground border-0 shadow-sm"
            />
          </div>
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3,4,5,6].map(i => <div key={i} className="h-72 bg-card rounded-2xl border border-border animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 space-y-2">
            <GraduationCap className="w-12 h-12 mx-auto text-muted-foreground/20" />
            <p className="font-semibold text-muted-foreground">No tutors found</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(t => (
              <TutorCard
                key={t.id}
                tutor={t}
                courseCount={courseCountByTutor[t.id] || 0}
                studentCount={studentCountByTutor[t.id] || 0}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
