/**
 * sendWelcomeEmail
 * Called by the frontend (VerifyOtp) immediately after OTP verification succeeds.
 * Sends a branded welcome email to the newly verified student.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Must be authenticated (called right after verifyOtp sets the token)
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Idempotency: only send once — check if a welcome notification already exists
    const existing = await base44.asServiceRole.entities.Notification.filter({
      user_id: user.id,
      type: 'welcome',
    });
    if (existing.length > 0) {
      console.log(`Welcome email already sent for ${user.email} — skipping`);
      return Response.json({ skipped: true });
    }

    // Build and send branded email
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

    // Record a welcome notification so we never double-send
    await base44.asServiceRole.entities.Notification.create({
      user_id: user.id,
      title: 'Welcome to Chibondo Academy!',
      message: 'Your account is verified. Start exploring your subjects.',
      type: 'welcome',
      link: '/dashboard',
      is_read: false,
    });

    console.log(`✅ Welcome email sent to ${user.email}`);
    return Response.json({ success: true });

  } catch (err: any) {
    console.error('sendWelcomeEmail error:', err);
    // Non-fatal — don't break the user's login flow
    return Response.json({ error: err.message }, { status: 500 });
  }
});
