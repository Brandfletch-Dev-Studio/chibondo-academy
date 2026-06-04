import React from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { BookOpen, Users, ClipboardList, BarChart3, Plus, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function TeacherDashboard() {
  const { user } = useOutletContext();

  const { data: subjects = [] } = useQuery({
    queryKey: ['teacherSubjects', user?.id],
    queryFn: () => base44.entities.Subject.filter({ teacher_id: user.id }, 'order', 50),
    enabled: !!user?.id,
  });

  const subjectIds = subjects.map(s => s.id);

  const { data: enrollments = [] } = useQuery({
    queryKey: ['teacherEnrollments', subjectIds],
    queryFn: async () => {
      if (subjectIds.length === 0) return [];
      const allEnrollments = [];
      for (const sid of subjectIds) {
        const e = await base44.entities.Enrollment.filter({ subject_id: sid }, '-created_date', 100);
        allEnrollments.push(...e);
      }
      return allEnrollments;
    },
    enabled: subjectIds.length > 0,
  });

  const stats = [
    { label: 'My Subjects', value: subjects.length, icon: BookOpen, color: 'bg-primary/10 text-primary' },
    { label: 'Students Enrolled', value: enrollments.length, icon: Users, color: 'bg-accent/10 text-accent' },
    { label: 'Published', value: subjects.filter(s => s.status === 'published').length, icon: ClipboardList, color: 'bg-success/10 text-success' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Teacher Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Welcome back, {user?.full_name?.split(' ')[0]}</p>
        </div>
        <Link to="/teacher/courses">
          <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Manage Courses</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${stat.color}`}>
                  <stat.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold font-display">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-display">My Subjects</CardTitle>
            <Link to="/teacher/courses" className="text-sm text-primary flex items-center gap-1 hover:underline">
              View All <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {subjects.map(s => {
              const subEnrollments = enrollments.filter(e => e.subject_id === s.id);
              return (
                <Link key={s.id} to={`/teacher/courses/${s.id}`} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{s.name}</p>
                    <p className="text-xs text-muted-foreground">{s.form_name}</p>
                  </div>
                  <div className="text-right">
                    <Badge variant="secondary" className="text-[10px]">{s.status}</Badge>
                    <p className="text-xs text-muted-foreground mt-1">{subEnrollments.length} students</p>
                  </div>
                </Link>
              );
            })}
            {subjects.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-6">No subjects assigned. Ask an admin to assign you.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}