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

    // ── Step 1: Check our DB — webhook may have already activated this ────────
    const payments = await base44.asServiceRole.entities.Payment.filter({ reference: tx_ref });
    if (payments.length === 0) return Response.json({ error: 'Payment record not found' }, { status: 404 });

    const payment = payments[0];

    if (payment.status === 'completed') {
      return Response.json({ success: true, already_activated: true });
    }

    const studentId = payment.student_id;
    const expectedAmount = payment.amount;

    // ── Step 2: Query PayChangu /transactions and match by amount + student email + time ──
    // /verify-payment/{tx_ref} is unreliable for checkout sessions.
    // We match our pending payment to a PayChangu transaction by:
    //   - status = 'success'
    //   - amount matches
    //   - created within 60 minutes of our payment record
    //   - email matches student email
    let matched = false;
    let matchedRef = null;

    try {
      const r = await fetch('https://api.paychangu.com/transactions?limit=50', {
        headers: { 'Authorization': `Bearer ${secretKey}`, 'Accept': 'application/json' },
      });
      const txData = await r.json() as any;
      const txs: any[] = txData?.data?.data || [];

      const paymentCreatedAt = new Date(payment.created_date).getTime();
      const windowMs = 60 * 60 * 1000; // 60-minute window

      // Get student email for matching
      const students = await base44.asServiceRole.entities.User.filter({ id: studentId });
      const studentEmail = students[0]?.email || '';

      console.log(`Searching ${txs.length} transactions for amount=${expectedAmount} email=${studentEmail}`);

      for (const tx of txs) {
        const txTime = new Date(tx.created_at).getTime();
        const withinWindow = Math.abs(txTime - paymentCreatedAt) < windowMs;
        const amountMatches = Number(tx.amount) === Number(expectedAmount) || 
                              Math.abs(Number(tx.amount) - Number(expectedAmount)) < 10; // allow small rounding
        const emailMatches = !studentEmail || tx.email === studentEmail || tx.customer?.email === studentEmail;
        const isSuccess = tx.status === 'success';

        console.log(`  tx ref_id=${tx.ref_id} amount=${tx.amount} email=${tx.email} status=${tx.status} withinWindow=${withinWindow}`);

        if (isSuccess && amountMatches && withinWindow && emailMatches) {
          matched = true;
          matchedRef = tx.ref_id;
          console.log(`✅ Matched transaction ref_id=${tx.ref_id}`);
          break;
        }
      }
    } catch (e) {
      console.error('Transaction search error (non-fatal):', e);
    }

    // ── Step 3: If no match found, check if payment is just still pending ────
    if (!matched) {
      // Check if there's a recent failed tx matching this student
      console.log(`No matching successful transaction found for tx_ref=${tx_ref}`);
      return Response.json({ success: false, pending: true });
    }

    // ── Step 4: Match found — activate subscription ──────────────────────────
    const activeSubs = await base44.asServiceRole.entities.Subscription.filter({ student_id: studentId, status: 'active' });
    if (activeSubs.length > 0) {
      // Already active (webhook got here while we were searching)
      await base44.asServiceRole.entities.Payment.update(payment.id, { status: 'completed' });
      return Response.json({ success: true, already_activated: true });
    }

    const trials = await base44.asServiceRole.entities.Subscription.filter({ student_id: studentId, status: 'trial' });
    if (trials.length === 0) return Response.json({ error: 'Subscription record not found' }, { status: 404 });

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
      description: `${sub.plan} fees confirmed via transaction match (ref: ${matchedRef})`,
    });

    await base44.asServiceRole.entities.Notification.create({
      user_id: studentId,
      title: 'Payment confirmed — full access unlocked!',
      message: `Your ${sub.plan} subscription is active until ${endDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.`,
      type: 'subscription', link: '/dashboard', is_read: false,
    });

    try {
      const students = await base44.asServiceRole.entities.User.filter({ id: studentId });
      if (students[0]?.email) {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: students[0].email,
          subject: 'Payment Confirmed – Chibondo Academy',
          body: `Hi ${students[0].full_name || 'Student'},\n\nYour ${sub.plan} subscription is now active until ${endDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.\n\nStart learning at https://www.chibondoacademy.com/dashboard\n\nChibondo Academy`,
        });
      }
    } catch (e) { console.error('Email non-fatal:', e); }

    console.log(`✅ Activated ${sub.plan} for student ${studentId} via transaction match`);
    return Response.json({ success: true, plan: sub.plan, end_date: endDate.toISOString() });

  } catch (err: any) {
    console.error('verifyPayChanguPayment error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
});
