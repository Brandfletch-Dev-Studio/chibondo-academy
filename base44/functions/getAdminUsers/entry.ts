/**
 * getAdminUsers
 * Returns the full user list for admin dashboards.
 * Uses asServiceRole so RLS never filters — any authenticated user with admin role gets all users.
 * NOTE: role check is done via DB lookup (asServiceRole), NOT from the JWT token,
 * so it works even when the session token hasn't refreshed yet.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Auth guard — must be logged in
    const me = await base44.auth.me();
    if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Verify admin role from DB (asServiceRole) — not from potentially stale JWT
    const dbUsers = await base44.asServiceRole.entities.User.filter({ id: me.id });
    const dbMe = dbUsers[0];
    if (!dbMe || dbMe.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch everything as service role — bypasses ALL RLS
    const [users, enrollments, subscriptions] = await Promise.all([
      base44.asServiceRole.entities.User.list('-created_date', 2000),
      base44.asServiceRole.entities.Enrollment.filter({}).catch(() => []),
      base44.asServiceRole.entities.Subscription.filter({ status: 'active' }).catch(() => []),
    ]);

    // Build per-user lookup maps
    const enrollCountByUser: Record<string, number> = {};
    for (const e of enrollments) {
      const key = e.student_id || e.user_id;
      if (key) enrollCountByUser[key] = (enrollCountByUser[key] || 0) + 1;
    }

    const activeSubByUser: Record<string, any> = {};
    for (const s of subscriptions) {
      const key = s.student_id || s.user_id;
      if (key) activeSubByUser[key] = s;
    }

    // Enrich each user with pre-computed data
    const enriched = users.map((u: any) => ({
      ...u,
      _enrollment_count: enrollCountByUser[u.id] || 0,
      _has_active_sub:   !!activeSubByUser[u.id],
      _sub_plan:         activeSubByUser[u.id]?.plan || null,
    }));

    const students = users.filter((u: any) => u.role === 'user' || !u.role);
    const teachers = users.filter((u: any) => u.role === 'teacher');
    const admins   = users.filter((u: any) => u.role === 'admin');

    return Response.json({
      users:       enriched,
      total:       users.length,
      students:    students.length,
      teachers:    teachers.length,
      admins:      admins.length,
      subscribed:  Object.keys(activeSubByUser).length,
      enrollments: enrollments.length,
    });

  } catch (err: any) {
    console.error('getAdminUsers error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
});
