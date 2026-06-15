import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Get current user (just verified their email)
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { referralCode } = await req.json();

    if (!referralCode) {
      return Response.json({ error: 'Referral code required' }, { status: 400 });
    }

    // Check if referral already exists for this user (one-time commission only)
    const existingReferrals = await base44.asServiceRole.entities.Referral.filter({
      referred_email: user.email,
    });

    if (existingReferrals.length > 0) {
      return Response.json({ message: 'Referral already tracked', existing: true });
    }

    // Find the referrer by their referral code
    const allUsers = await base44.asServiceRole.entities.User.list();
    const referrer = allUsers.find(u => {
      const code = u.referral_code || `CHIB-${u.id.slice(-6).toUpperCase()}`;
      return code === referralCode;
    });

    if (!referrer) {
      return Response.json({ error: 'Invalid referral code' }, { status: 404 });
    }

    // ── Self-referral guard ──────────────────────────────────────────────────
    if (referrer.id === user.id) {
      console.warn(`⚠️ Self-referral attempt blocked: user ${user.email} tried to use their own code`);
      return Response.json({ error: 'You cannot refer yourself.' }, { status: 400 });
    }

    // ── Existing student guard (commission applies to NEW students only) ─────
    // Check if this user had any prior payments/subscriptions before this referral
    const priorPayments = await base44.asServiceRole.entities.Payment.filter({
      student_id: user.id,
    });
    if (priorPayments.length > 0) {
      console.warn(`⚠️ Referral blocked: ${user.email} is an existing paying student`);
      return Response.json({ message: 'Referral only applies to new students', existing_student: true });
    }

    // Create referral record — reward_amount set to 0 until first payment confirmed
    await base44.asServiceRole.entities.Referral.create({
      referrer_id: referrer.id,
      referrer_name: referrer.full_name,
      referred_email: user.email,
      referred_user_id: user.id,
      referred_name: user.full_name,
      referral_code: referralCode,
      status: 'registered',
      reward_amount: 0,
      reward_status: 'pending',
      notes: 'Commission applies on first payment only',
    });

    console.log(`✅ Referral tracked: ${user.email} referred by ${referrer.full_name} (${referralCode})`);

    return Response.json({ 
      success: true, 
      message: 'Referral tracked successfully',
      referrer: {
        id: referrer.id,
        name: referrer.full_name,
      }
    });

  } catch (error) {
    console.error('Track referral error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
