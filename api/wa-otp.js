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


// ─── Free Trial Auto-Activation ──────────────────────────────────────────────
// When a new user registers and the admin has enabled free trial,
// automatically create a trial subscription so they can access lessons immediately.
async function maybeCreateTrialSubscription(SUPABASE_URL, headers, userId, fullName) {
  try {
    // Fetch pricing settings to check if trial is enabled
    const settingsRes = await fetch(`${SUPABASE_URL}/rest/v1/platform_settings?key=eq.pricing&limit=1`, { headers });
    if (!settingsRes.ok) return result;
    const settingsRows = await settingsRes.json();
    if (!settingsRows?.[0]?.value) return result;

    const pricing = settingsRows[0].value;
    if (!pricing.trial_enabled) return result;

    const trialDays = Math.max(1, Math.min(30, pricing.trial_days || 7));
    const now = new Date();
    const expires = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000);

    // Check if user already has any subscription (active or otherwise)
    const existingSubRes = await fetch(
      `${SUPABASE_URL}/rest/v1/subscriptions?student_id=eq.${encodeURIComponent(userId)}&limit=1`,
      { headers }
    );
    if (existingSubRes.ok) {
      const existing = await existingSubRes.json();
      if (existing?.length > 0) {
        console.log(`[trial] User ${userId} already has a subscription, skipping trial`);
        return result;
      }
    }

    // Create trial subscription
    const trialRes = await fetch(`${SUPABASE_URL}/rest/v1/subscriptions`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({
        student_id: userId,
        student_name: fullName || '',
        plan: 'trial',
        status: 'active',
        amount: 0,
        currency: pricing.currency || 'MWK',
        starts_at: now.toISOString(),
        expires_at: expires.toISOString(),
        pachangu_ref: 'TRIAL',
        created_by: userId,
        created_date: now.toISOString(),
        updated_date: now.toISOString(),
      }),
    });

    if (trialRes.ok) {
      console.log(`[trial] Created ${trialDays}-day trial subscription for ${userId}, expires ${expires.toISOString()}`);
    } else {
      console.error('[trial] Failed to create trial subscription:', await trialRes.text());
    }
  } catch (err) {
    console.error('[trial] Error creating trial subscription:', err.message);
  }
}


// ─── Affiliate Referral Tracking ─────────────────────────────────────────────
// When a new user registers with a referral code, look up the referrer
// and create a referral record. The referral starts as 'pending' and becomes
// 'paid' when the referred student pays their subscription.
async function maybeTrackReferral(SUPABASE_URL, headers, newUser, referralCode) {
  const result = { called: true, code: referralCode, userId: newUser?.id, steps: [] };
  try {
    result.steps.push('function entered');
    if (!referralCode || !newUser?.id) {
      result.steps.push('skipped: missing code or userId');
      return result;
    }
    const code = String(referralCode).trim().toUpperCase();

    // Look up the referrer by their referral_code
    const refRes = await fetch(
      `${SUPABASE_URL}/rest/v1/users?referral_code=eq.${encodeURIComponent(code)}&limit=1`,
      { headers }
    );
    if (!refRes.ok) {
      result.steps.push(`referrer lookup failed: ${refRes.status}`);
      return result;
    }
    const refRows = await refRes.json();
    const referrer = refRows?.[0];
    if (!referrer) {
      result.steps.push(`no referrer found for code: ${code}`);
      return result;
    }
    result.steps.push(`found referrer: ${referrer.full_name} (${referrer.id})`);

    // Don't create self-referrals
    if (referrer.id === newUser.id) {
      result.steps.push('self-referral skipped');
      return result;
    }

    // Check if a referral record already exists for this pair
    const existingRes = await fetch(
      `${SUPABASE_URL}/rest/v1/referrals?referrer_id=eq.${encodeURIComponent(referrer.id)}&referred_user_id=eq.${encodeURIComponent(newUser.id)}&limit=1`,
      { headers }
    );
    if (existingRes.ok) {
      const existing = await existingRes.json();
      if (existing?.length > 0) {
        result.steps.push(`referral already exists`);
        return result;
      }
    }

    // Fetch affiliate commission settings for the reward amount
    let rewardAmount = 5000; // default
    let recurringReward = 0;
    try {
      const affRes = await fetch(
        `${SUPABASE_URL}/rest/v1/platform_settings?key=eq.affiliate_commission&limit=1`,
        { headers }
      );
      if (affRes.ok) {
        const affRows = await affRes.json();
        const aff = affRows?.[0]?.value;
        if (aff) {
          if (aff.commission_type === 'fixed') {
            rewardAmount = aff.fixed_amount || aff.commission_amount || 5000;
          } else if (aff.commission_type === 'percentage') {
            // For percentage, we'll calculate based on the referred student's payment amount later
            rewardAmount = 0; // will be set when payment is confirmed
            recurringReward = 0;
          }
          if (aff.recurring_commission) {
            recurringReward = rewardAmount; // same as initial for now
          }
        }
      }
    } catch (_) {}

    // Create the referral record
    const refInsertRes = await fetch(`${SUPABASE_URL}/rest/v1/referrals`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({
        id: crypto.randomUUID(),
        referrer_id: referrer.id,
        referrer_name: referrer.full_name || '',
        referred_user_id: newUser.id,
        referred_name: newUser.full_name || '',
        referred_email: newUser.email || '',
        referral_code: code,
        status: 'pending',
        reward_amount: rewardAmount,
        reward_status: 'pending',
        recurring_reward_amount: recurringReward,
        recurring_count: 0,
        created_by: newUser.id,
        created_date: new Date().toISOString(),
        updated_date: new Date().toISOString(),
      }),
    });

    if (refInsertRes.ok) {
      result.steps.push(`created referral: ${referrer.full_name} -> ${newUser.full_name || newUser.id}`);
    } else {
      const errText = await refInsertRes.text();
      result.steps.push(`insert FAILED: ${refInsertRes.status} ${errText}`);
    }
  } catch (err) {
    result.steps.push(`error: ${err.message}`);
  }
  return result;
}

async function verifyOTP(req, res) {
  const { phone, code, token, name, referral_code } = req.body || {};
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

      // Upsert the users table row (trigger may have already created it from auth.user)
      // Using merge-duplicates resolution turns INSERT into UPSERT
      const newUserRes = await fetch(`${SUPABASE_URL}/rest/v1/users`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'return=representation,resolution=merge-duplicates' },
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
        console.error('users table upsert failed:', errText);
        // If it's a unique violation on phone_number, the phone is linked to a different account
        if (errText.includes('23505') && errText.includes('phone_number')) {
          return res.status(409).json({ error: 'This phone number is already linked to another account.' });
        }
      } else {
        console.log(`Upserted users table row for ${cleanPhone} (id: ${usersTableId})`);
      }
      // Always run trial + referral tracking for new users, regardless of insert result
      // (the handle_new_user trigger may have already created the row)
      await maybeCreateTrialSubscription(SUPABASE_URL, headers, usersTableId, name || '');
      // Track affiliate referral if code provided
      if (referral_code) {
await maybeTrackReferral(SUPABASE_URL, headers, { id: usersTableId, full_name: name || '', email: autoEmail }, referral_code);
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
      // Track affiliate referral for existing users who login with a referral code
      if (referral_code) {
await maybeTrackReferral(SUPABASE_URL, headers, { id: existingUser.id, full_name: existingUser.full_name || '', email: existingUser.email || autoEmail }, referral_code);
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
