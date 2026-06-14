import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { plan, return_url } = body;

    if (!plan) return Response.json({ error: 'Plan is required' }, { status: 400 });
    if (!return_url) return Response.json({ error: 'return_url is required' }, { status: 400 });

    const secretKey = Deno.env.get('PAYCHANGU_SECRET_KEY');
    if (!secretKey) return Response.json({ error: 'PayChangu not configured' }, { status: 500 });

    const settings = await base44.asServiceRole.entities.PlatformSettings.filter({ key: 'pricing' });
    const pricing = { monthly_price: 10000, annual_price: 80000, biannual_price: 150000, ...(settings[0]?.value || {}) };
    const amount = pricing[`${plan}_price`] || 0;
    if (amount <= 0) return Response.json({ error: 'Invalid plan' }, { status: 400 });

    const txRef = `TCA-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    // Cancel stale records
    try {
      const stale = await base44.asServiceRole.entities.Subscription.filter({ student_id: user.id, status: 'trial' });
      for (const s of stale) await base44.asServiceRole.entities.Subscription.update(s.id, { status: 'cancelled' });
      const pending = await base44.asServiceRole.entities.Payment.filter({ student_id: user.id, status: 'pending' });
      for (const p of pending) await base44.asServiceRole.entities.Payment.update(p.id, { status: 'cancelled' });
    } catch (_) {}

    const pcRes = await fetch('https://api.paychangu.com/payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${secretKey}`, 'Accept': 'application/json' },
      body: JSON.stringify({
        amount: String(amount),
        currency: 'MWK',
        email: user.email,
        first_name: user.full_name?.split(' ')[0] || 'Student',
        last_name: user.full_name?.split(' ').slice(1).join(' ') || '',
        callback_url: 'https://theaca.base44.app/api/functions/payChanguWebhook',
        return_url: `${return_url}&tx_ref=${txRef}`,
        tx_ref: txRef,
        customization: {
          title: 'Chibondo Academy School Fees',
          description: `${plan.charAt(0).toUpperCase() + plan.slice(1)} subscription`,
          logo: 'https://media.base44.com/images/public/6a212896f8e71114ad51c36f/3fd7d6af7_FB_IMG_1780187860438.jpg',
        },
        meta: { student_id: user.id, plan },
      }),
    });

    const pcText = await pcRes.text();
    let pcData: any;
    try { pcData = JSON.parse(pcText); } catch {
      return Response.json({ error: 'Bad response from PayChangu', raw: pcText }, { status: 500 });
    }

    console.log('PayChangu create:', JSON.stringify(pcData));

    const checkoutUrl = pcData?.data?.checkout_url || pcData?.data?.link || pcData?.checkout_url || pcData?.link;
    if (!checkoutUrl) {
      return Response.json({ error: 'No checkout URL from PayChangu', details: pcData }, { status: 500 });
    }

    await base44.asServiceRole.entities.Payment.create({
      student_id: user.id,
      student_name: user.full_name || '',
      amount, currency: 'MWK', method: 'mobile_money',
      reference: txRef, status: 'pending', description: `${plan} plan`,
    });

    const sub = await base44.asServiceRole.entities.Subscription.create({
      student_id: user.id, plan, status: 'trial',
      start_date: new Date().toISOString(),
      amount_paid: amount, currency: 'MWK', payment_method: 'mobile_money',
    });

    return Response.json({ success: true, tx_ref: txRef, subscription_id: sub.id, checkout_url: checkoutUrl });

  } catch (err: any) {
    console.error('createPayChanguSession error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
});
