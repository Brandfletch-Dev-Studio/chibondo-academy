import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen, Trophy, Clock, Flame, Target } from 'lucide-react';

export default function ProgressPage() {
  const { user } = useOutletContext();

  const { data: enrollments = [] } = useQuery({
    queryKey: ['enrollments', user?.id],
    queryFn: () => base44.entities.Enrollment.filter({ student_id: user.id }, '-last_accessed', 50),
    enabled: !!user?.id,
  });

  const { data: quizAttempts = [] } = useQuery({
    queryKey: ['myQuizAttempts', user?.id],
    queryFn: () => base44.entities.QuizAttempt.filter({ student_id: user.id, status: 'completed' }, '-created_date', 100),
    enabled: !!user?.id,
  });

  const totalLessonsCompleted = enrollments.reduce((acc, e) => acc + (e.completed_lessons?.length || 0), 0);
  const avgQuizScore = quizAttempts.length > 0 
    ? Math.round(quizAttempts.reduce((a, q) => a + (q.percentage || 0), 0) / quizAttempts.length) 
    : 0;
  const overallProgress = enrollments.length > 0
    ? Math.round(enrollments.reduce((a, e) => a + (e.progress_percentage || 0), 0) / enrollments.length)
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">My Progress</h1>
        <p className="text-sm text-muted-foreground mt-1">Track your learning journey</p>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5 text-center">
            <Target className="w-8 h-8 mx-auto text-primary mb-2" />
            <p className="text-3xl font-bold font-display">{overallProgress}%</p>
            <p className="text-xs text-muted-foreground">Overall Progress</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 text-center">
            <Trophy className="w-8 h-8 mx-auto text-accent mb-2" />
            <p className="text-3xl font-bold font-display">{totalLessonsCompleted}</p>
            <p className="text-xs text-muted-foreground">Lessons Completed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 text-center">
            <Flame className="w-8 h-8 mx-auto text-destructive mb-2" />
            <p className="text-3xl font-bold font-display">{user?.study_streak || 0}</p>
            <p className="text-xs text-muted-foreground">Day Streak</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 text-center">
            <Clock className="w-8 h-8 mx-auto text-success mb-2" />
            <p className="text-3xl font-bold font-display">{avgQuizScore}%</p>
            <p className="text-xs text-muted-foreground">Avg Quiz Score</p>
          </CardContent>
        </Card>
      </div>

      {/* Subject Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-display">Subject Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {enrollments.map(e => (
              <div key={e.id} className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <BookOpen className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-medium text-sm truncate">{e.subject_name}</p>
                    <span className="text-sm font-bold text-primary">{e.progress_percentage || 0}%</span>
                  </div>
                  <Progress value={e.progress_percentage || 0} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-1">
                    {e.completed_lessons?.length || 0} lessons completed · {e.form_name}
                  </p>
                </div>
              </div>
            ))}
            {enrollments.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-8">
                Enroll in subjects to start tracking your progress
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Quiz Performance */}
      {quizAttempts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-display">Recent Quiz Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {quizAttempts.slice(0, 10).map(attempt => (
                <div key={attempt.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold ${
                    attempt.passed ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
                  }`}>
                    {attempt.percentage || 0}%
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Quiz</p>
                    <p className="text-xs text-muted-foreground">
                      {attempt.score}/{attempt.total_points} points
                    </p>
                  </div>
                  <span className={`text-xs font-medium ${attempt.passed ? 'text-success' : 'text-destructive'}`}>
                    {attempt.passed ? 'Passed' : 'Failed'}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}