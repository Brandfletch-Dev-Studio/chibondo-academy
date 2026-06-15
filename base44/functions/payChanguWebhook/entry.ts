import { createClient } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const body = await req.text();
    let payload: any;
    try { payload = JSON.parse(body); }
    catch { return new Response('OK', { status: 200 }); }

    console.log('PayChangu webhook received:', JSON.stringify(payload));

    const base44 = createClient({ appId: '6a2115bb078a7219b5cbd8b0' });

    const status = (payload.status || '').toLowerCase();

    if (!['success', 'successful'].includes(status)) {
      console.log(`Ignoring status: ${status}`);
      return new Response('OK', { status: 200 });
    }

    const txRef = payload.tx_ref;
    if (!txRef) {
      console.error('No tx_ref in payload, full payload:', JSON.stringify(payload));
      return new Response('OK', { status: 200 });
    }

    const payments = await base44.asServiceRole.entities.Payment.filter({ reference: txRef });

    if (payments.length === 0) {
      console.log(`No payment for tx_ref=${txRef}, trying email fallback`);
      const email = payload.customer?.email || payload.email;
      if (email) {
        const users = await base44.asServiceRole.entities.User.filter({ email });
        if (users.length > 0) {
          const pending = await base44.asServiceRole.entities.Payment.filter({ student_id: users[0].id, status: 'pending' });
          if (pending.length > 0) {
            const match = pending.sort((a: any, b: any) => new Date(b.created_date).getTime() - new Date(a.created_date).getTime())[0];
            await activateSubscription(base44, match);
          }
        }
      }
      return new Response('OK', { status: 200 });
    }

    const payment = payments[0];
    if (payment.status === 'completed') {
      console.log(`Already completed: ${txRef}`);
      return new Response('OK', { status: 200 });
    }

    await activateSubscription(base44, payment);
    return new Response('OK', { status: 200 });

  } catch (err: any) {
    console.error('Webhook error:', err);
    return new Response('OK', { status: 200 });
  }
});

async function getEmailTemplate(base44: any, templateKey: string) {
  try {
    const settings = await base44.asServiceRole.entities.PlatformSettings.filter({ key: 'email_templates' });
    return settings[0]?.value || {};
  } catch {
    return {};
  }
}

async function activateSubscription(base44: any, payment: any) {
  const studentId = payment.student_id;

  const activeSubs = await base44.asServiceRole.entities.Subscription.filter({ student_id: studentId, status: 'active' });
  if (activeSubs.length > 0) {
    await base44.asServiceRole.entities.Payment.update(payment.id, { status: 'completed' });
    return;
  }

  const trials = await base44.asServiceRole.entities.Subscription.filter({ student_id: studentId, status: 'trial' });
  if (trials.length === 0) { console.error(`No trial sub for student ${studentId}`); return; }

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

  // Upgrade referral status from 'registered' → 'paid'
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
        console.log(`✅ Referral ${ref.id} upgraded to paid — reward MWK ${commAmount}`);
      }
    }
  } catch (refErr) { console.error('Referral upgrade error:', refErr); }

  await base44.asServiceRole.entities.Notification.create({
    user_id: studentId,
    title: 'Payment confirmed — full access unlocked!',
    message: `Your ${sub.plan} subscription is active until ${endDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.`,
    type: 'subscription', link: '/dashboard', is_read: false,
  });

  // Send email using custom template from PlatformSettings
  try {
    const users = await base44.asServiceRole.entities.User.filter({ id: studentId });
    const userEmail = users[0]?.email;
    const userName = users[0]?.full_name || 'Student';

    if (userEmail) {
      const templates = await getEmailTemplate(base44, 'email_templates');
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

  console.log(`✅ Activated ${sub.plan} for student ${studentId}`);
}
