// Vercel serverless function — POST /api/paychangu-webhook
// Paychangu server-to-server webhook — fires after payment confirmation.
// Register this URL in your Paychangu dashboard as the webhook endpoint.
// Validates the payload, activates the subscription, and tracks affiliate commissions.

const PAYCHANGU_SECRET  = process.env.PAYCHANGU_SECRET_KEY;
const SUPABASE_URL      = process.env.SUPABASE_URL;
const SUPABASE_SRK      = process.env.SUPABASE_SERVICE_ROLE_KEY;

const PLAN_MONTHS       = { monthly: 1, annual: 12, biannual: 24 };
const COMMISSION_AMOUNT = 10000; // MWK

async function supabaseGet(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    headers: {
      apikey: SUPABASE_SRK,
      Authorization: `Bearer ${SUPABASE_SRK}`,
      Accept: 'application/json',
    },
  });
  return r.json();
}

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

async function processReferralCommission(uid, txRef) {
  try {
    const refs = await supabaseGet(
      `/referrals?referred_user_id=eq.${encodeURIComponent(uid)}&status=neq.paid&limit=1`
    );
    const ref = Array.isArray(refs) ? refs[0] : null;
    if (!ref) { console.log('[webhook/referral] no open referral for user:', uid); return; }

    const commissionAmt = ref.reward_amount || COMMISSION_AMOUNT;
    const now = new Date().toISOString();

    await supabasePatch(`/referrals?id=eq.${encodeURIComponent(ref.id)}`, {
      status:        'paid',
      reward_status: 'earned',
      reward_amount: commissionAmt,
      notes:         `Confirmed via webhook tx_ref: ${txRef}`,
      updated_date:  now,
    });
    console.log('[webhook/referral] commission marked paid for referral:', ref.id);

    // Notify affiliate
    try {
      await supabasePost('/notifications', {
        user_id:      ref.referrer_id,
        type:         'affiliate_commission',
        title:        '💰 Commission Earned!',
        message:      `${ref.referred_name || 'Your referral'} just subscribed. You earned MWK ${commissionAmt.toLocaleString()}!`,
        is_read:      false,
        created_date: now,
        updated_date: now,
      });
    } catch (_) {}
  } catch (err) {
    console.error('[webhook/referral] error:', err.message);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const payload = req.body;
    console.log('[paychangu-webhook] payload:', JSON.stringify(payload).slice(0, 400));

    const event  = payload?.event;
    const data   = payload?.data || payload;
    const tx_ref = data?.tx_ref;
    const status = data?.status;

    if (event !== 'charge.success' && status !== 'success') {
      return res.status(200).json({ received: true });
    }
    if (!tx_ref) {
      console.warn('[paychangu-webhook] no tx_ref');
      return res.status(200).json({ received: true });
    }

    const meta       = data?.meta || {};
    const planPrefix = tx_ref.split('-')[1]?.toUpperCase();
    const prefixMap  = { MON: 'monthly', ANN: 'annual', BIA: 'biannual' };
    const plan       = meta.plan || prefixMap[planPrefix] || 'monthly';
    const months     = PLAN_MONTHS[plan] || 1;
    const amount     = data?.amount || 0;
    const uid        = meta.user_id;

    if (!uid) {
      console.warn('[paychangu-webhook] no user_id in meta');
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

    // Create subscription
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

    // Mark payment completed
    await supabasePatch(
      `/payments?reference=eq.${encodeURIComponent(tx_ref)}`,
      { status: 'completed', updated_date: now.toISOString() }
    );

    // ✅ Process referral commission
    await processReferralCommission(uid, tx_ref);

    console.log('[paychangu-webhook] ✅ done for', uid, 'plan:', plan);
    return res.status(200).json({ received: true, activated: true });

  } catch (err) {
    console.error('[paychangu-webhook] error:', err);
    return res.status(200).json({ received: true, error: err.message });
  }
}
