// api/wa-register.js  [Chibondo Academy]
// Receives a register_student tool call from NyasaDesk's AI agent.
// Creates a Supabase auth user with email + password, then returns
// a direct login link the agent sends back to the student on WhatsApp.

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
    console.warn('[wa-register] Unauthorized');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { tool, args } = req.body || {};
  if (tool !== 'register_student') {
    return res.status(400).json({ error: 'Unknown tool: ' + tool });
  }

  const { full_name, phone, email, password, form_level, referral_code } = args || {};

  if (!full_name || !phone || !email || !password) {
    return res.status(400).json({ error: 'Missing required fields: full_name, phone, email, password' });
  }

  try {
    const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const normPhone = normalisePhone(phone);

    // Check if user already exists by email or phone
    let existingName = null;

    const { data: existingByEmail } = await sb
      .from('users')
      .select('id, full_name')
      .eq('email', email)
      .maybeSingle();

    if (existingByEmail) {
      existingName = existingByEmail.full_name;
    } else {
      const { data: existingByPhone } = await sb
        .from('users')
        .select('id, full_name')
        .or(`phone.eq.${normPhone},phone_number.eq.${normPhone}`)
        .maybeSingle();
      if (existingByPhone) existingName = existingByPhone.full_name;
    }

    if (existingName) {
      return res.status(200).json({
        ok: true,
        already_registered: true,
        message: `Welcome back, ${existingName}! Your account already exists. Log in here:\n${APP_URL}/login\n\nIf you forgot your password, tap "Forgot password" on the login page.`,
      });
    }

    // Create auth user with email + password
    const { data: authData, error: signUpErr } = await sb.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      phone: normPhone,
      phone_confirm: true,
      user_metadata: {
        full_name,
        form_level: form_level || null,
        source: 'whatsapp_registration',
        referral_code: referral_code || 'AGENT',
      },
    });

    if (signUpErr) {
      console.error('[wa-register] createUser failed:', signUpErr);
      return res.status(500).json({ error: signUpErr.message });
    }

    const userId = authData.user.id;

    // Create public.users row
    await sb.from('users').insert({
      id:           userId,
      full_name,
      email,
      phone:        normPhone,
      phone_number: normPhone,
      role:         'student',
      created_by:   userId,
      referral_code: referral_code || 'AGENT',
    });

    // Create student_profiles row
    await sb.from('student_profiles').upsert({
      user_id:      userId,
      full_name,
      phone_number: normPhone,
      form_level:   form_level || null,
    }, { onConflict: 'user_id' });

    return res.status(200).json({
      ok: true,
      already_registered: false,
      message: `Your Chibondo Academy account has been created! 🎉\n\nLog in here:\n${APP_URL}/login\n\nUse your email *${email}* and the password you just set.\n\nAfter logging in, choose a plan to unlock your lessons. Welcome aboard!`,
    });

  } catch (err) {
    console.error('[wa-register] unexpected error:', err);
    return res.status(500).json({ error: err.message || 'Registration failed' });
  }
}

function normalisePhone(raw) {
  let p = String(raw).replace(/\D/g, '');
  if (p.startsWith('0')) p = '265' + p.slice(1);
  if (!p.startsWith('265')) p = '265' + p;
  return p;
}
