import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import SEO from '@/components/SEO';
import { Search, GraduationCap, BookOpen, Users, Clock, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';

/* ── Tutor card ─────────────────────────────────────────────────────────────── */
function TutorCard({ teacher, tutorProfile, courseCount, studentCount }) {
  const [coverErr, setCoverErr]   = useState(false);
  const [avatarErr, setAvatarErr] = useState(false);

  // Prefer TutorProfile fields, fall back to User fields
  const name      = tutorProfile?.full_name      || teacher.full_name  || teacher.email || 'Tutor';
  const photo     = tutorProfile?.profile_photo  || teacher.avatar_url || '';
  const coverPhoto= tutorProfile?.cover_photo    || '';
  const title     = tutorProfile?.professional_title || '';
  const tagline   = tutorProfile?.tagline        || '';
  const subjects  = tutorProfile?.subjects       || [];
  const years     = tutorProfile?.years_teaching || 0;
  const slug      = tutorProfile?.slug           || teacher.id;

  const initials  = name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();

  return (
    <Link
      to={`/tutors/${slug}`}
      className="bg-card border border-border rounded-2xl overflow-hidden hover:border-primary/40 hover:shadow-xl transition-all duration-200 group flex flex-col"
    >
      {/* Cover banner */}
      <div className="relative h-28 w-full flex-shrink-0 overflow-hidden">
        {coverPhoto && !coverErr ? (
          <img src={coverPhoto} alt="Cover" loading="eager" decoding="async"
            onError={() => setCoverErr(true)}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : photo && !avatarErr ? (
          <div className="relative w-full h-full overflow-hidden">
            <img src={photo} alt="" loading="eager" decoding="async" onError={() => setAvatarErr(true)}
              className="w-full h-full object-cover scale-150 blur-2xl opacity-50 saturate-150" />
            <div className="absolute inset-0"
              style={{ background: 'linear-gradient(135deg, hsl(222 47% 14% / 0.75), hsl(43 74% 40% / 0.25))' }} />
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, hsl(222 47% 14%) 0%, hsl(222 47% 20%) 60%, hsl(43 74% 30% / 0.4) 100%)' }}>
            <span className="text-5xl font-display font-bold opacity-15 select-none" style={{ color:'hsl(43 74% 66%)' }}>{initials}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
        {years > 0 && (
          <div className="absolute top-2.5 right-2.5">
            <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background:'hsl(43 74% 52% / 0.15)', color:'hsl(43 60% 38%)', border:'1px solid hsl(43 74% 52% / 0.3)', backdropFilter:'blur(4px)' }}>
              <Clock className="w-2.5 h-2.5" />{years}yr
            </span>
          </div>
        )}
      </div>

      {/* Avatar */}
      <div className="relative px-4 -mt-8 pb-1 flex items-end gap-3">
        <div className="w-16 h-16 rounded-full overflow-hidden border-4 shadow-lg flex-shrink-0"
          style={{ borderColor:'hsl(var(--card))', background:'hsl(222 47% 18%)' }}>
          {photo && !avatarErr ? (
            <img src={photo} alt={name} loading="eager" decoding="async" onError={() => setAvatarErr(true)}
              className="w-full h-full object-cover object-top" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-xl font-bold select-none" style={{ color:'hsl(43 74% 66%)' }}>{initials}</span>
            </div>
          )}
        </div>
      </div>

      {/* Identity */}
      <div className="px-4 pb-4 flex flex-col flex-1">
        <p className="font-display font-bold text-sm leading-snug group-hover:text-accent transition-colors line-clamp-1">
          {name}
        </p>
        {title && (
          <p className="text-xs mt-0.5 font-medium" style={{ color:'hsl(43 74% 52%)' }}>{title}</p>
        )}
        {tagline && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">"{tagline}"</p>
        )}
        {subjects.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {subjects.slice(0,3).map(s => (
              <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{s}</span>
            ))}
          </div>
        )}
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
  const [search, setSearch] = useState('');

  /* All published subjects — used to count courses + students per teacher */
  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects-all-for-tutors'],
    queryFn:  () => base44.entities.Subject.filter({ status: 'published' }, 'name', 500),
    staleTime: 60_000,
  });

  /* All tutor profiles — used for rich profile data + visibility toggle */
  const { data: tutorProfiles = [] } = useQuery({
    queryKey: ['all-tutor-profiles'],
    queryFn:  () => base44.entities.TutorProfile.filter({ status: 'active' }, 'full_name', 200),
    staleTime: 30_000,
  });

  /* All teachers (users with role=teacher) — source of truth for directory */
  const { data: teachers = [], isLoading } = useQuery({
    queryKey: ['all-teachers'],
    queryFn:  () => base44.entities.User.filter({ role: 'teacher' }, 'full_name', 200),
    staleTime: 30_000,
  });

  /* Map: user_id → TutorProfile */
  const profileByUserId = useMemo(() => {
    const map = {};
    tutorProfiles.forEach(p => { if (p.user_id) map[p.user_id] = p; });
    return map;
  }, [tutorProfiles]);

  /* Course count per teacher (by teacher_id on subject) */
  const courseCountByTeacher = useMemo(() => {
    const map = {};
    subjects.forEach(s => {
      if (s.teacher_id) map[s.teacher_id] = (map[s.teacher_id] || 0) + 1;
    });
    return map;
  }, [subjects]);

  /* Student count per teacher (sum of enrollment_count on their subjects) */
  const studentCountByTeacher = useMemo(() => {
    const map = {};
    subjects.forEach(s => {
      if (s.teacher_id && s.enrollment_count) {
        map[s.teacher_id] = (map[s.teacher_id] || 0) + s.enrollment_count;
      }
    });
    return map;
  }, [subjects]);

  /* Filter out teachers who have is_visible=false on their TutorProfile */
  const visibleTeachers = useMemo(() =>
    teachers.filter(t => {
      const profile = profileByUserId[t.id];
      // If no profile exists, show by default; if profile exists, respect is_visible
      if (!profile) return true;
      return profile.is_visible !== false;
    }),
  [teachers, profileByUserId]);

  /* Search filter */
  const filtered = useMemo(() => {
    if (!search.trim()) return visibleTeachers;
    const q = search.toLowerCase();
    return visibleTeachers.filter(t => {
      const p = profileByUserId[t.id];
      return (
        t.full_name?.toLowerCase().includes(q) ||
        t.email?.toLowerCase().includes(q) ||
        p?.professional_title?.toLowerCase().includes(q) ||
        p?.subjects?.some(s => s.toLowerCase().includes(q))
      );
    });
  }, [visibleTeachers, search, profileByUserId]);

  return (
    <>
      <SEO title="Our Tutors | Chibondo Academy" description="Meet the expert tutors at Chibondo Academy" />
      <div className="space-y-5">

        {/* Hero header */}
        <div className="rounded-2xl p-6" style={{ background:'hsl(222 47% 14%)' }}>
          <div className="flex items-center gap-2 mb-2">
            <GraduationCap className="w-5 h-5" style={{ color:'hsl(43 74% 66%)' }} />
            <span className="text-sm font-medium" style={{ color:'hsl(43 74% 66% / 0.8)' }}>Chibondo Academy</span>
          </div>
          <h1 className="text-2xl font-display font-bold mb-1" style={{ color:'hsl(43 20% 94%)' }}>Our Tutors</h1>
          <p className="text-sm mb-4" style={{ color:'hsl(43 20% 65%)' }}>
            {visibleTeachers.length} expert {visibleTeachers.length === 1 ? 'tutor' : 'tutors'} ready to help you excel
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
                teacher={t}
                tutorProfile={profileByUserId[t.id] || null}
                courseCount={courseCountByTeacher[t.id] || 0}
                studentCount={studentCountByTeacher[t.id] || 0}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
