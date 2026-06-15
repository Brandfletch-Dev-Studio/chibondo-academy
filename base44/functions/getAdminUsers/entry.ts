/**
 * getAdminUsers
 * Returns the full user list for admin dashboards.
 * Uses asServiceRole so RLS never filters the result — any admin gets all users.
 * Also returns enrollment + subscription counts per user for the stats grid.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Auth check — must be admin
    const me = await base44.auth.me();
    if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (me.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    // Fetch everything as service role — bypasses all RLS
    const [users, enrollments, subscriptions] = await Promise.all([
      base44.asServiceRole.entities.User.list('-created_date', 1000),
      base44.asServiceRole.entities.Enrollment.filter({}),
      base44.asServiceRole.entities.Subscription.filter({}),
    ]);

    // Compute per-user stats
    const enrollCountByStudent: Record<string, number> = {};
    for (const e of enrollments) {
      enrollCountByStudent[e.student_id] = (enrollCountByStudent[e.student_id] || 0) + 1;
    }

    const activeSubByStudent: Record<string, any> = {};
    for (const s of subscriptions) {
      if (s.status === 'active') activeSubByStudent[s.student_id] = s;
    }

    const enriched = users.map((u: any) => ({
      ...u,
      _enrollment_count: enrollCountByStudent[u.id] || 0,
      _has_active_sub:   !!activeSubByStudent[u.id],
      _sub_plan:         activeSubByStudent[u.id]?.plan || null,
    }));

    return Response.json({
      users: enriched,
      total: users.length,
      students:    users.filter((u: any) => u.role === 'user' || !u.role).length,
      teachers:    users.filter((u: any) => u.role === 'teacher').length,
      admins:      users.filter((u: any) => u.role === 'admin').length,
      subscribed:  Object.keys(activeSubByStudent).length,
      enrollments: enrollments.length,
    });

  } catch (err: any) {
    console.error('getAdminUsers error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
});
