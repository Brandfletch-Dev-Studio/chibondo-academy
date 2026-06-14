import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { tx_ref } = body;
    if (!tx_ref) return Response.json({ error: 'tx_ref required' }, { status: 400 });

    const secretKey = Deno.env.get('PAYCHANGU_SECRET_KEY');
    if (!secretKey) return Response.json({ error: 'PayChangu not configured' }, { status: 500 });

    // ── Step 1: Find our Payment record ──────────────────────────────────────
    const payments = await base44.asServiceRole.entities.Payment.filter({ reference: tx_ref });
    if (payments.length === 0) return Response.json({ error: 'Payment not found' }, { status: 404 });

    const payment = payments[0];

    // Already completed — webhook got here first, no action needed
    if (payment.status === 'completed') {
      return Response.json({ success: true, already_activated: true });
    }

    const studentId = payment.student_id;

    // ── Step 2: Ask PayChangu if payment went through ────────────────────────
    let pcStatus = 'unknown';
    let isSuccess = false;
    let isFailed = false;

    for (let attempt = 1; attempt <= 4; attempt++) {
      const r = await fetch(`https://api.paychangu.com/verify-payment/${tx_ref}`, {
        headers: { 'Authorization': `Bearer ${secretKey}`, 'Accept': 'application/json' },
      });
      const raw = await r.text();
      let pcData: any = {};
      try { pcData = JSON.parse(raw); } catch { break; }

      console.log(`verify attempt ${attempt}:`, JSON.stringify(pcData));

      // PayChangu can nest status in different places depending on version
      pcStatus = (
        pcData?.data?.status ||
        pcData?.data?.payment_status ||
        pcData?.status ||
        'unknown'
      ).toLowerCase();

      if (['success', 'successful', 'completed', 'paid'].includes(pcStatus)) { isSuccess = true; break; }
      if (['failed', 'cancelled', 'canceled', 'rejected', 'expired'].includes(pcStatus)) { isFailed = true; break; }

      if (attempt < 4) await new Promise(r => setTimeout(r, 3000));
    }

    // ── Step 3a: Payment failed — mark records ────────────────────────────────
    if (isFailed) {
      await base44.asServiceRole.entities.Payment.update(payment.id, {
        status: 'failed', description: `PayChangu status: ${pcStatus}`,
      });
      const trials = await base44.asServiceRole.entities.Subscription.filter({ student_id: studentId, status: 'trial' });
      for (const s of trials) await base44.asServiceRole.entities.Subscription.update(s.id, { status: 'cancelled' });
      return Response.json({ success: false, failed: true });
    }

    // ── Step 3b: Still pending after all retries ──────────────────────────────
    if (!isSuccess) {
      return Response.json({ success: false, pending: true });
    }

    // ── Step 4: SUCCESS — activate subscription ───────────────────────────────
    // Check if webhook already activated while we were polling
    const activeSubs = await base44.asServiceRole.entities.Subscription.filter({ student_id: studentId, status: 'active' });
    if (activeSubs.length > 0) {
      return Response.json({ success: true, already_activated: true });
    }

    const trials = await base44.asServiceRole.entities.Subscription.filter({ student_id: studentId, status: 'trial' });
    if (trials.length === 0) return Response.json({ error: 'Subscription not found' }, { status: 404 });

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
      description: `${sub.plan} fees confirmed`,
    });

    // In-app notification
    await base44.asServiceRole.entities.Notification.create({
      user_id: studentId,
      title: 'Payment confirmed — full access unlocked!',
      message: `Your ${sub.plan} subscription is active until ${endDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.`,
      type: 'subscription',
      link: '/dashboard',
      is_read: false,
    });

    // Confirmation email (non-fatal)
    try {
      const users = await base44.asServiceRole.entities.User.filter({ id: studentId });
      if (users[0]?.email) {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: users[0].email,
          subject: 'Payment Confirmed – Chibondo Academy',
          body: `Hi ${users[0].full_name || 'Student'},\n\nYour ${sub.plan} subscription is now active until ${endDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.\n\nLogin at https://www.chibondoacademy.com/dashboard to start learning.\n\nChibondo Academy Team`,
        });
      }
    } catch (e) { console.error('Email failed (non-fatal):', e); }

    console.log(`✅ Activated ${sub.plan} for student ${studentId}`);
    return Response.json({ success: true, plan: sub.plan, end_date: endDate.toISOString() });

  } catch (err: any) {
    console.error('verifyPayChanguPayment error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
});
