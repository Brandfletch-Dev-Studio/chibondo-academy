import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { MessageSquare, ThumbsUp, Flag, MoreVertical, Pin, CheckCircle, BookOpen } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Link } from 'react-router-dom';

/* ── Lesson origin quote banner ─────────────────────────────────────────────── */
function LessonQuote({ lessonTitle, lessonUrl }) {
  if (!lessonTitle && !lessonUrl) return null;
  const title = lessonTitle || 'View Lesson';
  const url   = lessonUrl || (lessonUrl ? `/lesson/${lessonUrl}` : null);
  return (
    <div className="flex items-center gap-2 px-3 py-2 mb-2 rounded-xl border-l-4 text-xs"
      style={{ borderColor: 'hsl(43 74% 52%)', background: 'hsl(43 74% 52% / 0.08)' }}>
      <BookOpen className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'hsl(43 74% 52%)' }} />
      <span className="text-muted-foreground">From lesson:</span>
      {url ? (
        <Link to={url} className="font-semibold hover:underline truncate" style={{ color: 'hsl(43 74% 45%)' }}>
          {title}
        </Link>
      ) : (
        <span className="font-semibold truncate">{title}</span>
      )}
    </div>
  );
}

export default function DiscussionThread({ lessonId, lessonTitle, lessonUrl, subjectId, currentUserId, currentUserName, currentUserAvatar, currentUserRole }) {
  const queryClient = useQueryClient();
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyContent, setReplyContent] = useState('');
  const isGuest = !currentUserId;

  const { data: discussions = [], isLoading } = useQuery({
    queryKey: ['discussions', lessonId],
    queryFn: async () => {
      const all = await base44.entities.Discussion.filter({ lesson_id: lessonId, status: 'active' }, '-created_date', 100);
      return all.sort((a, b) => (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0));
    },
    enabled: !!lessonId,
  });

  const createDiscussion = useMutation({
    mutationFn: async (data) => base44.entities.Discussion.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discussions', lessonId] });
      setNewComment('');
    },
  });

  const updateDiscussion = useMutation({
    mutationFn: async ({ id, data }) => base44.entities.Discussion.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['discussions', lessonId] }),
  });

  const handleSubmit = () => {
    if (!newComment.trim()) return;
    if (isGuest) { window.location.href = '/register'; return; }
    createDiscussion.mutate({
      lesson_id:    lessonId,
      lesson_title: lessonTitle || null,
      lesson_url:   lessonUrl   || null,
      subject_id:   subjectId,
      author_id:    currentUserId,
      author_name:  currentUserName || currentUserId,
      author_avatar: currentUserAvatar || null,
      author_role:  currentUserRole,
      content:      newComment.trim(),
      parent_id:    null,
      status:       'active',
    });
  };

  const handleReply = (parentId) => {
    if (!replyContent.trim()) return;
    if (isGuest) { window.location.href = '/register'; return; }
    createDiscussion.mutate({
      lesson_id:    lessonId,
      lesson_title: lessonTitle || null,
      lesson_url:   lessonUrl   || null,
      subject_id:   subjectId,
      author_id:    currentUserId,
      author_name:  currentUserName || currentUserId,
      author_avatar: currentUserAvatar || null,
      author_role:  currentUserRole,
      content:      replyContent.trim(),
      parent_id:    parentId,
      status:       'active',
    });
    setReplyingTo(null);
    setReplyContent('');
  };

  const handleLike    = (d) => updateDiscussion.mutate({ id: d.id, data: { likes: (d.likes || 0) + 1 } });
  const handlePin     = (d) => { if (currentUserRole !== 'teacher' && currentUserRole !== 'admin') return; updateDiscussion.mutate({ id: d.id, data: { is_pinned: !d.is_pinned } }); };
  const handleMarkAnswer = (d) => {
    if (currentUserRole !== 'teacher' && currentUserRole !== 'admin') return;
    discussions.forEach(x => { if (x.is_answer) updateDiscussion.mutate({ id: x.id, data: { is_answer: false } }); });
    updateDiscussion.mutate({ id: d.id, data: { is_answer: true } });
  };

  const rootDiscussions = discussions.filter(d => !d.parent_id);
  const getReplies = (parentId) => discussions.filter(d => d.parent_id === parentId);

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Loading discussions...</div>;

  return (
    <div className="space-y-4">
      {/* New comment box */}
      <Card>
        <CardContent className="pt-4 space-y-3">
          {/* Show lesson context above the textarea so users know where they're commenting */}
          <LessonQuote lessonTitle={lessonTitle} lessonUrl={lessonUrl} />
          <Textarea
            placeholder={isGuest ? "Sign in to ask a question or share your thoughts…" : "Ask a question or share your thoughts..."}
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            className="min-h-[100px]"
          />
          {isGuest ? (
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-xs text-muted-foreground">You need an account to post in discussions.</p>
              <div className="flex gap-2">
                <a href="/login"><Button variant="outline" size="sm">Login</Button></a>
                <a href="/register"><Button size="sm" style={{ background: 'hsl(43 74% 52%)', color: 'hsl(222 47% 11%)' }}>Join Now</Button></a>
              </div>
            </div>
          ) : (
            <div className="flex justify-end">
              <Button onClick={handleSubmit} disabled={!newComment.trim() || createDiscussion.isPending}>
                <MessageSquare className="w-4 h-4 mr-2" />
                Post Discussion
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Discussion list */}
      <div className="space-y-4">
        {rootDiscussions.map(discussion => (
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
  const isAuthor  = discussion.author_id === currentUserId;
  const isTeacher = discussion.author_role === 'teacher' || discussion.author_role === 'admin';

  return (
    <div className={`space-y-3 ${discussion.is_pinned ? 'ring-2 ring-primary/20 rounded-lg' : ''}`}>
      <Card className={discussion.is_answer ? 'border-success/50 bg-success/5' : ''}>
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <Avatar className="w-8 h-8">
              {discussion.author_avatar ? (
                <img src={discussion.author_avatar} alt={discussion.author_name} className="w-full h-full object-cover rounded-full" />
              ) : (
                <AvatarFallback className="text-xs font-bold"
                  style={{ background: isTeacher ? 'hsl(222 47% 18%)' : 'hsl(43 74% 52%)', color: isTeacher ? '#fff' : '#1e293b' }}>
                  {discussion.author_name?.[0]?.toUpperCase() || 'U'}
                </AvatarFallback>
              )}
            </Avatar>
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm">{discussion.author_name}</span>
                  {isTeacher && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: 'hsl(43 74% 52% / 0.15)', color: 'hsl(43 60% 36%)', border: '1px solid hsl(43 74% 52% / 0.3)' }}>
                      Teacher
                    </span>
                  )}
                  {discussion.is_answer && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1" style={{ background: 'hsl(160 60% 40%)', color: 'white' }}>
                      <CheckCircle className="w-3 h-3" /> Answer
                    </span>
                  )}
                  {discussion.is_pinned && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1" style={{ background: 'hsl(43 74% 52%)', color: 'hsl(222 47% 11%)' }}>
                      <Pin className="w-3 h-3" /> Pinned
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(discussion.created_date), { addSuffix: true })}
                  </span>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="w-4 h-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    {(currentUserRole === 'teacher' || currentUserRole === 'admin') && (
                      <>
                        <DropdownMenuItem onClick={() => onPin(discussion)}>
                          <Pin className="w-4 h-4 mr-2" />{discussion.is_pinned ? 'Unpin' : 'Pin'}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onMarkAnswer(discussion)}>
                          <CheckCircle className="w-4 h-4 mr-2" />{discussion.is_answer ? 'Unmark' : 'Mark as Answer'}
                        </DropdownMenuItem>
                      </>
                    )}
                    {isAuthor && (
                      <DropdownMenuItem><Flag className="w-4 h-4 mr-2" />Report</DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Lesson quote — shown in lesson view too for context on replies */}
              {discussion.lesson_title && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border-l-4 text-xs"
                  style={{ borderColor: 'hsl(43 74% 52%)', background: 'hsl(43 74% 52% / 0.08)' }}>
                  <BookOpen className="w-3 h-3 flex-shrink-0" style={{ color: 'hsl(43 74% 52%)' }} />
                  <span className="text-muted-foreground">From lesson:</span>
                  {discussion.lesson_url ? (
                    <a href={discussion.lesson_url} className="font-semibold hover:underline truncate" style={{ color: 'hsl(43 74% 45%)' }}>
                      {discussion.lesson_title}
                    </a>
                  ) : (
                    <span className="font-semibold">{discussion.lesson_title}</span>
                  )}
                </div>
              )}

              <p className="text-sm whitespace-pre-line">{discussion.content}</p>

              <div className="flex items-center gap-3 pt-1">
                <Button variant="ghost" size="sm" onClick={() => onLike(discussion)} className="h-7 px-2 text-xs gap-1.5 text-muted-foreground hover:text-foreground">
                  <ThumbsUp className="w-3.5 h-3.5" />{discussion.likes || 0}
                </Button>
                {!isGuest && (
                  <Button variant="ghost" size="sm" onClick={() => setReplyingTo(replyingTo === discussion.id ? null : discussion.id)} className="h-7 px-2 text-xs gap-1.5 text-muted-foreground hover:text-foreground">
                    <MessageSquare className="w-3.5 h-3.5" />Reply
                  </Button>
                )}
              </div>

              {replyingTo === discussion.id && (
                <div className="space-y-2 pl-2 border-l-2 border-border">
                  <Textarea
                    placeholder="Write a reply..."
                    value={replyContent}
                    onChange={e => setReplyContent(e.target.value)}
                    className="min-h-[80px] text-sm"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => onReply(discussion.id)} disabled={!replyContent.trim() || createDiscussion?.isPending}>
                      Post Reply
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setReplyingTo(null)}>Cancel</Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Nested replies */}
      {replies.length > 0 && (
        <div className="ml-8 space-y-3">
          {replies.map(reply => (
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
