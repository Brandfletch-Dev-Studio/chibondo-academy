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

    // Step 3: Payment confirmed — activate subscription
    const studentId = payment.student_id;

    const activeSubs = await base44.asServiceRole.entities.Subscription.filter({ student_id: studentId, status: 'active' });
    if (activeSubs.length > 0) {
      await base44.asServiceRole.entities.Payment.update(payment.id, { status: 'completed' });
      return Response.json({ success: true, already_activated: true });
    }

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

    // Upgrade referral
    try {
      const commSettings = await base44.asServiceRole.entities.PlatformSettings.filter({ key: 'affiliate_commission' });
      const commAmount = commSettings[0]?.value?.commission_amount ?? commSettings[0]?.value?.fixed_amount ?? 10000;
      const referrals = await base44.asServiceRole.entities.Referral.filter({ referred_user_id: studentId });
      for (const ref of referrals) {
        if (ref.status === 'registered' || ref.status === 'pending') {
          await base44.asServiceRole.entities.Referral.update(ref.id, {
            status: 'paid',
            reward_amount: commAmount,
            reward_status: 'pending',
          });
        }
      }
    } catch (refErr) { console.error('Referral upgrade error:', refErr); }

    // Notification
    await base44.asServiceRole.entities.Notification.create({
      user_id: studentId,
      title: 'Payment confirmed — full access unlocked!',
      message: `Your ${sub.plan} subscription is active until ${endDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.`,
      type: 'subscription', link: '/dashboard', is_read: false,
    });

    // Send email using custom template
    try {
      const users = await base44.asServiceRole.entities.User.filter({ id: studentId });
      const userEmail = users[0]?.email;
      const userName = users[0]?.full_name || 'Student';

      if (userEmail) {
        const templateSettings = await base44.asServiceRole.entities.PlatformSettings.filter({ key: 'email_templates' });
        const templates = templateSettings[0]?.value || {};
        const endDateFormatted = endDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

        const subject = templates.payment_confirmed_subject || 'Payment Confirmed – Chibondo Academy';
        const bodyTemplate = templates.payment_confirmed_body ||
          `Dear {student_name},\n\nYour payment has been received and your subscription is now active until {end_date}.\n\nYou now have full access to all lessons and course materials.\n\nVisit {dashboard_link} to start learning.\n\nRegards,\nThe Chibondo Academy Team`;

        const body = bodyTemplate
          .replace(/\{student_name\}/g, userName)
          .replace(/\{end_date\}/g, endDateFormatted)
          .replace(/\{dashboard_link\}/g, 'https://www.chibondoacademy.com/dashboard')
          .replace(/\{plan\}/g, sub.plan);

        await base44.asServiceRole.integrations.Core.SendEmail({ to: userEmail, subject, body });
        console.log(`✅ Payment confirmed email sent to ${userEmail}`);
      }
    } catch (e) { console.error('Email non-fatal:', e); }

    console.log(`✅ Activated ${sub.plan} for student ${studentId} via API verify`);
    return Response.json({ success: true });

  } catch (err: any) {
    console.error('verifyPayChanguPayment error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
});
