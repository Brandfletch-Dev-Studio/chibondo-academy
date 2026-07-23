/**
 * notifyNewLesson — triggered by Lesson entity automation on publish
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
      if (!u[0]?.phone_number) continue;
      
      const name = u[0].full_name || u[0].phone_number;
      const lessonTitle = lesson.title || 'New Lesson';
      const msg = `Hi ${name}, a new lesson has been published in *${subjectName}*:\n\n*${lessonTitle}*\n\nWatch lesson here: ${lessonUrl}`;
      
      await sendWhatsApp(u[0].phone_number, msg).catch(e2 => console.error(e2.message));
      sent++;
    }
    return Response.json({ success: true, sent });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});
