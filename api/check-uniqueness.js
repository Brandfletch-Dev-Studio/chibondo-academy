// Check if a phone number or email is already linked to an account
// GET /api/check-uniqueness?phone=265991234567&email=test@example.com&excludeUserId=xxx
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { phone, email, excludeUserId } = req.query;
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const headers = {
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
  };

  const result = { phoneAvailable: true, emailAvailable: true };

  try {
    // Check phone uniqueness
    if (phone) {
      const cleanPhone = String(phone).replace(/\D/g, '');
      const phoneRes = await fetch(
        `${SUPABASE_URL}/rest/v1/users?phone_number=eq.${encodeURIComponent(cleanPhone)}&select=id&limit=1`,
        { headers }
      );
      if (phoneRes.ok) {
        const rows = await phoneRes.json();
        if (rows && rows.length > 0 && rows[0].id !== excludeUserId) {
          result.phoneAvailable = false;
        }
      }
    }

    // Check email uniqueness
    if (email) {
      const cleanEmail = String(email).trim().toLowerCase();
      const emailRes = await fetch(
        `${SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(cleanEmail)}&select=id&limit=1`,
        { headers }
      );
      if (emailRes.ok) {
        const rows = await emailRes.json();
        if (rows && rows.length > 0 && rows[0].id !== excludeUserId) {
          result.emailAvailable = false;
        }
      }
    }
  } catch (err) {
    console.error('Uniqueness check error:', err.message);
  }

  return res.status(200).json(result);
}
