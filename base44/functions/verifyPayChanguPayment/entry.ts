import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { tx_ref } = body;
    if (!tx_ref) return Response.json({ error: 'tx_ref required' }, { status: 400 });

    // Step 1: Check DB — webhook may have already activated
    const payments = await base44.asServiceRole.entities.Payment.filter({ reference: tx_ref });
    if (payments.length === 0) return Response.json({ error: 'Payment record not found' }, { status: 404 });

    const payment = payments[0];
    if (payment.status === 'completed') {
      return Response.json({ success: true, already_activated: true });
    }

    // Step 2: Webhook hasn't fired yet — return pending so frontend can retry
    // The webhook at theaca.base44.app/api/functions/payChanguWebhook is the primary activator.
    // Frontend should poll this endpoint every 3s for up to 30s after redirect.
    console.log(`Payment ${tx_ref} still pending — webhook not yet received`);
    return Response.json({ success: false, pending: true });

  } catch (err: any) {
    console.error('verifyPayChanguPayment error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
});
