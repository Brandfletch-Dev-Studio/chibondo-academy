// Vercel serverless function — POST /api/verify-payment
// Verifies a Paychangu payment by tx_ref and creates/activates a subscription.
// Body: { tx_ref, user_id }

const PAYCHANGU_SECRET = process.env.PAYCHANGU_SECRET_KEY;
const SUPABASE_URL     = process.env.SUPABASE_URL;
const SUPABASE_SRK     = process.env.SUPABASE_SERVICE_ROLE_KEY;

// subscriptions table has: id, student_id, plan, status, amount, currency,
//                          starts_at, expires_at, created_date, updated_date, created_by
// users table has: id, email, full_name, role, avatar_url, referral_code, created_date, updated_date
// payments table has: id, student_id, amount, currency, method, reference, status, description

const PLAN_MONTHS = { monthly: 1, annual: 12, biannual: 24 };

async function supabasePost(path, body) {
  return fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SRK,
      Authorization: `Bearer ${SUPABASE_SRK}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
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
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { tx_ref, user_id } = req.body ?? {};
  if (!tx_ref) return res.status(400).json({ error: 'tx_ref is required' });

  try {
    // 1. Verify with Paychangu
    const pcRes = await fetch(`https://api.paychangu.com/verify-payment/${encodeURIComponent(tx_ref)}`, {
      headers: {
        Authorization: `Bearer ${PAYCHANGU_SECRET}`,
        Accept: 'application/json',
      },
    });
    const pcData = await pcRes.json();
    console.log('[verify-payment] Paychangu response:', JSON.stringify(pcData).slice(0, 300));

    // Paychangu status logic:
    // PAID:    pcData.status='success' AND pcData.data.status='success'
    // PENDING: pcData.data.status='pending' (top-level may be 'failed' — ignore it)
    // FAILED:  pcData.data.status='failed' OR pcData.data.status='cancelled'
    const dataStatus = pcData?.data?.status;
    const isPaid     = pcData.status === 'success' && dataStatus === 'success';
    const isFailed   = (dataStatus === 'failed' || dataStatus === 'cancelled');
    const isPending  = !isPaid && !isFailed; // covers 'pending' and unknown states

    if (isPending) {
      return res.status(200).json({ pending: true, status: dataStatus || 'pending' });
    }

    if (isFailed) {
      await supabasePatch(
        `/payments?reference=eq.${encodeURIComponent(tx_ref)}`,
        { status: 'failed', updated_date: new Date().toISOString() }
      );
      return res.status(200).json({ failed: true });
    }

    // ── Payment confirmed ─────────────────────────────────────────────────
    const meta       = pcData?.data?.meta || {};
    const planPrefix = tx_ref.split('-')[1]?.toUpperCase();
    const prefixMap  = { MON: 'monthly', ANN: 'annual', BIA: 'biannual' };
    const plan       = meta.plan || prefixMap[planPrefix] || 'monthly';
    const months     = PLAN_MONTHS[plan] || 1;
    const amount     = pcData?.data?.amount || 0;
    const uid        = user_id || meta.user_id;

    // Dates
    const now      = new Date();
    const startsAt = now.toISOString();
    const endsAt   = new Date(new Date().setMonth(new Date().getMonth() + months)).toISOString();

    if (uid) {
      // 2. Deactivate existing active subscriptions
      await supabasePatch(
        `/subscriptions?student_id=eq.${encodeURIComponent(uid)}&status=eq.active`,
        { status: 'expired', updated_date: new Date().toISOString() }
      );

      // 3. Create new subscription — only use confirmed existing columns
      const subId = `sub-${tx_ref}`;
      const subRes = await supabasePost('/subscriptions', {
        id:           subId,
        student_id:   uid,
        plan,
        status:       'active',
        amount,
        currency:     'MWK',
        starts_at:    startsAt,
        expires_at:   endsAt,      // ✅ correct column name
        created_date: new Date().toISOString(),
        updated_date: new Date().toISOString(),
      });
      if (!subRes.ok) {
        const err = await subRes.text();
        console.error('[verify] subscription insert error:', err);
      }

      // 4. Update payment record to completed
      await supabasePatch(
        `/payments?reference=eq.${encodeURIComponent(tx_ref)}`,
        { status: 'completed', updated_date: new Date().toISOString() }
      );

      // NOTE: users table has no subscription_plan column — subscription status
      // is derived at runtime from the subscriptions table. No user patch needed.
    }

    return res.status(200).json({
      success: true,
      plan,
      ends_at: endsAt,
      amount,
    });
  } catch (err) {
    console.error('verify-payment error:', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}
