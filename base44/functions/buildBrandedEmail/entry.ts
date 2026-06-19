/**
 * buildBrandedEmail — Shared HTML email renderer for Chibondo Academy
 *
 * POST { type, variables } → { subject, html, text }
 *
 * Types:
 *   welcome              – after registration
 *   payment_confirmed    – after PayChangu payment (now with amount/plan table)
 *   cart_recovery        – 1hr after abandoned payment
 *   subscription_expired – when subscription lapses
 *   subscription_expiring – 3 days before expiry
 *   new_lesson           – new/updated lesson published
 *   new_blog_post        – new blog post published
 */
import { createClient } from 'npm:@base44/sdk@0.8.31';

// ── Brand colours (exact match to index.css CSS vars) ──────────────────────
const NAVY   = '#1e2d5c';
const GOLD   = '#c9961a';
const GOLD_L = '#e8b84b';
const BG     = '#f5f6f9';
const WHITE  = '#ffffff';
const TEXT   = '#1a2340';
const MUTED  = '#7a8299';
const BORDER = '#dde1ea';
const CARD   = '#f0f3ff';

// ── HTML shell ─────────────────────────────────────────────────────────────
function buildHtml(opts: {
  academyName: string; tagline: string; logoUrl: string;
  website: string; contactEmail: string;
  subject: string; preheader: string; bodyHtml: string;
  ctaLabel?: string; ctaUrl?: string;
  heroImage?: string;
}) {
  const logo = opts.logoUrl
    ? `<img src="${opts.logoUrl}" alt="${opts.academyName}" style="height:48px;max-width:180px;object-fit:contain;" />`
    : `<span style="font-family:Georgia,serif;font-size:22px;font-weight:700;color:${GOLD};letter-spacing:-0.5px;">${opts.academyName}</span>`;

  const hero = opts.heroImage
    ? `<tr><td style="padding:0;"><img src="${opts.heroImage}" alt="" style="width:100%;max-height:200px;object-fit:cover;display:block;" /></td></tr>`
    : '';

  const cta = opts.ctaLabel && opts.ctaUrl
    ? `<div style="text-align:center;margin:28px 0 8px;">
        <a href="${opts.ctaUrl}" style="display:inline-block;background:${GOLD};color:${NAVY};font-family:'Nunito',Arial,sans-serif;font-size:15px;font-weight:700;text-decoration:none;padding:13px 36px;border-radius:10px;letter-spacing:0.2px;">${opts.ctaLabel}</a>
       </div>`
    : '';

  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>${opts.subject}</title>
</head>
<body style="margin:0;padding:0;background:${BG};font-family:'Nunito',Arial,Helvetica,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;color:${BG};">${opts.preheader}&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};min-height:100vh;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" style="max-width:580px;background:${WHITE};border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(30,45,92,0.10);">

        <!-- Header -->
        <tr>
          <td style="background:${NAVY};padding:28px 36px 20px;text-align:center;">
            ${logo}
            <p style="margin:10px 0 0;color:${GOLD};font-size:11.5px;font-weight:600;letter-spacing:1.4px;text-transform:uppercase;opacity:0.9;">${opts.tagline || 'Excellence in Education'}</p>
          </td>
        </tr>

        <!-- Gold bar -->
        <tr><td style="height:4px;background:linear-gradient(90deg,${GOLD} 0%,${GOLD_L} 50%,${GOLD} 100%);"></td></tr>

        <!-- Optional hero image -->
        ${hero}

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
            <p style="margin:0 0 4px;font-size:12px;color:${MUTED};">© ${year} ${opts.academyName}. All rights reserved.</p>
            ${opts.website ? `<a href="${opts.website}" style="font-size:12px;color:${GOLD};text-decoration:none;">${opts.website.replace(/https?:\/\//, '')}</a>` : ''}
            ${opts.contactEmail ? `<span style="font-size:12px;color:${MUTED};"> · ${opts.contactEmail}</span>` : ''}
            <p style="margin:10px 0 0;font-size:11px;color:${BORDER};">You are receiving this because you have an account at ${opts.academyName}.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Plain text → HTML paragraphs ───────────────────────────────────────────
function toHtml(text: string): string {
  return text
    .split(/\n\n+/)
    .map(b => b.trim())
    .filter(Boolean)
    .map(b => {
      if (b.startsWith('# '))  return `<h2 style="margin:0 0 14px;font-size:20px;font-weight:700;color:${TEXT};">${b.slice(2)}</h2>`;
      if (b.startsWith('## ')) return `<h3 style="margin:0 0 10px;font-size:16px;font-weight:700;color:${TEXT};">${b.slice(3)}</h3>`;
      if (b.startsWith('> ')) {
        const inner = b.slice(2).replace(/\n> /g, '<br />');
        return `<div style="background:${CARD};border-left:4px solid ${GOLD};border-radius:0 8px 8px 0;padding:12px 16px;margin:0 0 16px;font-size:14px;color:${NAVY};font-weight:600;">${inner}</div>`;
      }
      return `<p style="margin:0 0 16px;font-size:15px;line-height:1.75;color:${TEXT};">${b.split('\n').join('<br />')}</p>`;
    })
    .join('\n');
}

// ── Pill badge ─────────────────────────────────────────────────────────────
function pill(label: string) {
  return `<span style="display:inline-block;background:${GOLD};color:${NAVY};font-size:11px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;padding:3px 10px;border-radius:20px;">${label}</span>`;
}

// ── Meta row (icon + label + value) ───────────────────────────────────────
function metaRow(label: string, value: string) {
  return `<tr>
    <td style="padding:5px 0;font-size:13px;color:${MUTED};font-weight:600;width:110px;">${label}</td>
    <td style="padding:5px 0;font-size:13px;color:${TEXT};">${value}</td>
  </tr>`;
}

// ─────────────────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  try {
    const base44 = createClient({ appId: '6a2115bb078a7219b5cbd8b0' });
    const { type, variables = {} } = await req.json();

    const [academyRow, templateRow] = await Promise.all([
      base44.asServiceRole.entities.PlatformSettings.filter({ key: 'academy' }),
      base44.asServiceRole.entities.PlatformSettings.filter({ key: 'email_templates' }),
    ]);

    const academy  = academyRow[0]?.value  || {};
    const tpls     = templateRow[0]?.value || {};

    const b = {
      academyName:  academy.school_name    || 'The Chibondo Academy',
      tagline:      academy.tagline        || 'Excellence in Malawian Secondary Education',
      logoUrl:      academy.logo_url       || '',
      website:      academy.website        || 'https://www.chibondoacademy.com',
      contactEmail: academy.contact_email  || 'admin@chibondoacademy.com',
    };

    const v: any = variables;

    // ── Template map ───────────────────────────────────────────────────────
    const types: Record<string, () => { subject: string; preheader: string; bodyHtml: string; ctaLabel: string; ctaUrl: string; heroImage?: string; text: string }> = {

      // ── Welcome ──────────────────────────────────────────────────────────
      welcome: () => {
        const name = v.student_name || 'Student';
        const text = `Dear ${name},\n\nWelcome to ${b.academyName}! Your email has been verified and your account is ready.\n\n${b.tagline}.\n\nExplore your enrolled subjects, tackle quizzes, and track your progress — all in one place.`;
        return {
          subject: `Welcome to ${b.academyName}! 🎓`,
          preheader: 'Your account is verified — start learning today',
          bodyHtml: toHtml(text),
          ctaLabel: 'Go to Dashboard',
          ctaUrl: `${b.website}/dashboard`,
          text,
        };
      },

      // ── Welcome ──────────────────────────────────────────────────────────
      welcome: () => {
        const name = v.student_name || 'Student';
        const rawBody = (tpls.welcome_body ||
          `Dear {student_name},\n\nWelcome to ${b.academyName}! We are thrilled to have you join our learning community.\n\nYour referral code is: {referral_code}\n\nGet started at: {dashboard_link}`)
          .replace(/\{student_name\}/g,   name)
          .replace(/\{referral_code\}/g,  v.referral_code || '')
          .replace(/\{dashboard_link\}/g, `${b.website}/dashboard`);
        return {
          subject:   tpls.welcome_subject || `Welcome to ${b.academyName}! 🎓`,
          preheader: `Hi ${name}, your account is ready — start exploring today`,
          bodyHtml:  toHtml(rawBody),
          ctaLabel:  'Go to My Dashboard',
          ctaUrl:    `${b.website}/dashboard`,
          text: rawBody,
        };
      },

      // ── Payment confirmed ─────────────────────────────────────────────────
      payment_confirmed: () => {
        const name = v.student_name || 'Student';
        const planLabel = (v.plan || 'subscription').charAt(0).toUpperCase() + (v.plan || 'subscription').slice(1);
        const rawBody = (tpls.payment_confirmed_body ||
          `Dear {student_name},\n\nYour payment has been received and your {plan} subscription is now active until {end_date}.\n\nYou now have full access to all lessons, quizzes, and course materials.`)
          .replace(/\{student_name\}/g,  name)
          .replace(/\{end_date\}/g,      v.end_date || '')
          .replace(/\{plan\}/g,          planLabel)
          .replace(/\{amount\}/g,        v.amount ? Number(v.amount).toLocaleString() : '')
          .replace(/\{dashboard_link\}/g, `${b.website}/dashboard`)
          .replace(/\{contact_email\}/g, b.contactEmail);

        const infoTable = v.end_date ? `
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px 0 24px;width:100%;background:${CARD};border-radius:8px;border:1px solid ${BORDER};">
            <tr><td style="padding:10px 16px;border-bottom:1px solid ${BORDER};">${metaRow('Plan', planLabel)}</td></tr>
            <tr><td style="padding:10px 16px;border-bottom:1px solid ${BORDER};">${metaRow('Active until', v.end_date)}</td></tr>
            ${v.amount ? `<tr><td style="padding:10px 16px;">${metaRow('Amount paid', 'MWK ' + Number(v.amount).toLocaleString())}</td></tr>` : ''}
          </table>` : '';

        return {
          subject:   tpls.payment_confirmed_subject || `Payment Confirmed – ${b.academyName}`,
          preheader: `Your ${planLabel} subscription is active until ${v.end_date || ''}`,
          bodyHtml:  toHtml(rawBody) + infoTable,
          ctaLabel:  'Go to Dashboard',
          ctaUrl:    `${b.website}/dashboard`,
          text: rawBody,
        };
      },

      // ── Cart recovery ─────────────────────────────────────────────────────
      cart_recovery: () => {
        const name = v.student_name || 'Student';
        const planLabel = (v.plan || 'monthly').charAt(0).toUpperCase() + (v.plan || 'monthly').slice(1);
        const rawBody = (tpls.cart_recovery_body ||
          `Dear {student_name},\n\nWe noticed you started the school fees payment process but didn't complete it.\n\nComplete your {plan} subscription (MWK {amount}) now: {payment_link}\n\nIf you already paid, please ignore this email or contact us at {contact_email}.`)
          .replace(/\{student_name\}/g,  name)
          .replace(/\{plan\}/g,          planLabel)
          .replace(/\{amount\}/g,        v.amount ? Number(v.amount).toLocaleString() : '')
          .replace(/\{payment_link\}/g,  `${b.website}/subscription`)
          .replace(/\{contact_email\}/g, b.contactEmail);
        return {
          subject:   tpls.cart_recovery_subject || `Complete your ${b.academyName} fees payment`,
          preheader: `Your payment session is still open — finish in seconds`,
          bodyHtml:  toHtml(rawBody),
          ctaLabel:  'Complete Payment',
          ctaUrl:    `${b.website}/subscription`,
          text: rawBody,
        };
      },

      // ── Subscription expired ──────────────────────────────────────────────
      subscription_expired: () => {
        const name = v.student_name || 'Student';
        const rawBody = (tpls.subscription_expired_body ||
          `Dear {student_name},\n\nYour school fees subscription expired on {end_date}.\n\nPlease renew to continue accessing all lessons and course materials.`)
          .replace(/\{student_name\}/g, name)
          .replace(/\{end_date\}/g,     v.end_date || '')
          .replace(/\{subscription_link\}/g, `${b.website}/subscription`);
        return {
          subject:   tpls.subscription_expired_subject || `Your ${b.academyName} subscription has expired`,
          preheader: 'Renew your fees to restore full access',
          bodyHtml:  toHtml(rawBody),
          ctaLabel:  'Renew Now',
          ctaUrl:    `${b.website}/subscription`,
          text: rawBody,
        };
      },

      // ── Subscription expiring ─────────────────────────────────────────────
      subscription_expiring: () => {
        const name = v.student_name || 'Student';
        const rawBody = (tpls.subscription_expiring_body ||
          `Dear {student_name},\n\nYour school fees subscription will expire on {end_date} — only {days_left} day(s) away.\n\nRenew before it expires to avoid any interruption to your studies.`)
          .replace(/\{student_name\}/g, name)
          .replace(/\{end_date\}/g,     v.end_date || '')
          .replace(/\{days_left\}/g,    String(v.days_left || ''))
          .replace(/\{subscription_link\}/g, `${b.website}/subscription`);
        return {
          subject:   tpls.subscription_expiring_subject || `Your ${b.academyName} subscription expires soon`,
          preheader: `Only ${v.days_left || 'a few'} days left — renew now`,
          bodyHtml:  toHtml(rawBody),
          ctaLabel:  'Renew Subscription',
          ctaUrl:    `${b.website}/subscription`,
          text: rawBody,
        };
      },

      // ── New lesson ────────────────────────────────────────────────────────
      new_lesson: () => {
        const name    = v.student_name  || 'Student';
        const title   = v.lesson_title  || 'New Lesson';
        const subject = v.subject_name  || 'your subject';
        const desc    = v.description   || '';
        const mins    = v.estimated_minutes ? `${v.estimated_minutes} min` : '';
        const isNew   = v.is_update ? false : true;

        const metaTable = `
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px 0 24px;width:100%;">
            ${v.subject_name ? metaRow('Subject', v.subject_name) : ''}
            ${v.topic_title  ? metaRow('Topic',   v.topic_title)  : ''}
            ${mins           ? metaRow('Duration', mins)           : ''}
          </table>`;

        const bodyHtml = `
          <p style="margin:0 0 6px;">
            ${pill(isNew ? 'New Lesson' : 'Lesson Updated')}
          </p>
          <h2 style="margin:12px 0 6px;font-size:21px;font-weight:700;color:${TEXT};line-height:1.3;">${title}</h2>
          <p style="margin:0 0 16px;font-size:13px;color:${MUTED};">in <strong style="color:${TEXT};">${subject}</strong></p>
          ${desc ? `<p style="margin:0 0 4px;font-size:15px;line-height:1.75;color:${TEXT};">${desc}</p>` : ''}
          ${metaTable}`;

        const lessonUrl = v.lesson_url || `${b.website}/lessons/${v.lesson_id || ''}`;
        const text = `${isNew ? 'New lesson' : 'Updated lesson'}: ${title}\nSubject: ${subject}\n\n${desc}\n\nView: ${lessonUrl}`;
        return {
          subject:    `${isNew ? '📚 New lesson' : '✏️ Updated lesson'}: ${title}`,
          preheader:  `${isNew ? 'A new lesson has been added' : 'A lesson has been updated'} in ${subject}`,
          heroImage:  v.cover_image || '',
          bodyHtml,
          ctaLabel:  'View Lesson',
          ctaUrl:    lessonUrl,
          text,
        };
      },

      // ── New blog post ──────────────────────────────────────────────────────
      new_blog_post: () => {
        const name     = v.student_name || 'Student';
        const title    = v.post_title   || 'New Article';
        const excerpt  = v.excerpt      || '';
        const author   = v.author_name  || b.academyName;
        const category = v.category     || '';
        const postUrl  = v.post_url     || `${b.website}/blog/${v.post_slug || ''}`;

        const bodyHtml = `
          <p style="margin:0 0 10px;">
            ${category ? pill(category) : ''}
          </p>
          <h2 style="margin:12px 0 10px;font-size:21px;font-weight:700;color:${TEXT};line-height:1.3;">${title}</h2>
          <p style="margin:0 0 6px;font-size:12px;color:${MUTED};">By <strong style="color:${TEXT};">${author}</strong></p>
          ${excerpt ? `<p style="margin:14px 0 0;font-size:15px;line-height:1.75;color:${TEXT};">${excerpt}</p>` : ''}`;

        const text = `New article: ${title}\nBy ${author}\n\n${excerpt}\n\nRead: ${postUrl}`;
        return {
          subject:   `📖 New article: ${title}`,
          preheader: excerpt ? excerpt.slice(0, 90) : `New article published on ${b.academyName}`,
          heroImage: v.cover_image || '',
          bodyHtml,
          ctaLabel:  'Read Article',
          ctaUrl:    postUrl,
          text,
        };
      },
    };

    const builder = types[type];
    if (!builder) return Response.json({ error: `Unknown type: ${type}` }, { status: 400 });

    const t = builder();
    const html = buildHtml({ ...b, subject: t.subject, preheader: t.preheader, bodyHtml: t.bodyHtml, ctaLabel: t.ctaLabel, ctaUrl: t.ctaUrl, heroImage: t.heroImage });

    return Response.json({ subject: t.subject, html, text: t.text });

  } catch (err: any) {
    console.error('buildBrandedEmail error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
});
