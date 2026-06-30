// Vercel serverless function — POST /api/verify-payment
// Verifies a Paychangu payment by tx_ref and creates/activates a subscription.
// Body: { tx_ref, user_id }

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

async function supabaseGet(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    headers: { apikey: SUPABASE_SRK, Authorization: `Bearer ${SUPABASE_SRK}` },
  });
  return r.json();
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

    // Paychangu returns status: 'success' and data.status: 'success' when paid
    const txStatus = pcData?.data?.status || pcData?.status;
    const isPaid   = pcData.status === 'success' && txStatus === 'success';
    const isFailed = txStatus === 'failed' || txStatus === 'cancelled';

    if (!isPaid && !isFailed) {
      // Still pending
      return res.status(200).json({ pending: true, status: txStatus });
    }

    if (isFailed) {
      // Update payment record to failed
      if (tx_ref) {
        await supabasePatch(`/payments?reference=eq.${encodeURIComponent(tx_ref)}`, {
          status: 'failed',
          updated_date: new Date().toISOString(),
        });
      }
      return res.status(200).json({ failed: true });
    }

    // ── Payment confirmed ─────────────────────────────────────────────────
    const meta    = pcData?.data?.meta || {};
    const plan    = meta.plan || tx_ref.split('-')[1]?.toLowerCase() || 'monthly';
    const months  = PLAN_MONTHS[plan] || 1;
    const amount  = pcData?.data?.amount || 0;
    const uid     = user_id || meta.user_id;

    // Dates
    const now      = new Date();
    const startsAt = now.toISOString();
    const endsAt   = new Date(now.setMonth(now.getMonth() + months)).toISOString();

    if (uid) {
      // 2. Deactivate any existing active subscriptions
      await supabasePatch(
        `/subscriptions?student_id=eq.${encodeURIComponent(uid)}&status=eq.active`,
        { status: 'expired', updated_date: new Date().toISOString() }
      );

      // 3. Create new subscription
      const subId = `sub-${tx_ref}`;
      await supabasePost('/subscriptions', {
        id:           subId,
        student_id:   uid,
        plan,
        status:       'active',
        amount,
        currency:     'MWK',
        starts_at:    startsAt,
        end_date:     endsAt,
        tx_ref,
        created_date: new Date().toISOString(),
        updated_date: new Date().toISOString(),
      });

      // 4. Update payment record to completed
      await supabasePatch(`/payments?reference=eq.${encodeURIComponent(tx_ref)}`, {
        status:       'completed',
        updated_date: new Date().toISOString(),
      });

      // 5. Update user's subscription_plan field
      await supabasePatch(`/users?id=eq.${encodeURIComponent(uid)}`, {
        subscription_plan: plan,
        updated_date:      new Date().toISOString(),
      });
    }

    return res.status(200).json({
      success:  true,
      plan,
      ends_at:  endsAt,
      amount,
    });
  } catch (err) {
    console.error('verify-payment error:', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}
