import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { plan, app_origin } = await req.json();

    if (!plan) {
      return Response.json({ error: 'Plan is required' }, { status: 400 });
    }

    // Fetch pricing
    const settings = await base44.asServiceRole.entities.PlatformSettings.filter({ key: 'pricing' });
    let pricing = { monthly_price: 10000, annual_price: 80000, biannual_price: 150000 };
    if (settings.length > 0 && settings[0].value) {
      pricing = { ...pricing, ...settings[0].value };
    }

    const amount = pricing[`${plan}_price`] || 0;
    if (amount <= 0) {
      return Response.json({ error: 'Invalid plan or price' }, { status: 400 });
    }

    const secretKey = Deno.env.get('PAYCHANGU_SECRET_KEY');
    if (!secretKey) {
      return Response.json({ error: 'PayChangu credentials not configured' }, { status: 500 });
    }

    const appId = '6a2115bb078a7219b5cbd8b0';
    const txRef = `TCA-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    // Use app_origin sent by the client (window.location.origin) — never use
    // req.headers.get('origin') because Base44 proxies requests through api.base44.com,
    // which would make the return_url point to the wrong domain.
    const origin = app_origin || 'https://6a2115bb078a7219b5cbd8b0.base44.app';

    // Correct Base44 webhook URL format
    const webhookUrl = `https://api.base44.com/api/apps/${appId}/functions/payChanguWebhook`;

    // PayChangu Standard Checkout (hosted redirect mode)
    const paychanguResponse = await fetch('https://api.paychangu.com/payment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${secretKey}`,
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        amount: String(amount),
        currency: 'MWK',
        email: user.email,
        first_name: user.full_name?.split(' ')[0] || 'Student',
        last_name: user.full_name?.split(' ').slice(1).join(' ') || 'Student',
        callback_url: webhookUrl,
        return_url: `${origin}/subscription?paid=1&tx_ref=${txRef}`,
        tx_ref: txRef,
        customization: {
          title: 'Chibondo Academy School Fees',
          description: `${plan.charAt(0).toUpperCase() + plan.slice(1)} plan – school fees`,
          logo: 'https://media.base44.com/images/public/6a212896f8e71114ad51c36f/3fd7d6af7_FB_IMG_1780187860438.jpg',
        },
        meta: {
          student_id: user.id,
          plan,
        },
      }),
    });

    const responseText = await paychanguResponse.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      return Response.json({ error: 'Invalid response from payment gateway', raw: responseText }, { status: 500 });
    }

    if (!paychanguResponse.ok || (data.status && data.status !== 'success')) {
      return Response.json({
        error: data.message || data.error || 'Payment initiation failed',
        details: data
      }, { status: 400 });
    }

    const checkoutUrl = data.data?.checkout_url || data.data?.link || data.link || data.checkout_url;

    if (!checkoutUrl) {
      return Response.json({ error: 'No checkout URL returned by payment gateway', details: data }, { status: 500 });
    }

    // Create Payment record with tx_ref as reference
    await base44.asServiceRole.entities.Payment.create({
      student_id: user.id,
      student_name: user.full_name || '',
      amount,
      currency: 'MWK',
      method: 'airtel_money',
      reference: txRef,
      status: 'pending',
      description: `${plan} plan`,
    });

    // Create pending subscription record
    const sub = await base44.asServiceRole.entities.Subscription.create({
      student_id: user.id,
      plan,
      status: 'trial',
      start_date: new Date().toISOString(),
      amount_paid: amount,
      currency: 'MWK',
      payment_method: 'airtel_money',
    });

    return Response.json({
      success: true,
      tx_ref: txRef,
      subscription_id: sub.id,
      checkout_url: checkoutUrl,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
