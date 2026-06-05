import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import {
  Users, BookOpen, TrendingUp, CreditCard, GraduationCap,
  Gift, AlertCircle, CheckCircle2, Clock, Layers,
  UserCheck, ArrowRight, ArrowUpRight, DollarSign, Trash2, Loader2
} from 'lucide-react';
import { toast } from 'sonner';

// ─── STAT CARD ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon: Icon, gradient, to, trend }) {
  const content = (
    <div className={`relative overflow-hidden rounded-2xl p-5 ${gradient} group transition-all duration-200 hover:scale-[1.01] hover:shadow-xl`}>
      {/* Background decoration */}
      <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-white/5 pointer-events-none" />
      <div className="absolute -right-2 -bottom-6 w-16 h-16 rounded-full bg-white/5 pointer-events-none" />

      <div className="relative z-10 flex items-start justify-between">
        <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
          <Icon className="w-5 h-5 text-white" />
        </div>
        {to && (
          <ArrowUpRight className="w-4 h-4 text-white/40 group-hover:text-white/80 transition-colors" />
        )}
      </div>
      <div className="relative z-10 mt-4">
        <p className="text-3xl font-display font-bold text-white leading-none">{value}</p>
        <p className="text-sm font-semibold text-white/80 mt-1">{label}</p>
        {sub && <p className="text-xs text-white/50 mt-0.5">{sub}</p>}
        {trend && <p className="text-xs text-white/60 mt-1 flex items-center gap-1"><TrendingUp className="w-3 h-3" />{trend}</p>}
      </div>
    </div>
  );
  return to ? <Link to={to}>{content}</Link> : content;
}

// ─── DATA MANAGEMENT ──────────────────────────────────────────────────────────
const ENTITY_LIST = [
  { key: 'StudentProfile', label: 'Student Profiles', icon: Users },
  { key: 'Enrollment',     label: 'Enrollments',      icon: BookOpen },
  { key: 'Payment',        label: 'Payments',         icon: CreditCard },
  { key: 'Subscription',   label: 'Subscriptions',    icon: DollarSign },
  { key: 'Referral',       label: 'Referrals',        icon: Gift },
  { key: 'Lesson',         label: 'Lessons',          icon: Layers },
  { key: 'Subject',        label: 'Courses',          icon: BookOpen },
  { key: 'Topic',          label: 'Topics',           icon: Layers },
  { key: 'TeacherApplication', label: 'Tutor Applications', icon: UserCheck },
];

function DataManagement() {
  const queryClient = useQueryClient();
  const [deleting, setDeleting] = useState(null);

  const deleteMutation = useMutation({
    mutationFn: async (entityKey) => {
      const entity = base44.entities[entityKey];
      const records = await entity.list('created_date', 500);
      await Promise.all(records.map(r => entity.delete(r.id)));
      return records.length;
    },
    onSuccess: (count, entityKey) => {
      queryClient.invalidateQueries();
      toast.success(`Deleted ${count} records from ${entityKey}`);
      setDeleting(null);
    },
    onError: (err) => {
      toast.error('Delete failed: ' + err.message);
      setDeleting(null);
    }
  });

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-border bg-destructive/5">
        <Trash2 className="w-4 h-4 text-destructive" />
        <h2 className="font-semibold text-sm text-destructive">Data Management</h2>
        <span className="text-xs text-muted-foreground ml-2">— Delete all records from a collection</span>
      </div>
      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {ENTITY_LIST.map(({ key, label, icon: Icon }) => (
          <AlertDialog key={key}>
            <AlertDialogTrigger asChild>
              <button className="flex items-center gap-3 p-3 rounded-xl border border-border hover:border-destructive/40 hover:bg-destructive/5 transition-all text-left group">
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center group-hover:bg-destructive/10 flex-shrink-0">
                  <Icon className="w-4 h-4 text-muted-foreground group-hover:text-destructive" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{label}</p>
                  <p className="text-xs text-muted-foreground">Delete all records</p>
                </div>
                <Trash2 className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-destructive ml-auto flex-shrink-0" />
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete all {label}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete <strong>all records</strong> in the <strong>{label}</strong> collection. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => { setDeleting(key); deleteMutation.mutate(key); }}
                  disabled={deleteMutation.isPending && deleting === key}
                >
                  {deleteMutation.isPending && deleting === key
                    ? <><Loader2 className="w-4 h-4 animate-spin mr-1.5" />Deleting...</>
                    : 'Yes, Delete All'
                  }
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ))}
      </div>
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const [showDataMgmt, setShowDataMgmt] = useState(false);
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

  const confirmedRevenue = payments.filter(p => p.status === 'completed').reduce((s, p) => s + (p.amount || 0), 0);
  const pendingRevenue = payments.filter(p => p.status === 'pending').reduce((s, p) => s + (p.amount || 0), 0);
  const activeSubscriptions = subscriptions.filter(s => s.status === 'active').length;
  const pendingApps = applications.filter(a => a.status === 'pending').length;
  const avgProgress = enrollments.length > 0
    ? Math.round(enrollments.reduce((s, e) => s + (e.progress_percentage || 0), 0) / enrollments.length) : 0;
  const totalAffiliates = [...new Set(referrals.map(r => r.referrer_id))].length;

  const now = new Date();
  const thisMonthStudents = students.filter(s => {
    const d = new Date(s.created_date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const recentPayments = [...payments].filter(p => p.status === 'completed')
    .sort((a, b) => new Date(b.created_date) - new Date(a.created_date)).slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Overview</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Welcome back, {user?.full_name?.split(' ')[0] || 'Admin'} · {new Date().toLocaleDateString('en-MW', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
        <Button variant="ghost" size="sm" className="text-destructive/60 hover:text-destructive hover:bg-destructive/10" onClick={() => setShowDataMgmt(v => !v)}>
          <Trash2 className="w-4 h-4 mr-1.5" /> {showDataMgmt ? 'Hide' : 'Data'}
        </Button>
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
            <p className="text-xs text-white/40 mt-0.5">From {payments.filter(p => p.status === 'completed').length} completed payments</p>
            {pendingRevenue > 0 && (
              <div className="mt-3 inline-flex items-center gap-1.5 text-xs bg-white/10 px-2.5 py-1 rounded-full">
                <Clock className="w-3 h-3 text-yellow-300" />
                <span className="text-yellow-200">MWK {pendingRevenue.toLocaleString()} pending</span>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Active Subs" value={activeSubscriptions} sub={`${thisMonthStudents} new students`} icon={CreditCard} gradient="bg-gradient-to-br from-emerald-600 to-emerald-800" to="/admin/subscriptions" />
          <StatCard label="Students" value={students.length} sub={`+${thisMonthStudents} this month`} icon={Users} gradient="bg-gradient-to-br from-sky-600 to-sky-800" to="/admin/users" />
          <StatCard label="Tutors" value={teachers.length} sub={pendingApps > 0 ? `${pendingApps} pending` : 'All approved'} icon={GraduationCap} gradient="bg-gradient-to-br from-violet-600 to-violet-800" to="/admin/teachers" />
          <StatCard label="Courses" value={subjects.length} sub={`${subjects.filter(s => s.status === 'published').length} published`} icon={BookOpen} gradient="bg-gradient-to-br from-amber-600 to-amber-800" to="/admin/curriculum" />
        </div>
      </div>

      {/* Secondary stats row */}
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
          <p className="text-[11px] text-muted-foreground">{enrollments.length} enrollments</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-1">
          <div className="w-8 h-8 rounded-lg bg-pink-500/10 flex items-center justify-center mb-1">
            <Gift className="w-4 h-4 text-pink-500" />
          </div>
          <p className="text-2xl font-display font-bold">{totalAffiliates}</p>
          <p className="text-xs font-semibold text-foreground/80">Affiliates</p>
          <p className="text-[11px] text-muted-foreground">{referrals.filter(r => ['paid','rewarded'].includes(r.status)).length} conversions</p>
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
            <div className="p-8 text-center text-sm text-muted-foreground">No confirmed payments yet</div>
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

      {/* Support */}
      <div className="flex items-center gap-3 p-4 bg-card border border-border rounded-xl text-sm">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <CheckCircle2 className="w-4 h-4 text-primary" />
        </div>
        <div>
          <p className="font-medium">Need help?</p>
          <p className="text-xs text-muted-foreground">Email us at <a href="mailto:support@chibondoacademy.com" className="text-primary hover:underline">support@chibondoacademy.com</a></p>
        </div>
      </div>

      {/* Data Management (toggled) */}
      {showDataMgmt && <DataManagement />}
    </div>
  );
}