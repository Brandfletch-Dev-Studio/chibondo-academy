import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { plan, phone, provider } = await req.json();

    if (!phone || !provider) {
      return Response.json({ error: 'Phone number and provider are required' }, { status: 400 });
    }

    // Fetch pricing
    const settings = await base44.entities.PlatformSettings.filter({ key: 'pricing' });
    let pricing = { monthly_price: 5000, quarterly_price: 13500, annual_price: 48000 };
    if (settings.length > 0 && settings[0].value) {
      pricing = { ...pricing, ...settings[0].value };
    }

    const amount = pricing[`${plan}_price`] || 0;
    if (amount <= 0) {
      return Response.json({ error: 'Invalid plan or price' }, { status: 400 });
    }

    // Call PayChangu Mobile Money API
    const publicKey = Deno.env.get('PAYCHANGU_PUBLIC_KEY');
    const secretKey = Deno.env.get('PAYCHANGU_SECRET_KEY');

    if (!publicKey || !secretKey) {
      return Response.json({ error: 'PayChangu credentials not configured' }, { status: 500 });
    }

    const txRef = 'TXN-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

    const paychanguResponse = await fetch('https://api.paychangu.com/v1/charge/mobile-money', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${secretKey}`,
      },
      body: JSON.stringify({
        amount,
        currency: 'MWK',
        tx_ref: txRef,
        customer: {
          email: user.email,
          first_name: user.full_name?.split(' ')[0] || 'Student',
          last_name: user.full_name?.split(' ').slice(1).join(' ') || '',
          phone: phone.replace(/[^0-9]/g, ''),
        },
        provider: provider === 'airtel' ? 'airtel_money' : 'tnm_mpamba',
        meta: {
          student_id: user.id,
          plan,
        },
      }),
    });

    const data = await paychanguResponse.json();

    if (!paychanguResponse.ok || data.status !== 'success') {
      return Response.json({ 
        error: data.message || 'Payment initiation failed',
        details: data 
      }, { status: 400 });
    }

    // Create pending subscription record
    const subscription = await base44.entities.Subscription.create({
      student_id: user.id,
      plan,
      status: 'trial', // Pending payment
      start_date: new Date().toISOString(),
      amount_paid: amount,
      currency: 'MWK',
      payment_method: provider === 'airtel' ? 'airtel_money' : 'tnm_mpamba',
    });

    return Response.json({ 
      success: true, 
      transaction_id: data.data?.transaction_id || txRef,
      subscription_id: subscription.id,
      message: 'USSD prompt sent to your phone. Please enter your PIN to complete payment.',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});