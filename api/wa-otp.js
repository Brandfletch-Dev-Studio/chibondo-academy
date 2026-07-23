/**
 * WhatsApp OTP — Combined Send + Verify (Vercel Serverless Function)
 *
 * POST /api/wa-otp  with  { action: "send", phone: "265991234567" }
 * POST /api/wa-otp  with  { action: "verify", phone, code?, token?, name? }
 *
 * Merged to stay under the Vercel Hobby plan's 12-function limit.
 */

const GRAPH_VERSION = 'v21.0';

function generateToken() {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function normalisePhone(phone) {
  let clean = phone.replace(/\D/g, '');
  if (clean.startsWith('0')) clean = '265' + clean.slice(1);
  if (!clean.startsWith('265') && clean.length === 9) clean = '265' + clean;
  return clean;
}

// ─── SEND ────────────────────────────────────────────────────────────────────

async function sendOTP(req, res) {
  const { phone } = req.body || {};
  if (!phone) return res.status(400).json({ error: 'Phone number is required' });

  const cleanPhone = normalisePhone(phone);
  if (cleanPhone.length < 12 || cleanPhone.length > 13)
    return res.status(400).json({ error: 'Invalid phone number. Please enter a valid Malawi number (e.g. 0991234567).' });

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const WA_TOKEN = process.env.WA_ACCESS_TOKEN;
  const WA_PHONE_ID = process.env.WA_PHONE_NUMBER_ID;
  const APP_URL = process.env.APP_URL || 'https://chibondoacademy.com';

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY)
    return res.status(500).json({ error: 'Server configuration error' });

  // Rate limit: 1 OTP per phone per 60s
  try {
    const recentRes = await fetch(
      `${SUPABASE_URL}/rest/v1/otp_codes?phone=eq.${cleanPhone}&order=created_at.desc&limit=1`,
      { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } }
    );
    if (recentRes.ok) {
      const recent = await recentRes.json();
      if (recent.length > 0) {
        const ageSeconds = (Date.now() - new Date(recent[0].created_at).getTime()) / 1000;
        if (ageSeconds < 60)
          return res.status(429).json({ error: `Please wait ${Math.ceil(60 - ageSeconds)} seconds before requesting another code.` });
      }
    }
  } catch (_) {}

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const token = generateToken();
  const verifyLink = `${APP_URL}/verify-link?t=${token}`;

  // Store in otp_codes table (5-min expiry)
  try {
    const storeRes = await fetch(`${SUPABASE_URL}/rest/v1/otp_codes`, {
      method: 'POST',
      headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({ phone: cleanPhone, code, token, expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), used: false }),
    });
    if (!storeRes.ok) { console.error('Failed to store OTP:', await storeRes.text()); return res.status(500).json({ error: 'Failed to generate code' }); }
  } catch (err) { console.error('OTP store error:', err.message); return res.status(500).json({ error: 'Failed to generate code' }); }

  // Send via WhatsApp Business Cloud API
  try {
    const waRes = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${WA_PHONE_ID}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp', recipient_type: 'individual', to: cleanPhone,
        type: 'template', template: { name: 'otp_verification', language: { code: 'en_US' },
          components: [{ type: 'body', parameters: [{ type: 'text', text: code }] }] },
      }),
    });

    if (!waRes.ok) {
      console.error('WhatsApp template send failed:', JSON.stringify(await waRes.json().catch(() => ({}))));
      const messageBody =
        `🔐 *Chibondo Academy*\n\n` +
        `Tap this link to verify your login:\n${verifyLink}\n\n` +
        `Or enter code: *${code}*\n\n` +
        `Expires in 5 minutes. Don't share it with anyone.`;

      const fallbackRes = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${WA_PHONE_ID}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: cleanPhone, type: 'text', text: { body: messageBody } }),
      });
      if (!fallbackRes.ok) {
        console.error('WhatsApp fallback send failed:', JSON.stringify(await fallbackRes.json().catch(() => ({}))));
        return res.status(500).json({ error: 'Failed to send WhatsApp message. Please try again.' });
      }
    }
  } catch (err) { console.error('WhatsApp send error:', err.message); return res.status(500).json({ error: 'Failed to send WhatsApp message' }); }

  return res.status(200).json({ ok: true, phone: cleanPhone, message: 'Verification link sent via WhatsApp' });
}

// ─── VERIFY ──────────────────────────────────────────────────────────────────

async function derivePassword(phone, secret) {
  const data = new TextEncoder().encode(`${phone}:${secret}`);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

async function verifyOTP(req, res) {
  const { phone, code, token, name } = req.body || {};
  if (!code && !token) return res.status(400).json({ error: 'Verification code or token is required' });

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const OTP_SECRET = process.env.OTP_SECRET || 'chibondo-wa-otp-2026';

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return res.status(500).json({ error: 'Server configuration error' });

  let cleanPhone = phone ? normalisePhone(phone) : '';

  // 1. Verify the OTP code or token
  try {
    let verifyRes;
    if (token) {
      verifyRes = await fetch(`${SUPABASE_URL}/rest/v1/otp_codes?token=eq.${token}&used=eq.false&order=created_at.desc&limit=1`,
        { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } });
    } else {
      verifyRes = await fetch(`${SUPABASE_URL}/rest/v1/otp_codes?phone=eq.${cleanPhone}&used=eq.false&order=created_at.desc&limit=5`,
        { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } });
    }

    if (!verifyRes.ok) { console.error('OTP lookup failed:', await verifyRes.text()); return res.status(500).json({ error: 'Verification failed' }); }

    const otpRecords = await verifyRes.json();
    const now = new Date();
    let validOtp;
    if (token) {
      validOtp = otpRecords.find(r => !r.used && new Date(r.expires_at) > now);
      if (validOtp) cleanPhone = validOtp.phone;
    } else {
      validOtp = otpRecords.find(r => r.code === String(code) && !r.used && new Date(r.expires_at) > now);
    }

    if (!validOtp) return res.status(400).json({ error: 'Invalid or expired verification. Please try again.' });

    // Mark as used
    await fetch(`${SUPABASE_URL}/rest/v1/otp_codes?id=eq.${validOtp.id}`, {
      method: 'PATCH',
      headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ used: true }),
    });
  } catch (err) { console.error('OTP verify error:', err.message); return res.status(500).json({ error: 'Verification failed' }); }

  // 2. Find or create user
  try {
    const autoEmail = `${cleanPhone}@chibondoacademy.com`;
    const waPrefixEmail = `wa_${cleanPhone}@chibondoacademy.com`;
    const password = await derivePassword(cleanPhone, OTP_SECRET);

    const headers = {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
    };

    // Look up by phone_number OR by any auto-generated email format
    const userRes = await fetch(
      `${SUPABASE_URL}/rest/v1/users?or=(phone_number.eq.${cleanPhone},email.eq.${autoEmail},email.eq.${waPrefixEmail})&limit=1`,
      { headers }
    );
    const userRows = userRes.ok ? await userRes.json() : [];
    const existingUser = userRows[0];

    // Also check auth.users by phone (catches users created by wa-register.js)
    let authUserId = null;
    if (!existingUser) {
      try {
        const authListRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=1000`, { headers });
        if (authListRes.ok) {
          const authData = await authListRes.json();
          const authUsers = authData.users || authData;
          const match = authUsers.find(u => u.phone === `+${cleanPhone}` || u.phone === cleanPhone);
          if (match) {
            authUserId = match.id;
            console.log(`Found existing auth user ${authUserId} for phone ${cleanPhone}, email: ${match.email}`);
          }
        }
      } catch (e) { console.warn('Auth lookup failed:', e.message); }
    }

    if (!existingUser) {
      // Create auth user — only if one doesn't already exist
      if (!authUserId) {
        const createRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            email: autoEmail, password, email_confirm: true, phone: `+${cleanPhone}`,
            user_metadata: { phone_number: cleanPhone, full_name: name || '', auth_method: 'whatsapp_otp' },
          }),
        });

        // Read the body ONCE and store it
        const createBody = await createRes.json().catch(() => ({}));

        if (!createRes.ok) {
          const errMsg = createBody?.msg || '';
          if (!errMsg.toLowerCase().includes('already')) {
            console.error('User creation failed:', JSON.stringify(createBody));
            return res.status(500).json({ error: 'Failed to create account' });
          }
          // "already exists" — try to find the existing auth user by email
          console.log('Auth user already exists, attempting lookup...');
        } else {
          authUserId = createBody.id;
        }
      }

      // Generate a UUID for the users table row
      const usersTableId = authUserId || crypto.randomUUID();

      // Create the users table row with a guaranteed non-null id
      const newUserRes = await fetch(`${SUPABASE_URL}/rest/v1/users`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'return=representation' },
        body: JSON.stringify({
          id: usersTableId,
          email: autoEmail,
          full_name: name || '',
          role: 'user',
          phone_number: cleanPhone,
          created_date: new Date().toISOString(),
          updated_date: new Date().toISOString(),
        }),
      });

      if (!newUserRes.ok) {
        const errText = await newUserRes.text();
        console.error('users table insert failed:', errText);
        // Non-fatal — the auth user exists, sign-in can still work
      } else {
        console.log(`Created users table row for ${cleanPhone} (id: ${usersTableId})`);
      }
    } else {
      // Update phone_number and name for legacy users if needed
      const updates = {};
      if (!existingUser.phone_number) updates.phone_number = cleanPhone;
      if (name && !existingUser.full_name) updates.full_name = name;
      if (Object.keys(updates).length > 0) {
        updates.updated_date = new Date().toISOString();
        await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${existingUser.id}`, {
          method: 'PATCH',
          headers: { ...headers, Prefer: 'return=minimal' },
          body: JSON.stringify(updates),
        });
        console.log(`Updated ${Object.keys(updates).join(', ')} for existing user ${existingUser.id}`);
      }
    }

    // 3. Sign in — try with autoEmail, then wa_ prefix, then existing user's email
    const emailsToTry = [autoEmail];
    if (existingUser?.email && !emailsToTry.includes(existingUser.email)) emailsToTry.push(existingUser.email);
    if (!emailsToTry.includes(waPrefixEmail)) emailsToTry.push(waPrefixEmail);

    for (const tryEmail of emailsToTry) {
      const signInRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: tryEmail, password }),
      });

      if (signInRes.ok) {
        const authData = await signInRes.json();

        // Fetch user profile from users table (service role bypasses RLS)
        let userProfile = null;
        try {
          const profileRes = await fetch(
            `${SUPABASE_URL}/rest/v1/users?id=eq.${encodeURIComponent(authData.user?.id || authUserId || '')}&limit=1`,
            { headers }
          );
          if (profileRes.ok) {
            const profileRows = await profileRes.json();
            if (profileRows && profileRows.length > 0) userProfile = profileRows[0];
          }
        } catch (_) {}

        return res.status(200).json({
          ok: true,
          access_token: authData.access_token,
          refresh_token: authData.refresh_token,
          user: { phone: cleanPhone, isNew: !existingUser, profile: userProfile },
        });
      }
    }

    // All sign-in attempts failed
    console.error('All sign-in attempts failed for phone:', cleanPhone);
    return res.status(500).json({ error: 'Authentication failed. Please try again.' });
  } catch (err) {
    console.error('Auth flow error:', err.message);
    return res.status(500).json({ error: 'Authentication failed' });
  }
}

// ─── ROUTER ──────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const action = req.query.action || req.body?.action;

  if (action === 'send') return sendOTP(req, res);
  if (action === 'verify') return verifyOTP(req, res);

  return res.status(400).json({ error: 'Invalid action. Use ?action=send or ?action=verify' });
}
