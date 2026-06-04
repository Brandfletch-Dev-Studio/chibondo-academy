import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Parse webhook payload
    const payload = await req.json();
    
    console.log('PayChangu webhook received:', payload);
    
    // Verify this is a payment completion event
    if (payload.status === 'success' && payload.event === 'charge.completed') {
      const { tx_ref, amount, customer, meta } = payload.data;
      
      if (!meta?.student_id || !meta?.plan) {
        return Response.json({ error: 'Invalid webhook payload' }, { status: 400 });
      }
      
      // Find the pending subscription
      const subscriptions = await base44.asServiceRole.entities.Subscription.filter({ 
        student_id: meta.student_id,
        status: 'trial',
      });
      
      if (subscriptions.length === 0) {
        return Response.json({ error: 'No pending subscription found' }, { status: 404 });
      }
      
      const sub = subscriptions[0];
      
      // Calculate end date based on plan
      const startDate = new Date();
      let endDate = new Date();
      
      if (meta.plan === 'monthly') {
        endDate.setMonth(endDate.getMonth() + 1);
      } else if (meta.plan === 'quarterly') {
        endDate.setMonth(endDate.getMonth() + 3);
      } else if (meta.plan === 'annual') {
        endDate.setFullYear(endDate.getFullYear() + 1);
      }
      
      // Update subscription to active
      await base44.asServiceRole.entities.Subscription.update(sub.id, {
        status: 'active',
        amount_paid: amount,
        payment_method: meta?.provider || 'airtel_money',
        reference: tx_ref,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
      });
      
      // Update user metadata
      try {
        const user = await base44.asServiceRole.entities.User.filter({ id: meta.student_id });
        if (user.length > 0) {
          // Note: We can't directly update User entity, but we've updated the subscription
        }
      } catch (e) {
        console.error('Error updating user:', e);
      }
      
      // Create payment record
      await base44.asServiceRole.entities.Payment.create({
        student_id: meta.student_id,
        student_name: customer?.first_name + ' ' + (customer?.last_name || ''),
        subscription_id: sub.id,
        amount,
        currency: 'MWK',
        method: meta?.provider || 'airtel_money',
        reference: tx_ref,
        status: 'completed',
        description: `Payment for ${meta.plan} plan via PayChangu`,
      });
      
      console.log(`Subscription ${sub.id} activated for student ${meta.student_id}`);
    }
    
    return Response.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});