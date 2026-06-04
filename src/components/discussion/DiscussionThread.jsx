import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { MessageSquare, ThumbsUp, Flag, MoreVertical, Pin, CheckCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function DiscussionThread({ lessonId, subjectId, currentUserId, currentUserRole }) {
  const queryClient = useQueryClient();
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyContent, setReplyContent] = useState('');

  const { data: discussions = [], isLoading } = useQuery({
    queryKey: ['discussions', lessonId],
    queryFn: async () => {
      const all = await base44.entities.Discussion.filter({ lesson_id: lessonId, status: 'active' }, '-created_date', 100);
      // Sort: pinned first, then by date
      return all.sort((a, b) => (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0));
    },
    enabled: !!lessonId,
  });

  const createDiscussion = useMutation({
    mutationFn: async (data) => {
      return base44.entities.Discussion.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discussions', lessonId] });
      setNewComment('');
    },
  });

  const updateDiscussion = useMutation({
    mutationFn: async ({ id, data }) => {
      return base44.entities.Discussion.update(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discussions', lessonId] });
    },
  });

  const handleSubmit = () => {
    if (!newComment.trim()) return;
    createDiscussion.mutate({
      lesson_id: lessonId,
      subject_id: subjectId,
      author_id: currentUserId,
      author_name: currentUserId, // Will be populated from user context
      author_role: currentUserRole,
      content: newComment.trim(),
      parent_id: null,
    });
  };

  const handleReply = (parentId) => {
    if (!replyContent.trim()) return;
    createDiscussion.mutate({
      lesson_id: lessonId,
      subject_id: subjectId,
      author_id: currentUserId,
      author_name: currentUserId,
      author_role: currentUserRole,
      content: replyContent.trim(),
      parent_id: parentId,
    });
    setReplyingTo(null);
    setReplyContent('');
  };

  const handleLike = (discussion) => {
    updateDiscussion.mutate({
      id: discussion.id,
      data: { likes: (discussion.likes || 0) + 1 },
    });
  };

  const handlePin = (discussion) => {
    if (currentUserRole !== 'teacher' && currentUserRole !== 'admin') return;
    updateDiscussion.mutate({
      id: discussion.id,
      data: { is_pinned: !discussion.is_pinned },
    });
  };

  const handleMarkAnswer = (discussion) => {
    if (currentUserRole !== 'teacher' && currentUserRole !== 'admin') return;
    // Unmark others first
    discussions.forEach(d => {
      if (d.is_answer) {
        updateDiscussion.mutate({ id: d.id, data: { is_answer: false } });
      }
    });
    updateDiscussion.mutate({
      id: discussion.id,
      data: { is_answer: true },
    });
  };

  const rootDiscussions = discussions.filter(d => !d.parent_id);
  const getReplies = (parentId) => discussions.filter(d => d.parent_id === parentId);

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Loading discussions...</div>;

  return (
    <div className="space-y-4">
      {/* New Discussion */}
      <Card>
        <CardContent className="pt-4 space-y-3">
          <Textarea
            placeholder="Ask a question or share your thoughts..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            className="min-h-[100px]"
          />
          <div className="flex justify-end">
            <Button onClick={handleSubmit} disabled={!newComment.trim() || createDiscussion.isPending}>
              <MessageSquare className="w-4 h-4 mr-2" />
              Post Discussion
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Discussions List */}
      <div className="space-y-4">
        {rootDiscussions.map((discussion) => (
          <DiscussionItem
            key={discussion.id}
            discussion={discussion}
            replies={getReplies(discussion.id)}
            currentUserId={currentUserId}
            currentUserRole={currentUserRole}
            onReply={handleReply}
            onLike={handleLike}
            onPin={handlePin}
            onMarkAnswer={handleMarkAnswer}
            replyingTo={replyingTo}
            setReplyingTo={setReplyingTo}
            replyContent={replyContent}
            setReplyContent={setReplyContent}
          />
        ))}
        {rootDiscussions.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No discussions yet. Be the first to ask a question!</p>
          </div>
        )}
      </div>
    </div>
  );
}

function DiscussionItem({ discussion, replies, currentUserId, currentUserRole, onReply, onLike, onPin, onMarkAnswer, replyingTo, setReplyingTo, replyContent, setReplyContent }) {
  const isAuthor = discussion.author_id === currentUserId;
  const isTeacher = discussion.author_role === 'teacher' || discussion.author_role === 'admin';

  return (
    <div className={`space-y-3 ${discussion.is_pinned ? 'ring-2 ring-primary/20 rounded-lg' : ''}`}>
      <Card className={discussion.is_answer ? 'border-success/50 bg-success/5' : ''}>
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <Avatar className="w-8 h-8">
              <AvatarFallback className="text-xs font-bold" style={{ background: isTeacher ? 'hsl(222 47% 18%)' : 'hsl(43 74% 52%)', color: isTeacher ? '#fff' : '#1e293b' }}>
                {discussion.author_name?.[0]?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm">{discussion.author_name}</span>
                  {isTeacher && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: 'hsl(222 47% 18%)', color: 'white' }}>
                      Teacher
                    </span>
                  )}
                  {discussion.is_answer && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1" style={{ background: 'hsl(160 60% 40%)', color: 'white' }}>
                      <CheckCircle className="w-3 h-3" /> Answer
                    </span>
                  )}
                  {discussion.is_pinned && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1" style={{ background: 'hsl(43 74% 52%)', color: '#1e293b' }}>
                      <Pin className="w-3 h-3" /> Pinned
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(discussion.created_date), { addSuffix: true })}
                  </span>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    {(currentUserRole === 'teacher' || currentUserRole === 'admin') && (
                      <>
                        <DropdownMenuItem onClick={() => onPin(discussion)}>
                          <Pin className="w-4 h-4 mr-2" />
                          {discussion.is_pinned ? 'Unpin' : 'Pin'}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onMarkAnswer(discussion)}>
                          <CheckCircle className="w-4 h-4 mr-2" />
                          {discussion.is_answer ? 'Unmark' : 'Mark as Answer'}
                        </DropdownMenuItem>
                      </>
                    )}
                    {isAuthor && (
                      <DropdownMenuItem>
                        <Flag className="w-4 h-4 mr-2" />
                        Report
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <p className="text-sm text-foreground">{discussion.content}</p>
              <div className="flex items-center gap-4 pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => onLike(discussion)}
                >
                  <ThumbsUp className="w-3 h-3 mr-1" />
                  {discussion.likes || 0}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => setReplyingTo(replyingTo === discussion.id ? null : discussion.id)}
                >
                  <MessageSquare className="w-3 h-3 mr-1" />
                  Reply
                </Button>
              </div>

              {/* Reply Input */}
              {replyingTo === discussion.id && (
                <div className="mt-3 space-y-2">
                  <Textarea
                    placeholder="Write your reply..."
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    className="min-h-[60px]"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => onReply(discussion.id)}
                      disabled={!replyContent.trim()}
                    >
                      Post Reply
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setReplyingTo(null);
                        setReplyContent('');
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Nested Replies */}
      {replies.length > 0 && (
        <div className="space-y-3 pl-8 border-l-2 border-muted">
          {replies.map((reply) => (
            <DiscussionItem
              key={reply.id}
              discussion={reply}
              replies={[]}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
              onReply={onReply}
              onLike={onLike}
              onPin={onPin}
              onMarkAnswer={onMarkAnswer}
              replyingTo={replyingTo}
              setReplyingTo={setReplyingTo}
              replyContent={replyContent}
              setReplyContent={setReplyContent}
            />
          ))}
        </div>
      )}
    </div>
  );
}