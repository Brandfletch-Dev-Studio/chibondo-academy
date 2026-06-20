import { createClient } from 'npm:@base44/sdk@0.8.31';

// ── Resend email sender ───────────────────────────────────────────────────────
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || 're_Z2rVV1Yz_BapfeMWdpLWbHuBjyJ6QTpaD';
const FROM_ADDRESS   = 'Chibondo Academy <noreply@chibondoacademy.com>';

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM_ADDRESS, to: [to], subject, html }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend error ${res.status}: ${err}`);
  }
  const d = await res.json();
  console.log(`✅ Email sent to ${to} — Resend ID: ${d.id}`);
}


async function sendBrandedEmail(base44: any, to: string, type: string, variables: Record<string, string | number>) {
  try {
    const built = await base44.asServiceRole.functions.invoke('buildBrandedEmail', { type, variables });
    if (!built || built.error) throw new Error(built?.error || 'buildBrandedEmail failed');
    await sendEmail(to, built.subject, built.html);
  } catch (err: any) {
    console.error(`sendBrandedEmail(${type}) failed — falling back to plain text:`, err.message);
    await sendEmail(
      to,
      type === 'payment_confirmed' ? 'Payment Confirmed – Chibondo Academy' : 'Chibondo Academy Notification',
      `<p>Hi,</p><p>Your subscription update is confirmed. Visit <a href="https://www.chibondoacademy.com/dashboard">your dashboard</a> to continue.</p><p>Chibondo Academy</p>`,
    );
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

  // Check if there's already an active sub — if so this is a renewal payment
  const activeSubs = await base44.asServiceRole.entities.Subscription.filter({ student_id: studentId, status: 'active' });
  const isRenewal = activeSubs.length > 0;

  let sub: any;

  if (isRenewal) {
    // Extend the existing active subscription
    sub = activeSubs[0];
    const currentEnd = sub.end_date ? new Date(sub.end_date) : new Date();
    // Extend from current end date (not today) to avoid losing time
    const baseDate = currentEnd > new Date() ? currentEnd : new Date();
    const newEnd = new Date(baseDate);
    if (sub.plan === 'monthly')       newEnd.setMonth(newEnd.getMonth() + 1);
    else if (sub.plan === 'annual')   newEnd.setFullYear(newEnd.getFullYear() + 1);
    else if (sub.plan === 'biannual') newEnd.setFullYear(newEnd.getFullYear() + 2);
    else if (sub.plan === 'quarterly') newEnd.setMonth(newEnd.getMonth() + 3);

    await base44.asServiceRole.entities.Subscription.update(sub.id, {
      end_date: newEnd.toISOString(),
    });
    await base44.asServiceRole.entities.Payment.update(payment.id, {
      status: 'completed',
      description: `${sub.plan} renewal — webhook confirmed`,
    });
    console.log(`✅ Renewed ${sub.plan} for student ${studentId} until ${newEnd.toISOString()}`);
  } else {
    // First-time activation from trial
    const trials = await base44.asServiceRole.entities.Subscription.filter({ student_id: studentId, status: 'trial' });
    if (trials.length === 0) {
      console.error(`No trial or active sub for student ${studentId}`);
      return;
    }
    sub = trials[0];
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
  }

  // ── Commission logic ──────────────────────────────────────────────────────
  try {
    const commSettings = await base44.asServiceRole.entities.PlatformSettings.filter({ key: 'affiliate_commission' });
    const cfg = commSettings[0]?.value || {};
    const recurringEnabled = cfg.recurring_commission === true;

    // Calculate commission amount based on commission_type
    let commAmount = 0;
    if (cfg.commission_type === 'percentage') {
      commAmount = Math.round(((cfg.percentage_rate || 10) / 100) * (payment.amount || 0));
    } else if (cfg.commission_type === 'tiered') {
      // Count referrer's total paid referrals to determine tier
      const referrals = await base44.asServiceRole.entities.Referral.filter({ referred_user_id: studentId });
      const referrerId = referrals[0]?.referrer_id;
      if (referrerId) {
        const allRefByReferrer = await base44.asServiceRole.entities.Referral.filter({ referrer_id: referrerId });
        const paidCount = allRefByReferrer.filter((r: any) => ['paid','rewarded'].includes(r.status)).length;
        if (paidCount >= (cfg.tier3_referrals || 30)) commAmount = Math.round(((cfg.tier3_rate || 20) / 100) * (payment.amount || 0));
        else if (paidCount >= (cfg.tier2_referrals || 15)) commAmount = Math.round(((cfg.tier2_rate || 15) / 100) * (payment.amount || 0));
        else commAmount = Math.round(((cfg.tier1_rate || 10) / 100) * (payment.amount || 0));
      }
    } else {
      // fixed
      commAmount = cfg.fixed_amount ?? cfg.commission_amount ?? 10000;
    }

    const existingReferrals = await base44.asServiceRole.entities.Referral.filter({ referred_user_id: studentId });

    if (!isRenewal) {
      // First payment: upgrade the pending referral record
      for (const ref of existingReferrals) {
        if (ref.status === 'registered' || ref.status === 'pending') {
          await base44.asServiceRole.entities.Referral.update(ref.id, {
            status: 'paid',
            reward_amount: commAmount,
            reward_status: 'pending',
          });
        }
      }
    } else if (recurringEnabled && existingReferrals.length > 0) {
      // Renewal payment: create a new referral reward record for each referrer
      for (const ref of existingReferrals) {
        if (['paid', 'rewarded'].includes(ref.status)) {
          await base44.asServiceRole.entities.Referral.create({
            referrer_id: ref.referrer_id,
            referrer_name: ref.referrer_name,
            referred_email: ref.referred_email,
            referred_user_id: studentId,
            referred_name: ref.referred_name,
            referral_code: ref.referral_code,
            status: 'paid',
            reward_amount: commAmount,
            reward_status: 'pending',
            notes: `Recurring commission — renewal payment ${payment.reference || payment.id}`,
          });
          console.log(`✅ Recurring commission MWK ${commAmount} created for referrer ${ref.referrer_id}`);
        }
      }
    }
  } catch (refErr) { console.error('Commission error:', refErr); }

  // Notification to student
  const endDate = sub.end_date ? new Date(sub.end_date) : new Date();
  await base44.asServiceRole.entities.Notification.create({
    user_id: studentId,
    title: isRenewal ? 'Subscription renewed!' : 'Payment confirmed — full access unlocked!',
    message: `Your ${sub.plan} subscription is active until ${endDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.`,
    type: 'subscription', link: '/dashboard', is_read: false,
  });

  // Branded email
  try {
    const users = await base44.asServiceRole.entities.User.filter({ id: studentId });
    if (users[0]?.email) {
      await sendBrandedEmail(base44, users[0].email, 'payment_confirmed', {
        student_name: users[0].full_name || 'Student',
        end_date: endDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
        plan: sub.plan,
        amount: String(payment.amount || ''),
        highlight_label: 'Plan',
        highlight_value: `${sub.plan.charAt(0).toUpperCase() + sub.plan.slice(1)} — active until ${endDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`,
      });
    }
  } catch (e) { console.error('Email non-fatal:', e); }
}
