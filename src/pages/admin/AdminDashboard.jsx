import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Users, BookOpen, CreditCard, TrendingUp, GraduationCap, Activity } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-4">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-2xl font-bold font-display">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminDashboard() {
  const { data: users = [] } = useQuery({
    queryKey: ['adminUsers'],
    queryFn: () => base44.entities.User.list('-created_date', 1000),
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['adminSubjects'],
    queryFn: () => base44.entities.Subject.list('-created_date', 100),
  });

  const { data: payments = [] } = useQuery({
    queryKey: ['adminPayments'],
    queryFn: () => base44.entities.Payment.list('-created_date', 100),
  });

  const { data: enrollments = [] } = useQuery({
    queryKey: ['adminEnrollments'],
    queryFn: () => base44.entities.Enrollment.list('-created_date', 1000),
  });

  const students = users.filter(u => u.role === 'student' || !u.role);
  const teachers = users.filter(u => u.role === 'teacher');
  const totalRevenue = payments.filter(p => p.status === 'completed').reduce((sum, p) => sum + (p.amount || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">Admin Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Platform overview and management</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Students" value={students.length} color="bg-primary/10 text-primary" />
        <StatCard icon={GraduationCap} label="Teachers" value={teachers.length} color="bg-accent/10 text-accent" />
        <StatCard icon={BookOpen} label="Subjects" value={subjects.length} color="bg-success/10 text-success" />
        <StatCard icon={CreditCard} label="Revenue (MWK)" value={totalRevenue.toLocaleString()} color="bg-destructive/10 text-destructive" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Students */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-display">Recent Students</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {students.slice(0, 8).map(student => (
                <div key={student.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                    {student.full_name?.[0] || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{student.full_name || 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground">{student.email}</p>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground capitalize">
                    {student.subscription_plan || 'free'}
                  </span>
                </div>
              ))}
              {students.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-4">No students yet</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-display">Active Enrollments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {enrollments.slice(0, 8).map(e => (
                <div key={e.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                  <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center">
                    <Activity className="w-4 h-4 text-success" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{e.subject_name || 'Subject'}</p>
                    <p className="text-xs text-muted-foreground">{e.form_name}</p>
                  </div>
                  <span className="text-xs font-semibold text-primary">{e.progress_percentage || 0}%</span>
                </div>
              ))}
              {enrollments.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-4">No enrollments yet</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}