/**
 * cartRecoveryEmails — Deno.cron hourly + manual Nudge via POST
 * Inline HTML, dynamic APP_URL, no buildBrandedEmail dependency.
 */
import { createClient } from 'npm:@base44/sdk@0.8.31';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const FROM_ADDRESS   = 'Chibondo Academy <noreply@chibondoacademy.com>';
const APP_URL        = Deno.env.get('APP_URL') || 'https://chibondoacademy.com';

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM_ADDRESS, to: [to], subject, html }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
  const d = await res.json();
  console.log(`✅ Email sent to ${to} — Resend ID: ${d.id}`);
}

function emailShell(bodyHtml: string): string {
  return `<!DOCTYPE html><html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f6f9;font-family:Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:32px 16px;">
  <div style="background:#1e2d5c;padding:28px 32px;border-radius:12px 12px 0 0;text-align:center;">
    <h1 style="color:#c9961a;margin:0;font-size:24px;font-weight:bold;">Chibondo Academy</h1>
    <p style="color:#fff;margin:6px 0 0;font-size:12px;letter-spacing:1px;text-transform:uppercase;">Excellence in Malawian Secondary Education</p>
  </div>
  <div style="background:#fff;padding:32px;border-radius:0 0 12px 12px;">
    ${bodyHtml}
    <p style="color:#888;font-size:13px;line-height:1.6;margin:24px 0 0;">
      Questions? <a href="mailto:support@chibondoacademy.com" style="color:#1e2d5c;">support@chibondoacademy.com</a>
    </p>
  </div>
  <p style="text-align:center;color:#aaa;font-size:11px;margin:20px 0 0;">
    &copy; 2026 Chibondo Academy &middot; <a href="${APP_URL}" style="color:#aaa;">chibondoacademy.com</a>
  </p>
</div></body></html>`;
}

function buildCartHtml(name: string, amount: string, plan: string): string {
  const fmt = amount ? `MWK ${Number(amount).toLocaleString()}` : 'MWK 10,000';
  return emailShell(`
    <h2 style="color:#1e2d5c;margin:0 0 12px;font-size:20px;">Complete your registration, ${name}!</h2>
    <p style="color:#444;line-height:1.7;margin:0 0 16px;">
      You started registering for the <strong>${plan}</strong> plan but haven't completed your payment of <strong>${fmt}</strong> yet.
    </p>
    <p style="color:#444;line-height:1.7;margin:0 0 24px;">
      Don't miss out — complete your payment now and get instant access to all lessons, quizzes, past papers, and expert tutors.
    </p>
    <div style="text-align:center;margin:28px 0;">
      <a href="${APP_URL}/subscription"
         style="background:#c9961a;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:bold;font-size:16px;display:inline-block;">
        Complete Payment Now
      </a>
    </div>
  `);
}

async function sendRecovery(base44: any, user: { id: string; email: string; full_name?: string }, payment: any) {
  try {
    const name = user.full_name || user.email.split('@')[0];
    const plan = payment.description?.split(' ')[0] || 'Monthly';
    await sendEmail(user.email, `Complete your Chibondo Academy payment, ${name}`, buildCartHtml(name, String(payment.amount || ''), plan));
    await base44.asServiceRole.entities.Notification.create({
      user_id: user.id, title: 'Complete your payment', message: 'Cart recovery email sent', type: 'cart_recovery', is_read: true,
    });
    return true;
  } catch (e: any) { console.error('[cartRecovery]', e.message); return false; }
}

async function run(forceId?: string, forceEmail?: string, forcePay?: any) {
  const base44 = createClient({ appId: '6a2115bb078a7219b5cbd8b0' });

  if (forceId && forceEmail) {
    const ok = await sendRecovery(base44, { id: forceId, email: forceEmail, full_name: forcePay?.student_name }, forcePay || {});
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
    if (!u[0]?.email) { sk++; continue; }
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
    const r = await run(b.force_student_id, b.force_email, { amount: b.amount, description: b.description, student_name: b.student_name });
    return Response.json({ success: true, ...r });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});
