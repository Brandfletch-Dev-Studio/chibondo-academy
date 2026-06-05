import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import {
  Users, BookOpen, TrendingUp, CreditCard, GraduationCap,
  Gift, AlertCircle, CheckCircle2, Clock, Layers,
  UserCheck, ArrowRight, ArrowUpRight, DollarSign
} from 'lucide-react';

// ─── TIME FILTER ─────────────────────────────────────────────────────────────
const TIME_FILTERS = [
  { key: 'today',    label: 'Today' },
  { key: 'week',     label: 'This Week' },
  { key: 'month',    label: 'This Month' },
  { key: '6months',  label: '6 Months' },
  { key: 'year',     label: '1 Year' },
  { key: 'all',      label: 'All Time' },
];

function getStartDate(key) {
  const now = new Date();
  switch (key) {
    case 'today':   return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case 'week': {
      const d = new Date(now); d.setDate(now.getDate() - 7); return d;
    }
    case 'month': {
      const d = new Date(now); d.setMonth(now.getMonth() - 1); return d;
    }
    case '6months': {
      const d = new Date(now); d.setMonth(now.getMonth() - 6); return d;
    }
    case 'year': {
      const d = new Date(now); d.setFullYear(now.getFullYear() - 1); return d;
    }
    default: return null; // all time
  }
}

function inRange(dateStr, startDate) {
  if (!startDate) return true;
  return new Date(dateStr) >= startDate;
}

// ─── STAT CARD ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon: Icon, gradient, to }) {
  const content = (
    <div className={`relative overflow-hidden rounded-2xl p-5 ${gradient} group transition-all duration-200 hover:scale-[1.01] hover:shadow-xl`}>
      <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-white/5 pointer-events-none" />
      <div className="absolute -right-2 -bottom-6 w-16 h-16 rounded-full bg-white/5 pointer-events-none" />
      <div className="relative z-10 flex items-start justify-between">
        <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
          <Icon className="w-5 h-5 text-white" />
        </div>
        {to && <ArrowUpRight className="w-4 h-4 text-white/40 group-hover:text-white/80 transition-colors" />}
      </div>
      <div className="relative z-10 mt-4">
        <p className="text-3xl font-display font-bold text-white leading-none">{value}</p>
        <p className="text-sm font-semibold text-white/80 mt-1">{label}</p>
        {sub && <p className="text-xs text-white/50 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
  return to ? <Link to={to}>{content}</Link> : content;
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const [timePeriod, setTimePeriod] = useState('month');
  const { data: user } = useQuery({ queryKey: ['currentUser'], queryFn: () => base44.auth.me() });

  const { data: subjects = [] }      = useQuery({ queryKey: ['allSubjects'],      queryFn: () => base44.entities.Subject.filter({}) });
  const { data: enrollments = [] }   = useQuery({ queryKey: ['allEnrollments'],   queryFn: () => base44.entities.Enrollment.filter({}) });
  const { data: students = [] }      = useQuery({ queryKey: ['allStudents'],      queryFn: () => base44.entities.StudentProfile.filter({}) });
  const { data: teachers = [] }      = useQuery({ queryKey: ['allTeachers'],      queryFn: () => base44.entities.User.filter({ role: 'teacher' }) });
  const { data: applications = [] }  = useQuery({ queryKey: ['teacherApplications'], queryFn: () => base44.entities.TeacherApplication.filter({}) });
  const { data: subscriptions = [] } = useQuery({ queryKey: ['allSubscriptions'], queryFn: () => base44.entities.Subscription.filter({}) });
  const { data: payments = [] }      = useQuery({ queryKey: ['allPayments'],      queryFn: () => base44.entities.Payment.filter({}) });
  const { data: referrals = [] }     = useQuery({ queryKey: ['allReferrals'],     queryFn: () => base44.entities.Referral.list('-created_date', 500) });
  const { data: lessons = [] }       = useQuery({ queryKey: ['allLessons'],       queryFn: () => base44.entities.Lesson.filter({}) });

  const startDate = useMemo(() => getStartDate(timePeriod), [timePeriod]);

  // Filter all time-sensitive data
  const filteredPayments     = useMemo(() => payments.filter(p => inRange(p.created_date, startDate)), [payments, startDate]);
  const filteredEnrollments  = useMemo(() => enrollments.filter(e => inRange(e.created_date, startDate)), [enrollments, startDate]);
  const filteredStudents     = useMemo(() => students.filter(s => inRange(s.created_date, startDate)), [students, startDate]);
  const filteredSubscriptions= useMemo(() => subscriptions.filter(s => inRange(s.created_date, startDate)), [subscriptions, startDate]);
  const filteredReferrals    = useMemo(() => referrals.filter(r => inRange(r.created_date, startDate)), [referrals, startDate]);

  const confirmedRevenue   = filteredPayments.filter(p => p.status === 'completed').reduce((s, p) => s + (p.amount || 0), 0);
  const pendingRevenue     = filteredPayments.filter(p => p.status === 'pending').reduce((s, p) => s + (p.amount || 0), 0);
  const activeSubscriptions= filteredSubscriptions.filter(s => s.status === 'active').length;
  const pendingApps        = applications.filter(a => a.status === 'pending').length; // always show pending
  const avgProgress        = enrollments.length > 0
    ? Math.round(enrollments.reduce((s, e) => s + (e.progress_percentage || 0), 0) / enrollments.length) : 0;
  const totalAffiliates    = [...new Set(filteredReferrals.map(r => r.referrer_id))].length;

  const recentPayments = [...filteredPayments].filter(p => p.status === 'completed')
    .sort((a, b) => new Date(b.created_date) - new Date(a.created_date)).slice(0, 5);

  const periodLabel = TIME_FILTERS.find(f => f.key === timePeriod)?.label || '';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold">Overview</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Welcome back, {user?.full_name?.split(' ')[0] || 'Admin'} · {new Date().toLocaleDateString('en-MW', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        {/* Time Period Filter */}
        <div className="flex gap-1 flex-wrap bg-muted/50 rounded-xl p-1">
          {TIME_FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setTimePeriod(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                timePeriod === f.key
                  ? 'bg-card shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Alert banner */}
      {pendingApps > 0 && (
        <Link to="/admin/teachers">
          <div className="flex items-center gap-3 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-sm hover:bg-yellow-500/15 transition-colors">
            <AlertCircle className="w-4 h-4 text-yellow-600 flex-shrink-0" />
            <span className="flex-1 text-yellow-800 dark:text-yellow-400">
              <strong>{pendingApps}</strong> tutor application{pendingApps !== 1 ? 's' : ''} awaiting review
            </span>
            <ArrowRight className="w-4 h-4 text-yellow-600" />
          </div>
        </Link>
      )}

      {/* Period label */}
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">
        Showing data for: {periodLabel}
      </p>

      {/* Revenue hero */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1a2a4a] via-[#1e3260] to-[#243878] p-6 text-white">
          <div className="absolute -right-6 -top-6 w-36 h-36 rounded-full bg-white/5 pointer-events-none" />
          <div className="absolute right-10 bottom-0 w-20 h-20 rounded-full bg-white/5 pointer-events-none" />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-white" />
              </div>
              <Link to="/admin/subscriptions" className="flex items-center gap-1 text-xs text-white/60 hover:text-white/90 transition-colors">
                View all <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <p className="text-4xl font-display font-bold tracking-tight">MWK {confirmedRevenue.toLocaleString()}</p>
            <p className="text-sm font-semibold text-white/70 mt-1">Confirmed Revenue</p>
            <p className="text-xs text-white/40 mt-0.5">
              From {filteredPayments.filter(p => p.status === 'completed').length} completed payments
            </p>
            {pendingRevenue > 0 && (
              <div className="mt-3 inline-flex items-center gap-1.5 text-xs bg-white/10 px-2.5 py-1 rounded-full">
                <Clock className="w-3 h-3 text-yellow-300" />
                <span className="text-yellow-200">MWK {pendingRevenue.toLocaleString()} pending</span>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Active Subs" value={activeSubscriptions} sub={`${filteredStudents.length} new students`} icon={CreditCard} gradient="bg-gradient-to-br from-emerald-600 to-emerald-800" to="/admin/subscriptions" />
          <StatCard label="Students" value={filteredStudents.length} sub="In period" icon={Users} gradient="bg-gradient-to-br from-sky-600 to-sky-800" to="/admin/users" />
          <StatCard label="Tutors" value={teachers.length} sub={pendingApps > 0 ? `${pendingApps} pending` : 'All approved'} icon={GraduationCap} gradient="bg-gradient-to-br from-violet-600 to-violet-800" to="/admin/teachers" />
          <StatCard label="Courses" value={subjects.length} sub={`${subjects.filter(s => s.status === 'published').length} published`} icon={BookOpen} gradient="bg-gradient-to-br from-amber-600 to-amber-800" to="/admin/curriculum" />
        </div>
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-1">
          <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center mb-1">
            <Layers className="w-4 h-4 text-orange-500" />
          </div>
          <p className="text-2xl font-display font-bold">{lessons.length}</p>
          <p className="text-xs font-semibold text-foreground/80">Total Lessons</p>
          <p className="text-[11px] text-muted-foreground">Across {subjects.length} courses</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-1">
          <div className="w-8 h-8 rounded-lg bg-teal-500/10 flex items-center justify-center mb-1">
            <TrendingUp className="w-4 h-4 text-teal-500" />
          </div>
          <p className="text-2xl font-display font-bold">{avgProgress}%</p>
          <p className="text-xs font-semibold text-foreground/80">Avg. Progress</p>
          <p className="text-[11px] text-muted-foreground">{filteredEnrollments.length} enrollments</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-1">
          <div className="w-8 h-8 rounded-lg bg-pink-500/10 flex items-center justify-center mb-1">
            <Gift className="w-4 h-4 text-pink-500" />
          </div>
          <p className="text-2xl font-display font-bold">{totalAffiliates}</p>
          <p className="text-xs font-semibold text-foreground/80">Affiliates</p>
          <p className="text-[11px] text-muted-foreground">{filteredReferrals.filter(r => ['paid','rewarded'].includes(r.status)).length} conversions</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-1">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center mb-1">
            <UserCheck className="w-4 h-4 text-primary" />
          </div>
          <p className="text-2xl font-display font-bold">{applications.length}</p>
          <p className="text-xs font-semibold text-foreground/80">Applications</p>
          <p className="text-[11px] text-muted-foreground">{pendingApps} pending review</p>
        </div>
      </div>

      {/* Recent payments + Applications */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="font-semibold text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-success" /> Recent Payments
            </h2>
            <Link to="/admin/subscriptions" className="text-xs text-primary hover:underline flex items-center gap-0.5">
              View all <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          {recentPayments.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No payments in this period</div>
          ) : (
            <div className="divide-y divide-border">
              {recentPayments.map(p => (
                <div key={p.id} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center text-xs font-bold text-success flex-shrink-0">
                    {p.student_name?.[0]?.toUpperCase() || 'S'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.student_name || 'Student'}</p>
                    <p className="text-xs text-muted-foreground">{new Date(p.created_date).toLocaleDateString()}</p>
                  </div>
                  <span className="text-sm font-bold text-success flex-shrink-0">MWK {(p.amount || 0).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="font-semibold text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-yellow-500" /> Tutor Applications
            </h2>
            <Link to="/admin/teachers" className="text-xs text-primary hover:underline flex items-center gap-0.5">
              Manage <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          {applications.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No applications yet</div>
          ) : (
            <div className="divide-y divide-border">
              {applications.slice(0, 5).map(app => (
                <div key={app.id} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                    {app.full_name?.[0]?.toUpperCase() || 'T'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{app.full_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{app.subjects?.join(', ') || 'No subjects listed'}</p>
                  </div>
                  <Badge className={`text-[9px] flex-shrink-0 ${app.status === 'pending' ? 'bg-yellow-500/10 text-yellow-600' : app.status === 'approved' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
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