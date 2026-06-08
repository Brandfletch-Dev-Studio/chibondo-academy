import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import SEO from '@/components/SEO';
import {
  ArrowLeft, Send, Pin, CheckCircle, MoreVertical, Trash2,
  GraduationCap, Heart, MessageSquare, Megaphone, Image as ImageIcon,
  X, Mic, MicOff, Square, Play, Pause, CornerDownRight
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

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
              <img src={reply.image_url} alt="" className="mt-2 rounded-xl max-w-full max-h-52 object-contain" />
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
  const navigate  = useNavigate();
  const { state } = useLocation();
  const { user }  = useOutletContext();
  const qc        = useQueryClient();
  const bottomRef = useRef();
  const fileRef   = useRef();
  const voice     = useVoiceRecorder();

  const [text, setText]   = useState('');
  const [imgUrl, setImgUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadingVoice, setUploadingVoice] = useState(false);
  const [mode, setMode]   = useState('text'); // 'text' | 'voice'
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

  /* ── Image upload (reuse existing pattern) ── */
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

  /* ── Voice upload ── */
  const uploadVoice = async () => {
    if (!voice.blob) return null;
    // Capture duration NOW before any state changes
    const capturedDuration = voice.durationRef.current || voice.seconds || 0;
    setUploadingVoice(true);
    try {
      const mimeType = voice.blob.type || 'audio/webm';
      const ext = mimeType.includes('ogg') ? 'ogg' : mimeType.includes('mp4') ? 'mp4' : 'webm';
      const file = new File([voice.blob], `voice_${Date.now()}.${ext}`, { type: mimeType });
      const fd = new FormData();
      fd.append('file', file);
      const resp = await fetch(`/api/apps/${window.__appParams?.appId || ''}/storage/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${window.__appParams?.token || ''}` },
        body: fd,
      });
      if (!resp.ok) throw new Error(`Upload failed: ${resp.status}`);
      const json = await resp.json();
      const url = json.url || json.file_url || '';
      if (!url) throw new Error('No URL returned from upload');
      return { url, duration: capturedDuration };
    } catch (err) {
      toast.error('Voice upload failed: ' + err.message);
      return null;
    } finally {
      setUploadingVoice(false);
    }
  };

  /* ── Post mutation ── */
  const postMut = useMutation({
    mutationFn: async () => {
      let voiceUrl = null, voiceDuration = 0;
      if (mode === 'voice') {
        if (!voice.blob && !voice.blobUrl) throw new Error('No voice note recorded. Please record first.');
        // If blob isn't ready yet (onstop race) wait briefly
        if (!voice.blob && voice.blobUrl) {
          await new Promise(r => setTimeout(r, 300));
        }
        if (!voice.blob) throw new Error('Voice note not ready yet. Please try again.');
        const result = await uploadVoice();
        if (!result) throw new Error('Voice upload failed');
        voiceUrl = result.url;
        voiceDuration = result.duration;
      } else if (!text.trim() && !imgUrl) {
        throw new Error('Write something or record a voice note first');
      }

      return base44.entities.Discussion.create({
        content: text.trim(),
        image_url: imgUrl || undefined,
        voice_note_url: voiceUrl || undefined,
        voice_note_duration: voiceDuration || undefined,
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
      setText(''); setImgUrl(''); voice.clear(); setReplyTo(null);
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
        description={thread.content?.replace(/<[^>]*>/g,'').slice(0, 160) || ''}
        canonical={`${window.location.origin}/forums/${subjectSlug}/${threadSlug}`}
        schema={{
          "@context": "https://schema.org",
          "@type": "DiscussionForumPosting",
          "headline": thread.title || 'Discussion',
          "text": thread.content?.replace(/<[^>]*>/g,'').slice(0, 500) || '',
          "datePublished": thread.created_date,
          "dateModified": thread.updated_date || thread.created_date,
          "author": { "@type": "Person", "name": thread.author_name || 'Student' },
          "url": `${window.location.origin}/forums/${subjectSlug}/${threadSlug}`,
          "isPartOf": {
            "@type": "DiscussionForumPosting",
            "name": `${subject?.name || subjectSlug} Forum — Chibondo Academy`
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

          <h1 className="font-display font-bold text-lg leading-snug mb-4">{thread.title}</h1>

          {/* Author */}
          <div className="flex items-center gap-3 mb-4">
            <Avi name={thread.author_name} role={thread.author_role} avatarUrl={thread.author_avatar} size={9} />
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="text-sm font-semibold">{thread.author_name}</p>
                <RoleBadge role={thread.author_role} isTutor={thread.is_tutor_reply} />
              </div>
              <p className="text-[11px] text-muted-foreground">{ago}</p>
            </div>
          </div>

          {/* Content */}
          <div className="text-sm leading-relaxed text-foreground/85 whitespace-pre-line">{thread.content}</div>
          {thread.image_url && (
            <img src={thread.image_url} alt="" className="mt-3 rounded-xl max-w-full max-h-72 object-contain" />
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
            <LikeButton item={thread} userId={user?.id} onLike={() => requireAuth(() => likeThreadMut.mutate())} />
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
                  onLike={item => requireAuth(() => likeMut.mutate(item))}
                  onReplyTo={target => setReplyTo(target)}
                />
              ))}
            </div>
          )}
        </div>

        <div ref={bottomRef} />
      </div>

      {/* ══════════════════════════════════════════════════════════
          STICKY INPUT BAR — WhatsApp style
      ══════════════════════════════════════════════════════════ */}
      <div className="fixed bottom-16 left-0 right-0 z-40 bg-background/95 backdrop-blur-sm border-t border-border px-3 py-2 shadow-2xl lg:bottom-0">

        {/* Guest sign-in prompt — shown instead of composer for unauthenticated visitors */}
        {!isAuthenticated && (
          <div className="flex items-center justify-between gap-3 py-2">
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">Sign in</span> to reply, like, or join the discussion.
            </p>
            <button
              onClick={() => requireAuth(() => {})}
              className="flex-shrink-0 px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-95"
              style={{ background: 'hsl(43 74% 52%)', color: 'hsl(222 47% 11%)' }}
            >
              Sign in
            </button>
          </div>
        )}

        {/* Reply-to indicator */}
        {isAuthenticated && replyTo && (
          <div className="flex items-center gap-2 mb-1.5 px-1 text-xs">
            <CornerDownRight className="w-3 h-3 text-accent flex-shrink-0" />
            <span className="text-muted-foreground">Replying to <span className="font-semibold text-foreground">{replyTo.name}</span></span>
            <button onClick={() => setReplyTo(null)} className="ml-auto text-muted-foreground hover:text-destructive"><X className="w-3.5 h-3.5" /></button>
          </div>
        )}

        {/* Image preview */}
        {imgUrl && (
          <div className="flex items-center gap-2 mb-1.5 px-1">
            <img src={imgUrl} alt="" className="h-10 w-10 object-cover rounded-lg border border-border" />
            <button onClick={() => setImgUrl('')} className="text-muted-foreground hover:text-destructive"><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* Voice preview */}
        {voice.blobUrl && !voice.recording && (
          <div className="flex items-center gap-2 mb-1.5 px-1">
            <VoicePlayer url={voice.blobUrl} duration={voice.seconds} />
            <button onClick={voice.clear} className="text-muted-foreground hover:text-destructive"><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* Recording indicator */}
        {voice.recording && (
          <div className="flex items-center gap-2 mb-1.5 px-2 py-1.5 bg-red-500/10 border border-red-500/20 rounded-xl">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs text-red-600 font-medium">Recording… {fmt(voice.seconds)}</span>
            <button onClick={voice.stop} className="ml-auto flex items-center gap-1 text-xs text-red-600 font-semibold hover:opacity-80">
              <Square className="w-3 h-3 fill-current" /> Stop
            </button>
          </div>
        )}

        <div className="flex items-end gap-2">
          {/* Image button */}
          {mode === 'text' && (
            <>
              <button onClick={() => fileRef.current?.click()} disabled={uploading}
                className="flex-shrink-0 w-9 h-9 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors">
                {uploading ? <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" /> : <ImageIcon className="w-4 h-4" />}
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImage} />
            </>
          )}

          {/* Voice toggle button */}
          <button
            onClick={() => {
              if (mode === 'voice') { voice.stop(); voice.clear(); setMode('text'); }
              else { setMode('voice'); }
            }}
            className={`flex-shrink-0 w-9 h-9 rounded-full border flex items-center justify-center transition-colors ${
              mode === 'voice'
                ? 'bg-red-500/10 border-red-500/20 text-red-500'
                : 'border-border text-muted-foreground hover:text-foreground hover:border-primary/40'
            }`}
          >
            {mode === 'voice' ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          {mode === 'voice' ? (
            /* Voice mode controls */
            <div className="flex-1 flex items-center gap-2">
              {!voice.recording && !voice.blobUrl && (
                <button onClick={voice.start}
                  className="flex-1 flex items-center justify-center gap-2 h-10 rounded-2xl border border-red-500/30 bg-red-500/5 text-red-500 text-sm font-medium hover:bg-red-500/10 transition-colors">
                  <Mic className="w-4 h-4" /> Hold to record
                </button>
              )}
              {voice.recording && (
                <button onClick={voice.stop}
                  className="flex-1 flex items-center justify-center gap-2 h-10 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-600 text-sm font-medium">
                  <Square className="w-4 h-4 fill-current" /> Stop recording
                </button>
              )}
              {voice.blobUrl && !voice.recording && (
                <span className="flex-1 text-xs text-muted-foreground px-3">Voice note ready — send or discard</span>
              )}
            </div>
          ) : (
            /* Text mode */
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
          )}

          {/* Send */}
          <button
            onClick={() => requireAuth(() => postMut.mutate())}
            disabled={postMut.isPending || uploadingVoice || (mode === 'text' ? (!text.trim() && !imgUrl) : !voice.blobUrl)}
            className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center disabled:opacity-40 active:scale-95 transition-all"
            style={{ background: 'hsl(222 47% 18%)' }}
          >
            {(postMut.isPending || uploadingVoice)
              ? <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              : <Send className="w-4 h-4" style={{ color: 'hsl(43 74% 66%)' }} />
            }
          </button>
        </div>
      </div>
    </>
  );
}

