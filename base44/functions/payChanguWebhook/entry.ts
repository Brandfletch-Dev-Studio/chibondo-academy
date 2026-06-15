import { createClient } from 'npm:@base44/sdk@0.8.31';

// ── Branded email helper ────────────────────────────────────────────────────
async function sendBrandedEmail(base44: any, to: string, type: string, variables: Record<string, string | number>) {
  try {
    const built = await base44.asServiceRole.functions.invoke('buildBrandedEmail', { type, variables });
    if (!built || built.error) throw new Error(built?.error || 'buildBrandedEmail failed');
    await base44.asServiceRole.integrations.Core.SendEmail({ to, subject: built.subject, body: built.html });
    console.log(`✅ Branded email (${type}) sent to ${to}`);
  } catch (err: any) {
    console.error(`sendBrandedEmail(${type}) failed — falling back:`, err.message);
    // Plain text fallback
    await base44.asServiceRole.integrations.Core.SendEmail({
      to,
      subject: type === 'payment_confirmed' ? 'Payment Confirmed – Chibondo Academy' : type,
      body: `Hi,\n\nYour subscription update is confirmed. Visit https://www.chibondoacademy.com/dashboard to continue.\n\nChibondo Academy`,
    });
  }
}

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
      console.error('No tx_ref in payload:', JSON.stringify(payload));
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

  // Upgrade referral
  try {
    const commSettings = await base44.asServiceRole.entities.PlatformSettings.filter({ key: 'affiliate_commission' });
    const commAmount = commSettings[0]?.value?.commission_amount ?? commSettings[0]?.value?.fixed_amount ?? 10000;
    const referrals = await base44.asServiceRole.entities.Referral.filter({ referred_user_id: studentId });
    for (const ref of referrals) {
      if (ref.status === 'registered' || ref.status === 'pending') {
        await base44.asServiceRole.entities.Referral.update(ref.id, {
          status: 'paid', reward_amount: commAmount, reward_status: 'pending',
        });
      }
    }
  } catch (refErr) { console.error('Referral upgrade error:', refErr); }

  await base44.asServiceRole.entities.Notification.create({
    user_id: studentId,
    title: 'Payment confirmed — full access unlocked!',
    message: `Your ${sub.plan} subscription is active until ${endDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.`,
    type: 'subscription', link: '/dashboard', is_read: false,
  });

  // Send branded HTML email
  try {
    const users = await base44.asServiceRole.entities.User.filter({ id: studentId });
    if (users[0]?.email) {
      await sendBrandedEmail(base44, users[0].email, 'payment_confirmed', {
        student_name: users[0].full_name || 'Student',
        end_date: endDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
        plan: sub.plan,
        highlight_label: 'Plan',
        highlight_value: `${sub.plan.charAt(0).toUpperCase() + sub.plan.slice(1)} — active until ${endDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`,
      });
    }
  } catch (e) { console.error('Email non-fatal:', e); }

  console.log(`✅ Activated ${sub.plan} for student ${studentId}`);
}
