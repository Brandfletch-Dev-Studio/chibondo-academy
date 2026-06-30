// Vercel serverless function — POST /api/admin-grant-access
// Grants free subscription access to one or more students.
// Uses the Supabase service role key to bypass RLS.
// Body: { targets: [{id, email}], plan, days } OR { email, plan, days }

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SRK = process.env.SUPABASE_SERVICE_ROLE_KEY;

const PLAN_DAYS = { monthly: 30, annual: 365, biannual: 730 };

async function supa(method, path, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method,
    headers: {
      apikey:         SUPABASE_SRK,
      Authorization:  `Bearer ${SUPABASE_SRK}`,
      'Content-Type': 'application/json',
      Prefer:         'return=representation,resolution=ignore-duplicates',
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  try { return { ok: res.ok, status: res.status, data: JSON.parse(text) }; }
  catch { return { ok: res.ok, status: res.status, data: text }; }
}

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

function decodeJwt(token) {
  try {
    const part = token.split('.')[1];
    // Handle both base64url and base64
    const padded = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
  } catch { return null; }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.authorization || '';
  const userJwt    = authHeader.replace('Bearer ', '').trim();
  if (!userJwt) return res.status(401).json({ error: 'Unauthorized — no token' });

  try {
    const claims   = decodeJwt(userJwt);
    const callerId = claims?.sub;
    if (!callerId) return res.status(401).json({ error: 'Invalid token — no sub' });

    // Check role: first from JWT metadata (fastest), then from DB
    const jwtRole = claims?.app_metadata?.role || claims?.user_metadata?.role;
    let isAdmin = jwtRole === 'admin';

    if (!isAdmin) {
      // Fall back to DB lookup — role may only be stored in users table
      const callerRes = await supa('GET', `/users?id=eq.${encodeURIComponent(callerId)}&select=role&limit=1`);
      const caller    = Array.isArray(callerRes.data) ? callerRes.data[0] : null;
      isAdmin = caller?.role === 'admin';
      console.log(`[admin-grant] DB role check: ${caller?.role} → isAdmin=${isAdmin}`);
    }

    if (!isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { targets, plan = 'monthly', days, email } = req.body ?? {};

    // Resolve targets: email string → look up user
    let grantTargets = targets || [];
    if (!grantTargets.length && email) {
      const userRes = await supa('GET', `/users?email=eq.${encodeURIComponent(email.toLowerCase().trim())}&select=id,email,full_name&limit=1`);
      if (!Array.isArray(userRes.data) || !userRes.data.length) {
        return res.status(404).json({ error: `No user found with email: ${email}` });
      }
      grantTargets = userRes.data;
    }

    if (!grantTargets.length) return res.status(400).json({ error: 'No targets provided' });

    const grantDays = Math.max(1, parseInt(days) || PLAN_DAYS[plan] || 30);
    const now       = new Date();
    const expiresAt = new Date(Date.now() + grantDays * 86400000).toISOString();
    const startsAt  = now.toISOString();
    const planLabel = plan || 'monthly';

    const results = [];
    for (const target of grantTargets) {
      const uid = target.id || target.student_id;
      if (!uid) { results.push({ uid: null, ok: false, error: 'No id on target' }); continue; }

      // Expire existing active subs
      await supa('PATCH',
        `/subscriptions?student_id=eq.${encodeURIComponent(uid)}&status=eq.active`,
        { status: 'expired', updated_date: now.toISOString() }
      );

      // Create new subscription
      const r2 = await supa('POST', '/subscriptions', {
        id:           uuid(),
        student_id:   uid,
        plan:         planLabel,
        status:       'active',
        amount:       0,
        currency:     'MWK',
        starts_at:    startsAt,
        expires_at:   expiresAt,
        created_by:   callerId,
        created_date: now.toISOString(),
        updated_date: now.toISOString(),
      });
      results.push({ uid, ok: r2.ok, status: r2.status, error: r2.ok ? null : (r2.data?.message || JSON.stringify(r2.data)) });
      console.log(`[admin-grant] uid=${uid} insert=${r2.status}`, r2.ok ? '✅' : r2.data);
    }

    const succeeded = results.filter(r => r.ok).length;
    const failed    = results.filter(r => !r.ok);

    return res.status(200).json({
      success:    succeeded > 0,
      granted:    succeeded,
      failed:     failed.length,
      errors:     failed,
      expires_at: expiresAt,
    });

  } catch (err) {
    console.error('[admin-grant] error:', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}
