/**
 * /api/auth-me — Fetch authenticated user's profile
 *
 * Uses the service role key to bypass RLS and fetch the user's row
 * from the `users` table. PostgREST can't verify ES256 JWTs, so
 * the frontend calls this endpoint instead of querying PostgREST directly.
 *
 * POST /api/auth-me  with  { access_token, refresh_token? }
 */

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { access_token, refresh_token } = req.body || {};
  if (!access_token) return res.status(401).json({ error: 'Access token required' });

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || SUPABASE_SERVICE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY)
    return res.status(500).json({ error: 'Server configuration error' });

  // 1. Verify the token via Auth API (supports ES256 JWTs)
  let authUser;
  try {
    const authRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${access_token}` },
    });

    if (!authRes.ok) {
      // Try refresh if we have a refresh token
      if (refresh_token) {
        const refreshRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
          method: 'POST',
          headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token }),
        });
        if (refreshRes.ok) {
          const refreshed = await refreshRes.json();
          if (refreshed.access_token) {
            // Retry auth check with new token
            const retryRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
              headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${refreshed.access_token}` },
            });
            if (retryRes.ok) {
              authUser = await retryRes.json();
              return res.status(200).json({
                user: authUser,
                access_token: refreshed.access_token,
                refresh_token: refreshed.refresh_token || refresh_token,
              });
            }
          }
        }
      }
      return res.status(401).json({ error: 'Session expired' });
    }
    authUser = await authRes.json();
  } catch (err) {
    console.error('Auth-me: token verification failed:', err.message);
    return res.status(500).json({ error: 'Auth check failed' });
  }

  const sub = authUser.id;
  if (!sub) return res.status(401).json({ error: 'Invalid token' });

  // 2. Fetch user profile from users table using service role key (bypasses RLS)
  const serviceHeaders = {
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
  };

  try {
    const userRes = await fetch(
      `${SUPABASE_URL}/rest/v1/users?id=eq.${encodeURIComponent(sub)}&limit=1`,
      { headers: serviceHeaders }
    );

    if (userRes.ok) {
      const userRows = await userRes.json();
      if (userRows && userRows.length > 0) {
        return res.status(200).json({ user: userRows[0] });
      }
    }

    // 3. Auto-create user row if not found
    const now = new Date().toISOString();
    const newUser = {
      id: sub,
      email: authUser.email || '',
      full_name: authUser.user_metadata?.full_name || '',
      role: authUser.app_metadata?.role || authUser.user_metadata?.role || 'user',
      referral_code: 'ACA-' + sub.slice(-6).toUpperCase(),
      phone_number: authUser.phone?.replace('+', '') || authUser.user_metadata?.phone_number || '',
      created_date: now,
      updated_date: now,
    };

    const createRes = await fetch(`${SUPABASE_URL}/rest/v1/users`, {
      method: 'POST',
      headers: { ...serviceHeaders, Prefer: 'return=representation' },
      body: JSON.stringify(newUser),
    });

    if (createRes.ok) {
      const created = await createRes.json();
      return res.status(200).json({ user: Array.isArray(created) ? created[0] : created });
    }

    // If create fails (e.g., duplicate), try to fetch again
    const retryRes = await fetch(
      `${SUPABASE_URL}/rest/v1/users?or=(id.eq.${encodeURIComponent(sub)},email=eq.${encodeURIComponent(authUser.email || '')})&limit=1`,
      { headers: serviceHeaders }
    );
    if (retryRes.ok) {
      const retryRows = await retryRes.json();
      if (retryRows && retryRows.length > 0) {
        return res.status(200).json({ user: retryRows[0] });
      }
    }

    // Fall back to auth user data
    return res.status(200).json({ user: newUser });
  } catch (err) {
    console.error('Auth-me: profile fetch failed:', err.message);
    return res.status(500).json({ error: 'Failed to fetch user profile' });
  }
}

export default handler;
