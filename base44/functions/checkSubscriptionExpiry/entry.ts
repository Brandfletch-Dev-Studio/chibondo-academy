import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const now = new Date();

    // Find all active subscriptions
    const activeSubscriptions = await base44.asServiceRole.entities.Subscription.filter({ status: 'active' });

    let expiredCount = 0;

    for (const sub of activeSubscriptions) {
      if (!sub.end_date) continue;
      const endDate = new Date(sub.end_date);
      if (endDate >= now) continue; // Still valid

      // Mark subscription as expired
      await base44.asServiceRole.entities.Subscription.update(sub.id, { status: 'expired' });
      expiredCount++;

      // Send notification to the student
      await base44.asServiceRole.entities.Notification.create({
        user_id: sub.student_id,
        title: 'Your subscription has expired',
        message: 'Your school fees subscription has expired. Pay your fees to continue accessing all lessons.',
        type: 'subscription',
        link: '/subscription',
        is_read: false,
      });

      // Get email template from platform settings
      const emailTemplateSettings = await base44.asServiceRole.entities.PlatformSettings.filter({ key: 'email_templates' });
      const templates = emailTemplateSettings[0]?.value || {};

      const subject = templates.subscription_expired_subject || 'Your Chibondo Academy subscription has expired';
      const bodyTemplate = templates.subscription_expired_body ||
        `Dear Student,\n\nYour school fees subscription expired on {end_date}.\n\nPlease renew your subscription to continue accessing all lessons and course materials.\n\nVisit {subscription_link} to pay your fees.\n\nRegards,\nThe Chibondo Academy Team`;

      const body = bodyTemplate
        .replace('{end_date}', endDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }))
        .replace('{subscription_link}', 'https://app.chibondo.mw/subscription');

      // Find the user's email
      const users = await base44.asServiceRole.entities.User.filter({ id: sub.student_id });
      if (users[0]?.email) {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: users[0].email,
          subject,
          body,
        });
        console.log(`✅ Expiry email sent to ${users[0].email} for sub ${sub.id}`);
      }
    }

    console.log(`Expiry check complete — expired: ${expiredCount}`);
    return Response.json({ checked: activeSubscriptions.length, expired: expiredCount });
  } catch (error) {
    console.error('Expiry check error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});