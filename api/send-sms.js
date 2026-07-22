// Vercel serverless function — POST /api/send-sms
// Sends an SMS nudge using Africa's Talking SMS API.
// Auth: requires x-internal-secret header OR admin JWT

const AT_API_KEY      = process.env.AT_API_KEY;
const AT_USERNAME     = process.env.AT_USERNAME || 'sandbox';
const AT_SENDER_ID    = process.env.AT_SENDER_ID;
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET;
const SUPABASE_URL    = process.env.SUPABASE_URL;
const SUPABASE_SRK    = process.env.SUPABASE_SERVICE_ROLE_KEY;

function decodeJwt(token) {
  try {
    const part = token.split('.')[1];
    const padded = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
  } catch { return null; }
}

async function isAuthorized(req) {
  const secret = req.headers['x-internal-secret'];
  if (secret && secret === INTERNAL_SECRET) return true;

  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) return false;
  const claims = decodeJwt(token);
  if (!claims?.sub) return false;
  const jwtRole = claims?.app_metadata?.role || claims?.user_metadata?.role;
  if (jwtRole === 'admin') return true;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${encodeURIComponent(claims.sub)}&select=role&limit=1`, {
      headers: { apikey: SUPABASE_SRK, Authorization: `Bearer ${SUPABASE_SRK}` },
    });
    const rows = await r.json();
    return rows?.[0]?.role === 'admin';
  } catch { return false; }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://chibondoacademy.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-internal-secret');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // ── Auth guard ──────────────────────────────────────────────────────────
  if (!(await isAuthorized(req))) return res.status(401).json({ error: 'Unauthorized' });
  // ────────────────────────────────────────────────────────────────────────

  const { phone, student_name, amount, payment_link } = req.body ?? {};
  if (!phone) return res.status(400).json({ error: 'Phone number is required' });
  if (!student_name) return res.status(400).json({ error: 'Student name is required' });

  const amt  = amount || 10000;
  const name = student_name.split(' ')[0] || 'Student';
  const link = payment_link || 'https://chibondoacademy.com/subscription';
  const message = `Hi ${name}, your Chibondo Academy fees of MWK ${Number(amt).toLocaleString()} are pending. Pay now: ${link}`;

  try {
    if (!AT_API_KEY) throw new Error('AT_API_KEY is not configured');

    const params = new URLSearchParams();
    params.append('username', AT_USERNAME);
    params.append('to', phone);
    params.append('message', message);
    if (AT_SENDER_ID) params.append('from', AT_SENDER_ID);

    const response = await fetch('https://api.africastalking.com/version1/messaging', {
      method: 'POST',
      headers: { apiKey: AT_API_KEY, Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.errorMessage || `Africa's Talking error ${response.status}`);

    const recData = data?.SMSMessageData?.Recipients?.[0];
    if (recData?.status === 'Success' || recData?.status === 'Sent') {
      return res.status(200).json({ success: true, message_id: recData.messageId });
    }
    return res.status(502).json({ error: recData?.status || 'Failed to send SMS' });
  } catch (err) {
    console.error('[send-sms] error:', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}
