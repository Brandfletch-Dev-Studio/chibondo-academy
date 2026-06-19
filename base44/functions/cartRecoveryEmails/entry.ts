/**
 * cartRecoveryEmails
 * Scheduled: every hour (or triggered by automation)
 * Finds Payment records that are still "pending" after 1 hour
 * and have not already had a cart recovery email sent.
 * Sends one branded cart recovery email per student.
 */
import { createClient } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (_req) => {
  try {
    const base44 = createClient({ appId: '6a2115bb078a7219b5cbd8b0' });

    // Check if cart recovery is enabled
    const tplSettings = await base44.asServiceRole.entities.PlatformSettings.filter({ key: 'email_templates' });
    const tplConfig = tplSettings[0]?.value || {};
    if (tplConfig.cart_recovery_enabled === false) {
      return Response.json({ skipped: true, reason: 'disabled by admin' });
    }

    // Find pending payments older than 1 hour but younger than 24 hours
    const now = Date.now();
    const oneHourAgo  = new Date(now - 1 * 60 * 60 * 1000).toISOString();
    const oneDayAgo   = new Date(now - 24 * 60 * 60 * 1000).toISOString();

    const allPending = await base44.asServiceRole.entities.Payment.filter({ status: 'pending' });

    const eligible = allPending.filter((p: any) =>
      p.created_date >= oneDayAgo &&
      p.created_date <= oneHourAgo
    );

    if (eligible.length === 0) {
      console.log('cartRecovery: no eligible pending payments');
      return Response.json({ sent: 0 });
    }

    let sent = 0;
    let skipped = 0;

    for (const payment of eligible) {
      // Skip if already sent a cart recovery notification for this student today
      const existing = await base44.asServiceRole.entities.Notification.filter({
        user_id: payment.student_id,
        type: 'cart_recovery',
      });
      const sentToday = existing.some((n: any) => {
        const d = new Date(n.created_date);
        return (now - d.getTime()) < 24 * 60 * 60 * 1000;
      });
      if (sentToday) { skipped++; continue; }

      // Get student info
      const users = await base44.asServiceRole.entities.User.filter({ id: payment.student_id });
      if (!users[0]?.email) { skipped++; continue; }
      const user = users[0];

      // Skip if student is already active (paid via another method / webhook already fired)
      const activeSubs = await base44.asServiceRole.entities.Subscription.filter({ student_id: user.id, status: 'active' });
      if (activeSubs.length > 0) { skipped++; continue; }

      // Build and send email
      try {
        const built = await base44.asServiceRole.functions.invoke('buildBrandedEmail', {
          type: 'cart_recovery',
          variables: {
            student_name: user.full_name || user.email.split('@')[0],
            plan: payment.description?.split(' ')[0]?.toLowerCase() || 'monthly',
            amount: String(payment.amount || ''),
          },
        });

        if (!built || built.error) throw new Error(built?.error || 'buildBrandedEmail failed');

        await base44.asServiceRole.integrations.Core.SendEmail({
          to: user.email,
          subject: built.subject,
          body: built.html || built.text,
        });

        // Record that we sent it — prevents duplicates
        await base44.asServiceRole.entities.Notification.create({
          user_id:  user.id,
          title:    'Finish your payment',
          message:  'Cart recovery email sent',
          type:     'cart_recovery',
          is_read:  true, // silent — don't show in notification bell
        });

        console.log(`✅ Cart recovery sent to ${user.email}`);
        sent++;
      } catch (emailErr: any) {
        console.error(`Email error for ${user.email}:`, emailErr.message);
      }
    }

    return Response.json({ sent, skipped, eligible: eligible.length });

  } catch (err: any) {
    console.error('cartRecoveryEmails error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
});
