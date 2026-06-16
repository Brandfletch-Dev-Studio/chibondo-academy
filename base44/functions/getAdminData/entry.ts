/**
 * getAdminData — fixed version
 * Uses User.list() for students count (not StudentProfile which may be incomplete),
 * and uses filter() with proper sort/limit signatures throughout.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const ALL_DATASETS = [
  'users', 'enrollments', 'subscriptions', 'payments', 'referrals',
  'subjects', 'lessons', 'teachers', 'applications', 'students', 'payouts',
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const me = await base44.auth.me();
    if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (me.role !== 'admin') return Response.json({ error: 'Forbidden — admin only' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const requested: string[] = (body.datasets && body.datasets.length > 0)
      ? body.datasets
      : ALL_DATASETS;

    const result: Record<string, any[]> = {};

    const fetchSet = async (key: string, fn: () => Promise<any[]>) => {
      if (!requested.includes(key)) return;
      try { result[key] = await fn(); }
      catch (e: any) { console.error(`getAdminData: ${key} failed:`, e.message); result[key] = []; }
    };

    await Promise.all([
      // users — all roles
      fetchSet('users', () => base44.asServiceRole.entities.User.list('-created_date', 2000)),
      // enrollments
      fetchSet('enrollments', () => base44.asServiceRole.entities.Enrollment.list('-created_date', 5000)),
      // subscriptions
      fetchSet('subscriptions', () => base44.asServiceRole.entities.Subscription.list('-created_date', 2000)),
      // payments — all statuses
      fetchSet('payments', () => base44.asServiceRole.entities.Payment.list('-created_date', 2000)),
      // referrals
      fetchSet('referrals', () => base44.asServiceRole.entities.Referral.list('-created_date', 2000)),
      // subjects
      fetchSet('subjects', () => base44.asServiceRole.entities.Subject.list('order', 500)),
      // lessons
      fetchSet('lessons', () => base44.asServiceRole.entities.Lesson.list('order', 5000)),
      // teachers — filter by role
      fetchSet('teachers', () => base44.asServiceRole.entities.User.filter({ role: 'teacher' }, 'full_name', 500)),
      // teacher applications
      fetchSet('applications', () => base44.asServiceRole.entities.TeacherApplication.list('-created_date', 200)),
      // students — User records with role 'user' (most reliable source for count)
      fetchSet('students', () => base44.asServiceRole.entities.User.filter({ role: 'user' }, '-created_date', 2000)),
      // payouts
      fetchSet('payouts', () => base44.asServiceRole.entities.PayoutRequest.list('-created_date', 200)),
    ]);

    // Derived stats — always included
    const allUsers      = result.users      || [];
    const allSubs       = result.subscriptions || [];
    const allPayments   = result.payments   || [];
    const allReferrals  = result.referrals  || [];

    const stats = {
      total_users:       allUsers.length,
      total_students:    allUsers.filter((u: any) => u.role === 'user' || !u.role).length,
      total_teachers:    result.teachers?.length ?? allUsers.filter((u: any) => u.role === 'teacher').length,
      total_admins:      allUsers.filter((u: any) => u.role === 'admin').length,
      total_subjects:    result.subjects?.length   ?? 0,
      total_lessons:     result.lessons?.length    ?? 0,
      total_enrollments: result.enrollments?.length ?? 0,
      active_subs:       allSubs.filter((s: any) => s.status === 'active').length,
      completed_payments: allPayments.filter((p: any) => p.status === 'completed').length,
      total_revenue:     allPayments.filter((p: any) => p.status === 'completed').reduce((s: number, p: any) => s + (p.amount || 0), 0),
      total_affiliates:  new Set(allReferrals.map((r: any) => r.referrer_id)).size,
    };

    return Response.json({ ...result, stats });

  } catch (err: any) {
    console.error('getAdminData error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
});
