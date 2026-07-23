/**
 * sendWelcomeEmail — called after OTP verification / registration
 * Updated to send a WhatsApp welcome message instead of email.
 * Reads template body from PlatformSettings.email_templates so admins can edit it.
 * Falls back to DEFAULT_BODY if no custom template is saved.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const APP_URL  = Deno.env.get('APP_URL') || 'https://chibondoacademy.com';
const FEES_URL = `${APP_URL}/fees`;

const DEFAULT_BODY = `Dear {student_name},

Welcome to Chibondo Academy! We are thrilled to have you join our learning community.

You now have access to your student dashboard where you can explore subjects, topics, and learning resources.

To unlock full access to all lessons and course materials, pay your school fees here:
{fees_link}

Your referral code is: {referral_code}
Share it with friends and earn rewards when they subscribe!

Regards,
The Chibondo Academy Team`;

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
    let bodyText = DEFAULT_BODY;
    try {
      const s = await base44.asServiceRole.entities.PlatformSettings.filter({ key: 'email_templates' });
      const tmpl = s[0]?.value;
      if (tmpl?.welcome_enabled === false) return Response.json({ skipped: true, reason: 'disabled' });
      if (tmpl?.welcome_body)    bodyText = tmpl.welcome_body;
    } catch (_) {}

    // 5. Fill in variables
    const fresh = await base44.asServiceRole.entities.User.filter({ id: user.id }).catch(() => [user]);
    const refCode = fresh[0]?.referral_code || '';
    const name    = user.full_name || (user.email?.split('@')[0] ?? 'Student');
    const refUrl  = refCode ? `${APP_URL}/register?ref=${refCode}` : '';
    const bodyFilled    = fillVars(bodyText, {
      student_name:   name,
      referral_code:  refCode,
      referral_link:  refUrl,
      fees_link:      FEES_URL,
      dashboard_link: `${APP_URL}/dashboard`,
    });

    // 6. Send via WhatsApp
    const phone = fresh[0]?.phone_number || user.phone_number;
    if (!phone) {
      console.warn('Skipping WhatsApp welcome: user has no phone number');
    } else {
      await sendWhatsApp(phone, bodyFilled);
    }

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
