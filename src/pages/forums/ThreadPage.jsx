import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import SEO from '@/components/SEO';
import {
  ArrowLeft, Send, Pin, CheckCircle, MoreVertical, Trash2,
  GraduationCap, Heart, MessageSquare, Megaphone, Image as ImageIcon, X
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

/* ── Avatar ─────────────────────────────────────────────────────────────── */
function Avi({ name = '?', role }) {
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
  return (
    <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 select-none" style={s}>
      {initials}
    </div>
  );
}

function RoleBadge({ role, isTutor }) {
  if (isTutor || role === 'teacher')
    return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border"
      style={{ background:'hsl(43 74% 52% / 0.12)', color:'hsl(38 60% 32%)', borderColor:'hsl(43 74% 52% / 0.3)' }}>Teacher</span>;
  if (role === 'admin')
    return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 border border-red-200">Admin</span>;
  return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border"
    style={{ background:'hsl(222 47% 55% / 0.1)', color:'hsl(222 47% 35%)', borderColor:'hsl(222 47% 55% / 0.25)' }}>Student</span>;
}

/* ── Tutor badge ─────────────────────────────────────────────────────────── */
function TutorBadge({ subjectName }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
      style={{ background: 'hsl(43 74% 52% / 0.12)', color: 'hsl(43 60% 38%)', border: '1px solid hsl(43 74% 52% / 0.25)' }}>
      <GraduationCap className="w-2.5 h-2.5" />
      Verified Tutor{subjectName ? ` · ${subjectName}` : ''}
    </span>
  );
}

/* ── Accepted badge ──────────────────────────────────────────────────────── */
function AcceptedBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 border border-green-500/20">
      <CheckCircle className="w-2.5 h-2.5" /> Accepted Answer
    </span>
  );
}

/* ── Reply bubble ────────────────────────────────────────────────────────── */
function ReplyBubble({ reply, isAuthor, isTeacherOrAdmin, onDelete, onAccept, subjectName, threadAuthorId }) {
  const [menu, setMenu] = useState(false);
  const ago = reply.created_date
    ? formatDistanceToNow(new Date(reply.created_date), { addSuffix: true })
    : '';
  const canDelete = isAuthor || isTeacherOrAdmin;
  const canAccept = isTeacherOrAdmin; // tutor/admin marks accepted answers

  return (
    <div className={`flex gap-3 ${reply.is_accepted_answer ? 'relative' : ''}`}>
      {reply.is_accepted_answer && (
        <div className="absolute -left-3 top-0 bottom-0 w-1 rounded-full bg-green-500/60" />
      )}
      <Avi name={reply.author_name} role={reply.author_role} />
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="font-semibold text-sm">{reply.author_name}</span>
          <RoleBadge role={reply.author_role} isTutor={reply.is_tutor_reply} />
          {reply.is_accepted_answer && <AcceptedBadge />}
          <span className="text-[11px] text-muted-foreground ml-auto">{ago}</span>
          {(canDelete || canAccept) && (
            <div className="relative">
              <button onClick={() => setMenu(v => !v)} className="text-muted-foreground/40 hover:text-muted-foreground transition-colors p-0.5">
                <MoreVertical className="w-3.5 h-3.5" />
              </button>
              {menu && (
                <div className="absolute right-0 top-5 z-10 bg-card border border-border rounded-xl shadow-lg min-w-[140px] py-1 text-sm">
                  {canAccept && !reply.is_accepted_answer && (
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
        {/* Content */}
        <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-line ${
          reply.is_tutor_reply
            ? 'border'
            : 'bg-muted/50'
        }`}
          style={reply.is_tutor_reply ? {
            background: 'hsl(43 74% 52% / 0.06)',
            borderColor: 'hsl(43 74% 52% / 0.2)',
          } : {}}
        >
          {reply.content}
          {reply.image_url && (
            <img src={reply.image_url} alt="" className="mt-2 rounded-xl max-w-full max-h-64 object-contain" />
          )}
        </div>
      </div>
    </div>
  );
}

/* ── MAIN PAGE ───────────────────────────────────────────────────────────── */
export default function ThreadPage() {
  const { subjectSlug, threadSlug } = useParams();
  const navigate    = useNavigate();
  const { state }   = useLocation();
  const { user }    = useOutletContext();
  const qc          = useQueryClient();
  const bottomRef   = useRef();
  const inputRef    = useRef();
  const [text, setText] = useState('');
  const [imgUrl, setImgUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();

  const isTeacherOrAdmin = user?.role === 'teacher' || user?.role === 'admin';

  /* ── Thread data ── */
  const threadId = state?.thread?.id || threadSlug;
  const { data: threadArr = [], isLoading: loadingThread } = useQuery({
    queryKey: ['thread', threadSlug],
    queryFn: () => base44.entities.Discussion.filter({ slug: threadSlug }, 'created_date', 1),
    enabled: !state?.thread && !!threadSlug && threadSlug.length < 30,
    staleTime: 30_000,
  });
  const thread = state?.thread || threadArr[0];
  const resolvedThreadId = thread?.id || threadSlug;

  /* ── Subject from state or cache ── */
  const subject = state?.subject;

  /* ── Replies ── */
  const { data: replies = [], isLoading: loadingReplies } = useQuery({
    queryKey: ['replies', resolvedThreadId],
    queryFn: () => base44.entities.Discussion.filter(
      { parent_id: resolvedThreadId, status: 'active' }, 'created_date', 500
    ),
    enabled: !!resolvedThreadId,
    staleTime: 15_000,
    refetchInterval: 30_000, // light polling
  });

  /* ── Scroll to bottom on new replies ── */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [replies.length]);

  /* ── Post reply ── */
  const postMut = useMutation({
    mutationFn: async () => {
      if (!text.trim() && !imgUrl) throw new Error('Write something first');
      return base44.entities.Discussion.create({
        content: text.trim(),
        image_url: imgUrl || undefined,
        parent_id: resolvedThreadId,
        subject_id: thread?.subject_id,
        subject_slug: subjectSlug,
        author_id: user.id,
        author_name: user.full_name || user.email,
        author_role: user.role || 'user',
        is_tutor_reply: isTeacherOrAdmin,
        status: 'active',
      });
    },
    onSuccess: async () => {
      setText(''); setImgUrl('');
      // Increment reply_count on thread
      if (thread?.id) {
        try {
          await base44.entities.Discussion.update(thread.id, {
            reply_count: (thread.reply_count || 0) + 1,
          });
        } catch(_) {}
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
    onError: e => toast.error(e.message),
  });

  /* ── Accept answer ── */
  const acceptMut = useMutation({
    mutationFn: async (reply) => {
      // Clear previous accepted
      const prev = replies.find(r => r.is_accepted_answer);
      if (prev) await base44.entities.Discussion.update(prev.id, { is_accepted_answer: false });
      await base44.entities.Discussion.update(reply.id, { is_accepted_answer: true });
      if (thread?.id) await base44.entities.Discussion.update(thread.id, { thread_status: 'resolved' });
    },
    onSuccess: () => {
      toast.success('Answer marked as accepted');
      qc.invalidateQueries({ queryKey: ['replies', resolvedThreadId] });
    },
  });

  /* ── Pin thread (teacher/admin) ── */
  const pinMut = useMutation({
    mutationFn: () => base44.entities.Discussion.update(thread.id, { is_pinned: !thread.is_pinned }),
    onSuccess: () => { toast.success(thread.is_pinned ? 'Unpinned' : 'Pinned'); qc.invalidateQueries({ queryKey: ['thread', threadSlug] }); },
  });

  /* ── Image upload ── */
  const handleImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const resp = await fetch(`/api/apps/${window.__appParams?.appId || ''}/storage/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${window.__appParams?.token || ''}` },
        body: fd,
      });
      const json = await resp.json();
      setImgUrl(json.url || json.file_url || '');
    } catch { toast.error('Image upload failed'); }
    finally { setUploading(false); }
  };

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

  const ago = thread.created_date
    ? formatDistanceToNow(new Date(thread.created_date), { addSuffix: true })
    : '';

  /* Sort: accepted answer first, then tutor replies, then rest */
  const sorted = [...replies].sort((a,b) => {
    if (a.is_accepted_answer && !b.is_accepted_answer) return -1;
    if (!a.is_accepted_answer && b.is_accepted_answer) return 1;
    if (a.is_tutor_reply && !b.is_tutor_reply) return -1;
    if (!a.is_tutor_reply && b.is_tutor_reply) return 1;
    return new Date(a.created_date) - new Date(b.created_date);
  });

  return (
    <>
      <SEO
        title={`${thread.title || 'Discussion'} | ${subject?.name || subjectSlug} Forum | Chibondo Academy`}
        description={thread.content?.slice(0, 160) || ''}
        canonical={`https://aca.base44.app/forums/${subjectSlug}/${threadSlug}`}
      />

      {/*
        Extra bottom padding so the sticky reply bar doesn't cover content.
        The sticky bar is ~64px tall, add 24px extra = pb-24 total.
      */}
      <div className="pb-24 space-y-4">

        {/* ── BACK NAV ── */}
        <button
          onClick={() => navigate(`/forums/${subjectSlug}`, { state: { subject } })}
          className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {subject?.name || subjectSlug} Forum
        </button>

        {/* ── QUESTION CARD ── */}
        <div className="bg-card border border-border rounded-2xl p-5">
          {/* Status badges row */}
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

          {/* Title */}
          <h1 className="font-display font-bold text-lg leading-snug mb-4">{thread.title}</h1>

          {/* Author + time */}
          <div className="flex items-center gap-3 mb-4">
            <Avi name={thread.author_name} role={thread.author_role} />
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="text-sm font-semibold">{thread.author_name}</p>
                <RoleBadge role={thread.author_role} isTutor={thread.is_tutor_reply} />
              </div>
              <p className="text-[11px] text-muted-foreground">{ago}</p>
            </div>
          </div>

          {/* Content */}
          <div className="text-sm leading-relaxed text-foreground/85 whitespace-pre-line">
            {thread.content}
          </div>
          {thread.image_url && (
            <img src={thread.image_url} alt="" className="mt-3 rounded-xl max-w-full max-h-72 object-contain" />
          )}

          {/* Tags */}
          {thread.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-4">
              {thread.tags.map(t => (
                <span key={t} className="text-[11px] px-2.5 py-1 rounded-full bg-muted text-muted-foreground">{t}</span>
              ))}
            </div>
          )}
        </div>

        {/* ── REPLIES SECTION ── */}
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 px-1">
            {replies.length} {replies.length === 1 ? 'Answer' : 'Answers'}
          </p>

          {loadingReplies ? (
            <div className="space-y-3">
              {[1,2].map(i => <div key={i} className="h-20 bg-card rounded-2xl border border-border animate-pulse" />)}
            </div>
          ) : sorted.length === 0 ? (
            <div className="text-center py-10 bg-card border border-border rounded-2xl">
              <MessageSquare className="w-10 h-10 mx-auto text-muted-foreground/20 mb-2" />
              <p className="text-sm text-muted-foreground">No answers yet — be the first to reply!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {sorted.map(r => (
                <ReplyBubble
                  key={r.id}
                  reply={r}
                  isAuthor={r.author_id === user?.id}
                  isTeacherOrAdmin={isTeacherOrAdmin}
                  subjectName={subject?.name}
                  threadAuthorId={thread?.author_id}
                  onDelete={id => deleteMut.mutate(id)}
                  onAccept={reply => acceptMut.mutate(reply)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Scroll anchor */}
        <div ref={bottomRef} />
      </div>

      {/* ══════════════════════════════════════════════════════════
          STICKY REPLY BAR — WhatsApp-style, above bottom nav
      ══════════════════════════════════════════════════════════ */}
      <div className="fixed bottom-16 left-0 right-0 z-40 bg-background/95 backdrop-blur-sm border-t border-border px-3 py-2 shadow-2xl">
        {imgUrl && (
          <div className="flex items-center gap-2 mb-2 px-1">
            <img src={imgUrl} alt="" className="h-12 w-12 object-cover rounded-lg border border-border" />
            <button onClick={() => setImgUrl('')} className="text-muted-foreground hover:text-destructive transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          {/* Image attach */}
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex-shrink-0 w-9 h-9 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
          >
            <ImageIcon className="w-4 h-4" />
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImage} />

          {/* Text input */}
          <textarea
            ref={inputRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKey}
            placeholder={isTeacherOrAdmin ? 'Write your answer…' : 'Write a reply…'}
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
            disabled={postMut.isPending || (!text.trim() && !imgUrl)}
            className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center disabled:opacity-40 active:scale-95 transition-all"
            style={{ background: 'hsl(222 47% 18%)' }}
          >
            <Send className="w-4 h-4" style={{ color: 'hsl(43 74% 66%)' }} />
          </button>
        </div>
      </div>
    </>
  );
}
