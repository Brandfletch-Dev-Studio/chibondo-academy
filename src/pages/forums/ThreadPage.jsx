import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import SEO from '@/components/SEO';
import {
  ArrowLeft, Send, Pin, CheckCircle, MoreVertical, Trash2,
  Heart, MessageSquare, Megaphone,
  X, CornerDownRight, Share2
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';


/* ── Mark parent forum read when thread opens ──────────────────────────── */
function markForumRead(subjectSlug) {
  if (subjectSlug) localStorage.setItem(`forum_last_visit_${subjectSlug}`, new Date().toISOString());
}

/* ── Live aging timestamp — ticks every 30s so "2 min ago" stays accurate ── */
function useLiveAgo(isoDate) {
  const [label, setLabel] = React.useState(() =>
    isoDate ? formatDistanceToNow(new Date(isoDate), { addSuffix: true }) : ''
  );
  React.useEffect(() => {
    if (!isoDate) return;
    const tick = () => setLabel(formatDistanceToNow(new Date(isoDate), { addSuffix: true }));
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [isoDate]);
  return label;
}

/* ═══════════════════════════════════════════════════════════
   AVATAR — shows photo if available, initials otherwise
═══════════════════════════════════════════════════════════ */
function Avi({ name = '?', role, avatarUrl, size = 8 }) {
  const [err, setErr] = useState(false);
  const styles = {
    admin:   { background: 'hsl(0 72% 51% / 0.18)',   color: 'hsl(0 72% 36%)' },
    teacher: { background: 'hsl(43 74% 52% / 0.2)',   color: 'hsl(38 60% 32%)' },
    student: { background: 'hsl(222 47% 55% / 0.18)', color: 'hsl(222 47% 30%)' },
    user:    { background: 'hsl(222 47% 55% / 0.18)', color: 'hsl(222 47% 30%)' },
  };
  const s = styles[role] || styles.user;
  const parts = (name || '?').trim().split(/\s+/);
  const initials = parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : (name[0] || '?').toUpperCase();
  const sizeClass = `w-${size} h-${size}`;

  if (avatarUrl && !err) {
    return (
      <img
        src={avatarUrl} alt={name} onError={() => setErr(true)}
        className={`${sizeClass} rounded-full object-cover flex-shrink-0 border-2 border-border`}
      />
    );
  }
  return (
    <div className={`${sizeClass} rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 select-none`} style={s}>
      {initials}
    </div>
  );
}

function RoleBadge({ role, isTutor }) {
  if (isTutor || role === 'teacher')
    return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full border"
      style={{ background:'hsl(43 74% 52% / 0.12)', color:'hsl(38 60% 32%)', borderColor:'hsl(43 74% 52% / 0.3)' }}>Teacher</span>;
  if (role === 'admin')
    return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-600 border border-red-200">Admin</span>;
  return null; // students don't need a badge — they're the majority
}

/* ═══════════════════════════════════════════════════════════
   LIKE BUTTON
═══════════════════════════════════════════════════════════ */
function LikeButton({ item, userId, onLike, small = false }) {
  const liked = (item.liked_by || []).includes(userId);
  const count = item.likes || 0;
  return (
    <button
      onClick={() => onLike(item)}
      className={`flex items-center gap-1 transition-colors rounded-full px-2 py-1 ${
        liked
          ? 'text-red-500'
          : 'text-muted-foreground/50 hover:text-red-400'
      }`}
    >
      <Heart className={`${small ? 'w-3 h-3' : 'w-3.5 h-3.5'} ${liked ? 'fill-current' : ''} transition-transform active:scale-125`} />
      {count > 0 && <span className={`${small ? 'text-[10px]' : 'text-xs'} font-medium tabular-nums`}>{count}</span>}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════
   REPLY BUBBLE (comment or nested reply)
═══════════════════════════════════════════════════════════ */
function ReplyBubble({
  reply, replies, isAuthor, isTeacherOrAdmin, user,
  onDelete, onAccept, onLike, onReplyTo
}) {
  const [menu, setMenu] = useState(false);
  const [showReplies, setShowReplies] = useState(true);
  const ago = useLiveAgo(reply.created_date);
  const canDelete = isAuthor || isTeacherOrAdmin;

  // Find nested replies to this comment
  const nested = (replies || []).filter(r => r.reply_to_id === reply.id);

  return (
    <div className="space-y-2">
      <div className={`flex gap-2.5 ${reply.is_accepted_answer ? 'relative pl-2' : ''}`}>
        {reply.is_accepted_answer && (
          <div className="absolute -left-1 top-0 bottom-0 w-0.5 rounded-full bg-green-500/60" />
        )}

        <Avi name={reply.author_name} role={reply.author_role} avatarUrl={reply.author_avatar} size={8} />

        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            <span className="font-semibold text-sm">{reply.author_name}</span>
            <RoleBadge role={reply.author_role} isTutor={reply.is_tutor_reply} />
            {reply.is_accepted_answer && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-600 border border-green-500/20">
                <CheckCircle className="w-2.5 h-2.5" /> Accepted
              </span>
            )}
            <span className="text-[10px] text-muted-foreground ml-auto">{ago}</span>
            {(canDelete || isTeacherOrAdmin) && (
              <div className="relative">
                <button onClick={() => setMenu(v => !v)} className="text-muted-foreground/40 hover:text-muted-foreground p-0.5">
                  <MoreVertical className="w-3.5 h-3.5" />
                </button>
                {menu && (
                  <div className="absolute right-0 top-5 z-20 bg-card border border-border rounded-xl shadow-lg min-w-[140px] py-1">
                    {isTeacherOrAdmin && !reply.is_accepted_answer && (
                      <button onClick={() => { onAccept(reply); setMenu(false); }}
                        className="w-full text-left px-3 py-2 hover:bg-muted text-green-600 flex items-center gap-2 text-xs">
                        <CheckCircle className="w-3.5 h-3.5" /> Mark Accepted
                      </button>
                    )}
                    {canDelete && (
                      <button onClick={() => { onDelete(reply.id); setMenu(false); }}
                        className="w-full text-left px-3 py-2 hover:bg-muted text-destructive flex items-center gap-2 text-xs">
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Quoted reply-to */}
          {reply.reply_to_name && (
            <div className="text-xs text-muted-foreground italic mb-1.5 flex items-center gap-1">
              <CornerDownRight className="w-3 h-3 flex-shrink-0" />
              replying to <span className="font-semibold not-italic">{reply.reply_to_name}</span>
            </div>
          )}

          {/* Bubble */}
          <div className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-line ${
            reply.is_tutor_reply
              ? 'border'
              : reply.reply_to_id
              ? 'bg-muted/30'
              : 'bg-muted/50'
          }`}
            style={reply.is_tutor_reply ? {
              background: 'hsl(43 74% 52% / 0.06)',
              borderColor: 'hsl(43 74% 52% / 0.2)',
            } : {}}
          >
            {reply.content && <p>{reply.content}</p>}


          </div>

          {/* Action row */}
          <div className="flex items-center gap-1 mt-1.5 -ml-1">
            <LikeButton item={reply} userId={user?.id} onLike={onLike} small />
            <button
              onClick={() => onReplyTo({ id: reply.id, name: reply.author_name })}
              className="flex items-center gap-1 text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors px-2 py-1 rounded-full"
            >
              <CornerDownRight className="w-3 h-3" /> Reply
            </button>
          </div>
        </div>
      </div>

      {/* Nested replies — indented */}
      {nested.length > 0 && (
        <div className="ml-10 space-y-2 border-l-2 border-border/50 pl-3">
          {nested.map(nr => (
            <ReplyBubble
              key={nr.id} reply={nr} replies={[]} // no further nesting beyond level 2
              isAuthor={nr.author_id === user?.id} isTeacherOrAdmin={isTeacherOrAdmin}
              user={user} onDelete={onDelete} onAccept={onAccept} onLike={onLike} onReplyTo={onReplyTo}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════ */
export default function ThreadPage() {
  const { subjectSlug, threadSlug } = useParams();

  // Mark parent forum as visited — resets unread count for this forum
  React.useEffect(() => { markForumRead(subjectSlug); }, [subjectSlug]);
  const navigate  = useNavigate();
  const { state } = useLocation();
  const { user } = useOutletContext() ?? {};
  const qc        = useQueryClient();
  const bottomRef = useRef();
  const [text, setText]   = useState('');
  const [replyTo, setReplyTo] = useState(null); // { id, name }

  const isTeacherOrAdmin = user?.role === 'teacher' || user?.role === 'admin';

  /* ── Thread ── */
  const threadId = state?.thread?.id || threadSlug;
  const { data: threadArr = [], isLoading: loadingThread } = useQuery({
    queryKey: ['thread', threadSlug],
    queryFn: () => base44.entities.Discussion.filter({ slug: threadSlug, status: 'active' }, 'created_date', 1),
    enabled: !state?.thread && !!threadSlug && threadSlug.length < 30,
    staleTime: 30_000,
  });
  const thread = state?.thread || threadArr[0];
  const resolvedThreadId = thread?.id || threadSlug;
  const subject = state?.subject;

  /* ── All replies (comments + nested replies) ── */
  const { data: allReplies = [], isLoading: loadingReplies } = useQuery({
    queryKey: ['replies', resolvedThreadId],
    queryFn: () => base44.entities.Discussion.filter(
      { parent_id: resolvedThreadId, status: 'active' }, 'created_date', 500
    ),
    enabled: !!resolvedThreadId,
    staleTime: 0,
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
  });

  // Top-level comments (no reply_to_id) — sorted: accepted first, tutor next, then chrono
  const comments = [...allReplies.filter(r => !r.reply_to_id)].sort((a, b) => {
    if (a.is_accepted_answer && !b.is_accepted_answer) return -1;
    if (!a.is_accepted_answer && b.is_accepted_answer) return 1;
    if (a.is_tutor_reply && !b.is_tutor_reply) return -1;
    if (!a.is_tutor_reply && b.is_tutor_reply) return 1;
    return new Date(a.created_date) - new Date(b.created_date);
  });

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [allReplies.length]);



  /* ── Post mutation ── */
  const postMut = useMutation({
    mutationFn: async () => {
      // Guest users should not reach here — redirect handled in UI
      if (!user) { window.location.href = '/register'; return; }
      if (!text.trim()) throw new Error('Write something first');

      return base44.entities.Discussion.create({
        content: text.trim(),
        parent_id: resolvedThreadId,
        reply_to_id: replyTo?.id || undefined,
        reply_to_name: replyTo?.name || undefined,
        subject_id: thread?.subject_id,
        subject_slug: subjectSlug,
        author_id: user.id,
        author_name: user.full_name || user.email,
        author_avatar: user.avatar_url || undefined,
        author_role: user.role || 'user',
        is_tutor_reply: isTeacherOrAdmin,
        status: 'active',
      });
    },
    onSuccess: async () => {
      setText(''); setReplyTo(null);
      if (thread?.id) {
        try { await base44.entities.Discussion.update(thread.id, { reply_count: (thread.reply_count || 0) + 1 }); } catch(_) {}
      }
      qc.invalidateQueries({ queryKey: ['replies', resolvedThreadId] });
      qc.invalidateQueries({ queryKey: ['forum-threads', thread?.subject_id] });
    },
    onError: e => toast.error(e.message),
  });

  /* ── Delete ── */
  const deleteMut = useMutation({
    mutationFn: id => base44.entities.Discussion.update(id, { status: 'deleted' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['replies', resolvedThreadId] }),
  });

  /* ── Accept answer ── */
  const acceptMut = useMutation({
    mutationFn: async (reply) => {
      const prev = allReplies.find(r => r.is_accepted_answer);
      if (prev) await base44.entities.Discussion.update(prev.id, { is_accepted_answer: false });
      await base44.entities.Discussion.update(reply.id, { is_accepted_answer: true });
      if (thread?.id) await base44.entities.Discussion.update(thread.id, { thread_status: 'resolved' });
    },
    onSuccess: () => { toast.success('Answer marked as accepted'); qc.invalidateQueries({ queryKey: ['replies', resolvedThreadId] }); },
  });

  /* ── Pin thread ── */
  const pinMut = useMutation({
    mutationFn: () => base44.entities.Discussion.update(thread.id, { is_pinned: !thread.is_pinned }),
    onSuccess: () => { toast.success(thread.is_pinned ? 'Unpinned' : 'Pinned'); qc.invalidateQueries({ queryKey: ['thread', threadSlug] }); },
  });

  /* ── Like (toggle) ── */
  const likeMut = useMutation({
    mutationFn: async (item) => {
      const likedBy = item.liked_by || [];
      const hasLiked = likedBy.includes(user.id);
      const newLikedBy = hasLiked ? likedBy.filter(id => id !== user.id) : [...likedBy, user.id];
      return base44.entities.Discussion.update(item.id, {
        liked_by: newLikedBy,
        likes: newLikedBy.length,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['replies', resolvedThreadId] }),
    onMutate: async (item) => {
      // Optimistic update
      await qc.cancelQueries({ queryKey: ['replies', resolvedThreadId] });
      const prev = qc.getQueryData(['replies', resolvedThreadId]);
      qc.setQueryData(['replies', resolvedThreadId], old =>
        (old || []).map(r => {
          if (r.id !== item.id) return r;
          const likedBy = r.liked_by || [];
          const hasLiked = likedBy.includes(user.id);
          const newLikedBy = hasLiked ? likedBy.filter(id => id !== user.id) : [...likedBy, user.id];
          return { ...r, liked_by: newLikedBy, likes: newLikedBy.length };
        })
      );
      return { prev };
    },
    onError: (_e, _item, ctx) => { if (ctx?.prev) qc.setQueryData(['replies', resolvedThreadId], ctx.prev); },
  });

  /* ── Like on thread post itself ── */
  const likeThreadMut = useMutation({
    mutationFn: async () => {
      const likedBy = thread.liked_by || [];
      const hasLiked = likedBy.includes(user.id);
      const newLikedBy = hasLiked ? likedBy.filter(id => id !== user.id) : [...likedBy, user.id];
      return base44.entities.Discussion.update(thread.id, { liked_by: newLikedBy, likes: newLikedBy.length });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['thread', threadSlug] }),
  });

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); postMut.mutate(); }
  };

  if (loadingThread) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex gap-1.5">
          {[0,1,2].map(i => <div key={i} className="w-2 h-2 rounded-full bg-accent"
            style={{ animation:`bounce 1.2s ease-in-out ${i*0.15}s infinite` }} />)}
        </div>
        <style>{`@keyframes bounce{0%,80%,100%{transform:translateY(0);opacity:.3}40%{transform:translateY(-6px);opacity:1}}`}</style>
      </div>
    );
  }

  if (!thread) {
    return (
      <div className="text-center py-20 space-y-3">
        <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground/20" />
        <p className="font-semibold">Thread not found</p>
        <button onClick={() => navigate(`/forums/${subjectSlug}`)}
          className="px-4 py-2 rounded-xl text-sm font-semibold"
          style={{ background:'hsl(222 47% 18%)', color:'hsl(43 74% 66%)' }}>
          ← Back to Forum
        </button>
      </div>
    );
  }

  const ago = useLiveAgo(thread?.created_date);
  const fmt = (s) => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;

  return (
    <>
      <SEO
        title={`${thread.title || 'Discussion'} | ${subject?.name || subjectSlug} Forum | Chibondo Academy`}
        description={thread.content?.slice(0, 160) || ''}
      />

      <div className="pb-28 space-y-4">
        {/* Back + Live indicator */}
        <div className="flex items-center justify-between">
          <button onClick={() => navigate(`/forums/${subjectSlug}`, { state: { subject } })}
            className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            {subject?.name || subjectSlug} Forum
          </button>
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-green-600">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            Live
          </span>
        </div>

        {/* ── THREAD / QUESTION CARD ── */}
        <div className="bg-card border border-border rounded-2xl p-5">
          {/* Status row */}
          <div className="flex items-center gap-2 flex-wrap mb-3">
            {thread.is_pinned && (
              <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background:'hsl(43 74% 52% / 0.12)', color:'hsl(43 60% 38%)', border:'1px solid hsl(43 74% 52% / 0.25)' }}>
                <Pin className="w-2.5 h-2.5" /> Pinned
              </span>
            )}
            {thread.is_announcement && (
              <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background:'hsl(222 47% 18% / 0.12)', color:'hsl(222 47% 45%)', border:'1px solid hsl(222 47% 18% / 0.2)' }}>
                <Megaphone className="w-2.5 h-2.5" /> Announcement
              </span>
            )}
            {thread.thread_status === 'resolved' && (
              <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 border border-green-500/20">
                <CheckCircle className="w-2.5 h-2.5" /> Resolved
              </span>
            )}
            {isTeacherOrAdmin && (
              <button onClick={() => pinMut.mutate()}
                className="ml-auto text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
                <Pin className="w-3 h-3" />
                {thread.is_pinned ? 'Unpin' : 'Pin'}
              </button>
            )}
          </div>

          {/* Author — shown first */}
          <div className="flex items-start gap-3 mb-3">
            <Avi name={thread.author_name} role={thread.author_role} avatarUrl={thread.author_avatar} size={9} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="text-sm font-semibold">{thread.author_name}</p>
                <RoleBadge role={thread.author_role} isTutor={thread.is_tutor_reply} />
                <span className="text-[10px] text-muted-foreground ml-auto">{ago}</span>
                <button
                  onClick={() => {
                    const url = window.location.href;
                    if (navigator.share) navigator.share({ title: thread.title, url });
                    else { navigator.clipboard?.writeText(url); toast.success('Link copied!'); }
                  }}
                  className="flex-shrink-0 p-1 rounded-lg text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                  title="Share thread"
                >
                  <Share2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Optional heading (title) */}
          {thread.title && (
            <p className="font-semibold text-base leading-snug mb-2 text-foreground/90">{thread.title}</p>
          )}

          {/* Content */}
          <div className="text-sm leading-relaxed text-foreground/85 whitespace-pre-line">{thread.content}</div>



          {/* Tags */}
          {thread.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-4">
              {thread.tags.map(t => (
                <span key={t} className="text-[11px] px-2.5 py-1 rounded-full bg-muted text-muted-foreground">{t}</span>
              ))}
            </div>
          )}

          {/* Like on thread */}
          <div className="mt-4 pt-3 border-t border-border flex items-center gap-2">
            <LikeButton item={thread} userId={user?.id} onLike={() => likeThreadMut.mutate()} />
            <span className="text-xs text-muted-foreground">{allReplies.length} {allReplies.length === 1 ? 'comment' : 'comments'}</span>
          </div>
        </div>

        {/* ── COMMENTS — live tracking ── */}
        <div>
          <div className="flex items-center justify-between mb-3 px-1">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              {comments.length} {comments.length === 1 ? 'Comment' : 'Comments'}
            </p>
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-green-600">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Live
            </span>
          </div>

          {loadingReplies ? (
            <div className="space-y-3">{[1,2].map(i => <div key={i} className="h-20 bg-card rounded-2xl border border-border animate-pulse" />)}</div>
          ) : comments.length === 0 ? (
            <div className="text-center py-10 bg-card border border-border rounded-2xl">
              <MessageSquare className="w-10 h-10 mx-auto text-muted-foreground/20 mb-2" />
              <p className="text-sm text-muted-foreground">No comments yet — be the first!</p>
            </div>
          ) : (
            <div className="space-y-5">
              {comments.map(r => (
                <ReplyBubble
                  key={r.id}
                  reply={r}
                  replies={allReplies}
                  isAuthor={r.author_id === user?.id}
                  isTeacherOrAdmin={isTeacherOrAdmin}
                  user={user}
                  onDelete={id => deleteMut.mutate(id)}
                  onAccept={reply => acceptMut.mutate(reply)}
                  onLike={item => likeMut.mutate(item)}
                  onReplyTo={target => setReplyTo(target)}
                />
              ))}
            </div>
          )}
        </div>

        <div ref={bottomRef} />
      </div>

      {/* ══════════════════════════════════════════════════════════
          STICKY INPUT BAR
      ══════════════════════════════════════════════════════════ */}
      <div className="fixed bottom-16 left-0 right-0 z-40 bg-background/95 backdrop-blur-sm border-t border-border px-3 py-2 shadow-2xl lg:bottom-0">

        {/* Reply-to indicator */}
        {replyTo && (
          <div className="flex items-center gap-2 mb-1.5 px-1 text-xs">
            <CornerDownRight className="w-3 h-3 text-accent flex-shrink-0" />
            <span className="text-muted-foreground">Replying to <span className="font-semibold text-foreground">{replyTo.name}</span></span>
            <button onClick={() => setReplyTo(null)} className="ml-auto text-muted-foreground hover:text-destructive"><X className="w-3.5 h-3.5" /></button>
          </div>
        )}

        {/* Guest prompt — shown instead of text input */}
        {!user ? (
          <div className="flex items-center justify-between gap-3 py-1">
            <p className="text-sm text-muted-foreground">Join the conversation —</p>
            <div className="flex gap-2">
              <a href="/login">
                <button className="h-8 px-4 text-sm font-medium rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors">
                  Login
                </button>
              </a>
              <a href="/register">
                <button className="h-8 px-4 text-sm font-semibold rounded-full transition-colors"
                  style={{ background: 'hsl(43 74% 52%)', color: 'hsl(222 47% 11%)' }}>
                  Join Now
                </button>
              </a>
            </div>
          </div>
        ) : (
          <div className="flex items-end gap-2">
            {/* Text input */}
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={handleKey}
              placeholder={replyTo ? `Replying to ${replyTo.name}…` : isTeacherOrAdmin ? 'Write your answer…' : 'Write a comment…'}
              rows={1}
              className="flex-1 resize-none px-3 py-2.5 text-sm border border-border rounded-2xl bg-background focus:outline-none focus:ring-2 focus:ring-ring max-h-32 overflow-y-auto"
              style={{ lineHeight: '1.4' }}
              onInput={e => {
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px';
              }}
            />
            {/* Send */}
            <button
              onClick={() => postMut.mutate()}
              disabled={postMut.isPending || !text.trim()}
              className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center disabled:opacity-40 active:scale-95 transition-all"
              style={{ background: 'hsl(222 47% 18%)' }}
            >
              {postMut.isPending
                ? <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                : <Send className="w-4 h-4" style={{ color: 'hsl(43 74% 66%)' }} />
              }
            </button>
          </div>
        )}
      </div>    </>
  );
}

