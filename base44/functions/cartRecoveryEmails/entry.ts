/**
 * cartRecoveryEmails
 * Self-scheduled via Deno.cron — runs every hour, no agent credits needed.
 *
 * Also supports a MANUAL mode via HTTP POST with:
 *   { force_student_id, force_email, payment_id, amount, description }
 * This is used by the admin "Nudge" button to immediately send a recovery
 * email to a specific student, bypassing the hourly eligibility window.
 */
import { createClient } from 'npm:@base44/sdk@0.8.31';

// ── Resend email sender ───────────────────────────────────────────────────────
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';
const FROM_ADDRESS   = 'Chibondo Academy <noreply@chibondoacademy.com>';

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM_ADDRESS, to: [to], subject, html }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend error ${res.status}: ${err}`);
  }
  const d = await res.json();
  console.log(`✅ Email sent to ${to} — Resend ID: ${d.id}`);
}


async function sendRecoveryEmail(base44: any, user: any, payment: any) {
  try {
    const built = await base44.asServiceRole.functions.invoke('buildBrandedEmail', {
      type: 'cart_recovery',
      variables: {
        student_name: user.full_name || user.email?.split('@')[0] || 'Student',
        plan: payment.description?.split(' ')[0]?.toLowerCase() || 'monthly',
        amount: String(payment.amount || ''),
      },
    });
    if (!built || built.error) throw new Error(built?.error || 'buildBrandedEmail failed');

    await base44.asServiceRole.integrations.Core.SendEmail({
      to:      user.email,
      subject: built.subject,
      body:    built.html || built.text,
    });

    // Log so we don't repeat in the next automated run
    await base44.asServiceRole.entities.Notification.create({
      user_id: user.id,
      title:   'Complete your payment',
      message: 'Cart recovery email sent',
      type:    'cart_recovery',
      is_read: true,
    });

    console.log(`[cartRecovery] Sent to ${user.email}`);
    return true;
  } catch (e: any) {
    console.error(`[cartRecovery] Email error for ${user.email}:`, e.message);
    return false;
  }
}

async function runCartRecovery(forceStudentId?: string, forceEmail?: string, forcedPayment?: any) {
  const base44 = createClient({ appId: '6a2115bb078a7219b5cbd8b0' });

  // ── MANUAL MODE: admin triggered for a specific student ──────────────────
  if (forceStudentId && forceEmail) {
    console.log(`[cartRecovery] Manual trigger for student ${forceStudentId}`);
    const user = { id: forceStudentId, email: forceEmail, full_name: forcedPayment?.student_name || '' };
    const ok = await sendRecoveryEmail(base44, user, forcedPayment || {});
    return { sent: ok ? 1 : 0, skipped: 0, mode: 'manual' };
  }

  // ── AUTO MODE: hourly cron scan ───────────────────────────────────────────
  const tplSettings = await base44.asServiceRole.entities.PlatformSettings
    .filter({ key: 'email_templates' }).catch(() => []);
  const tplConfig = tplSettings[0]?.value || {};
  if (tplConfig.cart_recovery_enabled === false) {
    console.log('[cartRecovery] Disabled by admin — skipping');
    return { skipped: true, reason: 'disabled by admin' };
  }

  const now = Date.now();
  const oneHourAgo = new Date(now - 1 * 60 * 60 * 1000).toISOString();
  const oneDayAgo  = new Date(now - 24 * 60 * 60 * 1000).toISOString();

  const allPending = await base44.asServiceRole.entities.Payment.filter({ status: 'pending' });
  const eligible = allPending.filter((p: any) =>
    p.created_date >= oneDayAgo && p.created_date <= oneHourAgo
  );

  if (eligible.length === 0) {
    console.log('[cartRecovery] No eligible pending payments');
    return { sent: 0, skipped: 0 };
  }

  let sent = 0, skipped = 0;

  for (const payment of eligible) {
    const existing = await base44.asServiceRole.entities.Notification
      .filter({ user_id: payment.student_id, type: 'cart_recovery' });
    const sentRecently = existing.some((n: any) =>
      (now - new Date(n.created_date).getTime()) < 24 * 60 * 60 * 1000
    );
    if (sentRecently) { skipped++; continue; }

    const activeSubs = await base44.asServiceRole.entities.Subscription
      .filter({ student_id: payment.student_id, status: 'active' });
    if (activeSubs.length > 0) { skipped++; continue; }

    const users = await base44.asServiceRole.entities.User
      .filter({ id: payment.student_id });
    if (!users[0]?.email) { skipped++; continue; }

    const ok = await sendRecoveryEmail(base44, users[0], payment);
    ok ? sent++ : skipped++;
  }

  console.log(`[cartRecovery] Done — sent: ${sent}, skipped: ${skipped}`);
  return { sent, skipped, eligible: eligible.length };
}

// ── Hardcoded hourly cron — no agent credits ───────────────────────────────
Deno.cron('cart-recovery-hourly', '0 * * * *', async () => {
  console.log('[cartRecovery cron] Firing...');
  await runCartRecovery().catch(e => console.error('[cartRecovery cron] Error:', e));
});

// ── HTTP endpoint — GET = health check, POST = manual trigger ─────────────
Deno.serve(async (req) => {
  if (req.method === 'GET') {
    return Response.json({ ok: true, message: 'Cart recovery service running' });
  }
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }
  try {
    const body = await req.json().catch(() => ({}));
    const result = await runCartRecovery(
      body.force_student_id,
      body.force_email,
      { amount: body.amount, description: body.description, student_name: body.student_name }
    );
    return Response.json({ success: true, ...result });
  } catch (err: any) {
    console.error('[cartRecovery] HTTP trigger error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
});
