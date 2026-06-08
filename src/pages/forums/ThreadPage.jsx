import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import SEO from '@/components/SEO';
import {
  ArrowLeft, Send, Pin, CheckCircle, MoreVertical, Trash2,
  Heart, MessageSquare, Megaphone,
  X, Play, Pause, CornerDownRight, Share2
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';


/* ── Mark parent forum read when thread opens ──────────────────────────── */
function markForumRead(subjectSlug) {
  if (subjectSlug) localStorage.setItem(`forum_last_visit_${subjectSlug}`, new Date().toISOString());
}

/* ── Watermarked image share / download ─────────────────────────────────── */
async function shareOrDownloadImage(imgUrl) {
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('load')); img.src = imgUrl; });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || 800;
    canvas.height = img.naturalHeight || 600;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    // Watermark badge
    const fs = Math.max(12, Math.min(Math.floor(canvas.width / 28), 26));
    ctx.font = `bold ${fs}px Arial, sans-serif`;
    const text = '@ The Chibondo Academy';
    const tw = ctx.measureText(text).width;
    const pad = 10;
    const bx = canvas.width - tw - pad * 2 - 6;
    const by = canvas.height - fs - pad * 2 - 6;
    // Badge bg
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.moveTo(bx + 6, by); ctx.lineTo(bx + tw + pad * 2 - 6, by);
    ctx.quadraticCurveTo(bx + tw + pad * 2, by, bx + tw + pad * 2, by + 6);
    ctx.lineTo(bx + tw + pad * 2, by + fs + pad * 2 - 6);
    ctx.quadraticCurveTo(bx + tw + pad * 2, by + fs + pad * 2, bx + tw + pad * 2 - 6, by + fs + pad * 2);
    ctx.lineTo(bx + 6, by + fs + pad * 2);
    ctx.quadraticCurveTo(bx, by + fs + pad * 2, bx, by + fs + pad * 2 - 6);
    ctx.lineTo(bx, by + 6); ctx.quadraticCurveTo(bx, by, bx + 6, by);
    ctx.closePath(); ctx.fill();
    // Text
    ctx.fillStyle = 'rgba(255,215,100,0.96)';
    ctx.fillText(text, bx + pad, by + fs + pad - 2);

    return new Promise(res => canvas.toBlob(blob => {
      if (!blob) { res(null); return; }
      const file = new File([blob], 'chibondo-academy.jpg', { type: 'image/jpeg' });
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: 'Chibondo Academy' }).then(() => res('shared')).catch(() => res('fallback'));
      } else {
        res('fallback');
      }
    }, 'image/jpeg', 0.92));
  } catch { return 'fallback'; }
}

async function handleImageShare(imgUrl, toastFn) {
  const result = await shareOrDownloadImage(imgUrl);
  if (result === 'shared') return;
  // Fallback: download
  try {
    const img = new Image(); img.crossOrigin = 'anonymous';
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = imgUrl; });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || 800; canvas.height = img.naturalHeight || 600;
    const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const fs = Math.max(12, Math.min(Math.floor(canvas.width / 28), 26));
    ctx.font = `bold ${fs}px Arial, sans-serif`;
    const text = '@ The Chibondo Academy';
    const tw = ctx.measureText(text).width; const pad = 10;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(canvas.width - tw - pad * 2 - 6, canvas.height - fs - pad * 2 - 6, tw + pad * 2, fs + pad * 2);
    ctx.fillStyle = 'rgba(255,215,100,0.96)';
    ctx.fillText(text, canvas.width - tw - pad - 6, canvas.height - pad - 8);
    canvas.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'chibondo-academy.jpg'; a.click();
      URL.revokeObjectURL(url);
      toastFn?.('Image downloaded with watermark');
    }, 'image/jpeg', 0.92);
  } catch { toastFn?.('Could not process image'); }
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
   VOICE NOTE PLAYER — WhatsApp-style waveform bar
═══════════════════════════════════════════════════════════ */
function VoicePlayer({ url, duration }) {
  const audioRef = useRef();
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrent] = useState(0);

  const toggle = () => {
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else { audioRef.current.play(); setPlaying(true); }
  };

  const fmt = (s) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2,'0')}`;
  };

  return (
    <div className="flex items-center gap-2.5 bg-muted/60 rounded-2xl px-3 py-2 w-full max-w-xs">
      <audio
        ref={audioRef}
        src={url}
        onTimeUpdate={e => {
          const t = e.target.currentTime;
          const d = e.target.duration || duration || 1;
          setCurrent(t);
          setProgress((t / d) * 100);
        }}
        onEnded={() => { setPlaying(false); setProgress(0); setCurrent(0); }}
      />
      <button onClick={toggle}
        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ background:'hsl(43 74% 52%)', color:'hsl(222 47% 11%)' }}>
        {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
      </button>
      {/* Progress bar */}
      <div className="flex-1 relative h-1 bg-border rounded-full overflow-hidden cursor-pointer"
        onClick={e => {
          if (!audioRef.current) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const pct = (e.clientX - rect.left) / rect.width;
          audioRef.current.currentTime = pct * (audioRef.current.duration || 0);
        }}>
        <div className="h-full rounded-full transition-all" style={{ width:`${progress}%`, background:'hsl(43 74% 52%)' }} />
      </div>
      <span className="text-[10px] text-muted-foreground flex-shrink-0 tabular-nums">
        {playing ? fmt(currentTime) : fmt(duration || 0)}
      </span>
      <Mic className="w-3 h-3 text-muted-foreground flex-shrink-0" />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   VOICE RECORDER — records and returns blob URL
═══════════════════════════════════════════════════════════ */
function useVoiceRecorder() {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [blob, setBlob] = useState(null);
  const [blobUrl, setBlobUrl] = useState(null);
  // Use refs for duration so it survives async onstop callback
  const durationRef = useRef(0);
  const mediaRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  // Always clear the timer safely
  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const start = useCallback(async () => {
    // Don't start a second recording if already recording
    if (mediaRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Pick a supported mimeType
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : '';

      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      chunksRef.current = [];

      mr.ondataavailable = e => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      mr.onstop = () => {
        // Build blob from all chunks
        const type = mimeType || 'audio/webm';
        const b = new Blob(chunksRef.current, { type });
        setBlob(b);
        setBlobUrl(URL.createObjectURL(b));
        // Stop all mic tracks
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        mediaRef.current = null;
      };

      mr.start(100); // collect data every 100ms — ensures chunks arrive reliably
      mediaRef.current = mr;
      setRecording(true);
      setSeconds(0);
      durationRef.current = 0;

      // Start timer — only one at a time
      clearTimer();
      timerRef.current = setInterval(() => {
        durationRef.current += 1;
        setSeconds(s => s + 1);
      }, 1000);

    } catch (err) {
      mediaRef.current = null;
      toast.error('Microphone access denied. Please allow microphone in your browser settings.');
    }
  }, [clearTimer]);

  const stop = useCallback(() => {
    // Stop timer FIRST before anything async
    clearTimer();
    setRecording(false);
    // Then stop MediaRecorder — triggers onstop async
    if (mediaRef.current && mediaRef.current.state !== 'inactive') {
      mediaRef.current.stop();
    } else {
      mediaRef.current = null;
    }
  }, [clearTimer]);

  const clear = useCallback(() => {
    clearTimer();
    setRecording(false);
    setBlob(null);
    setBlobUrl(null);
    setSeconds(0);
    durationRef.current = 0;
    if (mediaRef.current) {
      try { mediaRef.current.stop(); } catch(_) {}
      mediaRef.current = null;
    }
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, [clearTimer]);

  // Expose durationRef so upload can read the final duration even after clear
  return { recording, seconds, blob, blobUrl, durationRef, start, stop, clear };
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
  const ago = reply.created_date
    ? formatDistanceToNow(new Date(reply.created_date), { addSuffix: true }) : '';
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
            {reply.image_url && (
              <div className="mt-2 relative group inline-block max-w-full">
                <img src={reply.image_url} alt="" className="rounded-xl max-w-full max-h-52 object-contain" />
                <button
                  onClick={() => handleImageShare(reply.image_url, toast.success)}
                  className="absolute top-2 right-2 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 active:opacity-100 transition-opacity"
                  style={{ background:'rgba(0,0,0,0.55)', color:'white' }}
                  title="Share / Download"
                >
                  <Share2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            {reply.voice_note_url && (
              <div className="mt-2">
                <VoicePlayer url={reply.voice_note_url} duration={reply.voice_note_duration || 0} />
              </div>
            )}
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
  const voice = useVoiceRecorder();
  const [uploadingVoice, setUploadingVoice] = useState(false);

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

  const ago = thread.created_date ? formatDistanceToNow(new Date(thread.created_date), { addSuffix: true }) : '';
  const isRecordingAndUploading = voice.recording || uploadingVoice;
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
          {thread.image_url && (
            <div className="mt-3 relative group inline-block max-w-full">
              <img src={thread.image_url} alt="" className="rounded-xl max-w-full max-h-72 object-contain" />
              <button
                onClick={() => handleImageShare(thread.image_url, toast.success)}
                className="absolute top-2 right-2 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 active:opacity-100 transition-opacity"
                style={{ background:'rgba(0,0,0,0.55)', color:'white' }}
                title="Share / Download"
              >
                <Share2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          {thread.voice_note_url && (
            <div className="mt-3">
              <VoicePlayer url={thread.voice_note_url} duration={thread.voice_note_duration || 0} />
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

