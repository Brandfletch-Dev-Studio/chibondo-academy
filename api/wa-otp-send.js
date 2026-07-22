/**
 * WhatsApp Verification Send — Vercel Serverless Function
 *
 * POST /api/wa-otp-send
 * Body: { phone: "265991234567" }
 *
 * Generates a 6-digit OTP + verification token, stores both in otp_codes table,
 * and sends a WhatsApp message with a tappable verification link + code fallback.
 */

const GRAPH_VERSION = 'v21.0';

// Generate a random token for link verification
function generateToken() {
  // 24-char hex string — short enough for a URL, long enough to be secure
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { phone } = req.body || {};

  if (!phone) {
    return res.status(400).json({ error: 'Phone number is required' });
  }

  // Normalize phone: strip non-digits, ensure it starts with country code
  let cleanPhone = phone.replace(/\D/g, '');

  // Malawi: convert local 09XX → 2659XX
  if (cleanPhone.startsWith('0')) {
    cleanPhone = '265' + cleanPhone.slice(1);
  }
  // If no country code, assume Malawi (265)
  if (!cleanPhone.startsWith('265') && cleanPhone.length === 9) {
    cleanPhone = '265' + cleanPhone;
  }

  if (cleanPhone.length < 12 || cleanPhone.length > 13) {
    return res.status(400).json({ error: 'Invalid phone number. Please enter a valid Malawi number (e.g. 0991234567).' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const WA_TOKEN = process.env.WA_ACCESS_TOKEN;
  const WA_PHONE_ID = process.env.WA_PHONE_NUMBER_ID;
  const APP_URL = process.env.APP_URL || 'https://chibondoacademy.com';

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // Rate limit: max 1 OTP per phone per 60 seconds
  try {
    const recentRes = await fetch(
      `${SUPABASE_URL}/rest/v1/otp_codes?phone=eq.${cleanPhone}&order=created_at.desc&limit=1`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
      }
    );
    if (recentRes.ok) {
      const recent = await recentRes.json();
      if (recent.length > 0) {
        const ageSeconds = (Date.now() - new Date(recent[0].created_at).getTime()) / 1000;
        if (ageSeconds < 60) {
          return res.status(429).json({
            error: `Please wait ${Math.ceil(60 - ageSeconds)} seconds before requesting another code.`,
          });
        }
      }
    }
  } catch (_) { /* non-fatal */ }

  // Generate 6-digit OTP + verification token
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const token = generateToken();
  const verifyLink = `${APP_URL}/verify-link?t=${token}`;

  // Store in otp_codes table (5-minute expiry)
  try {
    const storeRes = await fetch(`${SUPABASE_URL}/rest/v1/otp_codes`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        phone: cleanPhone,
        code,
        token,
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        used: false,
      }),
    });

    if (!storeRes.ok) {
      console.error('Failed to store OTP:', await storeRes.text());
      return res.status(500).json({ error: 'Failed to generate code' });
    }
  } catch (err) {
    console.error('OTP store error:', err.message);
    return res.status(500).json({ error: 'Failed to generate code' });
  }

  // Send via WhatsApp Business Cloud API
  try {
    // Try template first (if approved by Meta)
    const waRes = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${WA_PHONE_ID}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${WA_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: cleanPhone,
          type: 'template',
          template: {
            name: 'otp_verification',
            language: { code: 'en_US' },
            components: [
              {
                type: 'body',
                parameters: [
                  { type: 'text', text: code },
                ],
              },
            ],
          },
        }),
      }
    );

    // If template fails, send plain text with link + code
    if (!waRes.ok) {
      const waErr = await waRes.json().catch(() => ({}));
      console.error('WhatsApp template send failed:', JSON.stringify(waErr));

      const messageBody =
        `🔐 *Chibondo Academy*\n\n` +
        `Tap this link to verify your login:\n${verifyLink}\n\n` +
        `Or enter code: *${code}*\n\n` +
        `Expires in 5 minutes. Don't share it with anyone.`;

      const fallbackRes = await fetch(
        `https://graph.facebook.com/${GRAPH_VERSION}/${WA_PHONE_ID}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${WA_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: cleanPhone,
            type: 'text',
            text: { body: messageBody },
          }),
        }
      );

      if (!fallbackRes.ok) {
        const fbErr = await fallbackRes.json().catch(() => ({}));
        console.error('WhatsApp fallback send failed:', JSON.stringify(fbErr));
        return res.status(500).json({ error: 'Failed to send WhatsApp message. Please try again.' });
      }
    }
  } catch (err) {
    console.error('WhatsApp send error:', err.message);
    return res.status(500).json({ error: 'Failed to send WhatsApp message' });
  }

  return res.status(200).json({
    ok: true,
    phone: cleanPhone,
    message: 'Verification link sent via WhatsApp',
  });
}
