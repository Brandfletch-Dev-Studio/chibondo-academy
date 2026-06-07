import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Tag, Clock, Search, User } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import SEO from '@/components/SEO';

function PostCard({ post, onClick }) {
  const ago = post.published_at
    ? formatDistanceToNow(new Date(post.published_at), { addSuffix: true })
    : formatDistanceToNow(new Date(post.created_date), { addSuffix: true });

  return (
    <div
      onClick={onClick}
      className="bg-card border border-border rounded-2xl overflow-hidden cursor-pointer hover:border-accent/40 hover:shadow-lg transition-all duration-200 group"
    >
      {post.cover_image && (
        <div className="aspect-video overflow-hidden">
          <img
            src={post.cover_image}
            alt={post.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>
      )}
      <div className="p-5">
        {post.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {post.tags.slice(0, 3).map(tag => (
              <Badge key={tag} className="text-[10px] bg-accent/10 text-accent border-accent/20 capitalize">
                <Tag className="w-2.5 h-2.5 mr-1" />{tag}
              </Badge>
            ))}
          </div>
        )}
        <h2 className="font-display font-bold text-base leading-snug mb-2 group-hover:text-accent transition-colors line-clamp-2">
          {post.title}
        </h2>
        {post.excerpt && (
          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2 mb-4">
            {post.excerpt}
          </p>
        )}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <User className="w-3 h-3" /> {post.author_name || 'Chibondo Academy'}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" /> {ago}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function BlogPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [activeTag, setActiveTag] = useState('');

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['blogPosts'],
    queryFn: () => base44.entities.BlogPost.filter({ status: 'published' }, '-published_at', 50),
  });

  const allTags = [...new Set(posts.flatMap(p => p.tags || []))].slice(0, 12);

  const filtered = posts.filter(p => {
    const matchSearch = !search ||
      p.title?.toLowerCase().includes(search.toLowerCase()) ||
      p.excerpt?.toLowerCase().includes(search.toLowerCase()) ||
      p.author_name?.toLowerCase().includes(search.toLowerCase());
    const matchTag = !activeTag || (p.tags || []).includes(activeTag);
    return matchSearch && matchTag;
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <SEO title="Blog — Chibondo Academy" />
      <div>
        <h1 className="text-2xl font-display font-bold flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-accent" /> Blog
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Insights, study tips, and updates from the Chibondo Academy team
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search articles…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Tag filters */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTag('')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              !activeTag
                ? 'bg-accent text-accent-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            All
          </button>
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => setActiveTag(activeTag === tag ? '' : tag)}
              className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition-colors ${
                activeTag === tag
                  ? 'bg-accent text-accent-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Posts grid */}
      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1,2,3].map(i => (
            <div key={i} className="bg-card border border-border rounded-2xl overflow-hidden animate-pulse">
              <div className="aspect-video bg-muted" />
              <div className="p-5 space-y-3">
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-3 bg-muted rounded w-full" />
                <div className="h-3 bg-muted rounded w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <BookOpen className="w-12 h-12 mx-auto text-muted-foreground/20 mb-3" />
          <p className="text-muted-foreground">
            {search || activeTag ? 'No articles match your search.' : 'No articles published yet. Check back soon!'}
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map(post => (
            <PostCard
              key={post.id}
              post={post}
              onClick={() => navigate(`/blog/${post.slug || post.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
