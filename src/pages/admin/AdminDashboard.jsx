import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Star, Save, TrendingUp, Users, BookOpen } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminDashboard() {
  const { data: user } = useQuery({ queryKey: ['currentUser'], queryFn: () => base44.auth.me() });
  const queryClient = useQueryClient();

  // Fetch all data
  const { data: subjects = [] } = useQuery({
    queryKey: ['allSubjects'],
    queryFn: () => base44.entities.Subject.filter({}),
  });

  const { data: enrollments = [] } = useQuery({
    queryKey: ['allEnrollments'],
    queryFn: () => base44.entities.Enrollment.filter({}),
  });

  const { data: students = [] } = useQuery({
    queryKey: ['allStudents'],
    queryFn: () => base44.entities.StudentProfile.filter({}),
  });

  const { data: teachers = [] } = useQuery({
    queryKey: ['allTeachers'],
    queryFn: () => base44.entities.User.filter({ role: 'teacher' }),
  });

  const { data: applications = [] } = useQuery({
    queryKey: ['teacherApplications'],
    queryFn: () => base44.entities.TeacherApplication.filter({}),
  });

  const { data: subscriptions = [] } = useQuery({
    queryKey: ['allSubscriptions'],
    queryFn: () => base44.entities.Subscription.filter({}),
  });

  // Calculate stats
  const totalStudents = students.length;
  const totalTeachers = teachers.length;
  const totalSubjects = subjects.length;
  const totalEnrollments = enrollments.length;
  const pendingApplications = applications.filter(a => a.status === 'pending').length;
  const activeSubscriptions = subscriptions.filter(s => s.status === 'active').length;

  const avgProgress = enrollments.length > 0
    ? Math.round(enrollments.reduce((sum, e) => sum + (e.progress_percentage || 0), 0) / enrollments.length)
    : 0;

  const revenue = subscriptions.reduce((sum, s) => sum + (s.amount_paid || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground mt-1">Platform overview and analytics</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalStudents}</p>
                <p className="text-sm text-muted-foreground">Total Students</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalTeachers}</p>
                <p className="text-sm text-muted-foreground">Teachers</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-success/10 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{avgProgress}%</p>
                <p className="text-sm text-muted-foreground">Avg Progress</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-destructive/10 flex items-center justify-center">
                <Star className="w-6 h-6 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeSubscriptions}</p>
                <p className="text-sm text-muted-foreground">Active Subs</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Additional Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Platform Metrics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Total Subjects</span>
              <span className="font-medium">{totalSubjects}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Total Enrollments</span>
              <span className="font-medium">{totalEnrollments}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Pending Applications</span>
              <Badge variant={pendingApplications > 0 ? 'destructive' : 'default'}>
                {pendingApplications}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Revenue (MWK)</span>
              <span className="font-medium">{revenue.toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start" onClick={() => window.location.href = '/admin/users'}>
              Manage Users
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => window.location.href = '/admin/teachers'}>
              Review Applications
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => window.location.href = '/admin/academic'}>
              Academic Management
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => window.location.href = '/admin/subscriptions'}>
              View Subscriptions
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {applications.slice(0, 5).map((app) => (
              <div key={app.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div className="text-sm">
                  <p className="font-medium">{app.full_name}</p>
                  <p className="text-xs text-muted-foreground">Applied to teach</p>
                </div>
                <Badge variant={app.status === 'pending' ? 'secondary' : 'default'} className="text-xs">
                  {app.status}
                </Badge>
              </div>
            ))}
            {applications.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No recent activity</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}