import React from 'react';
import { useParams, Link, useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ArrowLeft, Tag, Clock, User, BookOpen } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import SEO from '@/components/SEO';

export default function BlogPostDetail() {
  const { slugOrId } = useParams();

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['blogPost', slugOrId],
    queryFn: async () => {
      // Try by slug first, fall back to id
      let res = await base44.entities.BlogPost.filter({ slug: slugOrId, status: 'published' });
      if (!res.length) res = await base44.entities.BlogPost.filter({ id: slugOrId, status: 'published' });
      return res;
    },
  });

  const post = posts[0];

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4 animate-pulse">
        <div className="h-6 bg-muted rounded w-1/3" />
        <div className="h-8 bg-muted rounded w-3/4" />
        <div className="aspect-video bg-muted rounded-2xl" />
        <div className="space-y-2">
          {[1,2,3,4,5].map(i => <div key={i} className="h-4 bg-muted rounded" />)}
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="text-center py-20">
        <BookOpen className="w-12 h-12 mx-auto text-muted-foreground/20 mb-4" />
        <h2 className="text-xl font-display font-bold mb-2">Article not found</h2>
        <p className="text-muted-foreground mb-4">This post may have been removed or unpublished.</p>
        <Link to="/blog"><Button variant="outline"><ArrowLeft className="w-4 h-4 mr-2" />Back to Blog</Button></Link>
      </div>
    );
  }

  const ago = post.published_at
    ? formatDistanceToNow(new Date(post.published_at), { addSuffix: true })
    : formatDistanceToNow(new Date(post.created_date), { addSuffix: true });

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <SEO title={`${post.title} — Chibondo Academy Blog`} />

      <Link to="/blog" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Blog
      </Link>

      {/* Tags */}
      {post.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {post.tags.map(tag => (
            <Badge key={tag} className="text-[10px] bg-accent/10 text-accent border-accent/20 capitalize">
              <Tag className="w-2.5 h-2.5 mr-1" />{tag}
            </Badge>
          ))}
        </div>
      )}

      {/* Title */}
      <h1 className="text-2xl sm:text-3xl font-display font-bold leading-snug">{post.title}</h1>

      {/* Meta */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground border-b border-border pb-4">
        <span className="flex items-center gap-1.5">
          <User className="w-4 h-4" /> {post.author_name || 'Chibondo Academy'}
        </span>
        <span className="flex items-center gap-1.5">
          <Clock className="w-4 h-4" /> {ago}
        </span>
      </div>

      {/* Cover image */}
      {post.cover_image && (
        <div className="rounded-2xl overflow-hidden border border-border">
          <img src={post.cover_image} alt={post.title} className="w-full object-cover max-h-96" />
        </div>
      )}

      {/* Content */}
      <div className="bg-card border border-border rounded-2xl p-6 lg:p-8">
        {post.content ? (
          <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: post.content }} />
        ) : (
          post.excerpt && <p className="text-muted-foreground leading-relaxed">{post.excerpt}</p>
        )}
      </div>

      {/* Footer CTA */}
      <div className="bg-gradient-to-r from-accent/10 to-primary/10 border border-accent/20 rounded-2xl p-6 text-center space-y-3">
        <h3 className="font-display font-bold">Continue Learning at Chibondo Academy</h3>
        <p className="text-sm text-muted-foreground">Access all lessons, quizzes, and resources with a school fees subscription.</p>
        <Link to="/subscription">
          <Button className="px-8">View School Fees Plans</Button>
        </Link>
      </div>
    </div>
  );
}
