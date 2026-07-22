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

// Maps agent-friendly form label → DB form_name value used in the subjects table
const FORM_NAME_MAP = {
  'Form 3': 'Form 3',
  'Form 4': 'Form 4',
  'MSCE':   'MSCE',
};

export default async function handler(req, res) {
  // Only POST
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

  const { full_name, phone, form_level, subjects } = args || {};
  if (!full_name || !phone || !form_level || !subjects?.length) {
    return res.status(400).json({ error: 'Missing required fields: full_name, phone, form_level, subjects' });
  }

  try {
    const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Normalise phone: strip leading 0, ensure 265 prefix
    const normPhone = normalisePhone(phone);

    // Check if a user with this phone already exists in public.users
    const { data: existing } = await sb
      .from('users')
      .select('id, full_name')
      .or(`phone.eq.${normPhone},phone_number.eq.${normPhone}`)
      .maybeSingle();

    if (existing) {
      // Already registered — just send them a fresh login link
      const link = await generateMagicLink(sb, existing.id, normPhone, APP_URL);
      return res.status(200).json({
        ok: true,
        already_registered: true,
        message: `Welcome back, ${existing.full_name}! Here is your login link (valid for 1 hour): ${link}`,
      });
    }

    // Create auth user — phone as the identifier, random password
    // (they will always log in via magic link, never need the password)
    const tempPassword = crypto.randomUUID().replace(/-/g, '') + 'Aa1!';
    const { data: authData, error: signUpErr } = await sb.auth.admin.createUser({
      phone: normPhone,
      password: tempPassword,
      phone_confirm: true,
      user_metadata: { full_name, form_level, source: 'whatsapp_registration' },
    });

    if (signUpErr) {
      console.error('[wa-register] auth.admin.createUser failed:', signUpErr);
      return res.status(500).json({ error: signUpErr.message });
    }

    const userId = authData.user.id;

    // Create public.users row
    await sb.from('users').insert({
      id:           userId,
      full_name,
      phone:        normPhone,
      phone_number: normPhone,
      role:         'student',
      created_by:   userId,
    });

    // Create student_profiles row
    // form_level stored as-is for profile; form_name used only for subject lookup
    await sb.from('student_profiles').upsert({
      user_id:      userId,
      full_name,
      phone_number: normPhone,
      form_level,
    }, { onConflict: 'user_id' });

    // Enroll in subjects — subjects table uses 'form_name' (e.g. "Form 3", "Form 4", "MSCE")
    // and 'name' for the subject name. Match on name only (a student picks specific subjects,
    // not all subjects for their form), with a form_name guard to avoid cross-form collisions
    // (e.g. Biology Book 3 vs Biology Book 4 have the same short name pattern).
    if (subjects?.length) {
      const dbFormName = FORM_NAME_MAP[form_level] || form_level;

      // Fetch matching subjects: name must be in the agent's list AND form_name must match
      // the student's form (or MSCE, which is available to all).
      const { data: subjectRows, error: subErr } = await sb
        .from('subjects')
        .select('id, name, form_name')
        .in('name', subjects)
        .in('form_name', [dbFormName, 'MSCE'])
        .eq('status', 'published');

      if (subErr) console.error('[wa-register] subject lookup failed:', subErr);

      if (subjectRows?.length) {
        const enrollments = subjectRows.map(s => ({
          student_id: userId,
          subject_id: s.id,
          status: 'active',
        }));
        const { error: enrollErr } = await sb
          .from('enrollments')
          .upsert(enrollments, { onConflict: 'student_id,subject_id' });
        if (enrollErr) console.error('[wa-register] enrollment upsert failed:', enrollErr);
      }
    }

    // Generate magic login link
    const loginLink = await generateMagicLink(sb, userId, normPhone, APP_URL);

    return res.status(200).json({
      ok: true,
      already_registered: false,
      message: `Your Chibondo Academy account has been created! Tap this link to log in (valid for 1 hour): ${loginLink}`,
    });

  } catch (err) {
    console.error('[wa-register] unexpected error:', err);
    return res.status(500).json({ error: err.message || 'Registration failed' });
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function normalisePhone(raw) {
  let p = String(raw).replace(/\D/g, ''); // digits only
  if (p.startsWith('0')) p = '265' + p.slice(1);
  if (!p.startsWith('265')) p = '265' + p;
  return p;
}

async function generateMagicLink(sb, userId, phone, appUrl) {
  // Generate a short-lived magic link via Supabase admin API.
  // Phone-only users have no email in auth.users, so we use a synthetic
  // address scoped to this app — it is never used for actual email delivery.
  try {
    const { data, error } = await sb.auth.admin.generateLink({
      type: 'magiclink',
      email: `${phone}@wa.chibondoacademy.com`,
      options: { redirectTo: `${appUrl}/dashboard` },
    });
    if (!error && data?.properties?.action_link) {
      return data.properties.action_link;
    }
    if (error) console.warn('[wa-register] generateLink error:', error.message);
  } catch (e) {
    console.warn('[wa-register] generateLink threw:', e.message);
  }

  // Fallback: direct login page with phone pre-filled
  return `${appUrl}/login?hint=${phone}`;
}
