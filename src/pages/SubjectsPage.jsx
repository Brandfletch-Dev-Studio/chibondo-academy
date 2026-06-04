import React, { useState } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { BookOpen, Lock, ChevronRight, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';

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
      <div>
        <h1 className="text-2xl font-display font-bold">Subjects</h1>
        <p className="text-muted-foreground text-sm mt-1">Browse and enroll in subjects for your form</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search subjects..." 
            className="pl-9 h-9" 
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Tabs value={selectedForm} onValueChange={setSelectedForm}>
          <TabsList className="bg-muted">
            <TabsTrigger value="all">All Forms</TabsTrigger>
            {forms.map(f => (
              <TabsTrigger key={f.id} value={f.id}>{f.name}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
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
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSubjects.map(subject => {
            const enrollment = enrollmentMap[subject.id];
            const isPremium = subject.is_premium;
            const isEnrolled = !!enrollment;

            return (
              <Link 
                key={subject.id}
                to={`/subjects/${subject.id}`}
                className="bg-card rounded-xl border border-border p-5 hover:border-primary/30 hover:shadow-md transition-all group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex items-center gap-2">
                    {isPremium && (
                      <Badge variant="secondary" className="text-[10px] bg-accent/10 text-accent border-accent/20">
                        <Lock className="w-2.5 h-2.5 mr-1" />Premium
                      </Badge>
                    )}
                    {isEnrolled && (
                      <Badge className="text-[10px] bg-success/10 text-success border-success/20">Enrolled</Badge>
                    )}
                  </div>
                </div>
                
                <h3 className="font-semibold text-sm group-hover:text-primary transition-colors">
                  {subject.name}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">{subject.form_name}</p>
                {subject.description && (
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{subject.description}</p>
                )}
                
                <div className="flex items-center justify-between mt-4">
                  <div className="text-xs text-muted-foreground">
                    {subject.total_topics || 0} topics · {subject.total_lessons || 0} lessons
                  </div>
                  {isEnrolled && (
                    <div className="flex items-center gap-2">
                      <Progress value={enrollment.progress_percentage || 0} className="w-12 h-1.5" />
                      <span className="text-xs font-medium text-primary">{enrollment.progress_percentage || 0}%</span>
                    </div>
                  )}
                </div>
                
                <div className="flex items-center text-primary text-xs font-medium mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  {isEnrolled ? 'Continue Learning' : 'View Subject'} <ChevronRight className="w-3 h-3 ml-1" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}