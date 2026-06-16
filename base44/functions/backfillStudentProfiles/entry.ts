/**
 * backfillStudentProfiles
 * One-time (and idempotent) fix for users who registered before the 
 * sendWelcomeEmail StudentProfile auto-creation was added.
 * 
 * Creates a StudentProfile for every user with role="user" who doesn't have one.
 * Also sets referral_code for any user missing it.
 * 
 * Safe to run multiple times — skips users who already have profiles.
 * Call from admin panel: base44.functions.invoke('backfillStudentProfiles', {})
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Admin only
    const me = await base44.auth.me();
    if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (me.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    // Get all users and all existing profiles
    const [allUsers, allProfiles] = await Promise.all([
      base44.asServiceRole.entities.User.list('-created_date', 5000),
      base44.asServiceRole.entities.StudentProfile.filter({}, 'user_id', 5000),
    ]);

    const profileUserIds = new Set(allProfiles.map((p: any) => p.user_id));

    let created = 0;
    let codesSet = 0;
    const errors: string[] = [];

    for (const user of allUsers) {
      // Create missing StudentProfile for students (role=user) and also for 
      // teachers/admins who may have student data
      if (!profileUserIds.has(user.id)) {
        try {
          await base44.asServiceRole.entities.StudentProfile.create({
            user_id:   user.id,
            full_name: user.full_name || '',
            email:     user.email,
            onboarding_complete: false,
          });
          created++;
        } catch (e: any) {
          errors.push(`Profile for ${user.email}: ${e.message}`);
        }
      }

      // Set missing referral codes
      if (!user.referral_code) {
        try {
          const code = 'CHIB-' + user.id.slice(-6).toUpperCase();
          await base44.asServiceRole.entities.User.update(user.id, { referral_code: code });
          codesSet++;
        } catch (e: any) {
          errors.push(`Code for ${user.email}: ${e.message}`);
        }
      }
    }

    console.log(`✅ Backfill: ${created} profiles created, ${codesSet} codes set, ${errors.length} errors`);
    return Response.json({
      success: true,
      profiles_created: created,
      codes_set: codesSet,
      total_users: allUsers.length,
      errors: errors.slice(0, 10), // cap error list
    });

  } catch (err: any) {
    console.error('backfillStudentProfiles error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
});
