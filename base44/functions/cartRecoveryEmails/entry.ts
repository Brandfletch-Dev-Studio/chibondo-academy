/**
 * cartRecoveryEmails
 * Self-scheduled via Deno.cron — runs every hour, no agent credits needed.
 * Finds Payment records still "pending" after 1 hour and sends one branded
 * cart recovery email per student (max once per 24 hours per student).
 * Also callable via HTTP POST for manual testing.
 */
import { createClient } from 'npm:@base44/sdk@0.8.31';

async function runCartRecovery() {
  const base44 = createClient({ appId: '6a2115bb078a7219b5cbd8b0' });

  // Check admin toggle
  const tplSettings = await base44.asServiceRole.entities.PlatformSettings
    .filter({ key: 'email_templates' }).catch(() => []);
  const tplConfig = tplSettings[0]?.value || {};
  if (tplConfig.cart_recovery_enabled === false) {
    console.log('[cartRecovery] Disabled by admin — skipping');
    return { skipped: true, reason: 'disabled by admin' };
  }

  const now = Date.now();
  const oneHourAgo = new Date(now - 1 * 60 * 60 * 1000).toISOString();
  const oneDayAgo  = new Date(now - 24 * 60 * 60 * 1000).toISOString();

  // Payments that are still pending, older than 1h but within 24h
  const allPending = await base44.asServiceRole.entities.Payment.filter({ status: 'pending' });
  const eligible = allPending.filter((p: any) =>
    p.created_date >= oneDayAgo && p.created_date <= oneHourAgo
  );

  if (eligible.length === 0) {
    console.log('[cartRecovery] No eligible pending payments');
    return { sent: 0, skipped: 0 };
  }

  let sent = 0, skipped = 0;

  for (const payment of eligible) {
    // Already sent a recovery email in the last 24h?
    const existing = await base44.asServiceRole.entities.Notification
      .filter({ user_id: payment.student_id, type: 'cart_recovery' });
    const sentRecently = existing.some((n: any) =>
      (now - new Date(n.created_date).getTime()) < 24 * 60 * 60 * 1000
    );
    if (sentRecently) { skipped++; continue; }

    // Student already has an active subscription (paid via another flow)?
    const activeSubs = await base44.asServiceRole.entities.Subscription
      .filter({ student_id: payment.student_id, status: 'active' });
    if (activeSubs.length > 0) { skipped++; continue; }

    // Get user record
    const users = await base44.asServiceRole.entities.User
      .filter({ id: payment.student_id });
    if (!users[0]?.email) { skipped++; continue; }
    const user = users[0];

    try {
      const built = await base44.asServiceRole.functions.invoke('buildBrandedEmail', {
        type: 'cart_recovery',
        variables: {
          student_name: user.full_name || user.email.split('@')[0],
          plan:         payment.description?.split(' ')[0]?.toLowerCase() || 'monthly',
          amount:       String(payment.amount || ''),
        },
      });

      if (!built || built.error) throw new Error(built?.error || 'buildBrandedEmail failed');

      await base44.asServiceRole.integrations.Core.SendEmail({
        to:      user.email,
        subject: built.subject,
        body:    built.html || built.text,
      });

      // Record send so we don't repeat within 24h
      await base44.asServiceRole.entities.Notification.create({
        user_id: user.id,
        title:   'Complete your payment',
        message: 'Cart recovery email sent',
        type:    'cart_recovery',
        is_read: true,
      });

      console.log(`[cartRecovery] Sent to ${user.email}`);
      sent++;
    } catch (e: any) {
      console.error(`[cartRecovery] Email error for ${user.email}:`, e.message);
    }
  }

  console.log(`[cartRecovery] Done — sent: ${sent}, skipped: ${skipped}`);
  return { sent, skipped, eligible: eligible.length };
}

// ── Hardcoded hourly cron — runs independently, no agent credits ──────────
Deno.cron('cart-recovery-hourly', '0 * * * *', async () => {
  console.log('[cartRecovery cron] Firing...');
  await runCartRecovery().catch(e => console.error('[cartRecovery cron] Error:', e));
});

// ── HTTP endpoint for manual trigger / testing ────────────────────────────
Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ ok: true, message: 'Cart recovery — POST to trigger manually' });
  }
  try {
    const result = await runCartRecovery();
    return Response.json({ success: true, ...result });
  } catch (err: any) {
    console.error('[cartRecovery] HTTP trigger error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
});
