import React from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { BookOpen, Settings, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default function TeacherCourses() {
  const { user } = useOutletContext();

  const { data: subjects = [] } = useQuery({
    queryKey: ['teacherSubjects', user?.id],
    queryFn: () => base44.entities.Subject.filter({ teacher_id: user.id }, 'order', 50),
    enabled: !!user?.id,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">My Courses</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your assigned subjects</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {subjects.map(s => (
          <div key={s.id} className="bg-card rounded-xl border border-border p-5 hover:border-primary/30 transition-all">
            <div className="flex items-start justify-between mb-3">
              <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-primary" />
              </div>
              <Badge variant="secondary" className="text-[10px]">{s.status}</Badge>
            </div>
            <h3 className="font-semibold text-sm">{s.name}</h3>
            <p className="text-xs text-muted-foreground mt-1">{s.form_name}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.total_topics || 0} topics · {s.total_lessons || 0} lessons</p>
            <div className="mt-4">
              <Link to={`/teacher/courses/${s.id}`}>
                <Button size="sm" className="w-full"><Settings className="w-3.5 h-3.5 mr-1" /> Course Builder</Button>
              </Link>
            </div>
          </div>
        ))}
        {subjects.length === 0 && (
          <div className="col-span-full text-center py-16 text-muted-foreground">
            <BookOpen className="w-16 h-16 mx-auto opacity-20 mb-4" />
            <p>No subjects assigned yet</p>
            <p className="text-xs mt-1">Ask an admin to assign subjects to you</p>
          </div>
        )}
      </div>
    </div>
  );
}