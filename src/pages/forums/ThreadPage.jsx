import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/api/supabaseClient';
import SEO from '@/components/SEO';
import {
  ArrowLeft, Send, Pin, CheckCircle, MoreVertical, Trash2,
  Heart, MessageSquare, Megaphone,
  X, CornerDownRight, Share2, BookOpen
} from 'lucide-react';
import { toast } from 'sonner';
import { useLiveAgo } from '@/hooks/useLiveAgo';


/* ── Lesson origin quote — shown on forum comments sourced from a lesson ─── */
function LessonQuote({ lessonTitle, lessonUrl }) {
  if (!lessonTitle) return null;
  return (
    <div className="flex items-center gap-2 px-3 py-2 mb-2 rounded-xl border-l-4 text-xs"
      style={{ borderColor: 'hsl(var(--primary))', background: 'hsl(var(--primary) / 0.08)' }}>
      <BookOpen className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'hsl(var(--primary))' }} />
      <span className="text-muted-foreground">From lesson:</span>
      {lessonUrl ? (
        <Link to={lessonUrl} className="font-semibold hover:underline truncate max-w-[200px]" style={{ color: 'hsl(var(--primary))' }}>
          {lessonTitle}
        </Link>
      ) : (
        <span className="font-semibold truncate max-w-[200px]">{lessonTitle}</span>
      )}
    </div>
  );
}

function markForumRead(subjectSlug) {
  if (subjectSlug) localStorage.setItem(`forum_last_visit_${subjectSlug}`, new Date().toISOString());
}


/* ═══════════════════════════════════════════════════════════
   AVATAR — shows photo if available, initials otherwise
═══════════════════════════════════════════════════════════ */
function Avi({ name = '?', role, avatarUrl, size = 8, onClick }) {
  const [err, setErr] = useState(false);
  const styles = {
    admin:   { background: 'hsl(0 72% 51% / 0.18)',   color: 'hsl(0 72% 36%)' },
    teacher: { background: 'hsl(var(--primary) / 0.2)',   color: 'hsl(var(--primary))' },
    student: { background: 'hsl(222 47% 55% / 0.18)', color: 'hsl(222 47% 30%)' },
    user:    { background: 'hsl(222 47% 55% / 0.18)', color: 'hsl(222 47% 30%)' },
  };
  const s = styles[role] || styles.user;
  const parts = (name || '?').trim().split(/\s+/);
  const initials = parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : (name[0] || '?').toUpperCase();
  const sizeClass = `w-${size} h-${size}`;
  const clickable = !!onClick;

  if (avatarUrl && !err) {
    return (
      <img
        src={avatarUrl} alt={name} onError={() => setErr(true)}
        className={`${sizeClass} rounded-full object-cover flex-shrink-0 border-2 border-border ${clickable ? 'cursor-pointer hover:ring-2 hover:ring-accent/50 transition-all' : ''}`}
        onClick={onClick}
        title={clickable ? `View ${name}` : undefined}
      />
    );
  }
  return (
    <div
      className={`${sizeClass} rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 select-none ${clickable ? 'cursor-pointer hover:ring-2 hover:ring-accent/50 transition-all' : ''}`}
      style={s}
      onClick={onClick}
      title={clickable ? `View ${name}` : undefined}
    >
      {initials}
    </div>
  );
}

/* ── AvatarViewer — fullscreen photo lightbox ─────────────────────────── */
function AvatarViewer({ open, onClose, name, role, avatarUrl, authorId }) {
  const [imgErr, setImgErr] = React.useState(false);

  // Fetch TutorProfile if this is a teacher — to get their slug
  const { data: tutorProfiles = [] } = useQuery({queryKey: ['tutor-profile-for-viewer', authorId],
    queryFn: async () => { try { return await db.entities.TutorProfile.filter({ user_id: authorId, status: 'active' }, 'full_name', 1); } catch(e) { console.error(e); return []; } },
    enabled:  open && !!authorId && (role === 'teacher' || role === 'admin'),
    staleTime: 120_000,
    placeholderData: [],}));
  const tutorProfile = tutorProfiles[0] || null;
  const tutorSlug    = tutorProfile?.slug || (role === 'teacher' ? authorId : null);

  if (!open) return null;

  const parts    = (name || '?').trim().split(/\s+/);
  const initials = parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : (name?.[0] || '?').toUpperCase();

  const roleLabel = role === 'teacher' ? 'Tutor' : role === 'admin' ? 'Admin' : 'Student';
  const isTeacher = role === 'teacher' || role === 'admin';

  const roleStyle = isTeacher
    ? { background: 'hsl(var(--primary) / 0.15)', color: 'hsl(var(--primary))', border: '1px solid hsl(var(--primary))' }
    : role === 'admin'
    ? { background: 'hsl(0 72% 51% / 0.12)', color: 'hsl(0 72% 40%)', border: '1px solid hsl(0 72% 51% / 0.25)' }
    : { background: 'hsl(222 47% 55% / 0.12)', color: 'hsl(222 47% 65%)', border: '1px solid hsl(222 47% 55% / 0.25)' };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div className="relative flex flex-col items-center gap-4 max-w-xs w-full" onClick={e => e.stopPropagation()}>
        <button onClick={onClose}
          className="absolute -top-10 right-0 p-2 rounded-full text-white/60 hover:text-white hover:bg-card/10 transition-colors">
          <X className="w-5 h-5" />
        </button>

        {/* Avatar */}
        {avatarUrl && !imgErr ? (
          <img src={avatarUrl} alt={name} onError={() => setImgErr(true)}
            className="w-52 h-52 rounded-full object-cover border-4"
            style={{ borderColor: isTeacher ? 'hsl(var(--primary))' : 'hsl(222 47% 35%)' }} />
        ) : (
          <div className="w-52 h-52 rounded-full flex items-center justify-center text-7xl font-black border-4"
            style={{ background: isTeacher ? 'hsl(var(--primary))' : 'hsl(var(--muted))', color: isTeacher ? 'hsl(var(--foreground))' : 'hsl(var(--primary-foreground))', borderColor: isTeacher ? 'hsl(var(--primary))' : 'hsl(222 47% 35%)' }}>
            {initials}
          </div>
        )}

        {/* Name + role */}
        <div className="text-center space-y-1.5">
          <p className="text-white text-xl font-bold">{name}</p>
          <span className="text-xs font-semibold px-3 py-1 rounded-full" style={roleStyle}>{roleLabel}</span>
          {tutorProfile?.professional_title && (
            <p className="text-xs text-white/60 mt-1">{tutorProfile.professional_title}</p>
          )}
        </div>

        {/* Tutor profile CTA — teachers only */}
        {tutorSlug && (
          <a href={`/tutors/${tutorSlug}`} onClick={onClose}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90"
            style={{ background:'hsl(var(--primary))', color:'hsl(var(--primary-foreground))' }}>
            View Tutor Profile →
          </a>
        )}
      </div>
    </div>
  );
}

function RoleBadge({ role, isTutor }) {
  if (isTutor || role === 'teacher')
    return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full border"
      style={{ background:'hsl(var(--primary) / 0.12)', color:'hsl(var(--primary))', borderColor:'hsl(var(--primary) / 0.3)' }}>Teacher</span>;
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
  onDelete, onAccept, onLike, onReplyTo, onAvatarClick
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

        <Avi name={reply.author_name} role={reply.author_role} avatarUrl={reply.author_avatar} size={8} onClick={() => onAvatarClick && onAvatarClick({ name: reply.author_name, role: reply.author_role, avatarUrl: reply.author_avatar, authorId: reply.author_id })} />

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

          {/* Lesson quote — if this comment originated from a lesson */}
          {reply.lesson_title && (
            <LessonQuote lessonTitle={reply.lesson_title} lessonUrl={reply.lesson_url} />
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
              background: 'hsl(var(--primary) / 0.06)',
              borderColor: 'hsl(var(--primary) / 0.2)',
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
              isAuthor={nr.author_id === user?.id} isTeacherOrAdmin={isTeacherOrAdmin} onAvatarClick={onAvatarClick}
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
  const [replyTo, setReplyTo] = useState(null);
  const [viewingAvatar, setViewingAvatar] = useState(null); // { name, role, avatarUrl, tutorSlug? } // { id, name }

  const isTeacherOrAdmin = user?.role === 'teacher' || user?.role === 'admin';

  /* ── Thread ── */
  const threadId = state?.thread?.id || threadSlug;
  const { data: threadArr = [], isLoading: loadingThread } = useQuery({queryKey: ['thread', threadSlug],
    queryFn: async () => { try { return await []; } catch(e) { console.error(e); return []; } },
    enabled: !state?.thread && !!threadSlug && threadSlug.length < 30,
    staleTime: 30_000,
    placeholderData: [],}));
  const thread = state?.thread || threadArr[0];
  const resolvedThreadId = thread?.id || threadSlug;
  const subject = state?.subject;

  /* ── All replies (comments + nested replies) ── */
  const { data: allReplies = [], isLoading: loadingReplies } = useQuery({queryKey: ['replies', resolvedThreadId],
    queryFn: async () => { try { return await db.entities.Discussion.filter(
      { parent_id: resolvedThreadId, status: 'active' }, 'created_date', 500
    ); } catch(e) { console.error(e); return []; } },
    enabled: !!resolvedThreadId,
    staleTime: 0,
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
    placeholderData: [],}));

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

      return db.entities.Discussion.create({
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

      }
      qc.invalidateQueries({ queryKey: ['replies', resolvedThreadId] });
      qc.invalidateQueries({ queryKey: ['forum-threads', thread?.subject_id] });
    },
    onError: e => toast.error(e.message),
  });

  /* ── Delete reply ── */
  const deleteMut = useMutation({
    mutationFn: id => Promise.resolve(null),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['replies', resolvedThreadId] }),
  });

  /* ── Delete thread (OP) ── */
  const deleteThreadMut = useMutation({
    mutationFn: () => Promise.resolve(null),
    onSuccess: () => {
      toast.success('Thread deleted');
      qc.invalidateQueries({ queryKey: ['forum-threads', thread?.subject_id] });
      navigate(`/forums/${subjectSlug}`);
    },
    onError: (e) => toast.error(e.message || 'Failed to delete thread'),
  });

  const handleDeleteThread = () => {
    if (window.confirm(`Delete "${thread?.title}"? All replies will also be removed. This cannot be undone.`)) {
      deleteThreadMut.mutate();
    }
  };

  /* ── Accept answer ── */
  const acceptMut = useMutation({
    mutationFn: async (reply) => {
      const prev = allReplies.find(r => r.is_accepted_answer);
      if (prev) await Promise.resolve(null);
      await Promise.resolve(null);
      if (thread?.id) await Promise.resolve(null);
    },
    onSuccess: () => { toast.success('Answer marked as accepted'); qc.invalidateQueries({ queryKey: ['replies', resolvedThreadId] }); },
  });

  /* ── Pin thread ── */
  const pinMut = useMutation({
    mutationFn: () => Promise.resolve(null),
    onSuccess: () => { toast.success(thread.is_pinned ? 'Unpinned' : 'Pinned'); qc.invalidateQueries({ queryKey: ['thread', threadSlug] }); },
  });

  /* ── Like (toggle) ── */
  const likeMut = useMutation({
    mutationFn: async (item) => {
      const likedBy = item.liked_by || [];
      const hasLiked = likedBy.includes(user.id);
      const newLikedBy = hasLiked ? likedBy.filter(id => id !== user.id) : [...likedBy, user.id];
      return Promise.resolve(null);
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
      return Promise.resolve(null);
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
          style={{ background:'hsl(var(--primary))', color:'hsl(var(--primary-foreground))' }}>
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
        title={thread.seo_title || thread.title}
        description={
          thread.seo_description ||
          (thread.content || '').replace(/<[^>]+>/g, '').slice(0, 160)
        }
        canonical={`${window.location.origin}/forums/${subjectSlug}/${threadSlug}`}
        ogType="article"
        ogTitle={
          thread.og_title ||
          thread.seo_title ||
          `${thread.title} — ${subject?.name || subjectSlug} Forum`
        }
        ogDescription={
          thread.og_description ||
          thread.seo_description ||
          (thread.content || '').replace(/<[^>]+>/g, '').slice(0, 160)
        }
        ogImageOverride={thread.seo_image || thread.og_image || undefined}
        twitterTitle={
          thread.twitter_title ||
          thread.og_title ||
          thread.seo_title ||
          thread.title
        }
        twitterDescription={
          thread.twitter_description ||
          thread.og_description ||
          thread.seo_description ||
          (thread.content || '').replace(/<[^>]+>/g, '').slice(0, 160)
        }
        schema={{
          "@context": "https://schema.org",
          "@type": "DiscussionForumPosting",
          "headline": thread.title,
          "text": (thread.content || '').replace(/<[^>]+>/g, '').slice(0, 500),
          "url": `${window.location.origin}/forums/${subjectSlug}/${threadSlug}`,
          "datePublished": thread.created_date,
          "dateModified": thread.updated_date || thread.created_date,
          "author": {
            "@type": "Person",
            "name": thread.author_name || "Student"
          },
          "interactionStatistic": {
            "@type": "InteractionCounter",
            "interactionType": "https://schema.org/ReplyAction",
            "userInteractionCount": thread.reply_count || 0
          },
          "isPartOf": {
            "@type": "DiscussionForumPosting",
            "name": `${subject?.name || subjectSlug} Forum`,
            "url": `${window.location.origin}/forums/${subjectSlug}`
          }
        }}
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
                style={{ background:'hsl(var(--primary) / 0.12)', color:'hsl(var(--primary))', border:'1px solid hsl(var(--primary))' }}>
                <Pin className="w-2.5 h-2.5" /> Pinned
              </span>
            )}
            {thread.is_announcement && (
              <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background:'hsl(var(--muted) / 0.12)', color:'hsl(222 47% 45%)', border:'1px solid hsl(222 47% 18% / 0.2)' }}>
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
            {/* Delete thread — author or admin/teacher */}
            {(user?.id === thread.author_id || isTeacherOrAdmin) && (
              <button
                onClick={handleDeleteThread}
                disabled={deleteThreadMut.isPending}
                className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors disabled:opacity-50"
                title="Delete this thread"
              >
                <Trash2 className="w-3 h-3" />
                Delete
              </button>
            )}
          </div>

          {/* Author — shown first */}
          <div className="flex items-start gap-3 mb-3">
            <Avi name={thread.author_name} role={thread.author_role} avatarUrl={thread.author_avatar} size={9} onClick={() => setViewingAvatar({ name: thread.author_name, role: thread.author_role, avatarUrl: thread.author_avatar, authorId: thread.author_id })} />
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

          {/* Lesson origin quote — shown when thread originated from a lesson comment */}
          {thread.lesson_title && (
            <div className="mt-3">
              <LessonQuote lessonTitle={thread.lesson_title} lessonUrl={thread.lesson_url} />
            </div>
          )}



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
                  onAvatarClick={p => setViewingAvatar(p)}
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
                  style={{ background:'hsl(var(--primary))', color:'hsl(var(--primary-foreground))' }}>
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
              style={{ background: 'hsl(var(--muted))' }}
            >
              {postMut.isPending
                ? <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                : <Send className="w-4 h-4" style={{ color: 'hsl(var(--primary))' }} />
              }
            </button>
          </div>
        )}
      </div>      {/* ── Avatar / profile viewer modal ── */}
      {viewingAvatar && (
        <AvatarViewer
          open={true}
          onClose={() => setViewingAvatar(null)}
          name={viewingAvatar.name}
          role={viewingAvatar.role}
          avatarUrl={viewingAvatar.avatarUrl}
          tutorSlug={viewingAvatar.tutorSlug}
        />
      )}
    </>
  );
}
