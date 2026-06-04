import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Send, ThumbsUp } from 'lucide-react';
import { format } from 'date-fns';

export default function LessonDiscussion({ lessonId, user, subjectId }) {
  const [newMessage, setNewMessage] = useState('');
  const queryClient = useQueryClient();

  const { data: discussions = [] } = useQuery({
    queryKey: ['discussions', lessonId],
    queryFn: () => base44.entities.Discussion.filter({ lesson_id: lessonId, status: 'active' }, '-created_date', 50),
  });

  const postMutation = useMutation({
    mutationFn: (content) => base44.entities.Discussion.create({
      lesson_id: lessonId,
      subject_id: subjectId,
      author_id: user.id,
      author_name: user.full_name,
      author_role: user.role || 'student',
      content,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discussions', lessonId] });
      setNewMessage('');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    postMutation.mutate(newMessage.trim());
  };

  return (
    <div className="bg-card rounded-xl border border-border p-6">
      <h3 className="font-display font-semibold mb-4">Discussion</h3>
      
      <form onSubmit={handleSubmit} className="mb-6">
        <Textarea 
          placeholder="Ask a question or share your thoughts..." 
          value={newMessage}
          onChange={e => setNewMessage(e.target.value)}
          className="mb-2 min-h-[80px]"
        />
        <Button type="submit" size="sm" disabled={!newMessage.trim()}>
          <Send className="w-3.5 h-3.5 mr-1.5" /> Post
        </Button>
      </form>

      <div className="space-y-4">
        {discussions.length === 0 ? (
          <div className="text-center py-8">
            <MessageSquare className="w-10 h-10 mx-auto text-muted-foreground/20 mb-2" />
            <p className="text-sm text-muted-foreground">No discussions yet. Be the first to ask!</p>
          </div>
        ) : (
          discussions.map(d => (
            <div key={d.id} className="p-4 rounded-lg bg-muted/30 border border-border/50">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                  {d.author_name?.[0] || '?'}
                </div>
                <div>
                  <span className="text-sm font-medium">{d.author_name}</span>
                  {d.author_role === 'teacher' && (
                    <Badge className="ml-2 text-[9px] bg-accent/10 text-accent">Teacher</Badge>
                  )}
                </div>
                <span className="text-xs text-muted-foreground ml-auto">
                  {format(new Date(d.created_date), 'MMM d, h:mm a')}
                </span>
              </div>
              <p className="text-sm leading-relaxed">{d.content}</p>
              <div className="flex items-center gap-3 mt-2">
                <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors">
                  <ThumbsUp className="w-3 h-3" /> {d.likes || 0}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}