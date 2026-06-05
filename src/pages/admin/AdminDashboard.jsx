import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import {
  Users, BookOpen, TrendingUp, CreditCard, GraduationCap,
  BarChart3, Gift, AlertCircle, CheckCircle2, Clock,
  Layers, UserCheck, ArrowRight
} from 'lucide-react';

function StatCard({ label, value, sub, icon: Icon, color, to }) {
  const content = (
    <div className={`bg-card border border-border rounded-2xl p-5 flex items-start gap-4 hover:shadow-md transition-shadow ${to ? 'cursor-pointer hover:border-primary/30' : ''}`}>
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-2xl font-display font-bold leading-none">{value}</p>
        <p className="text-sm font-medium mt-0.5">{label}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
      {to && <ArrowRight className="w-4 h-4 text-muted-foreground/40 flex-shrink-0 mt-1" />}
    </div>
  );
  return to ? <Link to={to}>{content}</Link> : content;
}

export default function AdminDashboard() {
  const { data: user } = useQuery({ queryKey: ['currentUser'], queryFn: () => base44.auth.me() });

  const { data: subjects = [] } = useQuery({ queryKey: ['allSubjects'], queryFn: () => base44.entities.Subject.filter({}) });
  const { data: enrollments = [] } = useQuery({ queryKey: ['allEnrollments'], queryFn: () => base44.entities.Enrollment.filter({}) });
  const { data: students = [] } = useQuery({ queryKey: ['allStudents'], queryFn: () => base44.entities.StudentProfile.filter({}) });
  const { data: teachers = [] } = useQuery({ queryKey: ['allTeachers'], queryFn: () => base44.entities.User.filter({ role: 'teacher' }) });
  const { data: applications = [] } = useQuery({ queryKey: ['teacherApplications'], queryFn: () => base44.entities.TeacherApplication.filter({}) });
  const { data: subscriptions = [] } = useQuery({ queryKey: ['allSubscriptions'], queryFn: () => base44.entities.Subscription.filter({}) });
  const { data: payments = [] } = useQuery({ queryKey: ['allPayments'], queryFn: () => base44.entities.Payment.filter({}) });
  const { data: referrals = [] } = useQuery({ queryKey: ['allReferrals'], queryFn: () => base44.entities.Referral.list('-created_date', 500) });
  const { data: lessons = [] } = useQuery({ queryKey: ['allLessons'], queryFn: () => base44.entities.Lesson.filter({}) });

  // Metrics
  const confirmedRevenue = payments.filter(p => p.status === 'completed').reduce((s, p) => s + (p.amount || 0), 0);
  const pendingRevenue = payments.filter(p => p.status === 'pending').reduce((s, p) => s + (p.amount || 0), 0);
  const activeSubscriptions = subscriptions.filter(s => s.status === 'active').length;
  const pendingApps = applications.filter(a => a.status === 'pending').length;
  const avgProgress = enrollments.length > 0
    ? Math.round(enrollments.reduce((s, e) => s + (e.progress_percentage || 0), 0) / enrollments.length)
    : 0;
  const totalAffiliates = [...new Set(referrals.map(r => r.referrer_id))].length;
  const pendingPayouts = referrals.filter(r => r.reward_status === 'pending' && (r.reward_amount || 0) > 0)
    .reduce((s, r) => s + (r.reward_amount || 0), 0);

  // Recent activity feed
  const recentEnrollments = [...enrollments].sort((a, b) => new Date(b.created_date) - new Date(a.created_date)).slice(0, 5);
  const recentPayments = [...payments].filter(p => p.status === 'completed').sort((a, b) => new Date(b.created_date) - new Date(a.created_date)).slice(0, 5);

  const now = new Date();
  const thisMonth = subscriptions.filter(s => {
    const d = new Date(s.created_date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Welcome back, {user?.full_name?.split(' ')[0] || 'Admin'}</p>
        </div>
        <Badge className="bg-primary/10 text-primary border-0 hidden sm:flex">
          {new Date().toLocaleDateString('en-MW', { weekday: 'long', day: 'numeric', month: 'long' })}
        </Badge>
      </div>

      {/* Alerts */}
      {pendingApps > 0 && (
        <Link to="/admin/teachers">
          <div className="flex items-center gap-3 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-sm">
            <AlertCircle className="w-4 h-4 text-yellow-600 flex-shrink-0" />
            <span className="flex-1 text-yellow-800 dark:text-yellow-400">
              <strong>{pendingApps}</strong> tutor application{pendingApps !== 1 ? 's' : ''} awaiting review
            </span>
            <ArrowRight className="w-4 h-4 text-yellow-600" />
          </div>
        </Link>
      )}

      {/* Primary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Students" value={students.length} sub={`${thisMonth} this month`} icon={Users} color="text-primary bg-primary/10" to="/admin/users" />
        <StatCard label="Tutors" value={teachers.length} sub={`${pendingApps} pending`} icon={GraduationCap} color="text-accent bg-accent/10" to="/admin/teachers" />
        <StatCard label="Courses" value={subjects.length} sub={`${subjects.filter(s => s.status === 'published').length} published`} icon={BookOpen} color="text-blue-500 bg-blue-500/10" to="/admin/curriculum" />
        <StatCard label="Active Subs" value={activeSubscriptions} sub={`${enrollments.length} enrolled`} icon={CreditCard} color="text-success bg-success/10" to="/admin/subscriptions" />
      </div>

      {/* Revenue Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-gradient-to-br from-primary to-primary/80 rounded-2xl p-5 text-primary-foreground col-span-1">
          <p className="text-xs font-medium opacity-70 uppercase tracking-wide mb-2">Confirmed Revenue</p>
          <p className="text-3xl font-display font-bold">MWK {confirmedRevenue.toLocaleString()}</p>
          <p className="text-xs opacity-60 mt-1">From {payments.filter(p => p.status === 'completed').length} confirmed payments</p>
          {pendingRevenue > 0 && (
            <p className="text-xs mt-2 opacity-80">+ MWK {pendingRevenue.toLocaleString()} pending</p>
          )}
        </div>
        <StatCard label="Avg. Progress" value={`${avgProgress}%`} sub={`${enrollments.length} active enrollments`} icon={TrendingUp} color="text-emerald-500 bg-emerald-500/10" />
        <StatCard label="Affiliates" value={totalAffiliates} sub={`MWK ${pendingPayouts.toLocaleString()} pending payouts`} icon={Gift} color="text-purple-500 bg-purple-500/10" to="/admin/affiliates" />
      </div>

      {/* Content Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard label="Total Lessons" value={lessons.length} sub={`Across ${subjects.length} courses`} icon={Layers} color="text-orange-500 bg-orange-500/10" />
        <StatCard label="Total Referrals" value={referrals.length} sub={`${referrals.filter(r => ['paid','rewarded'].includes(r.status)).length} converted`} icon={Gift} color="text-pink-500 bg-pink-500/10" />
        <StatCard label="Applications" value={applications.length} sub={`${pendingApps} pending · ${applications.filter(a => a.status === 'approved').length} approved`} icon={UserCheck} color="text-teal-500 bg-teal-500/10" to="/admin/teachers" />
      </div>

      {/* Bottom: Recent Payments + Pending Applications */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Confirmed Payments */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="font-semibold text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-success" /> Recent Payments
            </h2>
            <Link to="/admin/subscriptions" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          {recentPayments.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No confirmed payments yet</div>
          ) : (
            <div className="divide-y divide-border">
              {recentPayments.map(p => (
                <div key={p.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center text-xs font-bold text-success flex-shrink-0">
                    {p.student_name?.[0]?.toUpperCase() || 'S'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.student_name || 'Student'}</p>
                    <p className="text-xs text-muted-foreground">{new Date(p.created_date).toLocaleDateString()}</p>
                  </div>
                  <span className="text-sm font-bold text-success">MWK {(p.amount || 0).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pending Tutor Applications */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="font-semibold text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-yellow-500" /> Tutor Applications
            </h2>
            <Link to="/admin/teachers" className="text-xs text-primary hover:underline">Manage</Link>
          </div>
          {applications.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No applications yet</div>
          ) : (
            <div className="divide-y divide-border">
              {applications.slice(0, 5).map(app => (
                <div key={app.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                    {app.full_name?.[0]?.toUpperCase() || 'T'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{app.full_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{app.subjects?.join(', ') || 'No subjects listed'}</p>
                  </div>
                  <Badge className={`text-[9px] ${app.status === 'pending' ? 'bg-yellow-500/10 text-yellow-600' : app.status === 'approved' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                    {app.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}