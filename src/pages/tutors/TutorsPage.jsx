import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import SEO from '@/components/SEO';
import { Search, GraduationCap, BookOpen, ChevronRight, Clock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

const ALL_SUBJECTS = [
  'Biology','Chemistry','Physics','Mathematics','Additional Mathematics',
  'English Language','English Literature','Chichewa','Agriculture','Geography','History'
];

function TutorCard({ tutor, courseCount }) {
  return (
    <Link
      to={`/tutors/${tutor.slug}`}
      className="bg-card border border-border rounded-2xl overflow-hidden hover:border-primary/40 hover:shadow-xl transition-all duration-200 group flex flex-col"
    >
      {/* Photo */}
      <div className="relative h-44 w-full bg-gradient-to-br from-primary/20 to-accent/10 flex-shrink-0 overflow-hidden">
        {tutor.profile_photo ? (
          <img src={tutor.profile_photo} alt={tutor.full_name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center">
              <span className="text-3xl font-bold text-primary">{tutor.full_name?.[0]}</span>
            </div>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
        {tutor.years_teaching > 0 && (
          <div className="absolute top-3 right-3">
            <span className="flex items-center gap-1 text-[10px] text-white/90 font-medium bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded-full">
              <Clock className="w-2.5 h-2.5" />{tutor.years_teaching}+ yrs
            </span>
          </div>
        )}
        {/* Name over image */}
        <div className="absolute bottom-3 left-3 right-3">
          <p className="font-display font-bold text-white text-base leading-tight drop-shadow">{tutor.full_name}</p>
          {tutor.professional_title && (
            <p className="text-xs text-white/80 mt-0.5 drop-shadow">{tutor.professional_title}</p>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="p-4 flex flex-col flex-1 gap-3">
        {tutor.tagline && (
          <p className="text-xs text-muted-foreground italic leading-snug">"{tutor.tagline}"</p>
        )}

        {tutor.subjects?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tutor.subjects.slice(0, 3).map(s => (
              <Badge key={s} variant="outline" className="text-[10px] py-0 px-2 border-primary/30 text-primary/80">{s}</Badge>
            ))}
            {tutor.subjects.length > 3 && (
              <Badge variant="outline" className="text-[10px] py-0 px-2 text-muted-foreground">+{tutor.subjects.length - 3} more</Badge>
            )}
          </div>
        )}

        <div className="flex items-center justify-between mt-auto pt-2 border-t border-border/50">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <BookOpen className="w-3.5 h-3.5" />{courseCount} {courseCount === 1 ? 'course' : 'courses'}
          </span>
          <span className="flex items-center gap-1 text-xs text-primary font-medium group-hover:gap-2 transition-all">
            View Profile <ChevronRight className="w-3.5 h-3.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function TutorsPage() {
  const [search, setSearch] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('all');

  const { data: tutors = [], isLoading } = useQuery({
    queryKey: ['tutors-list'],
    queryFn: () => base44.entities.TutorProfile.filter({ status: 'active', is_visible: true }, 'full_name', 200),
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects-for-tutors'],
    queryFn: () => base44.entities.Subject.filter({ status: 'published' }, 'name', 200),
  });

  const courseCountByTutor = useMemo(() => {
    const map = {};
    subjects.forEach(s => {
      if (s.tutor_profile_id) map[s.tutor_profile_id] = (map[s.tutor_profile_id] || 0) + 1;
    });
    return map;
  }, [subjects]);

  const filtered = useMemo(() => tutors.filter(t => {
    const matchSearch = !search ||
      t.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      t.subjects?.some(s => s.toLowerCase().includes(search.toLowerCase())) ||
      t.professional_title?.toLowerCase().includes(search.toLowerCase());
    const matchSubject = selectedSubject === 'all' || t.subjects?.includes(selectedSubject);
    return matchSearch && matchSubject;
  }), [tutors, search, selectedSubject]);

  const activeSubjects = ALL_SUBJECTS.filter(s => tutors.some(t => t.subjects?.includes(s)));

  return (
    <>
      <SEO title="Our Tutors" description="Browse Chibondo Academy's expert tutors" />
      <div className="space-y-6">
        {/* Hero header */}
        <div className="bg-gradient-to-br from-primary to-primary/80 rounded-2xl p-6 text-primary-foreground">
          <div className="flex items-center gap-2 mb-2">
            <GraduationCap className="w-5 h-5 opacity-80" />
            <span className="text-sm font-medium opacity-80">Expert Educators</span>
          </div>
          <h1 className="text-2xl font-display font-bold mb-1">Our Tutors</h1>
          <p className="text-primary-foreground/70 text-sm">
            {tutors.length} qualified tutor{tutors.length !== 1 ? 's' : ''} ready to help you succeed in your MSCE
          </p>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or subject..."
              className="pl-9 h-10 bg-white text-foreground border-0 shadow-sm"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Subject filters */}
        {activeSubjects.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mt-2">
            {['all', ...activeSubjects].map(s => (
              <button
                key={s}
                onClick={() => setSelectedSubject(s)}
                className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                  selectedSubject === s
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground'
                }`}
              >
                {s === 'all' ? `All Tutors (${tutors.length})` : s}
              </button>
            ))}
          </div>
        )}

        {/* Grid */}
        {isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="bg-card rounded-2xl border border-border overflow-hidden animate-pulse">
                <div className="h-44 bg-muted" />
                <div className="p-4 space-y-3">
                  <div className="h-3 bg-muted rounded w-2/3" />
                  <div className="h-8 bg-muted rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <GraduationCap className="w-16 h-16 mx-auto text-muted-foreground/20 mb-4" />
            <p className="font-semibold text-muted-foreground">No tutors found</p>
            <p className="text-sm text-muted-foreground/60 mt-1">
              {search ? 'Try a different search term' : 'No tutors are listed yet'}
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map(tutor => (
              <TutorCard key={tutor.id} tutor={tutor} courseCount={courseCountByTutor[tutor.id] || 0} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
