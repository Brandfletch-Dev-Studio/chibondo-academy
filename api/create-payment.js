// Vercel serverless function — POST /api/create-payment
// Initiates a Paychangu checkout session for a subscription plan.
// Body: { plan: 'monthly'|'annual'|'biannual', user_id, email, first_name, last_name, return_url }

const PAYCHANGU_SECRET = process.env.PAYCHANGU_SECRET_KEY;
const SUPABASE_URL     = process.env.SUPABASE_URL;
const SUPABASE_SRK     = process.env.SUPABASE_SERVICE_ROLE_KEY;

const PLANS = {
  monthly:  { amount: 10000, label: 'Monthly Subscription',  months: 1  },
  annual:   { amount: 80000, label: 'Annual Subscription',   months: 12 },
  biannual: { amount: 150000, label: 'Biannual Subscription', months: 24 },
};

function generateTxRef(userId, plan) {
  const ts = Date.now().toString(36).toUpperCase();
  const uid = (userId || 'ANON').slice(-6).toUpperCase();
  return `ACA-${plan.toUpperCase().slice(0,3)}-${uid}-${ts}`;
}

async function getPricingFromSupabase() {
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/platform_settings?limit=5`,
      { headers: { apikey: SUPABASE_SRK, Authorization: `Bearer ${SUPABASE_SRK}` } }
    );
    const rows = await r.json();
    // pricing row has: { key: 'pricing', value: { monthly_price, annual_price, biannual_price } }
    const pricingRow = rows?.find(r => r.key === 'pricing');
    const cfg = pricingRow?.value;
    if (cfg?.monthly_price) return {
      monthly:  cfg.monthly_price  || 10000,
      annual:   cfg.annual_price   || 80000,
      biannual: cfg.biannual_price || 150000,
    };
  } catch (_) {}
  return { monthly: 10000, annual: 80000, biannual: 150000 };
}

export default async function handler(req, res) {
  console.log('[create-payment] START method:', req.method);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let body = req.body ?? {};
  console.log('[create-payment] body:', JSON.stringify(body));
  const { plan, user_id, email, first_name = 'Student', last_name = 'User', return_url } = body;

  if (!plan || !PLANS[plan]) return res.status(400).json({ error: `Invalid plan. Must be one of: ${Object.keys(PLANS).join(', ')}` });
  if (!email)                 return res.status(400).json({ error: 'email is required' });

  console.log('[create-payment] plan:', plan, 'email:', email);
  // Use dynamic pricing if available
  console.log('[create-payment] calling getPricingFromSupabase...');
  const pricing = await getPricingFromSupabase().catch(e => { console.error('[pricing error]', e.message); return { monthly: 10000, annual: 80000, biannual: 150000 }; });
  console.log('[create-payment] pricing:', JSON.stringify(pricing));
  const planCfg = { ...PLANS[plan], amount: pricing[plan] || PLANS[plan].amount };

  const tx_ref      = generateTxRef(user_id, plan);
  const redirect_url = return_url || 'https://chibondoacademy.com/subscription';
  const callback_url = redirect_url; // webhook callback = same as return URL for Paychangu

  try {
    console.log('[create-payment] calling paychangu api...');
    const r = await fetch('https://api.paychangu.com/payment', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAYCHANGU_SECRET}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        amount:      planCfg.amount,
        currency:    'MWK',
        email,
        first_name,
        last_name,
        callback_url: redirect_url,   // Paychangu redirects here after payment
        return_url:   redirect_url,
        tx_ref,
        customization: {
          title:       'Chibondo Academy',
          description: planCfg.label,
        },
        meta: {
          user_id:  user_id || '',
          plan,
          months:   planCfg.months,
        },
      }),
    });

    const data = await r.json();
    console.log('[create-payment] paychangu response:', r.status, JSON.stringify(data).slice(0,200));
    if (!r.ok || data.status !== 'success') {
      console.error('Paychangu create error:', data);
      return res.status(502).json({ error: data.message || 'Paychangu error' });
    }

    // Store the pending tx_ref in Supabase so webhook can match it later
    if (user_id) {
      await fetch(`${SUPABASE_URL}/rest/v1/payments`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_SRK,
          Authorization: `Bearer ${SUPABASE_SRK}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          id:           tx_ref,
          student_id:   user_id,
          amount:       planCfg.amount,
          currency:     'MWK',
          method:       'paychangu',
          reference:    tx_ref,
          status:       'pending',
          description:  plan,  // store plan name in description (no 'plan' column)
          created_date: new Date().toISOString(),
          updated_date: new Date().toISOString(),
        }),
      });
    }

    return res.status(200).json({
      checkout_url: data.data?.checkout_url,
      tx_ref,
    });
  } catch (err) {
    console.error('create-payment error:', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}
