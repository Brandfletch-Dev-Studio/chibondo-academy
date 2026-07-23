/**
 * /api/send-whatsapp — Send WhatsApp notification messages
 *
 * POST /api/send-whatsapp
 * Body: { to: string | string[], message: string, type?: 'text' | 'template', template?: {...} }
 *
 * Uses WhatsApp Business Cloud API (same credentials as OTP).
 * Falls back to text message if template fails.
 */

const WA_TOKEN    = process.env.WA_ACCESS_TOKEN;
const WA_PHONE_ID = process.env.WA_PHONE_NUMBER_ID;
const GRAPH_VERSION = 'v18.0';
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SRK = process.env.SUPABASE_SERVICE_ROLE_KEY;

const MAX_BATCH = 50;

function decodeJwt(token) {
  try {
    const part = token.split('.')[1];
    const padded = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
  } catch { return null; }
}

async function isAuthorized(req) {
  // Internal secret (server-to-server)
  const secret = req.headers['x-internal-secret'];
  if (secret && secret === process.env.INTERNAL_API_SECRET) return true;

  // Admin JWT from browser
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) return false;
  const claims = decodeJwt(token);
  if (!claims?.sub) return false;
  const jwtRole = claims?.app_metadata?.role || claims?.user_metadata?.role;
  if (jwtRole === 'admin' || jwtRole === 'teacher') return true;

  // DB lookup
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${encodeURIComponent(claims.sub)}&select=role&limit=1`, {
      headers: { apikey: SUPABASE_SRK, Authorization: `Bearer ${SUPABASE_SRK}` },
    });
    const rows = await r.json();
    return rows?.[0]?.role === 'admin' || rows?.[0]?.role === 'teacher';
  } catch { return false; }
}

async function sendSingleWhatsApp(phone, message) {
  // Normalize phone: strip + and non-digits, ensure starts with country code
  let cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.startsWith('0')) cleanPhone = '265' + cleanPhone.slice(1);
  if (!cleanPhone.startsWith('265')) cleanPhone = '265' + cleanPhone;

  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${WA_PHONE_ID}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanPhone,
        type: 'text',
        text: { body: message },
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('WhatsApp send failed:', JSON.stringify(err));
      return { ok: false, phone: cleanPhone, error: err?.error?.message || 'Failed' };
    }
    return { ok: true, phone: cleanPhone };
  } catch (err) {
    console.error('WhatsApp send error:', err.message);
    return { ok: false, phone: cleanPhone, error: err.message };
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://chibondoacademy.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-internal-secret');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!WA_TOKEN || !WA_PHONE_ID) {
    return res.status(500).json({ error: 'WhatsApp credentials not configured' });
  }

  const { to, message, users } = req.body ?? {};

  // Mode 1: Direct phone numbers
  if (to && message) {
    const phones = Array.isArray(to) ? to : [to];
    const results = await Promise.all(phones.map(p => sendSingleWhatsApp(p, message)));
    const sent = results.filter(r => r.ok).length;
    return res.status(200).json({ ok: true, sent, total: phones.length, results });
  }

  // Mode 2: User IDs — fetch phone numbers from users table
  if (users && message) {
    const userIds = Array.isArray(users) ? users : [users];
    if (userIds.length === 0) return res.status(400).json({ error: 'No user IDs provided' });

    // Fetch phone numbers from users table using service role key
    const headers = {
      apikey: SUPABASE_SRK,
      Authorization: `Bearer ${SUPABASE_SRK}`,
      'Content-Type': 'application/json',
    };

    // Fetch in batches
    let allUsers = [];
    for (let i = 0; i < userIds.length; i += MAX_BATCH) {
      const batch = userIds.slice(i, i + MAX_BATCH);
      const idFilter = batch.map(id => `id=eq.${encodeURIComponent(id)}`).join('&or=');
      // Actually use the OR syntax properly
      const orFilter = `or=(${batch.map(id => `id.eq.${encodeURIComponent(id)}`).join(',')})`;
      const url = `${SUPABASE_URL}/rest/v1/users?${orFilter}&select=id,phone_number,phone,whatsapp&limit=${MAX_BATCH}`;
      const r = await fetch(url, { headers });
      if (r.ok) {
        const rows = await r.json();
        allUsers = allUsers.concat(rows);
      }
    }

    // Extract phone numbers
    const phoneMap = {};
    for (const u of allUsers) {
      const phone = u.phone_number || u.phone || u.whatsapp;
      if (phone && phone.replace(/\D/g, '').length >= 9) {
        phoneMap[u.id] = phone;
      }
    }

    const phones = Object.values(phoneMap);
    if (phones.length === 0) {
      return res.status(200).json({ ok: true, sent: 0, message: 'No users with valid phone numbers found' });
    }

    // Send messages (with small delay between batches to avoid rate limits)
    const results = [];
    for (let i = 0; i < phones.length; i += 5) {
      const batch = phones.slice(i, i + 5);
      const batchResults = await Promise.all(batch.map(p => sendSingleWhatsApp(p, message)));
      results.push(...batchResults);
      if (i + 5 < phones.length) await new Promise(r => setTimeout(r, 500));
    }

    const sent = results.filter(r => r.ok).length;
    return res.status(200).json({ ok: true, sent, total: phones.length, results });
  }

  return res.status(400).json({ error: 'Missing required fields: (to OR users) and message' });
}
