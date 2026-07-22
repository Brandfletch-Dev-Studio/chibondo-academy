// api/wa-register.js  [Chibondo Academy]
// Receives a register_student tool call from NyasaDesk's AI agent.
// Creates a Supabase auth user + public.users row, then returns a
// magic login link the agent sends back to the student on WhatsApp.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL  = 'https://nckjjfxlmmsnmnexcgzg.supabase.co';
const SERVICE_KEY   = process.env.CHIBONDO_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const SHARED_SECRET = process.env.WA_REGISTER_SECRET;
const APP_URL       = process.env.VITE_APP_URL || 'https://chibondoacademy.com';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

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
    let existingRow = null;

    const { data: byEmail } = await sb
      .from('users')
      .select('id, full_name')
      .eq('email', email)
      .maybeSingle();

    if (byEmail) {
      existingRow = byEmail;
    } else {
      const { data: byPhone } = await sb
        .from('users')
        .select('id, full_name')
        .or(`phone_number.eq.${normPhone},phone.eq.${normPhone}`)
        .maybeSingle();
      if (byPhone) existingRow = byPhone;
    }

    if (existingRow) {
      const link = await generateMagicLink(sb, email, APP_URL);
      return res.status(200).json({
        ok: true,
        already_registered: true,
        message: `Welcome back, ${existingRow.full_name}! Your account already exists. Here's your login link (valid for 1 hour):\n${link}`,
      });
    }

    // Create auth user with email + password (both confirmed immediately)
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

    // Insert into public.users — using correct column names
    const { error: userInsertErr } = await sb.from('users').insert({
      id:            userId,
      full_name,
      email,
      phone_number:  normPhone,   // correct column name
      phone:         normPhone,   // also fill phone column
      role:          'student',
      created_by:    userId,
      referral_code: referral_code || 'AGENT',
    });

    if (userInsertErr) {
      console.error('[wa-register] users insert failed:', userInsertErr);
    }

    // Create student_profiles row
    const { error: profileErr } = await sb.from('student_profiles').upsert({
      user_id:      userId,
      full_name,
      phone_number: normPhone,
      form_level:   form_level || null,
    }, { onConflict: 'user_id' });

    if (profileErr) {
      console.error('[wa-register] student_profiles upsert failed:', profileErr);
    }

    // Generate magic link using the confirmed email
    const loginLink = await generateMagicLink(sb, email, APP_URL);

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

function normalisePhone(raw) {
  let p = String(raw).replace(/\D/g, '');
  if (p.startsWith('0')) p = '265' + p.slice(1);
  if (!p.startsWith('265')) p = '265' + p;
  return p;
}

async function generateMagicLink(sb, email, appUrl) {
  try {
    const { data, error } = await sb.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo: `${appUrl}/dashboard` },
    });
    if (!error && data?.properties?.action_link) {
      return data.properties.action_link;
    }
    console.warn('[wa-register] generateLink error:', error?.message);
  } catch (e) {
    console.warn('[wa-register] generateLink threw:', e.message);
  }
  return `${appUrl}/login`;
}
