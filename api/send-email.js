// Vercel serverless function — POST /api/send-email
// Accepts: { to: string[], subject: string, html: string, from_name?: string }
// Sends via Resend and returns { success, count } or { error }
// Auth: requires either x-internal-secret header OR a valid admin JWT

const RESEND_API_KEY    = process.env.RESEND_API_KEY;
const INTERNAL_SECRET   = process.env.INTERNAL_API_SECRET;
const SUPABASE_URL      = process.env.SUPABASE_URL;
const SUPABASE_SRK      = process.env.SUPABASE_SERVICE_ROLE_KEY;
const FROM_EMAIL        = 'noreply@chibondoacademy.com';
const MAX_BATCH         = 50;

function decodeJwt(token) {
  try {
    const part = token.split('.')[1];
    const padded = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
  } catch { return null; }
}

async function isAdminCaller(req) {
  // Option 1: internal secret (server-to-server calls)
  const secret = req.headers['x-internal-secret'];
  if (secret && secret === INTERNAL_SECRET) return true;

  // Option 2: admin JWT from browser
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) return false;

  const claims = decodeJwt(token);
  if (!claims?.sub) return false;

  // Check JWT metadata first (fast path)
  const jwtRole = claims?.app_metadata?.role || claims?.user_metadata?.role;
  if (jwtRole === 'admin') return true;

  // Fall back to DB lookup
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${encodeURIComponent(claims.sub)}&select=role&limit=1`, {
      headers: { apikey: SUPABASE_SRK, Authorization: `Bearer ${SUPABASE_SRK}` },
    });
    const rows = await r.json();
    return rows?.[0]?.role === 'admin';
  } catch { return false; }
}

export default async function handler(req, res) {
  // CORS preflight
  res.setHeader('Access-Control-Allow-Origin', 'https://chibondoacademy.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-internal-secret');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // ── Auth guard ──────────────────────────────────────────────────────────
  const authorized = await isAdminCaller(req);
  if (!authorized) return res.status(401).json({ error: 'Unauthorized' });
  // ────────────────────────────────────────────────────────────────────────

  const { to, subject, html, text, from_name = 'Chibondo Academy' } = req.body ?? {};

  if (!to || !subject || (!html && !text)) {
    return res.status(400).json({ error: 'Missing required fields: to, subject, html/text' });
  }

  const recipients = Array.isArray(to) ? to : [to];
  if (recipients.length === 0) return res.status(400).json({ error: 'No recipients' });

  // Filter out placeholder addresses (phone-only users)
  const realRecipients = recipients.filter(e => e && !e.endsWith('@student.chibondoacademy.com'));
  if (realRecipients.length === 0) return res.status(400).json({ error: 'No valid recipients (all are placeholder addresses)' });

  try {
    const batches = [];
    for (let i = 0; i < realRecipients.length; i += MAX_BATCH) {
      batches.push(realRecipients.slice(i, i + MAX_BATCH));
    }

    let sent = 0;
    for (const batch of batches) {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${from_name} <${FROM_EMAIL}>`,
          to: batch,
          subject,
          ...(html ? { html } : { text }),
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.message || `Resend error ${r.status}`);
      sent += batch.length;
    }

    return res.status(200).json({ success: true, count: sent });
  } catch (err) {
    console.error('send-email error:', err);
    return res.status(500).json({ error: err.message || 'Failed to send email' });
  }
}
