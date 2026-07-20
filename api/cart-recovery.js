// Vercel serverless function — POST /api/cart-recovery
// Sends a payment recovery "nudge" email.
// Body template is loaded from PlatformSettings.email_templates.nudge_body (admin-editable).
// Falls back to DEFAULT_NUDGE_BODY if not configured.

const RESEND_API_KEY   = process.env.RESEND_API_KEY;
const SUPABASE_URL     = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const FROM_EMAIL       = 'noreply@chibondoacademy.com';
const APP_URL          = process.env.VITE_APP_URL || 'https://chibondoacademy.com';
const FEES_URL         = `${APP_URL}/fees`;

const NAVY = '#1e2d5c';
const GOLD = '#c9961a';

const DEFAULT_NUDGE_SUBJECT = 'Complete your payment to unlock your lessons 📚';
const DEFAULT_NUDGE_BODY = `Hi {student_name}, you tried to pay fees to unlock access to video lessons on The Chibondo Academy.

Please complete your payment to unlock full access to your lessons:

Use this link: {fees_link}

If you have any problems, please let us know so that we can assist you make payment.`;

async function supabaseGet(table, query) {
  const qs = Object.entries(query)
    .map(([k, v]) => `${k}=eq.${encodeURIComponent(v)}`).join('&');
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${qs}&limit=1`, {
    headers: { apikey: SUPABASE_SERVICE, Authorization: `Bearer ${SUPABASE_SERVICE}` },
  });
  const rows = await res.json();
  return Array.isArray(rows) ? rows[0] : null;
}

async function loadNudgeTemplate() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE) return { subject: DEFAULT_NUDGE_SUBJECT, body: DEFAULT_NUDGE_BODY };
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/platform_settings?key=eq.email_templates&limit=1`,
      { headers: { apikey: SUPABASE_SERVICE, Authorization: `Bearer ${SUPABASE_SERVICE}` } }
    );
    const rows = await res.json();
    const tmpl = rows?.[0]?.value;
    return {
      subject: tmpl?.nudge_subject || DEFAULT_NUDGE_SUBJECT,
      body:    tmpl?.nudge_body    || DEFAULT_NUDGE_BODY,
    };
  } catch (_) {
    return { subject: DEFAULT_NUDGE_SUBJECT, body: DEFAULT_NUDGE_BODY };
  }
}

function fillVars(text, vars) {
  return Object.entries(vars).reduce((t, [k, v]) => t.replaceAll(`{${k}}`, v ?? ''), text);
}

function buildHtmlFromText(bodyText) {
  const escaped = bodyText
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\n/g, '<br />');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f6f9;font-family:Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:32px 16px;">
  <div style="background:${NAVY};padding:28px 32px;border-radius:12px 12px 0 0;text-align:center;">
    <h1 style="color:${GOLD};margin:0;font-size:24px;font-weight:bold;">Chibondo Academy</h1>
    <p style="color:#fff;margin:6px 0 0;font-size:11px;letter-spacing:1px;text-transform:uppercase;">Excellence in Malawian Secondary Education</p>
  </div>
  <div style="background:#fff;padding:32px;border-radius:0 0 12px 12px;">
    <p style="color:#333;font-size:15px;line-height:1.8;margin:0 0 24px;">${escaped}</p>
    <div style="text-align:center;margin:24px 0;">
      <a href="${FEES_URL}" style="background:${GOLD};color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:bold;font-size:16px;display:inline-block;">
        Complete Payment →
      </a>
    </div>
    <p style="color:#888;font-size:12px;margin:24px 0 0;">Questions? <a href="mailto:support@chibondoacademy.com" style="color:${NAVY};">support@chibondoacademy.com</a></p>
  </div>
  <p style="text-align:center;color:#aaa;font-size:11px;margin:20px 0 0;">&copy; ${new Date().getFullYear()} Chibondo Academy · <a href="${APP_URL}" style="color:#aaa;">chibondoacademy.com</a></p>
</div></body></html>`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { force_student_id, force_email, payment_id, amount, description, student_name } = req.body ?? {};
  if (!force_email && !force_student_id) {
    return res.status(400).json({ error: 'force_email or force_student_id required' });
  }

  try {
    let email = force_email;
    let name  = student_name;

    if (!email && force_student_id && SUPABASE_URL && SUPABASE_SERVICE) {
      const user = await supabaseGet('users', { id: force_student_id });
      if (user) { email = user.email; name = name || user.full_name; }
    }
    if (!email) return res.status(400).json({ error: 'Could not resolve student email' });

    const firstName = (name || 'Student').split(' ')[0];

    // Load admin-editable template
    const { subject: rawSubject, body: rawBody } = await loadNudgeTemplate();
    const vars = {
      student_name: firstName,
      fees_link:    FEES_URL,
      amount:       amount ? `MWK ${Number(amount).toLocaleString()}` : '',
      plan:         description || '',
    };
    const subject = fillVars(rawSubject, vars);
    const bodyText = fillVars(rawBody, vars);
    const html = buildHtmlFromText(bodyText);

    // Send via Resend
    const sendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: `Chibondo Academy <${FROM_EMAIL}>`, to: [email], subject, html }),
    });
    const data = await sendRes.json();
    if (!sendRes.ok) throw new Error(data?.message || `Resend error ${sendRes.status}`);

    // Log nudge timestamp
    if (payment_id && SUPABASE_URL && SUPABASE_SERVICE) {
      await fetch(`${SUPABASE_URL}/rest/v1/payments?id=eq.${payment_id}`, {
        method: 'PATCH',
        headers: {
          apikey: SUPABASE_SERVICE, Authorization: `Bearer ${SUPABASE_SERVICE}`,
          'Content-Type': 'application/json', Prefer: 'return=minimal',
        },
        body: JSON.stringify({ last_nudge_at: new Date().toISOString() }),
      });
    }

    return res.status(200).json({ success: true, sent_to: email });
  } catch (err) {
    console.error('cart-recovery error:', err);
    return res.status(500).json({ error: err.message || 'Failed to send recovery email' });
  }
}
