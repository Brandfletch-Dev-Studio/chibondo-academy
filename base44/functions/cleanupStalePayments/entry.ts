/**
 * cleanupStalePayments
 * Self-scheduled via Deno.cron — runs daily at 02:00 UTC, no agent credits needed.
 * Cancels trial subscriptions and pending payments older than 24 hours
 * that were never activated (abandoned / failed payments).
 * Also callable via HTTP POST for manual testing.
 */
import { createClient } from 'npm:@base44/sdk@0.8.31';

async function runCleanup() {
  const base44 = createClient({ appId: '6a2115bb078a7219b5cbd8b0' });

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  let cancelledSubs = 0;
  let cancelledPayments = 0;

  // Cancel stale trial subscriptions older than 24h
  const staleTrials = await base44.asServiceRole.entities.Subscription.filter({ status: 'trial' });
  for (const sub of staleTrials) {
    if (sub.created_date < cutoff) {
      await base44.asServiceRole.entities.Subscription.update(sub.id, { status: 'cancelled' });
      cancelledSubs++;
    }
  }

  // Cancel stale pending payments older than 24h
  const stalePending = await base44.asServiceRole.entities.Payment.filter({ status: 'pending' });
  for (const p of stalePending) {
    if (p.created_date < cutoff) {
      await base44.asServiceRole.entities.Payment.update(p.id, {
        status: 'failed',
        description: (p.description || '') + ' | Auto-cancelled: not confirmed within 24h',
      });
      cancelledPayments++;
    }
  }

  console.log(`[cleanup] Cancelled ${cancelledSubs} stale subscriptions, ${cancelledPayments} stale payments`);
  return { success: true, cancelledSubs, cancelledPayments };
}

// ── Hardcoded daily cron at 02:00 UTC — no agent credits ─────────────────
Deno.cron('cleanup-stale-daily', '0 2 * * *', async () => {
  console.log('[cleanup cron] Firing daily cleanup...');
  await runCleanup().catch(e => console.error('[cleanup cron] Error:', e));
});

// ── HTTP endpoint for manual trigger / testing ────────────────────────────
Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ ok: true, message: 'Cleanup stale payments — POST to trigger manually' });
  }
  try {
    const result = await runCleanup();
    return Response.json(result);
  } catch (error: any) {
    console.error('[cleanup] HTTP error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
