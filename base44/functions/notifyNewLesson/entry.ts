/**
 * notifyNewLesson
 * Triggered by entity automation on Lesson (create + update).
 * Only fires when status === 'published'.
 * Emails all students enrolled in the lesson's subject.
 *
 * Automation payload: { event, data, old_data }
 */
import { createClient } from 'npm:@base44/sdk@0.8.31';

// ── Resend email sender ───────────────────────────────────────────────────────
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || 're_Z2rVV1Yz_BapfeMWdpLWbHuBjyJ6QTpaD';
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


// Shared email helper
async function sendBrandedEmail(base44: any, to: string, type: string, variables: Record<string, any>) {
  try {
    const built = await base44.asServiceRole.functions.invoke('buildBrandedEmail', { type, variables });
    if (!built || built.error) throw new Error(built?.error || 'buildBrandedEmail failed');
    await sendEmail(to, built.subject, built.html);
  } catch (err: any) {
    console.error(`Email to ${to} failed:`, err.message);
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClient({ appId: '6a2115bb078a7219b5cbd8b0' });
    const body = await req.json();

    const lesson   = body.data;
    const oldLesson = body.old_data;
    const eventType = body.event?.type; // 'create' | 'update'

    // Only proceed if lesson is published
    if (lesson?.status !== 'published') {
      console.log(`Skipping — lesson status is "${lesson?.status}"`);
      return Response.json({ skipped: true });
    }

    // For updates: only notify if it just became published (was draft before)
    // OR if title/content changed on an already-published lesson
    const justPublished = eventType === 'update' && oldLesson?.status === 'draft' && lesson.status === 'published';
    const isNew         = eventType === 'create';
    const contentUpdated = eventType === 'update'
      && lesson.status === 'published'
      && oldLesson?.status === 'published'
      && (oldLesson?.title !== lesson.title || oldLesson?.content !== lesson.content || oldLesson?.video_url !== lesson.video_url);

    if (!isNew && !justPublished && !contentUpdated) {
      console.log('No meaningful change to notify about — skipping');
      return Response.json({ skipped: true });
    }

    const subjectId = lesson.subject_id;
    if (!subjectId) return Response.json({ skipped: true, reason: 'no subject_id' });

    // Find all active enrollments for this subject
    const enrollments = await base44.asServiceRole.entities.Enrollment.filter({ subject_id: subjectId, status: 'active' });
    if (enrollments.length === 0) {
      console.log(`No enrollments for subject ${subjectId}`);
      return Response.json({ sent: 0 });
    }

    // Get unique student IDs
    const studentIds = [...new Set(enrollments.map((e: any) => e.student_id))];
    console.log(`Notifying ${studentIds.length} students about lesson: ${lesson.title}`);

    // Batch fetch students
    const lessonUrl = `https://www.chibondoacademy.com/lessons/${lesson.id || ''}`;
    let sent = 0;

    for (const studentId of studentIds) {
      try {
        const users = await base44.asServiceRole.entities.User.filter({ id: studentId });
        const user = users[0];
        if (!user?.email) continue;

        // Also create an in-app notification
        await base44.asServiceRole.entities.Notification.create({
          user_id: studentId,
          title: `${isNew || justPublished ? '📚 New lesson' : '✏️ Updated lesson'}: ${lesson.title}`,
          message: `${lesson.subject_name || 'Your subject'} · ${lesson.topic_title || ''}`,
          type: 'lesson',
          link: `/lessons/${lesson.id}`,
          is_read: false,
        });

        await sendBrandedEmail(base44, user.email, 'new_lesson', {
          student_name:       user.full_name || user.email.split('@')[0],
          lesson_title:       lesson.title,
          subject_name:       lesson.subject_name  || '',
          topic_title:        lesson.topic_title   || '',
          description:        lesson.description   || '',
          estimated_minutes:  lesson.estimated_minutes || '',
          lesson_url:         lessonUrl,
          lesson_id:          lesson.id || '',
          cover_image:        lesson.og_image || '',
          is_update:          isNew || justPublished ? '' : 'true',
        });

        sent++;
      } catch (e: any) {
        console.error(`Failed for student ${studentId}:`, e.message);
      }
    }

    console.log(`✅ notifyNewLesson: sent ${sent}/${studentIds.length} emails for "${lesson.title}"`);
    return Response.json({ sent, total: studentIds.length });

  } catch (err: any) {
    console.error('notifyNewLesson error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
});
