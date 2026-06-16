import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

async function sendBrandedEmail(base44: any, to: string, type: string, variables: Record<string, string | number>) {
  try {
    const built = await base44.asServiceRole.functions.invoke('buildBrandedEmail', { type, variables });
    if (!built || built.error) throw new Error(built?.error || 'buildBrandedEmail failed');
    await base44.asServiceRole.integrations.Core.SendEmail({ to, subject: built.subject, body: built.html });
    console.log(`✅ Branded email (${type}) sent to ${to}`);
  } catch (err: any) {
    console.error(`sendBrandedEmail(${type}) failed — falling back:`, err.message);
    await base44.asServiceRole.integrations.Core.SendEmail({
      to,
      subject: 'Payment Confirmed – Chibondo Academy',
      body: `Hi,\n\nYour subscription is now active. Visit https://www.chibondoacademy.com/dashboard to continue.\n\nChibondo Academy`,
    });
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { tx_ref } = body;
    if (!tx_ref) return Response.json({ error: 'tx_ref required' }, { status: 400 });

    const payments = await base44.asServiceRole.entities.Payment.filter({ reference: tx_ref });
    if (payments.length === 0) return Response.json({ error: 'Payment record not found' }, { status: 404 });

    const payment = payments[0];
    if (payment.status === 'completed') return Response.json({ success: true, already_activated: true });

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

    const studentId = payment.student_id;

    // Check renewal vs first activation
    const activeSubs = await base44.asServiceRole.entities.Subscription.filter({ student_id: studentId, status: 'active' });
    const isRenewal = activeSubs.length > 0;

    let sub: any;
    let endDate: Date;

    if (isRenewal) {
      sub = activeSubs[0];
      const currentEnd = sub.end_date ? new Date(sub.end_date) : new Date();
      const baseDate = currentEnd > new Date() ? currentEnd : new Date();
      endDate = new Date(baseDate);
      if (sub.plan === 'monthly')        endDate.setMonth(endDate.getMonth() + 1);
      else if (sub.plan === 'annual')    endDate.setFullYear(endDate.getFullYear() + 1);
      else if (sub.plan === 'biannual')  endDate.setFullYear(endDate.getFullYear() + 2);
      else if (sub.plan === 'quarterly') endDate.setMonth(endDate.getMonth() + 3);

      await base44.asServiceRole.entities.Subscription.update(sub.id, {
        end_date: endDate.toISOString(),
      });
      await base44.asServiceRole.entities.Payment.update(payment.id, {
        status: 'completed',
        description: `${sub.plan} renewal — verified via PayChangu API`,
      });
    } else {
      const trials = await base44.asServiceRole.entities.Subscription.filter({ student_id: studentId, status: 'trial' });
      if (trials.length === 0) {
        console.error(`No trial sub for student ${studentId}`);
        return Response.json({ success: false, pending: true });
      }
      sub = trials[0];
      const startDate = new Date();
      endDate = new Date();
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
    }

    // ── Commission logic ──────────────────────────────────────────────────
    try {
      const commSettings = await base44.asServiceRole.entities.PlatformSettings.filter({ key: 'affiliate_commission' });
      const cfg = commSettings[0]?.value || {};
      const recurringEnabled = cfg.recurring_commission === true;

      let commAmount = 0;
      if (cfg.commission_type === 'percentage') {
        commAmount = Math.round(((cfg.percentage_rate || 10) / 100) * (payment.amount || 0));
      } else if (cfg.commission_type === 'tiered') {
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
        commAmount = cfg.fixed_amount ?? cfg.commission_amount ?? 10000;
      }

      const existingReferrals = await base44.asServiceRole.entities.Referral.filter({ referred_user_id: studentId });

      if (!isRenewal) {
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
          }
        }
      }
    } catch (refErr) { console.error('Commission error:', refErr); }

    await base44.asServiceRole.entities.Notification.create({
      user_id: studentId,
      title: isRenewal ? 'Subscription renewed!' : 'Payment confirmed — full access unlocked!',
      message: `Your ${sub.plan} subscription is active until ${endDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.`,
      type: 'subscription', link: '/dashboard', is_read: false,
    });

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

    console.log(`✅ ${isRenewal ? 'Renewed' : 'Activated'} ${sub.plan} for student ${studentId} via API verify`);
    return Response.json({ success: true });

  } catch (err: any) {
    console.error('verifyPayChanguPayment error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
});
