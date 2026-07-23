/**
 * cartRecoveryEmails — Deno.cron hourly + manual Nudge via POST
 * Updated to send WhatsApp notifications via the WhatsApp Cloud API.
 */
import { createClient } from 'npm:@base44/sdk@0.8.31';

const APP_URL = Deno.env.get('APP_URL') || 'https://chibondoacademy.com';

function normalizePhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  let normalized = digits;
  if (normalized.startsWith('0')) {
    normalized = '265' + normalized.slice(1);
  }
  if (!normalized.startsWith('265')) {
    normalized = '265' + normalized;
  }
  return normalized;
}

async function sendWhatsApp(phone: string, message: string): Promise<void> {
  const token = Deno.env.get('WA_ACCESS_TOKEN');
  const phoneNumberId = Deno.env.get('WA_PHONE_NUMBER_ID');
  
  if (!token || !phoneNumberId) {
    console.error('WhatsApp credentials missing (WA_ACCESS_TOKEN / WA_PHONE_NUMBER_ID)');
    return;
  }

  const normalizedPhone = normalizePhoneNumber(phone);
  const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;
  
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: normalizedPhone,
      type: 'text',
      text: { body: message }
    })
  });

  if (!res.ok) {
    throw new Error(`WhatsApp API ${res.status}: ${await res.text()}`);
  }
  
  const d = await res.json();
  console.log(`✅ WhatsApp sent to ${normalizedPhone} — Message ID: ${d.messages?.[0]?.id}`);
}

async function sendRecovery(base44: any, user: { id: string; phone_number: string; full_name?: string }, payment: any) {
  try {
    const name = user.full_name || 'Student';
    const plan = payment.description?.split(' ')[0] || 'Monthly';
    const amountVal = payment.amount ? `MWK ${Number(payment.amount).toLocaleString()}` : 'MWK 10,000';
    
    const msg = `Hi ${name}, you started registering for the *${plan}* plan on Chibondo Academy but haven't completed your payment of *${amountVal}* yet.\n\nDon't miss out — complete your payment here: ${APP_URL}/subscription`;
    
    await sendWhatsApp(user.phone_number, msg);
    
    await base44.asServiceRole.entities.Notification.create({
      user_id: user.id, title: 'Complete your payment', message: 'Cart recovery WhatsApp sent', type: 'cart_recovery', is_read: true,
    });
    return true;
  } catch (e: any) { console.error('[cartRecovery]', e.message); return false; }
}

async function run(forceId?: string, forcePhone?: string, forcePay?: any) {
  const base44 = createClient({ appId: '6a2115bb078a7219b5cbd8b0' });

  if (forceId && forcePhone) {
    const ok = await sendRecovery(base44, { id: forceId, phone_number: forcePhone, full_name: forcePay?.student_name }, forcePay || {});
    return { sent: ok ? 1 : 0, skipped: 0, mode: 'manual' };
  }

  const s = await base44.asServiceRole.entities.PlatformSettings.filter({ key: 'email_templates' }).catch(() => []);
  if (s[0]?.value?.cart_recovery_enabled === false) return { skipped: true, reason: 'disabled' };

  const now = Date.now();
  const pending = await base44.asServiceRole.entities.Payment.filter({ status: 'pending' });
  const eligible = pending.filter((p: any) =>
    p.created_date >= new Date(now - 24*3600*1000).toISOString() &&
    p.created_date <= new Date(now - 1*3600*1000).toISOString()
  );
  if (!eligible.length) return { sent: 0, skipped: 0 };

  let sent = 0, sk = 0;
  for (const p of eligible) {
    const n = await base44.asServiceRole.entities.Notification.filter({ user_id: p.student_id, type: 'cart_recovery' });
    if (n.some((x: any) => now - new Date(x.created_date).getTime() < 24*3600*1000)) { sk++; continue; }
    const sub = await base44.asServiceRole.entities.Subscription.filter({ student_id: p.student_id, status: 'active' });
    if (sub.length) { sk++; continue; }
    const u = await base44.asServiceRole.entities.User.filter({ id: p.student_id });
    if (!u[0]?.phone_number) { sk++; continue; }
    (await sendRecovery(base44, u[0], p)) ? sent++ : sk++;
  }
  return { sent, skipped: sk, eligible: eligible.length };
}

Deno.cron('cart-recovery-hourly', '0 * * * *', async () => {
  await run().catch(e => console.error('[cron]', e));
});

Deno.serve(async (req) => {
  if (req.method === 'GET') return Response.json({ ok: true });
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const b = await req.json().catch(() => ({}));
    // Accept either force_phone or force_email as phone to be compatible with potential manual triggers
    const phone = b.force_phone || b.force_email;
    const r = await run(b.force_student_id, phone, { amount: b.amount, description: b.description, student_name: b.student_name });
    return Response.json({ success: true, ...r });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});
