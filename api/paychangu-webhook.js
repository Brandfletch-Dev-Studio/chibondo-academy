// Vercel serverless function — POST /api/paychangu-webhook
// Paychangu server-to-server webhook — fires after payment confirmation.
// Register this URL in your Paychangu dashboard as the webhook endpoint.
// Validates the payload and activates the subscription in Supabase.

const PAYCHANGU_SECRET = process.env.PAYCHANGU_SECRET_KEY;
const SUPABASE_URL     = process.env.SUPABASE_URL;
const SUPABASE_SRK     = process.env.SUPABASE_SERVICE_ROLE_KEY;

const PLAN_MONTHS = { monthly: 1, annual: 12, biannual: 24 };

async function supabasePost(path, body) {
  return fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SRK,
      Authorization: `Bearer ${SUPABASE_SRK}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal,resolution=ignore-duplicates',
    },
    body: JSON.stringify(body),
  });
}

async function supabasePatch(path, body) {
  return fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_SRK,
      Authorization: `Bearer ${SUPABASE_SRK}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(body),
  });
}

export default async function handler(req, res) {
  // Paychangu sends POST webhooks
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const payload = req.body;
    console.log('[paychangu-webhook] payload:', JSON.stringify(payload).slice(0, 400));

    // Paychangu webhook payload shape:
    // { event: 'charge.success', data: { tx_ref, status, amount, currency, meta: { user_id, plan } } }
    const event    = payload?.event;
    const data     = payload?.data || payload; // some versions send data at root
    const tx_ref   = data?.tx_ref;
    const status   = data?.status;

    // Only process successful payments
    if (event !== 'charge.success' && status !== 'success') {
      console.log('[paychangu-webhook] not a success event — skipping');
      return res.status(200).json({ received: true });
    }

    if (!tx_ref) {
      console.warn('[paychangu-webhook] no tx_ref in payload');
      return res.status(200).json({ received: true });
    }

    const meta     = data?.meta || {};
    const planPrefix = tx_ref.split('-')[1]?.toUpperCase();
    const prefixMap  = { MON: 'monthly', ANN: 'annual', BIA: 'biannual' };
    const plan     = meta.plan || prefixMap[planPrefix] || 'monthly';
    const months   = PLAN_MONTHS[plan] || 1;
    const amount   = data?.amount || 0;
    const uid      = meta.user_id;

    if (!uid) {
      console.warn('[paychangu-webhook] no user_id in meta — cannot activate subscription');
      return res.status(200).json({ received: true });
    }

    const now      = new Date();
    const startsAt = now.toISOString();
    const expiresAt = new Date(new Date().setMonth(new Date().getMonth() + months)).toISOString();

    // Deactivate existing subscriptions
    await supabasePatch(
      `/subscriptions?student_id=eq.${encodeURIComponent(uid)}&status=eq.active`,
      { status: 'expired', updated_date: now.toISOString() }
    );

    // Create subscription (ignore duplicate if verify already ran)
    const subRes = await supabasePost('/subscriptions', {
      id:           `sub-${tx_ref}`,
      student_id:   uid,
      plan,
      status:       'active',
      amount,
      currency:     'MWK',
      starts_at:    startsAt,
      expires_at:   expiresAt,
      created_date: now.toISOString(),
      updated_date: now.toISOString(),
    });
    console.log('[paychangu-webhook] subscription insert:', subRes.status);

    // Mark payment as completed
    await supabasePatch(
      `/payments?reference=eq.${encodeURIComponent(tx_ref)}`,
      { status: 'completed', updated_date: now.toISOString() }
    );

    console.log('[paychangu-webhook] ✅ subscription activated for', uid, 'plan:', plan);
    return res.status(200).json({ received: true, activated: true });

  } catch (err) {
    console.error('[paychangu-webhook] error:', err);
    // Always return 200 to Paychangu so it doesn't retry endlessly
    return res.status(200).json({ received: true, error: err.message });
  }
}
