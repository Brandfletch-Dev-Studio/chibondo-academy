// Vercel serverless function — POST /api/send-email
// Accepts: { to: string[], subject: string, html: string, from_name?: string }
// Sends via Resend and returns { success, count } or { error }

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL     = 'noreply@chibondoacademy.com';
const MAX_BATCH      = 50; // Resend allows up to 50 recipients per call

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { to, subject, html, text, from_name = 'Chibondo Academy' } = req.body ?? {};

  if (!to || !subject || (!html && !text)) {
    return res.status(400).json({ error: 'Missing required fields: to, subject, html/text' });
  }

  const recipients = Array.isArray(to) ? to : [to];
  if (recipients.length === 0) return res.status(400).json({ error: 'No recipients' });

  try {
    const batches = [];
    for (let i = 0; i < recipients.length; i += MAX_BATCH) {
      batches.push(recipients.slice(i, i + MAX_BATCH));
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
          to:   batch,
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
