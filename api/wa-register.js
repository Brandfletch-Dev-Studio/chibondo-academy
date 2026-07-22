// api/wa-register.js  [Chibondo Academy]
// Receives a register_student tool call from NyasaDesk's AI agent.
// Creates a Supabase auth user + public.users row, then returns a
// magic login link the agent sends back to the student on WhatsApp.
//
// Called by: NyasaDesk aiAutoReply → executeWebhookTool
// Auth: Bearer token in Authorization header (WA_REGISTER_SECRET env var)

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL  = process.env.VITE_SUPABASE_URL  || process.env.SUPABASE_URL;
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SHARED_SECRET = process.env.WA_REGISTER_SECRET;
const APP_URL       = process.env.VITE_APP_URL || 'https://chibondoacademy.com';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Verify shared secret
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!SHARED_SECRET || token !== SHARED_SECRET) {
    console.warn('[wa-register] Unauthorized call — bad or missing secret');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { tool, args } = req.body || {};
  if (tool !== 'register_student') {
    return res.status(400).json({ error: 'Unknown tool: ' + tool });
  }

  const { full_name, phone, form_level, email, referral_code } = args || {};
  if (!full_name || !phone || !form_level) {
    return res.status(400).json({ error: 'Missing required fields: full_name, phone, form_level' });
  }

  try {
    const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Normalise phone: strip leading 0, ensure 265 prefix
    const normPhone = normalisePhone(phone);

    // Check if user already exists (by phone or email)
    let existingUserId = null;
    let existingName = null;

    const { data: existingByPhone } = await sb
      .from('users')
      .select('id, full_name')
      .or(`phone.eq.${normPhone},phone_number.eq.${normPhone}`)
      .maybeSingle();

    if (existingByPhone) {
      existingUserId = existingByPhone.id;
      existingName = existingByPhone.full_name;
    } else if (email) {
      const { data: existingByEmail } = await sb
        .from('users')
        .select('id, full_name')
        .eq('email', email)
        .maybeSingle();
      if (existingByEmail) {
        existingUserId = existingByEmail.id;
        existingName = existingByEmail.full_name;
      }
    }

    if (existingUserId) {
      const link = await generateMagicLink(sb, existingUserId, normPhone, email, APP_URL);
      return res.status(200).json({
        ok: true,
        already_registered: true,
        message: `Welcome back, ${existingName}! Here is your login link (valid for 1 hour):\n${link}`,
      });
    }

    // --- New user ---
    // Use email if provided, otherwise use synthetic phone-based email for auth
    const authEmail = email || `${normPhone}@wa.chibondoacademy.com`;
    const tempPassword = crypto.randomUUID().replace(/-/g, '') + 'Aa1!';

    const { data: authData, error: signUpErr } = await sb.auth.admin.createUser({
      email: authEmail,
      password: tempPassword,
      email_confirm: true,
      phone: normPhone,
      phone_confirm: true,
      user_metadata: { full_name, form_level, source: 'whatsapp_registration', referral_code: referral_code || 'AGENT' },
    });

    if (signUpErr) {
      console.error('[wa-register] auth.admin.createUser failed:', signUpErr);
      return res.status(500).json({ error: signUpErr.message });
    }

    const userId = authData.user.id;

    // Create public.users row
    const userRow = {
      id:           userId,
      full_name,
      phone:        normPhone,
      phone_number: normPhone,
      role:         'student',
      created_by:   userId,
      referral_code: referral_code || 'AGENT',
    };
    if (email) userRow.email = email;
    await sb.from('users').insert(userRow);

    // Create student_profiles row
    await sb.from('student_profiles').upsert({
      user_id:      userId,
      full_name,
      phone_number: normPhone,
      form_level,
    }, { onConflict: 'user_id' });

    // Generate magic login link using the confirmed email
    const loginLink = await generateMagicLink(sb, userId, normPhone, authEmail, APP_URL);

    return res.status(200).json({
      ok: true,
      already_registered: false,
      message: `Your Chibondo Academy account has been created! 🎉\n\nTap this link to log in (valid for 1 hour):\n${loginLink}\n\nAfter logging in, choose a plan to unlock your lessons. Welcome aboard!`,
    });

  } catch (err) {
    console.error('[wa-register] unexpected error:', err);
    return res.status(500).json({ error: err.message || 'Registration failed' });
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function normalisePhone(raw) {
  let p = String(raw).replace(/\D/g, '');
  if (p.startsWith('0')) p = '265' + p.slice(1);
  if (!p.startsWith('265')) p = '265' + p;
  return p;
}

async function generateMagicLink(sb, userId, phone, email, appUrl) {
  // Generate magic link using the user's confirmed email in auth.users
  try {
    const { data, error } = await sb.auth.admin.generateLink({
      type: 'magiclink',
      email: email,
      options: { redirectTo: `${appUrl}/dashboard` },
    });
    if (!error && data?.properties?.action_link) {
      return data.properties.action_link;
    }
    if (error) console.warn('[wa-register] generateLink error:', error.message);
  } catch (e) {
    console.warn('[wa-register] generateLink threw:', e.message);
  }

  // Fallback: direct login page
  return `${appUrl}/login?hint=${phone}`;
}
