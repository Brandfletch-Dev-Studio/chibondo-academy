/**
 * getAdminData
 * Single service-role endpoint for all admin dashboard data.
 * Bypasses ALL RLS — returns complete platform data for any authenticated admin.
 * 
 * POST { datasets: string[] }
 * Available datasets: users, enrollments, subscriptions, payments, referrals,
 *                     subjects, lessons, teachers, applications, students,
 *                     payouts, notifications
 * Omit datasets or pass [] to get all.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const ALL_DATASETS = [
  'users', 'enrollments', 'subscriptions', 'payments', 'referrals',
  'subjects', 'lessons', 'teachers', 'applications', 'students', 'payouts',
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Auth guard — admin only
    const me = await base44.auth.me();
    if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (me.role !== 'admin') return Response.json({ error: 'Forbidden — admin only' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const requested: string[] = (body.datasets && body.datasets.length > 0)
      ? body.datasets
      : ALL_DATASETS;

    const result: Record<string, any[]> = {};

    const fetch = async (key: string, fn: () => Promise<any[]>) => {
      if (!requested.includes(key)) return;
      try { result[key] = await fn(); }
      catch (e: any) { console.error(`getAdminData: ${key} failed:`, e.message); result[key] = []; }
    };

    await Promise.all([
      fetch('users',         () => base44.asServiceRole.entities.User.list('-created_date', 2000)),
      fetch('enrollments',   () => base44.asServiceRole.entities.Enrollment.filter({}, '-created_date', 5000)),
      fetch('subscriptions', () => base44.asServiceRole.entities.Subscription.list('-created_date', 2000)),
      fetch('payments',      () => base44.asServiceRole.entities.Payment.list('-created_date', 2000)),
      fetch('referrals',     () => base44.asServiceRole.entities.Referral.list('-created_date', 2000)),
      fetch('subjects',      () => base44.asServiceRole.entities.Subject.list('order', 500)),
      fetch('lessons',       () => base44.asServiceRole.entities.Lesson.list('order', 5000)),
      fetch('teachers',      () => base44.asServiceRole.entities.User.filter({ role: 'teacher' }, 'full_name', 500)),
      fetch('applications',  () => base44.asServiceRole.entities.TeacherApplication.filter({}, '-created_date', 200)),
      fetch('students',      () => base44.asServiceRole.entities.StudentProfile.filter({}, '-created_date', 2000)),
      fetch('payouts',       () => base44.asServiceRole.entities.PayoutRequest.list('-created_date', 200)),
    ]);

    // Summary stats always included
    const stats = {
      total_users:       result.users?.length       ?? 0,
      total_students:    result.users?.filter((u: any) => u.role === 'user' || !u.role).length ?? 0,
      total_teachers:    result.teachers?.length    ?? result.users?.filter((u: any) => u.role === 'teacher').length ?? 0,
      total_admins:      result.users?.filter((u: any) => u.role === 'admin').length ?? 0,
      total_subjects:    result.subjects?.length    ?? 0,
      total_lessons:     result.lessons?.length     ?? 0,
      total_enrollments: result.enrollments?.length ?? 0,
      active_subs:       result.subscriptions?.filter((s: any) => s.status === 'active').length ?? 0,
    };

    return Response.json({ ...result, stats });

  } catch (err: any) {
    console.error('getAdminData error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
});
