import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ── Branded email helper ────────────────────────────────────────────────────
async function sendBrandedEmail(base44: any, to: string, type: string, variables: Record<string, string | number>) {
  try {
    const built = await base44.asServiceRole.functions.invoke('buildBrandedEmail', { type, variables });
    if (!built || built.error) throw new Error(built?.error || 'buildBrandedEmail failed');
    await base44.asServiceRole.integrations.Core.SendEmail({ to, subject: built.subject, body: built.html });
    console.log(`✅ Branded email (${type}) sent to ${to}`);
  } catch (err: any) {
    console.error(`sendBrandedEmail(${type}) failed:`, err.message);
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const now = new Date();

    // Find all active subscriptions
    const activeSubscriptions = await base44.asServiceRole.entities.Subscription.filter({ status: 'active' });

    let expiredCount = 0;
    let expiringSoonCount = 0;

    for (const sub of activeSubscriptions) {
      if (!sub.end_date) continue;
      const endDate = new Date(sub.end_date);
      const endDateFormatted = endDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

      // ── EXPIRED ──────────────────────────────────────────────────────────
      if (endDate < now) {
        await base44.asServiceRole.entities.Subscription.update(sub.id, { status: 'expired' });
        expiredCount++;

        await base44.asServiceRole.entities.Notification.create({
          user_id: sub.student_id,
          title: 'Your subscription has expired',
          message: 'Your school fees subscription has expired. Pay your fees to continue accessing all lessons.',
          type: 'subscription', link: '/subscription', is_read: false,
        });

        const users = await base44.asServiceRole.entities.User.filter({ id: sub.student_id });
        if (users[0]?.email) {
          await sendBrandedEmail(base44, users[0].email, 'subscription_expired', {
            student_name: users[0].full_name || 'Student',
            end_date: endDateFormatted,
          });
        }
        continue;
      }

      // ── EXPIRING SOON (within 3 days) ────────────────────────────────────
      const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
      if (daysLeft <= 3) {
        // Dedup — don't re-send if already sent in last 24h
        const recentNotifs = await base44.asServiceRole.entities.Notification.filter({
          user_id: sub.student_id,
          type: 'subscription_expiring',
        });
        const alreadySent = recentNotifs.some((n: any) => {
          return (now.getTime() - new Date(n.created_date).getTime()) < 24 * 60 * 60 * 1000;
        });
        if (alreadySent) continue;

        expiringSoonCount++;

        await base44.asServiceRole.entities.Notification.create({
          user_id: sub.student_id,
          title: `Your subscription expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`,
          message: `Renew your fees before ${endDateFormatted} to avoid losing access.`,
          type: 'subscription_expiring', link: '/subscription', is_read: false,
        });

        const users = await base44.asServiceRole.entities.User.filter({ id: sub.student_id });
        if (users[0]?.email) {
          await sendBrandedEmail(base44, users[0].email, 'subscription_expiring', {
            student_name: users[0].full_name || 'Student',
            end_date: endDateFormatted,
            days_left: daysLeft,
          });
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
