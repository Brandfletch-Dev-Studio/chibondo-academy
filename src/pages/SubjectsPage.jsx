import React, { useState } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { BookOpen, Lock, ChevronRight, Search, Users, Calendar } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { format } from 'date-fns';
import SEO from '@/components/SEO';

export default function SubjectsPage() {
  const { user } = useOutletContext();
  const [selectedForm, setSelectedForm] = useState('all');
  const [search, setSearch] = useState('');

  const { data: forms = [] } = useQuery({
    queryKey: ['forms'],
    queryFn: () => base44.entities.AcademicForm.filter({ status: 'active' }, 'order', 50),
  });

  const { data: subjects = [], isLoading } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => base44.entities.Subject.filter({ status: 'published' }, 'order', 100),
  });

  const { data: enrollments = [] } = useQuery({
    queryKey: ['myEnrollments', user?.id],
    queryFn: () => base44.entities.Enrollment.filter({ student_id: user.id }, '-created_date', 100),
    enabled: !!user?.id,
  });

  const enrollmentMap = {};
  enrollments.forEach(e => { enrollmentMap[e.subject_id] = e; });

  const filteredSubjects = subjects.filter(s => {
    const matchForm = selectedForm === 'all' || s.form_id === selectedForm;
    const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase());
    return matchForm && matchSearch;
  });

  return (
    <div className="space-y-6">
      <SEO 
        title="MSCE Subjects - Form 3 & 4 Courses"
        description="Browse quality MSCE subjects for Form 3 and Form 4. Access video lessons, revision materials, quizzes, and assignments at The Chibondo Academy."
        type="website"
      />
      
      <div>
        <h1 className="text-2xl font-display font-bold">Subjects</h1>
        <p className="text-muted-foreground text-sm mt-1">Browse and enroll in subjects for your form</p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search subjects..." 
            className="pl-9 h-9" 
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        {/* Form filter — scrollable on mobile */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {['all', ...forms.map(f => f.id)].map((id) => {
            const label = id === 'all' ? 'All Forms' : forms.find(f => f.id === id)?.name;
            return (
              <button
                key={id}
                onClick={() => setSelectedForm(id)}
                className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                  selectedForm === id
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="bg-card rounded-xl border border-border p-5 animate-pulse">
              <div className="w-12 h-12 bg-muted rounded-lg mb-4" />
              <div className="h-4 bg-muted rounded w-2/3 mb-2" />
              <div className="h-3 bg-muted rounded w-full" />
            </div>
          ))}
        </div>
      ) : filteredSubjects.length === 0 ? (
        <div className="text-center py-16">
          <BookOpen className="w-16 h-16 mx-auto text-muted-foreground/20 mb-4" />
          <p className="text-muted-foreground">No subjects found</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredSubjects.map(subject => {
            const enrollment = enrollmentMap[subject.id];
            const isPremium = subject.is_premium;
            const isEnrolled = !!enrollment;

            return (
              <Link 
                key={subject.id}
                to={`/subjects/${subject.id}`}
                className="bg-card rounded-2xl border border-border overflow-hidden hover:border-primary/30 hover:shadow-lg transition-all duration-200 group flex flex-col"
              >
                {/* Thumbnail */}
                <div className="relative h-36 w-full overflow-hidden bg-gradient-to-br from-primary/20 to-primary/5">
                  {subject.cover_image ? (
                    <img src={subject.cover_image} alt={subject.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <BookOpen className="w-12 h-12 text-primary/30" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                  {/* Badges overlaid on image */}
                  <div className="absolute top-3 right-3 flex gap-1.5">
                    {isPremium && (
                      <Badge className="text-[10px] bg-accent text-accent-foreground border-0 shadow">
                        <Lock className="w-2.5 h-2.5 mr-1" />Premium
                      </Badge>
                    )}
                    {isEnrolled && (
                      <Badge className="text-[10px] bg-success text-success-foreground border-0 shadow">Enrolled</Badge>
                    )}
                  </div>
                  <div className="absolute bottom-2 left-3">
                    <span className="text-[10px] text-white/80 font-medium bg-black/30 px-2 py-0.5 rounded-full">{subject.form_name}</span>
                  </div>
                </div>

                {/* Content */}
                <div className="p-4 flex flex-col flex-1">
                  <h3 className="font-display font-semibold text-sm leading-snug group-hover:text-primary transition-colors">
                    {subject.name}
                  </h3>
                  {subject.description && (
                    <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">{subject.description}</p>
                  )}

                  {/* Stats row */}
                  <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" />{subject.total_lessons || 0} lessons</span>
                    {subject.updated_date && (
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{format(new Date(subject.updated_date), 'MMM yyyy')}</span>
                    )}
                  </div>

                  {/* Progress if enrolled */}
                  {isEnrolled && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-muted-foreground">Progress</span>
                        <span className="text-xs font-semibold text-primary">{enrollment.progress_percentage || 0}%</span>
                      </div>
                      <Progress value={enrollment.progress_percentage || 0} className="h-1.5" />
                    </div>
                  )}

                  <div className="flex items-center text-primary text-xs font-medium mt-auto pt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    {isEnrolled ? 'Continue Learning' : 'View Subject'} <ChevronRight className="w-3 h-3 ml-1" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}