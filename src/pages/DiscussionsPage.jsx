import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { MessageSquare, ThumbsUp, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

export default function DiscussionsPage() {
  const { user } = useOutletContext();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newContent, setNewContent] = useState('');

  const { data: discussions = [] } = useQuery({
    queryKey: ['allDiscussions'],
    queryFn: () => base44.entities.Discussion.filter({ status: 'active' }, '-created_date', 50),
  });

  const createDiscussionMutation = useMutation({
    mutationFn: (content) =>
      base44.entities.Discussion.create({
        content,
        author_id: user.id,
        author_name: user.full_name,
        author_role: user.role,
        status: 'active',
        likes: 0,
        is_pinned: false,
        is_answer: false,
        parent_id: null,
        lesson_id: null,
        subject_id: null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allDiscussions'] });
      setDialogOpen(false);
      setNewContent('');
      toast.success('Discussion started!');
    },
    onError: (error) => {
      toast.error('Failed to start discussion');
      console.error(error);
    },
  });

  const handleStartDiscussion = () => {
    if (!newContent.trim()) {
      toast.error('Please enter some content');
      return;
    }
    createDiscussionMutation.mutate(newContent);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Discussions</h1>
          <p className="text-sm text-muted-foreground mt-1">Community questions and answers</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Start Discussion
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Start a New Discussion</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Textarea
                  placeholder="What would you like to discuss with the community?"
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  rows={5}
                  className="resize-none"
                />
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleStartDiscussion}
                  disabled={!newContent.trim() || createDiscussionMutation.isPending}
                >
                  {createDiscussionMutation.isPending ? 'Posting...' : 'Post Discussion'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
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
            <p className="text-xs text-muted-foreground mt-1">Be the first to start a discussion!</p>
          </div>
        )}
      </div>
    </div>
  );
}