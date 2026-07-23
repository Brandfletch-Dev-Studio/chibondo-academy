import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

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
    const base44 = createClientFromRequest(req);
    const now = new Date();

    // Find all active subscriptions
    const activeSubscriptions = await base44.asServiceRole.entities.Subscription.filter({ status: 'active' });

    let expiredCount = 0;
    let expiringSoonCount = 0;

    for (const sub of activeSubscriptions) {
      if (!sub.end_date) continue;
      const endDate = new Date(sub.end_date);
      const endDateFormatted = endDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

      // ── EXPIRED ──────────────────────────────────────────────────────────
      if (endDate < now) {
        await base44.asServiceRole.entities.Subscription.update(sub.id, { status: 'expired' });
        expiredCount++;

        await base44.asServiceRole.entities.Notification.create({
          user_id: sub.student_id,
          title: 'Your subscription has expired',
          message: 'Your school fees subscription has expired. Pay your fees to continue accessing all lessons.',
          type: 'subscription', link: '/subscription', is_read: false,
        });

        const users = await base44.asServiceRole.entities.User.filter({ id: sub.student_id });
        if (users[0]?.phone_number) {
          const name = users[0].full_name || 'Student';
          const msg = `Hi ${name}, your Chibondo Academy subscription has expired. Pay your fees to continue accessing lessons: ${APP_URL}/subscription`;
          await sendWhatsApp(users[0].phone_number, msg).catch(err => console.error('WhatsApp expiry alert failed:', err.message));
        }
        continue;
      }

      // ── EXPIRING SOON (within 3 days) ────────────────────────────────────
      const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
      if (daysLeft <= 3) {
        // Dedup — don't re-send if already sent in last 24h
        const recentNotifs = await base44.asServiceRole.entities.Notification.filter({
          user_id: sub.student_id,
          type: 'subscription_expiring',
        });
        const alreadySent = recentNotifs.some((n: any) => {
          return (now.getTime() - new Date(n.created_date).getTime()) < 24 * 60 * 60 * 1000;
        });
        if (alreadySent) continue;

        expiringSoonCount++;

        await base44.asServiceRole.entities.Notification.create({
          user_id: sub.student_id,
          title: `Your subscription expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`,
          message: `Renew your fees before ${endDateFormatted} to avoid losing access.`,
          type: 'subscription_expiring', link: '/subscription', is_read: false,
        });

        const users = await base44.asServiceRole.entities.User.filter({ id: sub.student_id });
        if (users[0]?.phone_number) {
          const name = users[0].full_name || 'Student';
          const msg = `Hi ${name}, your subscription expires in ${daysLeft} day(s). Renew before ${endDateFormatted} to avoid losing access: ${APP_URL}/subscription`;
          await sendWhatsApp(users[0].phone_number, msg).catch(err => console.error('WhatsApp expiry-soon alert failed:', err.message));
        }
      }
    }

    console.log(`Expiry check complete — expired: ${expiredCount}, expiring soon: ${expiringSoonCount}`);
    return Response.json({ checked: activeSubscriptions.length, expired: expiredCount, expiring_soon: expiringSoonCount });

  } catch (error) {
    console.error('Expiry check error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
