/**
 * sendWelcomeEmail — called after OTP verification / registration
 * Reads subject + body from PlatformSettings.email_templates so admins can edit it.
 * Falls back to DEFAULT_BODY if no custom template is saved.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const FROM_ADDRESS   = 'Chibondo Academy <noreply@chibondoacademy.com>';
const APP_URL        = Deno.env.get('APP_URL') || 'https://chibondoacademy.com';
const FEES_URL       = `${APP_URL}/fees`;

const DEFAULT_SUBJECT = 'Welcome to Chibondo Academy! 🎓';
const DEFAULT_BODY = `Dear {student_name},

Welcome to Chibondo Academy! We are thrilled to have you join our learning community.

You now have access to your student dashboard where you can explore subjects, topics, and learning resources.

To unlock full access to all lessons and course materials, pay your school fees here:
{fees_link}

Your referral code is: {referral_code}
Share it with friends and earn rewards when they subscribe!

Regards,
The Chibondo Academy Team`;

const NAVY = '#1e2d5c';
const GOLD = '#c9961a';

function buildHtmlFromText(bodyText: string): string {
  const escaped = bodyText
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\n/g, '<br />');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <style>body{margin:0;padding:0;background:#f5f6f9;font-family:Arial,sans-serif;}a{color:${NAVY}}</style>
  </head><body>
  <div style="max-width:600px;margin:0 auto;padding:32px 16px;">
    <div style="background:${NAVY};padding:28px 32px;border-radius:12px 12px 0 0;text-align:center;">
      <h1 style="color:${GOLD};margin:0;font-size:24px;font-weight:bold;">Chibondo Academy</h1>
      <p style="color:#fff;margin:6px 0 0;font-size:11px;letter-spacing:1px;text-transform:uppercase;">Excellence in Malawian Secondary Education</p>
    </div>
    <div style="background:#fff;padding:32px;border-radius:0 0 12px 12px;">
      <p style="color:#333;font-size:15px;line-height:1.8;margin:0 0 24px;">${escaped}</p>
      <div style="text-align:center;margin:24px 0;">
        <a href="${FEES_URL}" style="background:${GOLD};color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:bold;font-size:16px;display:inline-block;">
          Pay Fees & Get Full Access
        </a>
      </div>
      <p style="color:#888;font-size:12px;margin:24px 0 0;">Questions? <a href="mailto:support@chibondoacademy.com">support@chibondoacademy.com</a></p>
    </div>
    <p style="text-align:center;color:#aaa;font-size:11px;margin:20px 0 0;">&copy; ${new Date().getFullYear()} Chibondo Academy · <a href="${APP_URL}" style="color:#aaa;">chibondoacademy.com</a></p>
  </div></body></html>`;
}

function fillVars(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (t, [k, v]) => t.replaceAll(`{${k}}`, v ?? ''), template
  );
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
        await base44.asServiceRole.entities.User.update(user.id, {
          referral_code: 'CHIB-' + user.id.slice(-6).toUpperCase(),
        });
      }
    } catch (e: any) { console.error('ReferralCode (non-fatal):', e.message); }

    // 3. Idempotency — skip if already sent
    const ex = await base44.asServiceRole.entities.Notification.filter({ user_id: user.id, type: 'welcome' });
    if (ex.length) return Response.json({ skipped: true });

    // 4. Load template from PlatformSettings (admin-editable)
    let subject = DEFAULT_SUBJECT;
    let bodyText = DEFAULT_BODY;
    try {
      const s = await base44.asServiceRole.entities.PlatformSettings.filter({ key: 'email_templates' });
      const tmpl = s[0]?.value;
      if (tmpl?.welcome_enabled === false) return Response.json({ skipped: true, reason: 'disabled' });
      if (tmpl?.welcome_subject) subject = tmpl.welcome_subject;
      if (tmpl?.welcome_body)    bodyText = tmpl.welcome_body;
    } catch (_) {}

    // 5. Fill in variables
    const fresh = await base44.asServiceRole.entities.User.filter({ id: user.id }).catch(() => [user]);
    const refCode = fresh[0]?.referral_code || '';
    const name    = user.full_name || (user.email?.split('@')[0] ?? 'Student');
    const refUrl  = refCode ? `${APP_URL}/register?ref=${refCode}` : '';
    const subjectFilled = fillVars(subject, { student_name: name });
    const bodyFilled    = fillVars(bodyText, {
      student_name:   name,
      referral_code:  refCode,
      referral_link:  refUrl,
      fees_link:      FEES_URL,
      dashboard_link: `${APP_URL}/dashboard`,
    });
    const html = buildHtmlFromText(bodyFilled);

    // 6. Send via Resend
    const sendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM_ADDRESS, to: [user.email], subject: subjectFilled, html }),
    });
    if (!sendRes.ok) {
      const err = await sendRes.text();
      throw new Error(`Resend ${sendRes.status}: ${err}`);
    }
    const d = await sendRes.json();
    console.log(`✅ Welcome email sent to ${user.email} — Resend ID: ${d.id}`);

    // 7. Record notification (idempotency guard)
    await base44.asServiceRole.entities.Notification.create({
      user_id: user.id,
      title: 'Welcome to Chibondo Academy!',
      message: 'Your account is active. Explore subjects and start learning.',
      type: 'welcome', link: '/dashboard', is_read: false,
    });

    return Response.json({ success: true });
  } catch (err: any) {
    console.error('sendWelcomeEmail error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
});
