import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// This function is called from the frontend after Paychangu redirects back
// It verifies the payment with Paychangu and activates the subscription
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { tx_ref } = await req.json();

    if (!tx_ref) {
      return Response.json({ error: 'tx_ref is required' }, { status: 400 });
    }

    const secretKey = Deno.env.get('PAYCHANGU_SECRET_KEY');
    if (!secretKey) {
      return Response.json({ error: 'PayChangu credentials not configured' }, { status: 500 });
    }

    // Verify with Paychangu API
    const verifyResponse = await fetch(`https://api.paychangu.com/verify-payment/${tx_ref}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Accept': 'application/json',
      },
    });

    const verifyText = await verifyResponse.text();
    let verifyData;
    try {
      verifyData = JSON.parse(verifyText);
    } catch {
      return Response.json({ error: 'Invalid response from Paychangu verification', raw: verifyText }, { status: 500 });
    }

    console.log('Paychangu verify response:', JSON.stringify(verifyData));

    // Check if payment was successful
    const isSuccess =
      verifyData?.status === 'success' ||
      verifyData?.data?.status === 'success' ||
      verifyData?.data?.payment_status === 'success';

    if (!isSuccess) {
      return Response.json({
        success: false,
        status: verifyData?.data?.status || verifyData?.status || 'unknown',
        message: 'Payment not yet confirmed',
      });
    }

    // Find the pending payment
    const payments = await base44.asServiceRole.entities.Payment.filter({
      reference: tx_ref,
    });

    if (payments.length === 0) {
      return Response.json({ error: 'Payment record not found' }, { status: 404 });
    }

    const payment = payments[0];

    // Already completed? Return success immediately
    if (payment.status === 'completed') {
      return Response.json({ success: true, already_activated: true });
    }

    const studentId = payment.student_id;

    // Find the pending subscription
    const subscriptions = await base44.asServiceRole.entities.Subscription.filter({
      student_id: studentId,
      status: 'trial',
    });

    if (subscriptions.length === 0) {
      return Response.json({ error: 'Subscription record not found' }, { status: 404 });
    }

    const sub = subscriptions[0];

    // Calculate end date
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

    // Activate subscription
    await base44.asServiceRole.entities.Subscription.update(sub.id, {
      status: 'active',
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
    });

    // Mark payment completed
    await base44.asServiceRole.entities.Payment.update(payment.id, {
      status: 'completed',
      description: `${sub.plan} school fees — payment confirmed`,
    });

    // Send notification
    await base44.asServiceRole.entities.Notification.create({
      user_id: studentId,
      title: 'Payment confirmed — full access unlocked!',
      message: `Your ${sub.plan} subscription is now active until ${endDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.`,
      type: 'subscription',
      link: '/dashboard',
      is_read: false,
    });

    // Send email
    try {
      const emailTemplateSettings = await base44.asServiceRole.entities.PlatformSettings.filter({ key: 'email_templates' });
      const templates = emailTemplateSettings[0]?.value || {};
      const emailSubject = templates.payment_confirmed_subject || 'Payment Confirmed – Welcome to Chibondo Academy!';
      const emailBodyTemplate = templates.payment_confirmed_body ||
        `Dear Student,\n\nYour payment has been received and your subscription is now active until {end_date}.\n\nYou now have full access to all lessons and course materials.\n\nVisit {dashboard_link} to start learning.\n\nRegards,\nThe Chibondo Academy Team`;

      const emailBody = emailBodyTemplate
        .replace('{end_date}', endDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }))
        .replace('{dashboard_link}', 'https://app.chibondo.ac.mw/dashboard');

      const users = await base44.asServiceRole.entities.User.filter({ id: studentId });
      if (users[0]?.email) {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: users[0].email,
          subject: emailSubject,
          body: emailBody,
        });
      }
    } catch (emailErr) {
      console.error('Email send failed (non-fatal):', emailErr);
    }

    console.log(`✅ Subscription activated for student ${studentId} via return-URL verification`);

    return Response.json({
      success: true,
      plan: sub.plan,
      end_date: endDate.toISOString(),
    });
  } catch (error) {
    console.error('verifyPayChanguPayment error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
