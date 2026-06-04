import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { planKey, value } = await req.json();

    // Fetch existing settings or create new
    const existing = await base44.entities.PlatformSettings.filter({ key: planKey });
    
    if (existing.length > 0) {
      await base44.entities.PlatformSettings.update(existing[0].id, {
        value,
        updated_by: user.id,
      });
    } else {
      await base44.entities.PlatformSettings.create({
        key: planKey,
        value,
        updated_by: user.id,
      });
    }

    return Response.json({ success: true, message: 'Settings saved' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});