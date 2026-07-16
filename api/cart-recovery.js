// Vercel serverless function — POST /api/cart-recovery
// Sends a payment recovery "nudge" email to a student who started but didn't complete payment.
// Body: { force_student_id, force_email, payment_id, amount, description, student_name }

const RESEND_API_KEY   = process.env.RESEND_API_KEY;
const SUPABASE_URL     = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const FROM_EMAIL       = 'noreply@chibondoacademy.com';
const APP_URL          = process.env.VITE_APP_URL || 'https://chibondoacademy.com';

async function supabaseGet(table, query) {
  const qs = Object.entries(query)
    .map(([k, v]) => `${k}=eq.${encodeURIComponent(v)}`).join('&');
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${qs}&limit=1`, {
    headers: {
      apikey: SUPABASE_SERVICE,
      Authorization: `Bearer ${SUPABASE_SERVICE}`,
    },
  });
  const rows = await res.json();
  return Array.isArray(rows) ? rows[0] : null;
}

function formatAmount(amount) {
  if (!amount) return 'MWK 0';
  const num = parseFloat(amount);
  return `MWK ${num.toLocaleString('en-MW', { minimumFractionDigits: 0 })}`;
}

function buildEmailHtml({ student_name, amount, description, payment_id, fees_url }) {
  const firstName = (student_name || 'Student').split(' ')[0];
  const amountFormatted = formatAmount(amount);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Complete Your Payment – Chibondo Academy</title>
  <style>
    body { margin:0; padding:0; background:#f4f4f5; font-family: 'Segoe UI', Arial, sans-serif; }
    .wrap { max-width:600px; margin:32px auto; background:#fff; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,.08); }
    .header { background:linear-gradient(135deg,#0d1b4b 0%,#1a2f7a 100%); padding:36px 40px; text-align:center; }
    .logo-text { color:#D4AF37; font-size:22px; font-weight:700; letter-spacing:.5px; }
    .logo-sub  { color:rgba(255,255,255,.7); font-size:12px; margin-top:4px; }
    .body { padding:40px; }
    h1 { font-size:22px; color:#0d1b4b; margin:0 0 8px; }
    p  { font-size:15px; color:#444; line-height:1.7; margin:0 0 16px; }
    .amount-box { background:#f8f7ff; border:2px solid #0d1b4b; border-radius:12px; padding:20px 24px; margin:24px 0; text-align:center; }
    .amount-label { font-size:13px; color:#666; text-transform:uppercase; letter-spacing:.5px; }
    .amount-value { font-size:32px; font-weight:700; color:#0d1b4b; margin:4px 0; }
    .amount-desc  { font-size:14px; color:#888; }
    .cta { display:block; text-align:center; margin:32px 0 0; }
    .cta a { background:#D4AF37; color:#0d1b4b; text-decoration:none; font-weight:700; font-size:16px; padding:16px 40px; border-radius:10px; display:inline-block; }
    .cta a:hover { background:#c4a020; }
    .note { background:#fffbeb; border-left:4px solid #D4AF37; border-radius:4px; padding:14px 18px; margin:24px 0; font-size:14px; color:#7c6500; }
    .footer { background:#f9f9fb; padding:24px 40px; text-align:center; border-top:1px solid #eee; }
    .footer p { font-size:12px; color:#aaa; margin:4px 0; }
    .footer a { color:#0d1b4b; text-decoration:none; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="header">
      <div class="logo-text">✦ CHIBONDO ACADEMY</div>
      <div class="logo-sub">Excellence in Education</div>
    </div>
    <div class="body">
      <h1>Hey ${firstName}, you're almost there! 🎓</h1>
      <p>We noticed you started a payment but didn't quite finish. Don't worry — your spot is saved and we're ready to get you learning right away.</p>

      <div class="amount-box">
        <div class="amount-label">Amount Due</div>
        <div class="amount-value">${amountFormatted}</div>
        <div class="amount-desc">${description || 'Academy Subscription'}</div>
      </div>

      <p>Completing your payment takes less than 2 minutes and unlocks:</p>
      <ul style="color:#444;font-size:15px;line-height:2;margin:0 0 16px;padding-left:20px;">
        <li>📚 Full access to all your enrolled subjects</li>
        <li>🎥 HD video lessons from expert tutors</li>
        <li>📝 Practice quizzes & assignments</li>
        <li>💬 Subject group chats & tutor support</li>
        <li>📊 Progress tracking & analytics</li>
      </ul>

      <div class="cta">
        <a href="${fees_url}">Complete Payment Now →</a>
      </div>

      <div class="note">
        ⏰ <strong>Don't lose your progress.</strong> Your account is ready and waiting — just one step left to unlock everything.
      </div>

      <p>If you have any trouble with payment or need help, reply to this email and we'll sort it out immediately.</p>
      <p>See you inside! 🚀</p>
    </div>
    <div class="footer">
      <p>Chibondo Academy — Empowering Malawi's brightest minds</p>
      <p><a href="${APP_URL}">chibondoacademy.com</a> · <a href="${APP_URL}/fees">Pay Fees</a></p>
      <p style="margin-top:12px;color:#ccc;font-size:11px;">This is an automated reminder. Payment ID: ${payment_id || 'N/A'}</p>
    </div>
  </div>
</body>
</html>`;
}

export default async function handler(req, res) {
  // CORS
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

    // Resolve email/name from Supabase if not provided directly
    if (!email && force_student_id && SUPABASE_URL && SUPABASE_SERVICE) {
      const user = await supabaseGet('users', { id: force_student_id });
      if (user) { email = user.email; name = name || user.full_name; }
    }

    if (!email) return res.status(400).json({ error: 'Could not resolve student email' });

    const fees_url = `${APP_URL}/fees`;
    const html = buildEmailHtml({ student_name: name, amount, description, payment_id, fees_url });

    // Send via Resend
    const sendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `Chibondo Academy <${FROM_EMAIL}>`,
        to:   [email],
        subject: `${(name || ''). split(' ')[0] || 'Hey'}, complete your payment to unlock your courses 🎓`,
        html,
      }),
    });

    const data = await sendRes.json();
    if (!sendRes.ok) throw new Error(data?.message || `Resend error ${sendRes.status}`);

    // Log nudge in payments table if payment_id provided
    if (payment_id && SUPABASE_URL && SUPABASE_SERVICE) {
      await fetch(`${SUPABASE_URL}/rest/v1/payments?id=eq.${payment_id}`, {
        method: 'PATCH',
        headers: {
          apikey: SUPABASE_SERVICE,
          Authorization: `Bearer ${SUPABASE_SERVICE}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
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
