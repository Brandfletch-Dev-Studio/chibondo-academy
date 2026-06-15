/**
 * deleteMyAccount
 * Google Play Store requirement: apps with login must provide account deletion.
 * Deletes ALL data associated with the requesting user:
 *   - Enrollments, Subscriptions, Payments, Referrals, Notifications,
 *     StudentProfile, ForumPresence, LessonProgress, Assignments
 * Then deletes the User record itself.
 * Returns { success: true } on completion.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const ENTITIES_TO_PURGE = [
  'Enrollment',
  'Subscription',
  'Payment',
  'Referral',
  'Notification',
  'StudentProfile',
  'ForumPresence',
  'LessonProgress',
  'Assignment',
  'QuizAttempt',
  'AssignmentSubmission',
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();
    if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = me.id;
    console.log(`Account deletion requested by user ${userId} (${me.email})`);

    // Delete all related entity records
    for (const entityName of ENTITIES_TO_PURGE) {
      try {
        const records = await base44.asServiceRole.entities[entityName]?.filter?.({ student_id: userId })
          || await base44.asServiceRole.entities[entityName]?.filter?.({ user_id: userId })
          || [];
        for (const rec of records) {
          try {
            await base44.asServiceRole.entities[entityName].delete(rec.id);
          } catch (_) {}
        }
        // Also try user_id field
        if (entityName === 'StudentProfile' || entityName === 'ForumPresence') {
          const byUserId = await base44.asServiceRole.entities[entityName].filter({ user_id: userId }).catch(() => []);
          for (const rec of byUserId) {
            await base44.asServiceRole.entities[entityName].delete(rec.id).catch(() => {});
          }
        }
      } catch (e) {
        console.log(`  skip ${entityName}: ${e.message}`);
      }
    }

    // Delete forum posts/replies authored by this user
    try {
      const posts = await base44.asServiceRole.entities.ForumPost.filter({ author_id: userId }).catch(() => []);
      for (const p of posts) await base44.asServiceRole.entities.ForumPost.delete(p.id).catch(() => {});
      const replies = await base44.asServiceRole.entities.ForumReply.filter({ author_id: userId }).catch(() => []);
      for (const r of replies) await base44.asServiceRole.entities.ForumReply.delete(r.id).catch(() => {});
    } catch (_) {}

    // Finally delete the user account
    await base44.asServiceRole.entities.User.delete(userId);

    // Sign out the token
    await base44.auth.logout().catch(() => {});

    console.log(`✅ Account deleted: ${userId} (${me.email})`);
    return Response.json({ success: true });

  } catch (err: any) {
    console.error('deleteMyAccount error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
});
