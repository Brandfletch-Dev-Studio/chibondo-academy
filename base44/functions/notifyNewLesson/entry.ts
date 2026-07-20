/**
 * notifyNewLesson — triggered by Lesson entity automation on publish
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

function buildLessonHtml(name: string, title: string, subject: string, url: string): string {
  return emailShell(`
    <h2 style="color:#1e2d5c;margin:0 0 12px;font-size:20px;">New Lesson Available, ${name}!</h2>
    <p style="color:#444;line-height:1.7;margin:0 0 16px;">A new lesson has been published in <strong>${subject}</strong>:</p>
    <div style="background:#f0f4ff;border-left:4px solid #1e2d5c;padding:16px;border-radius:0 8px 8px 0;margin:0 0 20px;">
      <p style="color:#1e2d5c;font-weight:bold;font-size:16px;margin:0;">${title}</p>
    </div>
    <div style="text-align:center;margin:24px 0;">
      <a href="${url}" style="background:#c9961a;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:bold;font-size:16px;display:inline-block;">
        Watch Lesson
      </a>
    </div>
  `);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClient({ appId: '6a2115bb078a7219b5cbd8b0' });
    const body = await req.json();
    const lesson = body.data; const old = body.old_data; const evt = body.event?.type;
    if (lesson?.status !== 'published') return Response.json({ skipped: true });
    if (evt === 'update' && old?.status === 'published') return Response.json({ skipped: true, reason: 'already published' });

    const subjects = await base44.asServiceRole.entities.Subject.filter({ id: lesson.subject_id }).catch(() => []);
    const subjectName = subjects[0]?.name || 'your subject';
    const lessonUrl = `${APP_URL}/lessons/${lesson.id}`;
    const enrollments = await base44.asServiceRole.entities.Enrollment.filter({ subject_id: lesson.subject_id });

    let sent = 0;
    for (const e of enrollments) {
      const u = await base44.asServiceRole.entities.User.filter({ id: e.student_id });
      if (!u[0]?.email) continue;
      const name = u[0].full_name || u[0].email.split('@')[0];
      await sendEmail(u[0].email, `New lesson in ${subjectName}: ${lesson.title}`, buildLessonHtml(name, lesson.title || 'New Lesson', subjectName, lessonUrl)).catch(e2 => console.error(e2.message));
      sent++;
    }
    return Response.json({ success: true, sent });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});
