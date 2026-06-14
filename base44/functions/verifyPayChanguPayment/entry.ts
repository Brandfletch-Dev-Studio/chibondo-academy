import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { tx_ref } = body;
    if (!tx_ref) return Response.json({ error: 'tx_ref required' }, { status: 400 });

    // Step 1: Check DB — already activated?
    const payments = await base44.asServiceRole.entities.Payment.filter({ reference: tx_ref });
    if (payments.length === 0) return Response.json({ error: 'Payment record not found' }, { status: 404 });

    const payment = payments[0];
    if (payment.status === 'completed') {
      return Response.json({ success: true, already_activated: true });
    }

    // Step 2: Ask PayChangu directly to confirm the transaction
    const secretKey = Deno.env.get('PAYCHANGU_SECRET_KEY');
    if (!secretKey) return Response.json({ success: false, pending: true });

    let pcStatus = '';
    try {
      const pcRes = await fetch(`https://api.paychangu.com/verify-payment/${tx_ref}`, {
        headers: { 'Authorization': `Bearer ${secretKey}`, 'Accept': 'application/json' },
      });
      const pcData = await pcRes.json();
      console.log('PayChangu verify response:', JSON.stringify(pcData));
      // Status can be at pcData.data.status or pcData.status
      pcStatus = (pcData?.data?.status || pcData?.status || '').toLowerCase();
    } catch (e) {
      console.error('PayChangu verify API error:', e);
      return Response.json({ success: false, pending: true });
    }

    const isSuccess = ['success', 'successful', 'completed'].includes(pcStatus);
    const isFailed  = ['failed', 'cancelled', 'canceled'].includes(pcStatus);

    if (isFailed) {
      await base44.asServiceRole.entities.Payment.update(payment.id, { status: 'failed' });
      return Response.json({ success: false, failed: true });
    }

    if (!isSuccess) {
      console.log(`PayChangu status is "${pcStatus}" — still pending`);
      return Response.json({ success: false, pending: true });
    }

    // Step 3: Payment confirmed by PayChangu — activate subscription
    const studentId = payment.student_id;

    // Check if already active
    const activeSubs = await base44.asServiceRole.entities.Subscription.filter({ student_id: studentId, status: 'active' });
    if (activeSubs.length > 0) {
      await base44.asServiceRole.entities.Payment.update(payment.id, { status: 'completed' });
      return Response.json({ success: true, already_activated: true });
    }

    // Get trial subscription to upgrade
    const trials = await base44.asServiceRole.entities.Subscription.filter({ student_id: studentId, status: 'trial' });
    if (trials.length === 0) {
      console.error(`No trial sub for student ${studentId}`);
      return Response.json({ success: false, pending: true });
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
      description: `${sub.plan} fees — verified via PayChangu API`,
    });

    // Send notification
    await base44.asServiceRole.entities.Notification.create({
      user_id: studentId,
      title: 'Payment confirmed — full access unlocked!',
      message: `Your ${sub.plan} subscription is active until ${endDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.`,
      type: 'subscription', link: '/dashboard', is_read: false,
    });

    // Send email
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

    console.log(`✅ Activated ${sub.plan} for student ${studentId} via API verify`);
    return Response.json({ success: true });

  } catch (err: any) {
    console.error('verifyPayChanguPayment error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
});
