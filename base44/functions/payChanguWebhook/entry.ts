import { createClient } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const body = await req.text();
    let payload: any;

    try { payload = JSON.parse(body); }
    catch { return new Response('Bad JSON', { status: 400 }); }

    console.log('PayChangu webhook received:', JSON.stringify(payload));

    const base44 = createClient({ appId: Deno.env.get('BASE44_APP_ID') || '6a2115bb078a7219b5cbd8b0' });

    const eventType = payload.event_type || '';
    const status = (payload.status || '').toLowerCase();

    // Only handle successful checkout payments
    if (!eventType.includes('checkout') && !eventType.includes('payment')) {
      console.log(`Ignoring event_type: ${eventType}`);
      return new Response('OK', { status: 200 });
    }

    if (status !== 'success' && status !== 'successful') {
      console.log(`Ignoring non-success status: ${status}`);
      return new Response('OK', { status: 200 });
    }

    // Our tx_ref is in payload.tx_ref for checkout events
    const txRef = payload.tx_ref || payload.reference;
    if (!txRef) {
      console.error('No tx_ref in webhook payload');
      return new Response('OK', { status: 200 });
    }

    // Find our Payment record by tx_ref
    const payments = await base44.asServiceRole.entities.Payment.filter({ reference: txRef });

    if (payments.length === 0) {
      // Try to match by amount + email as fallback
      console.log(`No payment found for tx_ref=${txRef}, trying amount/email match`);
      const amount = Number(payload.amount);
      const email = payload.customer?.email || payload.email;

      if (amount && email) {
        const users = await base44.asServiceRole.entities.User.filter({ email });
        if (users.length > 0) {
          const studentId = users[0].id;
          const pendingPayments = await base44.asServiceRole.entities.Payment.filter({
            student_id: studentId, status: 'pending'
          });
          if (pendingPayments.length > 0) {
            // Use the most recent pending payment
            const match = pendingPayments.sort((a: any, b: any) =>
              new Date(b.created_date).getTime() - new Date(a.created_date).getTime())[0];
            console.log(`Fallback matched payment ${match.id} for student ${studentId}`);
            await activateSubscription(base44, match, payload);
          }
        }
      }
      return new Response('OK', { status: 200 });
    }

    const payment = payments[0];

    // Idempotency — already completed
    if (payment.status === 'completed') {
      console.log(`Payment ${txRef} already completed — skipping`);
      return new Response('OK', { status: 200 });
    }

    await activateSubscription(base44, payment, payload);
    return new Response('OK', { status: 200 });

  } catch (err: any) {
    console.error('Webhook error:', err);
    // Always return 200 to prevent PayChangu retries on our bugs
    return new Response('OK', { status: 200 });
  }
});

async function activateSubscription(base44: any, payment: any, payload: any) {
  const studentId = payment.student_id;

  // Idempotency — check for existing active sub
  const activeSubs = await base44.asServiceRole.entities.Subscription.filter({ student_id: studentId, status: 'active' });
  if (activeSubs.length > 0) {
    console.log(`Student ${studentId} already has active subscription`);
    await base44.asServiceRole.entities.Payment.update(payment.id, { status: 'completed' });
    return;
  }

  // Find trial subscription
  const trials = await base44.asServiceRole.entities.Subscription.filter({ student_id: studentId, status: 'trial' });
  if (trials.length === 0) {
    console.error(`No trial subscription found for student ${studentId}`);
    return;
  }

  const sub = trials[0];
  const startDate = new Date();
  const endDate = new Date();
  if (sub.plan === 'monthly')        endDate.setMonth(endDate.getMonth() + 1);
  else if (sub.plan === 'annual')    endDate.setFullYear(endDate.getFullYear() + 1);
  else if (sub.plan === 'biannual')  endDate.setFullYear(endDate.getFullYear() + 2);
  else if (sub.plan === 'quarterly') endDate.setMonth(endDate.getMonth() + 3);

  await base44.asServiceRole.entities.Subscription.update(sub.id, {
    status: 'active',
    start_date: startDate.toISOString(),
    end_date: endDate.toISOString(),
  });

  await base44.asServiceRole.entities.Payment.update(payment.id, {
    status: 'completed',
    description: `${sub.plan} fees — webhook confirmed`,
  });

  await base44.asServiceRole.entities.Notification.create({
    user_id: studentId,
    title: 'Payment confirmed — full access unlocked!',
    message: `Your ${sub.plan} subscription is active until ${endDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.`,
    type: 'subscription', link: '/dashboard', is_read: false,
  });

  try {
    const users = await base44.asServiceRole.entities.User.filter({ id: studentId });
    if (users[0]?.email) {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: users[0].email,
        subject: 'Payment Confirmed – Chibondo Academy',
        body: `Hi ${users[0].full_name || 'Student'},\n\nYour ${sub.plan} subscription is now active until ${endDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.\n\nStart learning at https://www.chibondoacademy.com/dashboard\n\nChibondo Academy`,
      });
    }
  } catch (e) { console.error('Email non-fatal:', e); }

  console.log(`✅ Webhook activated ${sub.plan} for student ${studentId}`);
}
