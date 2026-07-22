/**
 * WhatsApp Verification Verify — Vercel Serverless Function
 *
 * POST /api/wa-otp-verify
 * Body: { phone: "265991234567", code?: "123456", token?: "abc123", name?: "John Doe" }
 *
 * Verifies via either a 6-digit code OR a link token, finds or creates
 * a Supabase auth user, and returns an access token.
 */

async function derivePassword(phone, secret) {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${phone}:${secret}`);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const hex = Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return hex.slice(0, 32);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { phone, code, token, name } = req.body || {};

  // Must have either a code or a token
  if (!code && !token) {
    return res.status(400).json({ error: 'Verification code or token is required' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const OTP_SECRET = process.env.OTP_SECRET || 'chibondo-wa-otp-2026';

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // 1. Verify the OTP code or token
  let cleanPhone = phone ? phone.replace(/\D/g, '') : '';

  try {
    let verifyRes;

    if (token) {
      // Link-based verification: look up by token
      verifyRes = await fetch(
        `${SUPABASE_URL}/rest/v1/otp_codes?token=eq.${token}&used=eq.false&order=created_at.desc&limit=1`,
        {
          headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          },
        }
      );
    } else {
      // Code-based verification: look up by phone + code
      if (cleanPhone.startsWith('0')) cleanPhone = '265' + cleanPhone.slice(1);
      if (!cleanPhone.startsWith('265') && cleanPhone.length === 9) cleanPhone = '265' + cleanPhone;

      verifyRes = await fetch(
        `${SUPABASE_URL}/rest/v1/otp_codes?phone=eq.${cleanPhone}&used=eq.false&order=created_at.desc&limit=5`,
        {
          headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          },
        }
      );
    }

    if (!verifyRes.ok) {
      console.error('OTP lookup failed:', await verifyRes.text());
      return res.status(500).json({ error: 'Verification failed' });
    }

    const otpRecords = await verifyRes.json();
    const now = new Date();

    // Find a matching, unused, non-expired record
    let validOtp;
    if (token) {
      validOtp = otpRecords.find(r => !r.used && new Date(r.expires_at) > now);
      if (validOtp) cleanPhone = validOtp.phone; // get phone from the OTP record
    } else {
      validOtp = otpRecords.find(
        r => r.code === String(code) && !r.used && new Date(r.expires_at) > now
      );
    }

    if (!validOtp) {
      return res.status(400).json({ error: 'Invalid or expired verification. Please try again.' });
    }

    // Mark the OTP as used
    await fetch(`${SUPABASE_URL}/rest/v1/otp_codes?id=eq.${validOtp.id}`, {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ used: true }),
    });
  } catch (err) {
    console.error('OTP verify error:', err.message);
    return res.status(500).json({ error: 'Verification failed' });
  }

  if (!cleanPhone) {
    return res.status(400).json({ error: 'Could not determine phone number from verification.' });
  }

  // 2. Find or create the user
  const autoEmail = `wa_${cleanPhone}@chibondoacademy.com`;
  const password = await derivePassword(cleanPhone, OTP_SECRET);

  try {
    // Check if user exists in users table by phone_number
    const userRes = await fetch(
      `${SUPABASE_URL}/rest/v1/users?phone_number=eq.${cleanPhone}&limit=1`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
      }
    );

    let existingUser = null;
    if (userRes.ok) {
      const users = await userRes.json();
      existingUser = users.length > 0 ? users[0] : null;
    }

    if (existingUser) {
      // Existing user — update their password via admin API so we can sign them in
      const userId = existingUser.id;

      await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
        method: 'PUT',
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });
    } else {
      // Create a new Supabase auth user
      const createRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: autoEmail,
          password,
          email_confirm: true,
          phone: `+${cleanPhone}`,
          user_metadata: {
            phone_number: cleanPhone,
            full_name: name || '',
            auth_method: 'whatsapp_otp',
          },
        }),
      });

      if (!createRes.ok) {
        const createErr = await createRes.json().catch(() => ({}));
        if (!createErr.msg?.includes('already')) {
          console.error('User creation failed:', JSON.stringify(createErr));
          return res.status(500).json({ error: 'Failed to create account' });
        }
      }

      // Create the users table row
      const newUserRes = await fetch(`${SUPABASE_URL}/rest/v1/users`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({
          id: (await createRes.json().catch(() => ({}))).id || undefined,
          email: autoEmail,
          full_name: name || '',
          role: 'user',
          phone_number: cleanPhone,
          created_date: new Date().toISOString(),
          updated_date: new Date().toISOString(),
        }),
      });

      if (!newUserRes.ok) {
        const err = await newUserRes.text();
        console.error('users table insert failed:', err);
      }
    }

    // 3. Sign in with the auto-generated credentials to get a token
    const signInRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: autoEmail, password }),
    });

    if (!signInRes.ok) {
      const signInErr = await signInRes.json().catch(() => ({}));
      console.error('Sign in failed:', JSON.stringify(signInErr));

      // Fallback: try with existing user's email if they had one
      if (existingUser?.email) {
        const altSignIn = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
          method: 'POST',
          headers: {
            apikey: SUPABASE_ANON_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: existingUser.email, password }),
        });

        if (altSignIn.ok) {
          const altData = await altSignIn.json();
          return res.status(200).json({
            ok: true,
            access_token: altData.access_token,
            refresh_token: altData.refresh_token,
            user: { phone: cleanPhone, isNew: !existingUser },
          });
        }
      }

      return res.status(500).json({ error: 'Authentication failed. Please try again.' });
    }

    const authData = await signInRes.json();

    return res.status(200).json({
      ok: true,
      access_token: authData.access_token,
      refresh_token: authData.refresh_token,
      user: { phone: cleanPhone, isNew: !existingUser },
    });
  } catch (err) {
    console.error('Auth flow error:', err.message);
    return res.status(500).json({ error: 'Authentication failed' });
  }
}
