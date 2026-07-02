import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { db } from '@/api/supabaseClient';
import SEO from '@/components/SEO';
import { Search, GraduationCap, BookOpen, Users, Clock, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';

/* ── Tutor card ─────────────────────────────────────────────────────────────── */
function TutorCard({ profile, courseCount, studentCount }) {
  const [coverErr, setCoverErr]   = useState(false);
  const [avatarErr, setAvatarErr] = useState(false);

  // All data comes directly from TutorProfile (publicly readable)
  const name      = profile.full_name            || 'Tutor';
  const photo     = profile.profile_photo        || '';
  const coverPhoto= profile.cover_photo          || '';
  const title     = profile.professional_title   || '';
  const tagline   = profile.tagline              || '';
  const subjects  = profile.subjects             || [];
  const years     = profile.years_teaching       || 0;
  const slug      = profile.slug                 || profile.id;

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
              style={{ background: 'linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--muted)) 100%)' }} />
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--muted)) 100%)' }}>
            <span className="text-5xl font-display font-bold opacity-15 select-none" style={{ color:'hsl(var(--primary-foreground))' }}>{initials}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
        {years > 0 && (
          <div className="absolute top-2.5 right-2.5">
            <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background:'hsl(var(--primary) / 0.15)', color:'hsl(var(--primary))', border:'1px solid hsl(var(--primary))', backdropFilter:'blur(4px)' }}>
              <Clock className="w-2.5 h-2.5" />{years}yr
            </span>
          </div>
        )}
      </div>

      {/* Avatar */}
      <div className="relative px-4 -mt-8 pb-1 flex items-end gap-3">
        <div className="w-16 h-16 rounded-full overflow-hidden border-4 shadow-lg flex-shrink-0"
          style={{ borderColor:'hsl(var(--card))', background:'hsl(var(--muted))' }}>
          {photo && !avatarErr ? (
            <img src={photo} alt={name} loading="eager" decoding="async" onError={() => setAvatarErr(true)}
              className="w-full h-full object-cover object-top" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-xl font-bold select-none" style={{ color:'hsl(var(--primary-foreground))' }}>{initials}</span>
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
          <p className="text-xs mt-0.5 font-medium" style={{ color:'hsl(var(--primary))' }}>{title}</p>
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

  // ── Data fetching ──────────────────────────────────────────────────────────
  // TutorProfile has rls.read={} — fully public, works for logged-out users.
  // We drive the directory from TutorProfile only; no User.filter() needed.
  const { data: tutorProfiles = [], isLoading } = useQuery({
    queryKey: ['all-tutor-profiles-public'],
    queryFn:  () => db.entities.TutorProfile.filter({ status: 'active', is_visible: true }, 'full_name', 200),
    staleTime: 60_000,
  });

  // Published subjects — rls allows public reads on published records.
  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects-all-for-tutors'],
    queryFn:  () => db.entities.Subject.filter({ status: 'published' }, 'name', 500),
    staleTime: 60_000,
  });

  // Course count per tutor (match on tutor_profile_id OR teacher_id === user_id)
  const courseCountByProfile = useMemo(() => {
    const map = {};
    subjects.forEach(s => {
      const key = s.tutor_profile_id || s.teacher_id;
      if (key) map[key] = (map[key] || 0) + 1;
    });
    return map;
  }, [subjects]);

  // Student count per tutor
  const studentCountByProfile = useMemo(() => {
    const map = {};
    subjects.forEach(s => {
      const key = s.tutor_profile_id || s.teacher_id;
      if (key && s.enrollment_count) {
        map[key] = (map[key] || 0) + s.enrollment_count;
      }
    });
    return map;
  }, [subjects]);

  // Search filter across TutorProfile fields directly
  const filtered = useMemo(() => {
    if (!search.trim()) return tutorProfiles;
    const q = search.toLowerCase();
    return tutorProfiles.filter(p =>
      p.full_name?.toLowerCase().includes(q) ||
      p.professional_title?.toLowerCase().includes(q) ||
      p.tagline?.toLowerCase().includes(q) ||
      p.subjects?.some(s => s.toLowerCase().includes(q))
    );
  }, [tutorProfiles, search]);

  // Alias so the count in the hero header still works
  const visibleTeachers = filtered;

  return (
    <>
      <SEO title="Our Tutors | Chibondo Academy" description="Meet the expert tutors at Chibondo Academy" />
      <div className="space-y-5">

        {/* Hero header */}
        <div className="rounded-2xl p-6" style={{ background:'hsl(var(--card))' }}>
          <div className="flex items-center gap-2 mb-2">
            <GraduationCap className="w-5 h-5" style={{ color:'hsl(var(--primary-foreground))' }} />
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
              className="pl-9 bg-card text-foreground border-0 shadow-sm"
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
            {filtered.map(p => (
              <TutorCard
                key={p.id}
                profile={p}
                courseCount={courseCountByProfile[p.id] || courseCountByProfile[p.user_id] || 0}
                studentCount={studentCountByProfile[p.id] || studentCountByProfile[p.user_id] || 0}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
