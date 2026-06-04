import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { MessageSquare, ThumbsUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

export default function DiscussionsPage() {
  const { user } = useOutletContext();

  const { data: discussions = [] } = useQuery({
    queryKey: ['allDiscussions'],
    queryFn: () => base44.entities.Discussion.filter({ status: 'active' }, '-created_date', 50),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">Discussions</h1>
        <p className="text-sm text-muted-foreground mt-1">Community questions and answers</p>
      </div>

      <div className="space-y-3">
        {discussions.map(d => (
          <div key={d.id} className="bg-card rounded-xl border border-border p-5">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                {d.author_name?.[0] || '?'}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{d.author_name}</span>
                  {d.author_role === 'teacher' && (
                    <Badge className="text-[9px] bg-accent/10 text-accent">Teacher</Badge>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(d.created_date), 'MMM d, h:mm a')}
                  </span>
                </div>
                <p className="text-sm mt-1.5 leading-relaxed">{d.content}</p>
                <div className="flex items-center gap-3 mt-2">
                  <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors">
                    <ThumbsUp className="w-3 h-3" /> {d.likes || 0}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
        {discussions.length === 0 && (
          <div className="text-center py-16">
            <MessageSquare className="w-16 h-16 mx-auto text-muted-foreground/20 mb-4" />
            <p className="text-muted-foreground">No discussions yet</p>
            <p className="text-xs text-muted-foreground mt-1">Start a discussion on any lesson page</p>
          </div>
        )}
      </div>
    </div>
  );
}