import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { BookOpen, Clock, Trophy, TrendingUp, Calendar, Award } from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const COLORS = ['hsl(222, 47%, 30%)', 'hsl(43, 74%, 52%)', 'hsl(160, 60%, 45%)', 'hsl(280, 65%, 60%)', 'hsl(340, 75%, 55%)'];

export default function ProgressAnalytics() {
  const { data: user } = useQuery({ queryKey: ['currentUser'], queryFn: () => base44.auth.me() });

  const { data: enrollments = [] } = useQuery({
    queryKey: ['enrollments', user?.id],
    queryFn: () => base44.entities.Enrollment.filter({ student_id: user?.id }),
    enabled: !!user?.id,
  });

  const { data: quizAttempts = [] } = useQuery({
    queryKey: ['quizAttempts', user?.id],
    queryFn: () => base44.entities.QuizAttempt.filter({ student_id: user?.id }, '-created_date', 100),
    enabled: !!user?.id,
  });

  const { data: lessons = [] } = useQuery({
    queryKey: ['lessons'],
    queryFn: () => base44.entities.Lesson.filter({ status: 'published' }),
  });

  // Calculate stats
  const totalLessons = lessons.length;
  const completedLessons = enrollments.reduce((acc, e) => acc + (e.completed_lessons?.length || 0), 0);
  const completionRate = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  const avgQuizScore = quizAttempts.length > 0
    ? Math.round(quizAttempts.reduce((acc, q) => acc + (q.percentage || 0), 0) / quizAttempts.length)
    : 0;

  const totalStudyTime = enrollments.reduce((acc, e) => {
    // Estimate 15 min per lesson
    return acc + (e.completed_lessons?.length || 0) * 15;
  }, 0);

  // Subject progress data
  const subjectData = enrollments.map(e => ({
    name: e.subject_name,
    progress: e.progress_percentage || 0,
    lessons: e.completed_lessons?.length || 0,
  }));

  // Quiz performance over time
  const quizData = quizAttempts.slice(0, 10).reverse().map((q, i) => ({
    attempt: i + 1,
    score: q.percentage || 0,
    date: new Date(q.created_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
  }));

  // Weekly activity (mock - would need activity logs entity)
  const weeklyData = [
    { day: 'Mon', minutes: 45 },
    { day: 'Tue', minutes: 62 },
    { day: 'Wed', minutes: 38 },
    { day: 'Thu', minutes: 75 },
    { day: 'Fri', minutes: 52 },
    { day: 'Sat', minutes: 30 },
    { day: 'Sun', minutes: 20 },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Learning Analytics</h1>
        <p className="text-muted-foreground">Track your progress and performance</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Completion Rate"
          value={`${completionRate}%`}
          icon={Trophy}
          trend="+12% from last month"
        />
        <StatCard
          title="Lessons Completed"
          value={completedLessons}
          icon={BookOpen}
          trend={`of ${totalLessons} total`}
        />
        <StatCard
          title="Study Time"
          value={`${Math.round(totalStudyTime / 60)}h ${totalStudyTime % 60}m`}
          icon={Clock}
          trend="This semester"
        />
        <StatCard
          title="Avg Quiz Score"
          value={`${avgQuizScore}%`}
          icon={Award}
          trend={avgQuizScore >= 70 ? "Excellent!" : "Keep practicing"}
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Subject Progress */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Subject Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            {subjectData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={subjectData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="progress" fill="hsl(222, 47%, 30%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-8">No enrollment data yet</p>
            )}
          </CardContent>
        </Card>

        {/* Quiz Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Quiz Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            {quizData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={quizData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="score" stroke="hsl(43, 74%, 52%)" strokeWidth={2} name="Score %" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-8">No quiz attempts yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Weekly Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Weekly Study Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="minutes" fill="hsl(43, 74%, 52%)" radius={[4, 4, 0, 0]} name="Minutes" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Detailed Progress */}
      <Card>
        <CardHeader>
          <CardTitle>Detailed Subject Progress</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {enrollments.map((enrollment) => (
            <div key={enrollment.id} className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium">{enrollment.subject_name}</span>
                <span className="text-muted-foreground">
                  {enrollment.completed_lessons?.length || 0} / ? lessons
                </span>
              </div>
              <Progress value={enrollment.progress_percentage || 0} className="h-2" />
            </div>
          ))}
          {enrollments.length === 0 && (
            <p className="text-center text-muted-foreground py-4">Not enrolled in any subjects yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, trend }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{trend}</p>
          </div>
          <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'hsl(222 20% 93%)' }}>
            <Icon className="w-6 h-6" style={{ color: 'hsl(222 47% 18%)' }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}