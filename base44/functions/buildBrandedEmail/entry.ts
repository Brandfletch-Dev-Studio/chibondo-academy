/**
 * buildBrandedEmail — Shared helper for Chibondo Academy HTML emails
 * 
 * Called by other backend functions to render on-brand HTML emails.
 * Pulls academy branding (name, logo, tagline, contact) from PlatformSettings.
 * 
 * Usage: POST { type, variables }
 * Returns: { subject, html, text }
 */
import { createClient } from 'npm:@base44/sdk@0.8.31';

// ── Brand constants (match index.css CSS vars) ─────────────────────────────
const NAVY   = '#1e2d5c'; // hsl(222 47% 18%) primary
const GOLD   = '#c9961a'; // hsl(43 74% 52%)  accent
const BG     = '#f5f6f9'; // hsl(220 20% 97%) background
const WHITE  = '#ffffff';
const TEXT   = '#1a2340'; // hsl(222 47% 11%) foreground
const MUTED  = '#7a8299'; // hsl(220 12% 46%) muted-foreground
const BORDER = '#dde1ea'; // hsl(220 20% 88%) border

function buildHtml(opts: {
  academyName: string;
  tagline: string;
  logoUrl: string;
  website: string;
  contactEmail: string;
  subject: string;
  preheader: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
}) {
  const logo = opts.logoUrl
    ? `<img src="${opts.logoUrl}" alt="${opts.academyName}" style="height:48px;max-width:180px;object-fit:contain;" />`
    : `<span style="font-family:Georgia,serif;font-size:22px;font-weight:700;color:${GOLD};letter-spacing:-0.5px;">${opts.academyName}</span>`;

  const cta = opts.ctaLabel && opts.ctaUrl ? `
    <div style="text-align:center;margin:28px 0 8px;">
      <a href="${opts.ctaUrl}"
         style="display:inline-block;background:${GOLD};color:${NAVY};font-family:'Nunito',Arial,sans-serif;font-size:15px;font-weight:700;text-decoration:none;padding:13px 32px;border-radius:10px;letter-spacing:0.2px;">
        ${opts.ctaLabel}
      </a>
    </div>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>${opts.subject}</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
</head>
<body style="margin:0;padding:0;background:${BG};font-family:'Nunito',Arial,Helvetica,sans-serif;">

  <!-- Preheader (hidden preview text) -->
  <div style="display:none;max-height:0;overflow:hidden;color:${BG};">${opts.preheader}&nbsp;‌&nbsp;‌&nbsp;‌</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};min-height:100vh;">
    <tr><td align="center" style="padding:32px 16px;">

      <!-- Card -->
      <table role="presentation" width="100%" style="max-width:580px;background:${WHITE};border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(30,45,92,0.10);">

        <!-- Header bar -->
        <tr>
          <td style="background:${NAVY};padding:28px 36px 22px;text-align:center;">
            ${logo}
            <p style="margin:10px 0 0;color:${GOLD};font-size:12px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;opacity:0.9;">${opts.tagline || 'Excellence in Education'}</p>
          </td>
        </tr>

        <!-- Gold accent line -->
        <tr><td style="height:4px;background:linear-gradient(90deg,${GOLD} 0%,#e8b84b 50%,${GOLD} 100%);"></td></tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px 28px;">
            ${opts.bodyHtml}
            ${cta}
          </td>
        </tr>

        <!-- Divider -->
        <tr><td style="padding:0 40px;"><hr style="border:none;border-top:1px solid ${BORDER};margin:0;" /></td></tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 40px 28px;text-align:center;">
            <p style="margin:0 0 6px;font-size:12px;color:${MUTED};">
              © ${new Date().getFullYear()} ${opts.academyName}. All rights reserved.
            </p>
            ${opts.website ? `<a href="${opts.website}" style="font-size:12px;color:${GOLD};text-decoration:none;">${opts.website.replace('https://', '')}</a>` : ''}
            ${opts.contactEmail ? `<span style="font-size:12px;color:${MUTED};"> · ${opts.contactEmail}</span>` : ''}
            <p style="margin:10px 0 0;font-size:11px;color:${BORDER};">
              You are receiving this email because you have an account at ${opts.academyName}.
            </p>
          </td>
        </tr>

      </table>
      <!-- End Card -->

    </td></tr>
  </table>
</body>
</html>`;
}

// ── Text helpers ──────────────────────────────────────────────────────────────
function mdToHtml(text: string): string {
  // Convert plain text body (with \n) to simple HTML paragraphs
  return text
    .split(/\n\n+/)
    .map(block => block.trim())
    .filter(Boolean)
    .map(block => {
      // Headings
      if (block.startsWith('# ')) return `<h2 style="margin:0 0 12px;font-size:20px;font-weight:700;color:${TEXT};">${block.slice(2)}</h2>`;
      if (block.startsWith('## ')) return `<h3 style="margin:0 0 10px;font-size:16px;font-weight:700;color:${TEXT};">${block.slice(3)}</h3>`;
      // Highlight box (lines starting with >) 
      if (block.startsWith('> ')) {
        const inner = block.slice(2).replace(/\n> /g, '<br />');
        return `<div style="background:#f0f3ff;border-left:4px solid ${GOLD};border-radius:0 8px 8px 0;padding:12px 16px;margin:0 0 16px;font-size:14px;color:${NAVY};font-weight:600;">${inner}</div>`;
      }
      // Default paragraph
      const lines = block.split('\n').join('<br />');
      return `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:${TEXT};">${lines}</p>`;
    })
    .join('\n');
}

// ── Main handler ──────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  try {
    const base44 = createClient({ appId: '6a2115bb078a7219b5cbd8b0' });

    const { type, variables = {} } = await req.json();

    // Load branding
    const [academySettings, emailTemplates] = await Promise.all([
      base44.asServiceRole.entities.PlatformSettings.filter({ key: 'academy' }),
      base44.asServiceRole.entities.PlatformSettings.filter({ key: 'email_templates' }),
    ]);

    const academy = academySettings[0]?.value || {};
    const templates = emailTemplates[0]?.value || {};

    const branding = {
      academyName: academy.school_name || 'The Chibondo Academy',
      tagline:     academy.tagline     || 'Excellence in Malawian Secondary Education',
      logoUrl:     academy.logo_url    || '',
      website:     academy.website     || 'https://www.chibondoacademy.com',
      contactEmail: academy.contact_email || 'admin@chibondoacademy.com',
    };

    // ── Template definitions ──────────────────────────────────────────────────
    const emailTypes: Record<string, any> = {

      payment_confirmed: {
        subject: templates.payment_confirmed_subject || `Payment Confirmed – ${branding.academyName}`,
        preheader: `Your subscription is now active until ${variables.end_date || ''}`,
        ctaLabel: 'Go to Dashboard',
        ctaUrl: `${branding.website}/dashboard`,
        bodyText: (templates.payment_confirmed_body ||
          `Dear {student_name},\n\nYour payment has been received and your {plan} subscription is now active until {end_date}.\n\nYou now have full access to all lessons, quizzes, and course materials.\n\nVisit your dashboard to start learning.`
        )
          .replace(/\{student_name\}/g, variables.student_name || 'Student')
          .replace(/\{end_date\}/g, variables.end_date || '')
          .replace(/\{plan\}/g, variables.plan || 'subscription')
          .replace(/\{dashboard_link\}/g, `${branding.website}/dashboard`),
      },

      subscription_expired: {
        subject: templates.subscription_expired_subject || `Your ${branding.academyName} subscription has expired`,
        preheader: 'Renew your fees to restore full access',
        ctaLabel: 'Renew Now',
        ctaUrl: `${branding.website}/subscription`,
        bodyText: (templates.subscription_expired_body ||
          `Dear {student_name},\n\nYour school fees subscription expired on {end_date}.\n\nPlease renew to continue accessing all lessons and course materials.`
        )
          .replace(/\{student_name\}/g, variables.student_name || 'Student')
          .replace(/\{end_date\}/g, variables.end_date || '')
          .replace(/\{subscription_link\}/g, `${branding.website}/subscription`),
      },

      subscription_expiring: {
        subject: templates.subscription_expiring_subject || `Your ${branding.academyName} subscription expires soon`,
        preheader: `Only ${variables.days_left || 'a few'} days left — renew now to stay on track`,
        ctaLabel: 'Renew Subscription',
        ctaUrl: `${branding.website}/subscription`,
        bodyText: (templates.subscription_expiring_body ||
          `Dear {student_name},\n\nThis is a reminder that your school fees subscription will expire on {end_date} — only {days_left} day(s) away.\n\nRenew before it expires to avoid any interruption to your studies.`
        )
          .replace(/\{student_name\}/g, variables.student_name || 'Student')
          .replace(/\{end_date\}/g, variables.end_date || '')
          .replace(/\{days_left\}/g, String(variables.days_left || ''))
          .replace(/\{subscription_link\}/g, `${branding.website}/subscription`),
      },

      welcome: {
        subject: `Welcome to ${branding.academyName}! 🎓`,
        preheader: 'Your account is ready — start learning today',
        ctaLabel: 'Start Learning',
        ctaUrl: `${branding.website}/dashboard`,
        bodyText: `Dear {student_name},\n\nWelcome to ${branding.academyName}! Your account has been verified and you are all set.\n\n${branding.tagline}.\n\nBrowse your subjects, attempt quizzes, and track your progress — all in one place.`
          .replace(/\{student_name\}/g, variables.student_name || 'Student'),
      },
    };

    const template = emailTypes[type];
    if (!template) {
      return Response.json({ error: `Unknown email type: ${type}` }, { status: 400 });
    }

    // Add a highlight box for key info if provided
    let highlightHtml = '';
    if (variables.highlight_label && variables.highlight_value) {
      highlightHtml = `\n\n> **${variables.highlight_label}:** ${variables.highlight_value}`;
    }

    const bodyHtml = mdToHtml(template.bodyText + highlightHtml);

    const html = buildHtml({
      ...branding,
      subject: template.subject,
      preheader: template.preheader,
      bodyHtml,
      ctaLabel: template.ctaLabel,
      ctaUrl: template.ctaUrl,
    });

    return Response.json({
      subject: template.subject,
      html,
      text: template.bodyText, // plain text fallback
    });

  } catch (err: any) {
    console.error('buildBrandedEmail error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
});
