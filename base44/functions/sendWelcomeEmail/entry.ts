/**
 * sendWelcomeEmail
 * Called immediately after OTP verification succeeds.
 * 1. Creates a StudentProfile if one doesn't already exist — so the user
 *    appears as a student in all admin views from the moment they register,
 *    NOT just after their first payment.
 * 2. Sends a branded welcome email.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ── Resend email sender ───────────────────────────────────────────────────────
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || 're_Z2rVV1Yz_BapfeMWdpLWbHuBjyJ6QTpaD';
const FROM_ADDRESS   = 'Chibondo Academy <noreply@chibondoacademy.com>';

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM_ADDRESS, to: [to], subject, html }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend error ${res.status}: ${err}`);
  }
  const d = await res.json();
  console.log(`✅ Email sent to ${to} — Resend ID: ${d.id}`);
}


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

    // ── 4. Check if welcome email is enabled in admin settings ──────────────
    try {
      const tplSettings = await base44.asServiceRole.entities.PlatformSettings.filter({ key: 'email_templates' });
      const tplConfig = tplSettings[0]?.value || {};
      if (tplConfig.welcome_enabled === false) {
        console.log('Welcome email disabled by admin — skipping');
        return Response.json({ skipped: true, reason: 'disabled' });
      }
    } catch (_) { /* non-fatal — proceed with send */ }

    // ── 5. Build and send branded email ─────────────────────────────────────
    // Get referral code (may have just been set above)
    const freshUser = await base44.asServiceRole.entities.User.filter({ id: user.id }).catch(() => [user]);
    const referralCode = freshUser[0]?.referral_code || user.referral_code || '';

    const built = await base44.asServiceRole.functions.invoke('buildBrandedEmail', {
      type: 'welcome',
      variables: {
        student_name: user.full_name || user.email.split('@')[0],
        referral_code: referralCode,
      },
    });

    if (!built || built.error) throw new Error(built?.error || 'buildBrandedEmail failed');

    await sendEmail(user.email, built.subject, built.html);

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
