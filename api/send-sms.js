// Vercel serverless function — POST /api/send-sms
// Sends an SMS nudge to a student with pending payment using Africa's Talking SMS API.
// Body: { phone, student_name, amount, payment_link }

const AT_API_KEY   = process.env.AT_API_KEY;
const AT_USERNAME  = process.env.AT_USERNAME || 'sandbox';
const AT_SENDER_ID = process.env.AT_SENDER_ID; // optional

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { phone, student_name, amount, payment_link } = req.body ?? {};

  if (!phone) return res.status(400).json({ error: 'Phone number is required' });
  if (!student_name) return res.status(400).json({ error: 'Student name is required' });
  const amt = amount || 10000;
  
  // Format message: "Hi {name}, your Chibondo Academy fees of MWK {amount} are pending. Pay now: {link}"
  const name = student_name.split(' ')[0] || 'Student';
  const link = payment_link || 'https://chibondoacademy.com/subscription';
  const message = `Hi ${name}, your Chibondo Academy fees of MWK ${amt.toLocaleString()} are pending. Pay now: ${link}`;

  console.log('[send-sms] Sending message to:', phone, 'message:', message);

  try {
    if (!AT_API_KEY) {
      throw new Error('AT_API_KEY is not configured on the server');
    }

    const params = new URLSearchParams();
    params.append('username', AT_USERNAME);
    params.append('to', phone);
    params.append('message', message);
    if (AT_SENDER_ID) {
      params.append('from', AT_SENDER_ID);
    }

    const response = await fetch('https://api.africastalking.com/version1/messaging', {
      method: 'POST',
      headers: {
        'apiKey': AT_API_KEY,
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (_) {
      throw new Error(`Invalid JSON response from Africa's Talking: ${text}`);
    }

    console.log('[send-sms] Africa\'s Talking response:', response.status, JSON.stringify(data));

    if (!response.ok) {
      throw new Error(data?.errorMessage || `Africa's Talking error code ${response.status}`);
    }

    // Africa's talking returns structure: { SMSMessageData: { Recipients: [ { number: '+265...', status: 'Success', messageId: '...' } ] } }
    const recData = data?.SMSMessageData?.Recipients?.[0];
    if (recData?.status === 'Success' || recData?.status === 'Sent') {
      return res.status(200).json({ success: true, message_id: recData.messageId });
    } else {
      return res.status(502).json({ error: recData?.status || 'Failed to send SMS' });
    }
  } catch (err) {
    console.error('[send-sms] error:', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}
