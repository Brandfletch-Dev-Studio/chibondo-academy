/**
 * notifyNewBlogPost
 * Triggered by entity automation on BlogPost (update to published).
 * Emails all users who have an active subscription.
 *
 * Automation payload: { event, data, old_data }
 */
import { createClient } from 'npm:@base44/sdk@0.8.31';

async function sendBrandedEmail(base44: any, to: string, type: string, variables: Record<string, any>) {
  try {
    const built = await base44.asServiceRole.functions.invoke('buildBrandedEmail', { type, variables });
    if (!built || built.error) throw new Error(built?.error || 'buildBrandedEmail failed');
    await base44.asServiceRole.integrations.Core.SendEmail({ to, subject: built.subject, body: built.html });
  } catch (err: any) {
    console.error(`Email to ${to} failed:`, err.message);
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClient({ appId: '6a2115bb078a7219b5cbd8b0' });
    const body = await req.json();

    const post    = body.data;
    const oldPost = body.old_data;
    const eventType = body.event?.type;

    // Only notify when post is published
    if (post?.status !== 'published') {
      console.log(`Skipping — post status is "${post?.status}"`);
      return Response.json({ skipped: true });
    }

    // Only notify on create, or when it just transitioned draft → published
    const justPublished = eventType === 'update' && oldPost?.status !== 'published' && post.status === 'published';
    const isNew = eventType === 'create' && post.status === 'published';

    if (!isNew && !justPublished) {
      console.log('Post was already published and no trigger condition met — skipping');
      return Response.json({ skipped: true });
    }

    // Get all active subscriptions to find active student IDs
    const activeSubs = await base44.asServiceRole.entities.Subscription.filter({ status: 'active' });
    if (activeSubs.length === 0) {
      console.log('No active subscribers');
      return Response.json({ sent: 0 });
    }

    const studentIds = [...new Set(activeSubs.map((s: any) => s.student_id))];
    console.log(`Notifying ${studentIds.length} active subscribers about: ${post.title}`);

    const postUrl = post.slug
      ? `https://www.chibondoacademy.com/blog/${post.slug}`
      : `https://www.chibondoacademy.com/blog`;

    let sent = 0;

    for (const studentId of studentIds) {
      try {
        const users = await base44.asServiceRole.entities.User.filter({ id: studentId });
        const user = users[0];
        if (!user?.email) continue;

        // In-app notification
        await base44.asServiceRole.entities.Notification.create({
          user_id: studentId,
          title: `📖 New article: ${post.title}`,
          message: post.excerpt ? post.excerpt.slice(0, 120) : `A new article has been published on ${post.category || 'the blog'}.`,
          type: 'blog',
          link: `/blog/${post.slug || ''}`,
          is_read: false,
        });

        await sendBrandedEmail(base44, user.email, 'new_blog_post', {
          student_name: user.full_name || user.email.split('@')[0],
          post_title:   post.title,
          post_slug:    post.slug || '',
          post_url:     postUrl,
          excerpt:      post.excerpt || '',
          author_name:  post.author_name || '',
          category:     post.category || '',
          cover_image:  post.cover_image || post.og_image || '',
        });

        sent++;
      } catch (e: any) {
        console.error(`Failed for student ${studentId}:`, e.message);
      }
    }

    console.log(`✅ notifyNewBlogPost: sent ${sent}/${studentIds.length} emails for "${post.title}"`);
    return Response.json({ sent, total: studentIds.length });

  } catch (err: any) {
    console.error('notifyNewBlogPost error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
});
