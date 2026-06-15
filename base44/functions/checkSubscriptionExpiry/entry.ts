import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    // Load email templates once
    const templateSettings = await base44.asServiceRole.entities.PlatformSettings.filter({ key: 'email_templates' });
    const templates = templateSettings[0]?.value || {};

    // Find all active subscriptions
    const activeSubscriptions = await base44.asServiceRole.entities.Subscription.filter({ status: 'active' });

    let expiredCount = 0;
    let expiringSoonCount = 0;

    for (const sub of activeSubscriptions) {
      if (!sub.end_date) continue;
      const endDate = new Date(sub.end_date);

      // ── EXPIRED ────────────────────────────────────────────────────────────
      if (endDate < now) {
        await base44.asServiceRole.entities.Subscription.update(sub.id, { status: 'expired' });
        expiredCount++;

        await base44.asServiceRole.entities.Notification.create({
          user_id: sub.student_id,
          title: 'Your subscription has expired',
          message: 'Your school fees subscription has expired. Pay your fees to continue accessing all lessons.',
          type: 'subscription',
          link: '/subscription',
          is_read: false,
        });

        const subject = templates.subscription_expired_subject || 'Your Chibondo Academy subscription has expired';
        const bodyTemplate = templates.subscription_expired_body ||
          `Dear Student,\n\nYour school fees subscription expired on {end_date}.\n\nPlease renew your subscription to continue accessing all lessons and course materials.\n\nVisit {subscription_link} to pay your fees.\n\nRegards,\nThe Chibondo Academy Team`;

        const body = bodyTemplate
          .replace(/\{end_date\}/g, endDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }))
          .replace(/\{subscription_link\}/g, 'https://www.chibondoacademy.com/subscription');

        const users = await base44.asServiceRole.entities.User.filter({ id: sub.student_id });
        if (users[0]?.email) {
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: users[0].email,
            subject,
            body: body.replace(/\{student_name\}/g, users[0].full_name || 'Student'),
          });
          console.log(`✅ Expiry email sent to ${users[0].email}`);
        }
        continue;
      }

      // ── EXPIRING SOON (within 3 days) ──────────────────────────────────────
      const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
      if (daysLeft <= 3) {
        // Only send once — check if we already sent a "expiring soon" notification recently
        const recentNotifs = await base44.asServiceRole.entities.Notification.filter({
          user_id: sub.student_id,
          type: 'subscription_expiring',
        });
        // Don't re-send if we already sent one in the last 24h
        const alreadySent = recentNotifs.some((n: any) => {
          const sentAt = new Date(n.created_date);
          return (now.getTime() - sentAt.getTime()) < 24 * 60 * 60 * 1000;
        });
        if (alreadySent) continue;

        expiringSoonCount++;

        await base44.asServiceRole.entities.Notification.create({
          user_id: sub.student_id,
          title: `Your subscription expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`,
          message: `Renew your fees before ${endDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })} to avoid losing access.`,
          type: 'subscription_expiring',
          link: '/subscription',
          is_read: false,
        });

        const subject = templates.subscription_expiring_subject || 'Your Chibondo Academy subscription expires soon';
        const bodyTemplate = templates.subscription_expiring_body ||
          `Dear Student,\n\nThis is a reminder that your school fees subscription will expire on {end_date}.\n\nRenew before it expires to avoid interruption to your studies.\n\nVisit {subscription_link} to renew.\n\nRegards,\nThe Chibondo Academy Team`;

        const body = bodyTemplate
          .replace(/\{end_date\}/g, endDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }))
          .replace(/\{subscription_link\}/g, 'https://www.chibondoacademy.com/subscription')
          .replace(/\{days_left\}/g, String(daysLeft));

        const users = await base44.asServiceRole.entities.User.filter({ id: sub.student_id });
        if (users[0]?.email) {
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: users[0].email,
            subject,
            body: body.replace(/\{student_name\}/g, users[0].full_name || 'Student'),
          });
          console.log(`✅ Expiring-soon email sent to ${users[0].email} (${daysLeft} days left)`);
        }
      }
    }

    console.log(`Expiry check complete — expired: ${expiredCount}, expiring soon: ${expiringSoonCount}`);
    return Response.json({ checked: activeSubscriptions.length, expired: expiredCount, expiring_soon: expiringSoonCount });
  } catch (error) {
    console.error('Expiry check error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
