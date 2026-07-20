/**
 * sendWelcomeEmail — called after OTP verification
 * Inline HTML, dynamic APP_URL, no buildBrandedEmail dependency.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

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

function buildWelcomeHtml(name: string, referralCode: string): string {
  const refUrl = `${APP_URL}/register?ref=${referralCode}`;
  const refBlock = referralCode
    ? `<p style="color:#444;line-height:1.7;margin:20px 0 0;">Share your referral link and earn rewards:<br>
       <a href="${refUrl}" style="color:#1e2d5c;font-weight:bold;">${refUrl}</a></p>`
    : '';
  return emailShell(`
    <h2 style="color:#1e2d5c;margin:0 0 12px;font-size:20px;">Welcome to Chibondo Academy, ${name}! 🎉</h2>
    <p style="color:#444;line-height:1.7;margin:0 0 16px;">
      Your account is active. Start exploring lessons, quizzes, and past papers crafted for Malawian MSCE students.
    </p>
    <div style="text-align:center;margin:24px 0;">
      <a href="${APP_URL}/subscription"
         style="background:#c9961a;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:bold;font-size:16px;display:inline-block;">
        Get Full Access
      </a>
    </div>
    ${refBlock}
  `);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // 1. Ensure StudentProfile
    try {
      const ex = await base44.asServiceRole.entities.StudentProfile.filter({ user_id: user.id });
      if (!ex.length) await base44.asServiceRole.entities.StudentProfile.create({
        user_id: user.id, full_name: user.full_name || '', email: user.email, onboarding_complete: false,
      });
    } catch (e: any) { console.error('StudentProfile (non-fatal):', e.message); }

    // 2. Ensure referral code
    try {
      if (!user.referral_code) {
        await base44.asServiceRole.entities.User.update(user.id, { referral_code: 'CHIB-' + user.id.slice(-6).toUpperCase() });
      }
    } catch (e: any) { console.error('ReferralCode (non-fatal):', e.message); }

    // 3. Idempotency
    const ex = await base44.asServiceRole.entities.Notification.filter({ user_id: user.id, type: 'welcome' });
    if (ex.length) return Response.json({ skipped: true });

    // 4. Admin toggle
    try {
      const s = await base44.asServiceRole.entities.PlatformSettings.filter({ key: 'email_templates' });
      if (s[0]?.value?.welcome_enabled === false) return Response.json({ skipped: true, reason: 'disabled' });
    } catch (_) {}

    // 5. Build & send
    const fresh = await base44.asServiceRole.entities.User.filter({ id: user.id }).catch(() => [user]);
    const name = user.full_name || user.email.split('@')[0];
    const html = buildWelcomeHtml(name, fresh[0]?.referral_code || '');
    await sendEmail(user.email, `Welcome to Chibondo Academy, ${name}!`, html);

    await base44.asServiceRole.entities.Notification.create({
      user_id: user.id, title: 'Welcome to Chibondo Academy!',
      message: 'Your account is active. Explore subjects, join the forum, and start learning.',
      type: 'welcome', link: '/dashboard', is_read: false,
    });

    return Response.json({ success: true });
  } catch (err: any) {
    console.error('sendWelcomeEmail error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
});
