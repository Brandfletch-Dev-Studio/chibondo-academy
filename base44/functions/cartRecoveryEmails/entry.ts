/**
 * cartRecoveryEmails
 * Self-contained — no dependency on buildBrandedEmail.
 * Runs on Deno.cron every hour AND accepts manual POST for admin Nudge.
 *
 * POST body (manual): { force_student_id, force_email, amount, description, student_name }
 */
import { createClient } from 'npm:@base44/sdk@0.8.31';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || 're_Z2rVV1Yz_BapfeMWdpLWbHuBjyJ6QTpaD';
const FROM_ADDRESS   = 'Chibondo Academy <noreply@chibondoacademy.com>';

// ── Inline email builder ──────────────────────────────────────────────────────
function buildCartRecoveryHtml(studentName: string, amount: string, plan: string): string {
  const formattedAmount = amount ? `MWK ${Number(amount).toLocaleString()}` : 'MWK 10,000';
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f6f9;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px;">
    <div style="background:#1e2d5c;padding:28px 32px;border-radius:12px 12px 0 0;text-align:center;">
      <h1 style="color:#c9961a;margin:0;font-size:24px;font-weight:bold;">Chibondo Academy</h1>
      <p style="color:#fff;margin:6px 0 0;font-size:12px;letter-spacing:1px;text-transform:uppercase;">Excellence in Malawian Secondary Education</p>
    </div>
    <div style="background:#fff;padding:32px;border-radius:0 0 12px 12px;">
      <h2 style="color:#1e2d5c;margin:0 0 12px;font-size:20px;">Complete your registration, ${studentName}!</h2>
      <p style="color:#444;line-height:1.7;margin:0 0 20px;">
        You started registering for the <strong>${plan}</strong> plan but haven't completed your payment of <strong>${formattedAmount}</strong> yet.
      </p>
      <p style="color:#444;line-height:1.7;margin:0 0 24px;">
        Don't miss out — complete your payment now and get instant access to all lessons, quizzes, past papers, and expert tutors.
      </p>
      <div style="text-align:center;margin:28px 0;">
        <a href="https://app.chibondoacademy.com/subscription"
           style="background:#c9961a;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:bold;font-size:16px;display:inline-block;">
          Complete Payment Now
        </a>
      </div>
      <p style="color:#888;font-size:13px;line-height:1.6;margin:24px 0 0;">
        Questions? Email us at <a href="mailto:support@chibondoacademy.com" style="color:#1e2d5c;">support@chibondoacademy.com</a>.
      </p>
    </div>
    <p style="text-align:center;color:#aaa;font-size:11px;margin:20px 0 0;">
      &copy; 2026 Chibondo Academy &middot; Malawi &middot;
      <a href="https://app.chibondoacademy.com" style="color:#aaa;">chibondoacademy.com</a>
    </p>
  </div>
</body>
</html>`;
}

// ── Resend sender ─────────────────────────────────────────────────────────────
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

// ── Core logic ────────────────────────────────────────────────────────────────
async function sendRecoveryEmail(base44: any, user: { id: string; email: string; full_name?: string }, payment: any) {
  try {
    const name    = user.full_name || user.email.split('@')[0];
    const plan    = payment.description?.split(' ')[0] || 'Monthly';
    const html    = buildCartRecoveryHtml(name, String(payment.amount || ''), plan);
    const subject = `Complete your Chibondo Academy payment, ${name}`;
    await sendEmail(user.email, subject, html);

    await base44.asServiceRole.entities.Notification.create({
      user_id: user.id,
      title:   'Complete your payment',
      message: 'Cart recovery email sent',
      type:    'cart_recovery',
      is_read: true,
    });
    return true;
  } catch (e: any) {
    console.error(`[cartRecovery] Error for ${user.email}:`, e.message);
    return false;
  }
}

async function runCartRecovery(forceStudentId?: string, forceEmail?: string, forcedPayment?: any) {
  const base44 = createClient({ appId: '6a2115bb078a7219b5cbd8b0' });

  // ── MANUAL MODE ──────────────────────────────────────────────────────────
  if (forceStudentId && forceEmail) {
    console.log(`[cartRecovery] Manual nudge → ${forceEmail}`);
    const ok = await sendRecoveryEmail(base44,
      { id: forceStudentId, email: forceEmail, full_name: forcedPayment?.student_name || '' },
      forcedPayment || {}
    );
    return { sent: ok ? 1 : 0, skipped: 0, mode: 'manual' };
  }

  // ── AUTO CRON MODE ───────────────────────────────────────────────────────
  const tplSettings = await base44.asServiceRole.entities.PlatformSettings
    .filter({ key: 'email_templates' }).catch(() => []);
  if (tplSettings[0]?.value?.cart_recovery_enabled === false) {
    console.log('[cartRecovery] Disabled by admin');
    return { skipped: true, reason: 'disabled' };
  }

  const now        = Date.now();
  const oneHourAgo = new Date(now - 1 * 60 * 60 * 1000).toISOString();
  const oneDayAgo  = new Date(now - 24 * 60 * 60 * 1000).toISOString();

  const allPending = await base44.asServiceRole.entities.Payment.filter({ status: 'pending' });
  const eligible   = allPending.filter((p: any) =>
    p.created_date >= oneDayAgo && p.created_date <= oneHourAgo
  );

  if (!eligible.length) return { sent: 0, skipped: 0 };

  let sent = 0, skipped = 0;
  for (const payment of eligible) {
    const recentNotif = await base44.asServiceRole.entities.Notification
      .filter({ user_id: payment.student_id, type: 'cart_recovery' });
    const alreadySent = recentNotif.some((n: any) =>
      now - new Date(n.created_date).getTime() < 24 * 60 * 60 * 1000
    );
    if (alreadySent) { skipped++; continue; }

    const activeSubs = await base44.asServiceRole.entities.Subscription
      .filter({ student_id: payment.student_id, status: 'active' });
    if (activeSubs.length) { skipped++; continue; }

    const users = await base44.asServiceRole.entities.User.filter({ id: payment.student_id });
    if (!users[0]?.email) { skipped++; continue; }

    const ok = await sendRecoveryEmail(base44, users[0], payment);
    ok ? sent++ : skipped++;
  }

  console.log(`[cartRecovery] Done — sent:${sent} skipped:${skipped}`);
  return { sent, skipped, eligible: eligible.length };
}

// ── Hourly cron ───────────────────────────────────────────────────────────────
Deno.cron('cart-recovery-hourly', '0 * * * *', async () => {
  console.log('[cartRecovery cron] Firing...');
  await runCartRecovery().catch(e => console.error('[cron] Error:', e));
});

// ── HTTP endpoint ─────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'GET') return Response.json({ ok: true });
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const body = await req.json().catch(() => ({}));
    const result = await runCartRecovery(
      body.force_student_id,
      body.force_email,
      { amount: body.amount, description: body.description, student_name: body.student_name }
    );
    return Response.json({ success: true, ...result });
  } catch (err: any) {
    console.error('[cartRecovery] HTTP error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
});
