/**
 * sendWelcomeEmail
 * Called immediately after OTP verification succeeds.
 * 1. Creates a StudentProfile if one doesn't already exist — so the user
 *    appears as a student in all admin views from the moment they register,
 *    NOT just after their first payment.
 * 2. Sends a branded welcome email.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // ── 1. Ensure StudentProfile exists ─────────────────────────────────────
    // Do this via asServiceRole so it always works regardless of who calls it.
    try {
      const existing = await base44.asServiceRole.entities.StudentProfile.filter({ user_id: user.id });
      if (existing.length === 0) {
        await base44.asServiceRole.entities.StudentProfile.create({
          user_id:   user.id,
          full_name: user.full_name || '',
          email:     user.email,
          onboarding_complete: false,
        });
        console.log(`✅ StudentProfile created for ${user.email}`);
      } else {
        console.log(`StudentProfile already exists for ${user.email}`);
      }
    } catch (profileErr: any) {
      // Non-fatal — don't block the welcome email
      console.error('StudentProfile creation error:', profileErr.message);
    }

    // ── 2. Ensure user has a referral code (used for the affiliate programme) ──
    try {
      if (!user.referral_code) {
        const code = 'CHIB-' + user.id.slice(-6).toUpperCase();
        await base44.asServiceRole.entities.User.update(user.id, { referral_code: code });
        console.log(`✅ Referral code set: ${code} for ${user.email}`);
      }
    } catch (codeErr: any) {
      console.error('referral_code set error (non-fatal):', codeErr.message);
    }

    // ── 3. Idempotency: only send welcome email once ─────────────────────────
    const existingNotif = await base44.asServiceRole.entities.Notification.filter({
      user_id: user.id,
      type: 'welcome',
    });
    if (existingNotif.length > 0) {
      console.log(`Welcome email already sent for ${user.email} — skipping email`);
      return Response.json({ skipped: true });
    }

    // ── 4. Build and send branded email ─────────────────────────────────────
    const built = await base44.asServiceRole.functions.invoke('buildBrandedEmail', {
      type: 'welcome',
      variables: { student_name: user.full_name || user.email.split('@')[0] },
    });

    if (!built || built.error) throw new Error(built?.error || 'buildBrandedEmail failed');

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: user.email,
      subject: built.subject,
      body: built.html,
    });

    // ── 5. Record welcome notification to prevent re-sending ────────────────
    await base44.asServiceRole.entities.Notification.create({
      user_id: user.id,
      title:   'Welcome to Chibondo Academy!',
      message: 'Your account is active. Explore subjects, join the forum, and start learning.',
      type:    'welcome',
      link:    '/dashboard',
      is_read: false,
    });

    console.log(`✅ Welcome email sent to ${user.email}`);
    return Response.json({ success: true });

  } catch (err: any) {
    console.error('sendWelcomeEmail error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
});
