import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { MessageSquare, ThumbsUp, Plus, Send, Reply, MoreVertical } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

export default function DiscussionsPage() {
  const { user } = useOutletContext();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [replyTo, setReplyTo] = useState(null);

  const { data: discussions = [] } = useQuery({
    queryKey: ['allDiscussions'],
    queryFn: () => base44.entities.Discussion.filter({ status: 'active', parent_id: null }, '-created_date', 50),
  });

  const { data: replies = [] } = useQuery({
    queryKey: ['allReplies'],
    queryFn: () => base44.entities.Discussion.filter({ status: 'active' }, '-created_date', 200),
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      return base44.entities.Discussion.create({
        content: data.content,
        author_id: user.id,
        author_name: user.full_name,
        author_role: user.role,
        status: 'active',
        likes: 0,
        is_pinned: false,
        is_answer: false,
        parent_id: data.parent_id || null,
        lesson_id: null,
        subject_id: null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allDiscussions'] });
      queryClient.invalidateQueries({ queryKey: ['allReplies'] });
      setDialogOpen(false);
      setReplyTo(null);
      setNewContent('');
      toast.success(replyTo ? 'Reply posted!' : 'Discussion started!');
    },
  });

  const likeMutation = useMutation({
    mutationFn: async (discussionId) => {
      const disc = discussions.find(d => d.id === discussionId) || replies.find(r => r.id === discussionId);
      return base44.entities.Discussion.update(discussionId, { likes: (disc?.likes || 0) + 1 });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allDiscussions'] });
      queryClient.invalidateQueries({ queryKey: ['allReplies'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => base44.entities.Discussion.update(id, { status: 'deleted' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allDiscussions'] });
      queryClient.invalidateQueries({ queryKey: ['allReplies'] });
      toast.success('Discussion deleted');
    },
  });

  const handleSubmit = () => {
    if (!newContent.trim()) {
      toast.error('Please enter some content');
      return;
    }
    createMutation.mutate({ content: newContent, parent_id: replyTo?.id });
  };

  const handleStartDiscussion = () => {
    setReplyTo(null);
    setDialogOpen(true);
  };

  const handleReply = (discussion) => {
    setReplyTo(discussion);
    setDialogOpen(true);
  };

  const getReplies = (parentId) => replies.filter(r => r.parent_id === parentId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Discussions</h1>
          <p className="text-sm text-muted-foreground mt-1">Community questions and answers</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setReplyTo(null); setNewContent(''); } }}>
          <DialogTrigger asChild>
            <Button onClick={handleStartDiscussion}>
              <Plus className="w-4 h-4 mr-2" />
              Start Discussion
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{replyTo ? 'Reply to Discussion' : 'Start a New Discussion'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              {replyTo && (
                <div className="bg-muted/50 rounded-xl p-3 text-sm">
                  <p className="text-xs text-muted-foreground mb-1">Replying to</p>
                  <p className="text-sm">{replyTo.content.slice(0, 150)}{replyTo.content.length > 150 ? '...' : ''}</p>
                </div>
              )}
              <div>
                <Textarea placeholder={replyTo ? "Write your reply..." : "What would you like to discuss with the community?"} value={newContent} onChange={(e) => setNewContent(e.target.value)} rows={5} className="resize-none" />
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleSubmit} disabled={!newContent.trim() || createMutation.isPending}>
                  {createMutation.isPending ? 'Posting...' : <><Send className="w-4 h-4 mr-2" />{replyTo ? 'Reply' : 'Post Discussion'}</>}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-4">
        {discussions.map(d => (
          <DiscussionThread key={d.id} discussion={d} onReply={handleReply} onLike={() => likeMutation.mutate(d.id)} onDelete={() => deleteMutation.mutate(d.id)} user={user} replies={getReplies(d.id)} />
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

function DiscussionThread({ discussion, onReply, onLike, onDelete, user, replies = [] }) {
  const [showReplies, setShowReplies] = useState(true);

  const roleBadges = {
    admin: { label: 'Admin', className: 'bg-destructive/10 text-destructive' },
    teacher: { label: 'Teacher', className: 'bg-accent/10 text-accent' },
    user: { label: 'Student', className: 'bg-muted text-muted-foreground' },
  };

  const badge = roleBadges[discussion.author_role] || roleBadges.user;

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      {/* Main Discussion */}
      <div className="p-5">
        <div className="flex items-start gap-3">
          <Avatar className="w-10 h-10">
            <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">{discussion.author_name?.[0] || '?'}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium">{discussion.author_name}</span>
              <Badge className={`text-[9px] ${badge.className}`}>{badge.label}</Badge>
              <span className="text-xs text-muted-foreground">{format(new Date(discussion.created_date), 'MMM d, h:mm a')}</span>
            </div>
            <p className="text-sm mt-2 leading-relaxed">{discussion.content}</p>
            <div className="flex items-center gap-3 mt-3">
              <button onClick={onLike} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors">
                <ThumbsUp className="w-3.5 h-3.5" /> {discussion.likes || 0}
              </button>
              <button onClick={() => { setShowReplies(!showReplies); onReply(discussion); }} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors">
                <Reply className="w-3.5 h-3.5" /> Reply
              </button>
              {replies.length > 0 && (
                <button onClick={() => setShowReplies(!showReplies)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors">
                  <MessageSquare className="w-3.5 h-3.5" /> {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
                </button>
              )}
              {(user.role === 'admin' || user.id === discussion.author_id) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="ml-auto text-muted-foreground hover:text-foreground">
                      <MoreVertical className="w-3.5 h-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={onDelete} className="text-destructive">Delete</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Replies */}
      {showReplies && replies.length > 0 && (
        <div className="border-t border-border bg-muted/30">
          {replies.map(reply => (
            <div key={reply.id} className="p-4 border-b border-border last:border-b-0">
              <div className="flex items-start gap-2.5">
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">{reply.author_name?.[0] || '?'}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{reply.author_name}</span>
                    {reply.author_role === 'teacher' && <Badge className="text-[9px] bg-accent/10 text-accent">Teacher</Badge>}
                    {reply.author_role === 'admin' && <Badge className="text-[9px] bg-destructive/10 text-destructive">Admin</Badge>}
                    <span className="text-xs text-muted-foreground">{format(new Date(reply.created_date), 'MMM d, h:mm a')}</span>
                  </div>
                  <p className="text-sm mt-1.5 leading-relaxed">{reply.content}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors">
                      <ThumbsUp className="w-3 h-3" /> {reply.likes || 0}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}