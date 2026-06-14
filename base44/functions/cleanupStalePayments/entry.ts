import { createClient } from 'npm:@base44/sdk@0.8.31';

// Scheduled cleanup: cancel stale 'trial' subscriptions and 'pending' payments
// that were never activated after 24 hours (abandoned / failed payments)
Deno.serve(async (req) => {
  try {
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
          status: 'cancelled',
          description: 'Auto-cancelled: payment not confirmed within 24 hours',
        });
        cancelledPayments++;
      }
    }

    console.log(`Cleanup: cancelled ${cancelledSubs} stale subscriptions, ${cancelledPayments} stale payments`);
    return Response.json({ success: true, cancelledSubs, cancelledPayments });
  } catch (error) {
    console.error('Cleanup error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
