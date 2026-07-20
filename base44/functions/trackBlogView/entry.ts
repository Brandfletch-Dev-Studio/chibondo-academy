import { createClient } from 'npm:@base44/sdk@0.8.31';

// trackBlogView — increments view_count on a BlogPost
// Called from BlogPostDetail.jsx when a reader opens a post
// Uses service role to bypass RLS (since readers can't update posts they don't own)
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  try {
    const { post_id } = await req.json();
    if (!post_id) return new Response(JSON.stringify({ error: 'post_id required' }), { status: 400, headers });

    const base44 = createClient({ appId: '6a2115bb078a7219b5cbd8b0' });

    // Fetch current post
    const posts = await base44.asServiceRole.entities.BlogPost.filter({ id: post_id });
    if (posts.length === 0) return new Response(JSON.stringify({ error: 'Post not found' }), { status: 404, headers });

    const post = posts[0];
    const newCount = (post.view_count || 0) + 1;

    await base44.asServiceRole.entities.BlogPost.update(post_id, { view_count: newCount });

    return new Response(JSON.stringify({ success: true, view_count: newCount }), { status: 200, headers });
  } catch (err: any) {
    console.error('trackBlogView error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
});
