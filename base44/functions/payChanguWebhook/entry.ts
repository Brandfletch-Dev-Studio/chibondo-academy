import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const payload = await req.json();
    console.log('PayChangu webhook received:', JSON.stringify(payload));

    // PayChangu sends status=success and event=charge.completed on successful payment
    if (payload.status === 'success' && payload.event === 'charge.completed') {
      const { charge_id, amount, customer } = payload.data || {};

      if (!charge_id) {
        console.error('Webhook missing charge_id');
        return Response.json({ error: 'Missing charge_id' }, { status: 400 });
      }

      // Find the pending payment by charge_id (stored as reference)
      const payments = await base44.asServiceRole.entities.Payment.filter({
        reference: charge_id,
        status: 'pending',
      });

      if (payments.length === 0) {
        console.error(`No pending payment found for charge_id: ${charge_id}`);
        return Response.json({ error: 'Payment record not found' }, { status: 404 });
      }

      const payment = payments[0];
      const subscriptionId = payment.subscription_id;
      const studentId = payment.student_id;

      // Find the pending subscription
      const subscriptions = await base44.asServiceRole.entities.Subscription.filter({
        student_id: studentId,
        status: 'trial',
      });

      if (subscriptions.length === 0) {
        console.error(`No pending subscription for student ${studentId}`);
        return Response.json({ error: 'Subscription not found' }, { status: 404 });
      }

      // Use the one matching subscription_id if multiple exist
      const sub = subscriptions.find(s => s.id === subscriptionId) || subscriptions[0];

      // Calculate end date based on plan
      const startDate = new Date();
      const endDate = new Date();

      if (sub.plan === 'monthly') {
        endDate.setMonth(endDate.getMonth() + 1);
      } else if (sub.plan === 'annual') {
        endDate.setFullYear(endDate.getFullYear() + 1);
      } else if (sub.plan === 'biannual') {
        endDate.setFullYear(endDate.getFullYear() + 2);
      } else if (sub.plan === 'quarterly') {
        endDate.setMonth(endDate.getMonth() + 3);
      }

      // Activate the subscription
      await base44.asServiceRole.entities.Subscription.update(sub.id, {
        status: 'active',
        amount_paid: amount || sub.amount_paid,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
      });

      // Mark the payment as completed
      await base44.asServiceRole.entities.Payment.update(payment.id, {
        status: 'completed',
        description: `${sub.plan} school fees — payment confirmed`,
      });

      console.log(`✅ Subscription ${sub.id} activated for student ${studentId} — plan: ${sub.plan} until ${endDate.toISOString()}`);

      // Send payment confirmed notification
      await base44.asServiceRole.entities.Notification.create({
        user_id: studentId,
        title: 'Payment confirmed — full access unlocked!',
        message: `Your ${sub.plan} subscription is now active until ${endDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.`,
        type: 'subscription',
        link: '/dashboard',
        is_read: false,
      });

      // Send payment confirmed email using template
      const emailTemplateSettings = await base44.asServiceRole.entities.PlatformSettings.filter({ key: 'email_templates' });
      const templates = emailTemplateSettings[0]?.value || {};

      const emailSubject = templates.payment_confirmed_subject || 'Payment Confirmed – Welcome to Chibondo Academy!';
      const emailBodyTemplate = templates.payment_confirmed_body ||
        `Dear Student,\n\nYour payment has been received and your subscription is now active until {end_date}.\n\nYou now have full access to all lessons and course materials.\n\nVisit {dashboard_link} to start learning.\n\nRegards,\nThe Chibondo Academy Team`;

      const emailBody = emailBodyTemplate
        .replace('{end_date}', endDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }))
        .replace('{dashboard_link}', 'https://app.chibondo.mw/dashboard');

      const users = await base44.asServiceRole.entities.User.filter({ id: studentId });
      if (users[0]?.email) {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: users[0].email,
          subject: emailSubject,
          body: emailBody,
        });
        console.log(`✅ Payment confirmed email sent to ${users[0].email}`);
      }
    } else {
      console.log(`Webhook event ignored: status=${payload.status}, event=${payload.event}`);
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});