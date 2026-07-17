import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { db } from '@/api/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { BookOpen, TrendingUp, Clock, Award } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default function StudentProgressTracker() {
  const { data: user } = useQuery({queryKey: ['currentUser'], queryFn: async () => { try { return await db.auth.me(); } catch(e) { console.error(e); return []; } },
    placeholderData: [],});

  const { data: subjects = [] } = useQuery({queryKey: ['teacherSubjects', user?.id],
    queryFn: async () => { try { return await db.entities.Subject.filter({ teacher_id: user?.id }); } catch(e) { console.error(e); return []; } },
    enabled: user?.role === 'teacher' || user?.role === 'admin',
    placeholderData: [],});

  const { data: enrollments = [] } = useQuery({queryKey: ['subjectEnrollments'],
    queryFn: async () => { try { const subjectIds = subjects.map(s => s.id);
      const all = await db.entities.Enrollment.filter({});
      return all.filter(e => subjectIds.includes(e.subject_id)); } catch(e) { console.error(e); return []; } },
    enabled: subjects.length > 0,
    placeholderData: [],});

  const { data: studentProfiles = [] } = useQuery({queryKey: ['studentProfiles'],
    queryFn: async () => { try { return await db.entities.User.filter({}); } catch(e) { console.error(e); return []; } },
    placeholderData: [],});

  const getStudentName = (studentId) => {
    const profile = studentProfiles.find(p => p.user_id === studentId);
    return profile?.full_name || 'Unknown Student';
  };

  const getStudentForm = (studentId) => {
    const profile = studentProfiles.find(p => p.user_id === studentId);
    return profile?.form || 'N/A';
  };

  // Group by student
  const studentProgress = {};
  enrollments.forEach(enrollment => {
    if (!studentProgress[enrollment.student_id]) {
      studentProgress[enrollment.student_id] = {
        name: getStudentName(enrollment.student_id),
        form: getStudentForm(enrollment.student_id),
        subjects: [],
        avgProgress: 0,
        totalLessons: 0,
      };
    }
    studentProgress[enrollment.student_id].subjects.push({
      subjectName: enrollment.subject_name,
      progress: enrollment.progress_percentage || 0,
      completedLessons: enrollment.completed_lessons?.length || 0,
    });
  });

  // Calculate averages
  Object.values(studentProgress).forEach(student => {
    const total = student.subjects.reduce((sum, s) => sum + s.progress, 0);
    student.avgProgress = Math.round(total / student.subjects.length) || 0;
    student.totalLessons = student.subjects.reduce((sum, s) => sum + s.completedLessons, 0);
  });

  const studentsList = Object.values(studentProgress);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Student Progress</h1>
        <p className="text-muted-foreground mt-1">Track your students' learning journey</p>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{studentsList.length}</p>
                <p className="text-sm text-muted-foreground">Active Students</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {studentsList.length > 0 ? Math.round(studentsList.reduce((s, st) => s + st.avgProgress, 0) / studentsList.length) : 0}%
                </p>
                <p className="text-sm text-muted-foreground">Average Progress</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-success/10 flex items-center justify-center">
                <Award className="w-6 h-6 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {studentsList.reduce((s, st) => s + st.totalLessons, 0)}
                </p>
                <p className="text-sm text-muted-foreground">Lessons Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Student List */}
      <Card>
        <CardHeader>
          <CardTitle>Individual Progress</CardTitle>
        </CardHeader>
        <CardContent>
          {studentsList.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Form</TableHead>
                  <TableHead>Avg Progress</TableHead>
                  <TableHead>Lessons Done</TableHead>
                  <TableHead>Subjects</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {studentsList.map((student) => (
                  <TableRow key={student.name}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="w-8 h-8">
                          <AvatarFallback className="text-xs font-bold">
                            {student.name[0]?.toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{student.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{student.form}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={student.avgProgress} className="h-2 w-24" />
                        <span className="text-sm font-medium">{student.avgProgress}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{student.totalLessons}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {student.subjects.map((s, i) => (
                          <Badge key={i} variant="secondary" className="text-[10px]">
                            {s.subjectName}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No students enrolled in your subjects yet
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}