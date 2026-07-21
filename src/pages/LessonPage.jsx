import React, { useState, useEffect } from 'react';
import { useParams, useOutletContext, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/api/supabaseClient';
import {
  ArrowLeft, ArrowRight, CheckCircle2, Download, MessageSquare,
  BookOpen, PlayCircle, FileText, Clock, Lock, ChevronDown,
  ChevronRight, Menu, X, Layers, Check, FileDown, ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import LessonDiscussion from '@/components/lesson/LessonDiscussion';
import LessonComments from '@/components/lesson/LessonComments';
import { cn } from '@/lib/utils';
import SEO from '@/components/SEO';

// ─── VIDEO UTILS ──────────────────────────────────────────────────────────────
function getYouTubeId(url) {
  if (!url) return null;
  const patterns = [
    /youtu\.be\/([^?#&]+)/,
    /youtube\.com\/watch\?v=([^?#&]+)/,
    /youtube\.com\/embed\/([^?#&]+)/,
    /youtube\.com\/v\/([^?#&]+)/,
    /youtube\.com\/shorts\/([^?#&]+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

const EMBED_ALLOW = "accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; gyroscope; picture-in-picture; web-share; screen-wake-lock";

// ─── BUNNY PLAYER — polls encoding status before showing iframe ────────────────
function BunnyPlayer({ videoUrl, lesson }) {
  const [bunnyStatus, setBunnyStatus] = useState(null); // null=checking, 'ready', 'encoding', 'failed'
  const [progress, setProgress]       = useState(0);
  const [pollCount, setPollCount]     = useState(0);

  // Extract libraryId and videoId from the embed URL
  // Format: https://iframe.mediadelivery.net/embed/{libraryId}/{videoId}
  const match = videoUrl?.match(/iframe\.mediadelivery\.net\/embed\/([^/]+)\/([^?#]+)/);
  const libraryId = match?.[1];
  const videoId   = match?.[2] || lesson?.bunny_video_id;

  // Get stored API key for status check
  const apiKey = typeof window !== 'undefined' ? localStorage.getItem('bunny_api_key') : null;

  useEffect(() => {
    if (!libraryId || !videoId || !apiKey) {
      // No credentials — just show the iframe and hope it's ready
      setBunnyStatus('ready');
      return;
    }

    let cancelled = false;
    let timer = null;

    async function checkStatus() {
      try {
        const params = new URLSearchParams({ libraryId, videoId, apiKey });
        const r = await fetch(`/api/bunny?action=status&${params}`);
        if (!r.ok) { setBunnyStatus('ready'); return; } // fallback to show iframe
        const data = await r.json();
        if (cancelled) return;

        const st = data.status; // 'queued','processing','encoding','ready','failed'
        setProgress(data.encodeProgress || 0);
        setBunnyStatus(st);

        // Keep polling if still encoding (every 8 seconds, max 30 polls = ~4 min)
        if ((st === 'encoding' || st === 'processing' || st === 'queued') && pollCount < 30) {
          setPollCount(c => c + 1);
          timer = setTimeout(checkStatus, 8000);
        }
      } catch {
        setBunnyStatus('ready'); // network error — show iframe anyway
      }
    }

    checkStatus();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [libraryId, videoId, apiKey]);

  // Still checking
  if (bunnyStatus === null) {
    return (
      <div className="relative aspect-video bg-black w-full flex items-center justify-center">
        <div className="text-center text-white/70 space-y-3">
          <svg className="w-8 h-8 mx-auto animate-spin opacity-60" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
          <p className="text-sm font-medium">Loading video…</p>
        </div>
      </div>
    );
  }

  // Still encoding
  if (bunnyStatus === 'encoding' || bunnyStatus === 'processing' || bunnyStatus === 'queued') {
    return (
      <div className="relative aspect-video w-full flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg, #0d1b4b 0%, #1a2f6b 100%)' }}>
        <div className="text-center space-y-4 px-6 max-w-sm">
          {/* Animated progress ring */}
          <div className="relative w-20 h-20 mx-auto">
            <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6"/>
              <circle cx="40" cy="40" r="34" fill="none" stroke="#D4AF37" strokeWidth="6"
                strokeDasharray={`${2 * Math.PI * 34}`}
                strokeDashoffset={`${2 * Math.PI * 34 * (1 - (progress || 5) / 100)}`}
                strokeLinecap="round" className="transition-all duration-1000"/>
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-white font-bold text-sm">{progress || '…'}%</span>
            </div>
          </div>
          <div>
            <p className="text-white font-semibold text-sm">Video is Processing</p>
            <p className="text-white/60 text-xs mt-1">
              This video is being encoded by our servers.
              It will be ready in a few minutes — please check back shortly.
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 text-white/40 text-xs">
            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            Auto-refreshing…
          </div>
        </div>
      </div>
    );
  }

  // Encoding failed
  if (bunnyStatus === 'failed') {
    return (
      <div className="relative aspect-video w-full flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg, #1a0505 0%, #2d0a0a 100%)' }}>
        <div className="text-center space-y-3 px-6 max-w-sm">
          <div className="w-14 h-14 rounded-full bg-red-900/50 flex items-center justify-center mx-auto">
            <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <p className="text-white font-semibold text-sm">Video Encoding Failed</p>
          <p className="text-white/50 text-xs">
            This video could not be processed. Please contact your teacher or admin.
          </p>
        </div>
      </div>
    );
  }

  // Ready — show the actual iframe
  return (
    <div className="relative aspect-video bg-black w-full">
      <iframe
        src={videoUrl}
        className="absolute inset-0 w-full h-full"
        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        title={lesson?.title || 'Video lesson'}
      />
    </div>
  );
}

function VideoPlayer({ lesson }) {
  const { video_url, video_provider } = lesson;
  if (!video_url) return null;

  // YouTube — extract ID properly
  const ytId = getYouTubeId(video_url);
  if (ytId) {
    const ytParams = [
      'rel=0',
      'modestbranding=1',
      'iv_load_policy=3',
      'disablekb=1',
      'fs=1',
      'playsinline=1',
      'vq=hd1080',
      'cc_load_policy=0',
      'color=white',
      'controls=1',
      `origin=${encodeURIComponent(window.location.origin)}`,
    ].join('&');
    return (
      <div
        className="relative aspect-video bg-black w-full select-none"
        onContextMenu={e => e.preventDefault()}
      >
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${ytId}?${ytParams}`}
          className="absolute inset-0 w-full h-full pointer-events-auto"
          allow={EMBED_ALLOW}
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          title={lesson.title}
          loading="lazy"
        />
        {/* Transparent overlay — blocks right-click context menu on the iframe */}
        <div
          className="absolute inset-0 pointer-events-none"
          onContextMenu={e => e.preventDefault()}
          style={{ zIndex: 1 }}
        />
      </div>
    );
  }

  // Bunny.net stream embed — with encoding-state awareness
  if (video_provider === 'bunny' || video_url?.includes('iframe.mediadelivery.net') || video_url?.includes('b-cdn.net')) {
    return <BunnyPlayer videoUrl={video_url} lesson={lesson} />;
  }

  // Vimeo
  if (video_url?.includes('vimeo.com')) {
    const vimeoId = video_url.match(/vimeo\.com\/(\d+)/)?.[1];
    const embedUrl = vimeoId ? `https://player.vimeo.com/video/${vimeoId}?title=0&byline=0&portrait=0` : video_url;
    return (
      <div className="relative aspect-video bg-black w-full">
        <iframe
          src={embedUrl}
          className="absolute inset-0 w-full h-full"
          allow={EMBED_ALLOW}
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          title={lesson.title}
        />
      </div>
    );
  }

  // Loom
  if (video_url?.includes('loom.com')) {
    const embedUrl = video_url.replace('loom.com/share/', 'loom.com/embed/');
    return (
      <div className="relative aspect-video bg-black w-full">
        <iframe
          src={embedUrl}
          className="absolute inset-0 w-full h-full"
          allow={EMBED_ALLOW}
          allowFullScreen
          title={lesson.title}
        />
      </div>
    );
  }

  // Direct video file (mp4, webm, ogg, mov, mkv, etc.)
  const isDirectVideo = /\.(mp4|webm|ogg|ogv|mov|m4v|avi|mkv|3gp|flv)(\?|$)/i.test(video_url);
  if (video_provider === 'upload' || isDirectVideo) {
    return (
      <div className="relative aspect-video bg-black w-full">
        <video
          src={video_url}
          controls
          className="absolute inset-0 w-full h-full"
          playsInline
          preload="metadata"
        >
          <source src={video_url} type="video/mp4" />
          <source src={video_url} type="video/webm" />
          <source src={video_url} type="video/ogg" />
        </video>
      </div>
    );
  }

  // Generic iframe fallback (any other embed URL)
  return (
    <div className="relative aspect-video bg-black w-full">
      <iframe
        src={video_url}
        className="absolute inset-0 w-full h-full"
        allow={EMBED_ALLOW}
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        title={lesson.title}
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-presentation"
      />
    </div>
  );
}

// ─── GUEST VIDEO GATE ────────────────────────────────────────────────────────
function GuestVideoGate({ lesson }) {
  return (
    <div className="relative w-full bg-black" style={{ aspectRatio: '16/9' }}>
      {lesson.thumbnail_url || lesson.cover_image ? (
        <img
          src={lesson.thumbnail_url || lesson.cover_image}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          style={{ filter: 'blur(8px)', transform: 'scale(1.05)', opacity: 0.4 }}
        />
      ) : (
        <div className="absolute inset-0" style={{ background: 'hsl(var(--sidebar-background))' }} />
      )}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="w-16 h-16 rounded-full flex items-center justify-center"
          style={{ background: 'hsl(var(--muted))', border: '2px solid hsl(var(--primary))' }}>
          <Lock className="w-7 h-7" style={{ color: 'hsl(var(--primary))' }} />
        </div>
        <div>
          <p className="text-white font-semibold text-base mb-1">Create an account to watch this lesson</p>
          <p className="text-white/60 text-sm">Join free — track progress, access all subjects, and more.</p>
        </div>
        <a href="/register">
          <button
            className="mt-1 h-11 px-8 rounded-full text-sm font-semibold transition-opacity hover:opacity-90 active:scale-95"
            style={{ background:'hsl(var(--primary))', color:'hsl(var(--primary-foreground))' }}
          >
            Start Learning
          </button>
        </a>
        <a href="/login" className="text-xs underline" style={{ color: 'hsl(215 20% 60%)' }}>
          Already have an account? Log in
        </a>
      </div>
    </div>
  );
}

// ─── SIDEBAR LESSON ITEM ──────────────────────────────────────────────────────
function SidebarLesson({ lesson, currentLessonId, completed, locked }) {
  const isActive = lesson.id === currentLessonId;
  const isDone = completed.includes(lesson.id);

  return (
    <Link
      to={locked ? '#' : `/lesson/${lesson.id}`}
      onClick={(e) => {
        if (locked) {
          e.preventDefault();
          toast.error('This lesson is locked. Please pay fees to unlock.');
        }
      }}
      className={cn(
        'flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs transition-all group border-l-2',
        isActive
          ? 'bg-primary/10 text-primary border-primary font-medium'
          : 'border-transparent',
        locked
          ? 'opacity-50 cursor-not-allowed'
          : 'hover:bg-card/40 text-sidebar-foreground/80 hover:text-sidebar-foreground'
      )}
    >
      <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
        {isDone ? (
          <Check className="w-3.5 h-3.5 text-green-500 font-bold" />
        ) : locked ? (
          <Lock className="w-3 h-3 text-muted-foreground/60" />
        ) : lesson.video_url ? (
          <PlayCircle className={cn('w-3.5 h-3.5', isActive ? 'text-primary' : 'text-primary/70')} />
        ) : (
          <FileText className={cn('w-3.5 h-3.5', isActive ? 'text-primary' : 'text-muted-foreground')} />
        )}
      </span>
      <span className="flex-1 leading-snug truncate">{lesson.title}</span>
      {lesson.estimated_minutes > 0 && (
        <span className={cn('flex-shrink-0 text-[10px]', isActive ? 'text-primary/70' : 'text-muted-foreground')}>
          {lesson.estimated_minutes}m
        </span>
      )}
    </Link>
  );
}

// ─── PROSE/NOTES STYLES ──────────────────────────────────────────────────────
const proseStyles = `
  .lesson-prose h1, .lesson-prose h2, .lesson-prose h3 { font-weight: 700; margin: 1.2em 0 0.5em; color: hsl(var(--foreground)); }
  .lesson-prose h2 { font-size: 1.2em; border-bottom: 2px solid hsl(var(--primary) / 0.3); padding-bottom: 0.3em; }
  .lesson-prose p { margin: 0.75em 0; line-height: 1.75; }
  .lesson-prose ul, .lesson-prose ol { margin: 0.75em 0 0.75em 1.5em; }
  .lesson-prose li { margin: 0.4em 0; }
  .lesson-prose strong { color: hsl(var(--primary)); }
  .lesson-prose table { width: 100%; border-collapse: collapse; margin: 1em 0; font-size: 0.9em; }
  .lesson-prose th { background: hsl(var(--primary) / 0.1); padding: 0.5em 0.75em; border: 1px solid hsl(var(--border)); font-weight: 600; text-align: left; }
  .lesson-prose td { padding: 0.5em 0.75em; border: 1px solid hsl(var(--border)); }
  .lesson-prose code { background: hsl(var(--muted)); padding: 0.15em 0.4em; border-radius: 4px; font-family: monospace; font-size: 0.85em; }
  .lesson-prose blockquote { border-left: 3px solid hsl(var(--primary)); padding-left: 1em; margin: 1em 0; color: hsl(var(--muted-foreground)); font-style: italic; }
  .lesson-prose img { max-width: 100%; border-radius: 8px; margin: 1em 0; }
`;

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function LessonPage() {
  const { lessonId } = useParams();
  const { user } = useOutletContext() ?? {};
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('notes');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [expandedTopics, setExpandedTopics] = useState({});
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const { data: lesson } = useQuery({
    queryKey: ['lesson', lessonId],
    queryFn: async () => {
      const results = await db.entities.Lesson.filter({ id: lessonId });
      return results[0];
    },
  });

  const { data: allLessons = [] } = useQuery({
    queryKey: ['subjectLessons', lesson?.subject_id],
    queryFn: async () => { try { return await db.entities.Lesson.filter({ subject_id: lesson.subject_id }, 'order', 200); } catch(e) { console.error(e); return []; } },
    enabled: !!lesson?.subject_id,
    onSuccess: (lessons) => {
      const currentLesson = lessons.find(l => l.id === lessonId);
      if (currentLesson?.topic_id) {
        setExpandedTopics(prev => ({ ...prev, [currentLesson.topic_id]: true }));
      }
    },
  });

  const { data: topics = [] } = useQuery({
    queryKey: ['topics', lesson?.subject_id],
    queryFn: async () => { try { return await db.entities.Topic.filter({ subject_id: lesson?.subject_id }, 'order', 200); } catch(e) { console.error(e); return []; } },
    enabled: !!lesson?.subject_id,
  });

  const { data: enrollment } = useQuery({
    queryKey: ['enrollment', user?.id, lesson?.subject_id],
    queryFn: async () => {
      const results = await db.entities.Enrollment.filter({ student_id: user.id, subject_id: lesson.subject_id });
      return results[0] || null;
    },
    enabled: !!user?.id && !!lesson?.subject_id,
  });

  const { data: subscription } = useQuery({
    queryKey: ['subscription', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const results = await db.entities.Subscription.filter({ student_id: user.id, status: 'active' });
      if (!results[0]) return null;
      const sub = results[0];
      if (sub.end_date && new Date(sub.end_date) < new Date()) return null;
      return sub;
    },
    enabled: !!user?.id,
  });

  const hasPaidFees = !!subscription;

  const isLessonLocked = () => !!user && !hasPaidFees;

  const markCompleteMutation = useMutation({
    mutationFn: async () => {
      let enr = enrollment;
      if (!enr && lesson?.subject_id) {
        enr = await db.entities.Enrollment.create({
          student_id: user.id,
          subject_id: lesson.subject_id,
          subject_name: lesson.subject_name,
          completed_lessons: [],
          status: 'active',
          progress_percentage: 0,
        });
      }
      if (!enr) return { pct: 0 };

      const completed = [...(enr.completed_lessons || [])];
      if (!completed.includes(lessonId)) completed.push(lessonId);
      const pct = allLessons.length > 0 ? Math.round((completed.length / allLessons.length) * 100) : 0;
      await db.entities.Enrollment.update(enr.id, {
        completed_lessons: completed,
        progress_percentage: pct,
        last_lesson_id: lessonId,
        last_accessed: new Date().toISOString(),
        status: pct === 100 ? 'completed' : 'active',
      });
      return { pct, completed };
    },
    onSuccess: ({ pct, completed }) => {
      queryClient.invalidateQueries({ queryKey: ['enrollment'] });
      if (pct === 100) {
        toast.success('🎉 Course completed! Well done!', { duration: 5000 });
      } else {
        toast.success('✓ Lesson complete!');
        if (nextLesson) {
          setTimeout(() => navigate(`/lesson/${nextLesson.id}`), 800);
        }
      }
    },
    onError: () => toast.error('Could not save progress. Try again.'),
  });

  const completedLessons = enrollment?.completed_lessons || [];
  const currentIndex = allLessons.findIndex(l => l.id === lessonId);
  const prevLesson = currentIndex > 0 ? allLessons[currentIndex - 1] : null;
  const nextLesson = currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null;
  const isCompleted = completedLessons.includes(lessonId);
  const progressPct = allLessons.length > 0 ? Math.round((completedLessons.length / allLessons.length) * 100) : 0;

  const lessonsByTopic = {};
  allLessons.forEach(l => {
    if (!lessonsByTopic[l.topic_id]) lessonsByTopic[l.topic_id] = [];
    lessonsByTopic[l.topic_id].push(l);
  });

  const toggleTopic = (topicId) => setExpandedTopics(prev => ({ ...prev, [topicId]: !prev[topicId] }));

  useEffect(() => {
    if (lesson?.topic_id) {
      setExpandedTopics(prev => ({ ...prev, [lesson.topic_id]: true }));
    }
  }, [lesson?.topic_id]);

  if (!lesson) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const dataLoaded = subscription !== undefined || !user;
  if (user && dataLoaded && isLessonLocked()) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Lock className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-xl font-display font-bold">Pay Fees to Access This Lesson</h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          All lessons are available exclusively to students who have paid their school fees.
          Pay now to unlock everything on the platform.
        </p>
        <div className="flex gap-3 flex-wrap justify-center">
          <Link to="/subscription">
            <Button className="px-8">Pay Fees Now</Button>
          </Link>
          <Link to={`/subjects/${lesson.subject_id}`}>
            <Button variant="outline">Back to Course</Button>
          </Link>
        </div>
      </div>
    );
  }

  const hasVideo = !!lesson.video_url;
  const lessonTitle = lesson.seo_title || lesson.title;
  const lessonDesc  = lesson.seo_description
    || (lesson.content || '').replace(/<[^>]+>/g, '').slice(0, 160)
    || `Watch and study: ${lesson.title}. Part of Chibondo Academy's MSCE curriculum.`;
  const lessonUrl   = `${window.location.origin}/lesson/${lessonId}`;

  const currentCountText = allLessons.length > 0 
    ? `${completedLessons.length}/${allLessons.length}`
    : '0/0';

  return (
    <>
      <style>{proseStyles}</style>
      <SEO
        title={lessonTitle}
        description={lessonDesc}
        canonical={lessonUrl}
        ogType="article"
        ogImage={lesson.og_image || lesson.thumbnail || undefined}
        ogImageOverride={lesson.og_image || undefined}
        ogTitle={lesson.og_title || lessonTitle}
        ogDescription={lesson.og_description || lessonDesc}
        keywords={lesson.seo_keywords || `${lesson.title}, MSCE, Chibondo Academy`}
      />

      <div className="flex flex-col lg:flex-row min-h-screen -mx-4 sm:-mx-6 lg:-mx-8 bg-background text-foreground relative pb-32 lg:pb-0">
        
        {/* 1. MOBILE TOP BAR (sticky) */}
        <div className="sticky top-0 z-40 w-full bg-card/95 backdrop-blur-md border-b border-border lg:hidden flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 h-14">
            <Link to={`/subjects/${lesson.subject_id}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground min-w-0 max-w-[40%]">
              <ArrowLeft className="w-5 h-5 flex-shrink-0" />
              <span className="text-xs font-semibold truncate leading-none">{lesson.subject_name || 'Subject'}</span>
            </Link>
            
            <div className="flex-1 px-2 text-center min-w-0 max-w-[35%]">
              <p className="text-[10px] text-muted-foreground truncate leading-none mb-0.5">{lesson.topic_title || 'Topic'}</p>
              <h2 className="text-xs font-bold truncate leading-none">{lesson.title}</h2>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-xs font-semibold px-2 py-1 rounded-full bg-muted text-muted-foreground">
                {currentCountText}
              </span>
              {user && enrollment && (
                <Button
                  onClick={() => markCompleteMutation.mutate()}
                  variant={isCompleted ? 'secondary' : 'default'}
                  size="sm"
                  disabled={isCompleted || markCompleteMutation.isPending}
                  className="h-8 text-xs font-semibold px-3"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 sm:mr-1" />
                  <span className="hidden sm:inline">{isCompleted ? 'Done' : 'Complete'}</span>
                </Button>
              )}
            </div>
          </div>
          <div className="w-full h-1 bg-muted">
            <div 
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* ── 6. DESKTOP SIDEBAR (lg:flex, hidden on mobile) ──────────────── */}
        <aside className={cn(
          'bg-[#0d1420] text-slate-200 border-r border-slate-800 flex-shrink-0 flex flex-col transition-all duration-300',
          'lg:sticky lg:top-0 lg:h-screen',
          sidebarOpen ? 'lg:w-80' : 'lg:w-0 lg:overflow-hidden',
          'hidden lg:flex'
        )}>
          <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-800 flex-shrink-0">
            <Link to={`/subjects/${lesson.subject_id}`} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors min-w-0">
              <ArrowLeft className="w-4 h-4 flex-shrink-0" />
              <span className="text-xs font-semibold truncate">{lesson.subject_name || 'Course'}</span>
            </Link>
          </div>

          {user && (
            <div className="px-5 py-4 border-b border-slate-800 flex-shrink-0 bg-slate-900/40">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-slate-400">Course progress</span>
                <span className="font-bold text-primary">{progressPct}%</span>
              </div>
              <Progress value={progressPct} className="h-1.5 bg-slate-800" />
              <p className="text-[10px] text-slate-500 mt-1.5">{completedLessons.length} of {allLessons.length} lessons done</p>
            </div>
          )}

          <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-1">
            {topics.length === 0 ? (
              allLessons.map(l => (
                <SidebarLesson key={l.id} lesson={l} currentLessonId={lessonId} completed={completedLessons} locked={isLessonLocked(l)} />
              ))
            ) : topics.map((topic, tIdx) => {
              const tLessons = lessonsByTopic[topic.id] || [];
              const isOpen = expandedTopics[topic.id];
              const doneCount = tLessons.filter(l => completedLessons.includes(l.id)).length;
              return (
                <div key={topic.id} className="mb-2">
                  <button
                    onClick={() => toggleTopic(topic.id)}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-slate-800/50 transition-colors text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Topic {tIdx + 1}</p>
                      <h4 className="text-xs font-semibold text-slate-300 truncate mt-0.5">{topic.title}</h4>
                    </div>
                    <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
                      <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-medium">
                        {doneCount}/{tLessons.length}
                      </span>
                      {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                    </div>
                  </button>
                  {isOpen && (
                    <div className="mt-1 pl-2 border-l border-slate-800 space-y-0.5">
                      {tLessons.map(l => (
                        <SidebarLesson
                          key={l.id}
                          lesson={l}
                          currentLessonId={lessonId}
                          completed={completedLessons}
                          locked={isLessonLocked(l)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </aside>

        {/* ── MAIN CONTENT AREA ────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 flex flex-col bg-background">
          
          <div className="hidden lg:flex items-center justify-between px-6 py-4 border-b border-border bg-card/40 sticky top-0 z-20 backdrop-blur-md">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => setSidebarOpen(v => !v)}
                className="flex items-center justify-center w-9 h-9 rounded-lg border border-border hover:bg-muted transition-colors text-muted-foreground"
              >
                <Menu className="w-4 h-4" />
              </button>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{lesson.topic_title || 'Topic'}</p>
                <h1 className="text-lg font-bold truncate">{lesson.title}</h1>
              </div>
            </div>
            
            <div className="flex items-center gap-4 flex-shrink-0">
              {lesson.estimated_minutes > 0 && (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                  <Clock className="w-3.5 h-3.5 text-primary" />{lesson.estimated_minutes}m duration
                </span>
              )}
              {user && enrollment && (
                <Button
                  onClick={() => markCompleteMutation.mutate()}
                  variant={isCompleted ? 'secondary' : 'default'}
                  size="default"
                  disabled={isCompleted || markCompleteMutation.isPending}
                  className="font-semibold text-xs h-9 px-4 gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {isCompleted ? 'Completed' : 'Mark Complete'}
                </Button>
              )}
            </div>
          </div>

          {/* 2. VIDEO PLAYER AREA */}
          <div className="w-full bg-black lg:sticky lg:top-[65px] z-30 shadow-md">
            {hasVideo ? (
              <div className="w-full">
                {!user ? (
                  <GuestVideoGate lesson={lesson} />
                ) : (
                  <VideoPlayer lesson={lesson} />
                )}
              </div>
            ) : (
              <div className="bg-slate-900 border-b border-border py-12 px-6 flex flex-col items-center justify-center text-center">
                <FileText className="w-16 h-16 text-primary mb-4" />
                <h3 className="text-lg font-bold text-white">Reading Lesson</h3>
                <p className="text-sm text-slate-400 max-w-md mt-1">
                  This lesson is structured as study notes. Access full materials, files, and discussion tabs below.
                </p>
              </div>
            )}
            
            <div className="bg-card/40 border-b border-border px-4 py-2.5 flex items-center gap-2 flex-wrap text-xs">
              <Badge variant="secondary" className="gap-1 font-semibold text-[11px] py-0.5">
                {hasVideo ? <PlayCircle className="w-3.5 h-3.5" /> : <BookOpen className="w-3.5 h-3.5" />}
                {hasVideo ? 'Video' : 'Reading'}
              </Badge>
              {lesson.estimated_minutes > 0 && (
                <Badge variant="outline" className="gap-1 text-[11px] py-0.5">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                  {lesson.estimated_minutes} min
                </Badge>
              )}
              {isCompleted ? (
                <Badge className="bg-green-500/10 text-green-500 border-green-500/20 gap-1 text-[11px] py-0.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Completed
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[11px] py-0.5 text-muted-foreground">
                  In Progress
                </Badge>
              )}
            </div>
          </div>

          {/* MAIN PAGE BODY CONTENT */}
          <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mr-auto w-full space-y-8">
            
            {/* 3. LESSON HEADER */}
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wider text-primary font-bold">
                  {lesson.topic_title || 'Topic Content'}
                </p>
                <h1 className="text-2xl sm:text-3xl font-display font-extrabold leading-tight">
                  {lesson.title}
                </h1>
              </div>
              
              {lesson.description && (
                <p className="text-sm text-muted-foreground leading-relaxed bg-muted/30 p-4 rounded-xl border border-border/50">
                  {lesson.description}
                </p>
              )}

              <div className="flex items-center gap-2 flex-wrap pt-2">
                {user && enrollment && (
                  <Button
                    onClick={() => markCompleteMutation.mutate()}
                    variant={isCompleted ? 'secondary' : 'default'}
                    disabled={isCompleted || markCompleteMutation.isPending}
                    className="h-10 text-xs font-bold px-4"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-1.5" />
                    {isCompleted ? 'Completed' : 'Mark Complete'}
                  </Button>
                )}
                {nextLesson && (
                  <Button
                    variant="outline"
                    onClick={() => navigate(`/lesson/${nextLesson.id}`)}
                    className="h-10 text-xs font-semibold px-4"
                  >
                    Next Lesson <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                  </Button>
                )}
                {prevLesson && (
                  <Button
                    variant="ghost"
                    onClick={() => navigate(`/lesson/${prevLesson.id}`)}
                    className="h-10 text-xs font-semibold px-3 text-muted-foreground hover:text-foreground"
                  >
                    <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Previous
                  </Button>
                )}
              </div>
            </div>

            {/* 4. CONTENT TABS */}
            <div className="space-y-4">
              <div className="flex border-b border-border overflow-x-auto scrollbar-none">
                <button
                  onClick={() => setActiveTab('notes')}
                  className={cn(
                    "flex items-center gap-2 py-3 px-4 text-xs font-bold transition-all relative border-b-2 whitespace-nowrap min-h-[44px]",
                    activeTab === 'notes' ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  <BookOpen className="w-4 h-4" />
                  <span>Notes</span>
                </button>
                <button
                  onClick={() => setActiveTab('discussion')}
                  className={cn(
                    "flex items-center gap-2 py-3 px-4 text-xs font-bold transition-all relative border-b-2 whitespace-nowrap min-h-[44px]",
                    activeTab === 'discussion' ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Discussion</span>
                </button>
                {user && lesson.attachments?.length > 0 && (
                  <button
                    onClick={() => setActiveTab('downloads')}
                    className={cn(
                      "flex items-center gap-2 py-3 px-4 text-xs font-bold transition-all relative border-b-2 whitespace-nowrap min-h-[44px]",
                      activeTab === 'downloads' ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Download className="w-4 h-4" />
                    <span>Files ({lesson.attachments.length})</span>
                  </button>
                )}
              </div>

              <div className="pt-2">
                {activeTab === 'notes' && (
                  <div className="bg-card rounded-2xl border border-border p-6 lg:p-8 shadow-sm">
                    {lesson.content ? (
                      !user ? (
                        <div className="relative">
                          <div 
                            className="lesson-prose max-w-none pointer-events-none select-none"
                            style={{ maxHeight: '8rem', overflow: 'hidden', maskImage: 'linear-gradient(to bottom, black 30%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, black 30%, transparent 100%)' }}
                            dangerouslySetInnerHTML={{ __html: lesson.content }}
                          />
                          <div className="mt-4 rounded-xl p-6 text-center border border-primary bg-card shadow-lg">
                            <BookOpen className="w-10 h-10 mx-auto mb-3 text-primary" />
                            <p className="text-sm font-bold text-foreground">Sign in to read the full notes</p>
                            <p className="text-xs text-muted-foreground mb-4">Create a free account to access all lesson notes, resources, and track progress.</p>
                            <div className="flex gap-2 justify-center">
                              <a href="/register">
                                <Button size="sm" className="font-semibold text-xs h-9 px-5">
                                  Start Learning
                                </Button>
                              </a>
                              <a href="/login">
                                <Button variant="outline" size="sm" className="font-semibold text-xs h-9 px-5">
                                  Login
                                </Button>
                              </a>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="lesson-prose max-w-none" dangerouslySetInnerHTML={{ __html: lesson.content }} />
                      )
                    ) : (
                      <div className="text-center py-16">
                        <BookOpen className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                        <p className="text-sm font-medium text-muted-foreground">No notes for this lesson yet.</p>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'discussion' && (
                  <LessonComments lessonId={lessonId} user={user} />
                )}

                {activeTab === 'downloads' && user && (
                  <div className="bg-card rounded-2xl border border-border p-6 shadow-sm space-y-3">
                    <h3 className="text-sm font-bold text-foreground mb-3">Downloadable Resources</h3>
                    {lesson.attachments.map((file, idx) => (
                      <a
                        key={idx}
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3.5 rounded-xl border border-border/80 hover:bg-muted/50 transition-colors group min-h-[44px]"
                      >
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <FileDown className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold truncate group-hover:text-primary transition-colors">{file.name}</p>
                          {file.type && <p className="text-[10px] text-muted-foreground uppercase mt-0.5 tracking-wider font-semibold">{file.type}</p>}
                        </div>
                        <ExternalLink className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {!user && (
              <div className="rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4 border border-primary bg-card/60 shadow-lg">
                <div className="text-center sm:text-left">
                  <p className="font-bold text-base text-foreground">Ready to start learning?</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Create a free account to enrol, track progress and access resources.</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <a href="/login">
                    <Button variant="outline" className="h-10 text-xs font-semibold px-5">
                      Login
                    </Button>
                  </a>
                  <a href="/register">
                    <Button className="h-10 text-xs font-bold px-5">
                      Start Learning
                    </Button>
                  </a>
                </div>
              </div>
            )}

            {/* 5. NEXT/PREV LESSON NAVIGATION CARD */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-6 border-t border-border">
              {prevLesson ? (
                <Link to={`/lesson/${prevLesson.id}`}>
                  <div className="flex items-center gap-3 p-5 rounded-2xl border border-border hover:bg-muted/30 transition-all group h-full min-h-[44px]">
                    <ArrowLeft className="w-5 h-5 text-muted-foreground group-hover:text-foreground flex-shrink-0 transition-transform group-hover:-translate-x-1" />
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Previous Lesson</p>
                      <p className="text-xs font-bold truncate mt-1 text-foreground leading-snug">{prevLesson.title}</p>
                    </div>
                  </div>
                </Link>
              ) : (
                <div className="p-5 rounded-2xl border border-dashed border-border flex items-center justify-center text-muted-foreground/40 text-xs h-full">
                  First Lesson of Subject
                </div>
              )}

              {nextLesson ? (
                <Link to={`/lesson/${nextLesson.id}`}>
                  <div className="flex items-center gap-3 p-5 rounded-2xl border-2 border-primary/40 bg-primary/5 hover:bg-primary/10 hover:border-primary transition-all group justify-end text-right h-full min-h-[44px]">
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-primary font-bold">Next Lesson</p>
                      <p className="text-xs font-bold truncate mt-1 text-foreground leading-snug">{nextLesson.title}</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-primary flex-shrink-0 transition-transform group-hover:translate-x-1" />
                  </div>
                </Link>
              ) : (
                <div className="flex items-center gap-3 p-5 rounded-2xl border border-green-500/30 bg-green-500/5 text-green-500 justify-center">
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                  <div className="text-center">
                    <p className="text-xs font-bold">Course Completed!</p>
                    <p className="text-[10px] opacity-80">You have completed all lessons</p>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* 7. MOBILE COURSE CONTENT DRAWER FLOATING BUTTON */}
        <div className="lg:hidden fixed bottom-5 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-sm">
          <Button
            onClick={() => setMobileDrawerOpen(true)}
            className="w-full h-12 shadow-xl rounded-full bg-primary text-primary-foreground flex items-center justify-center gap-2 text-xs font-bold tracking-wide"
          >
            <Layers className="w-4 h-4 animate-pulse" />
            <span>📚 Course Content ({allLessons.length} lessons)</span>
          </Button>
        </div>

        {/* Floating Course Content Drawer Sheet overlay */}
        {mobileDrawerOpen && (
          <div className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center">
            <div className="absolute inset-0" onClick={() => setMobileDrawerOpen(false)} />
            
            <div className="relative bg-card text-foreground rounded-t-3xl w-full max-h-[85vh] flex flex-col shadow-2xl z-10 transition-transform duration-300 ease-out">
              <div className="mx-auto my-3 w-12 h-1.5 bg-muted rounded-full" />
              
              <div className="flex items-center justify-between px-5 pb-3 border-b border-border">
                <div>
                  <h3 className="text-sm font-bold text-foreground">Course Syllabus</h3>
                  <p className="text-[10px] text-muted-foreground">{lesson.subject_name}</p>
                </div>
                <button
                  onClick={() => setMobileDrawerOpen(false)}
                  className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 pb-16">
                {user && (
                  <div className="bg-muted/40 rounded-xl p-3 mb-2 flex items-center justify-between text-xs">
                    <span className="font-medium text-muted-foreground">Your progress</span>
                    <span className="font-extrabold text-primary">{progressPct}% ({completedLessons.length}/{allLessons.length})</span>
                  </div>
                )}

                {topics.length === 0 ? (
                  <div className="space-y-1">
                    {allLessons.map(l => (
                      <SidebarLesson 
                        key={l.id} 
                        lesson={l} 
                        currentLessonId={lessonId} 
                        completed={completedLessons} 
                        locked={isLessonLocked(l)} 
                      />
                    ))}
                  </div>
                ) : topics.map((topic, tIdx) => {
                  const tLessons = lessonsByTopic[topic.id] || [];
                  const doneCount = tLessons.filter(l => completedLessons.includes(l.id)).length;
                  return (
                    <div key={topic.id} className="bg-card border border-border/60 rounded-xl p-2.5">
                      <div className="flex items-center justify-between px-2 py-1">
                        <div className="min-w-0">
                          <p className="text-[9px] uppercase font-bold text-primary tracking-wider">Topic {tIdx + 1}</p>
                          <h4 className="text-xs font-bold text-foreground truncate">{topic.title}</h4>
                        </div>
                        <span className="text-[9px] font-bold bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                          {doneCount}/{tLessons.length}
                        </span>
                      </div>
                      <div className="mt-2 space-y-1 border-t border-border/40 pt-2">
                        {tLessons.map(l => (
                          <div key={l.id} onClick={() => setMobileDrawerOpen(false)}>
                            <SidebarLesson
                              lesson={l}
                              currentLessonId={lessonId}
                              completed={completedLessons}
                              locked={isLessonLocked(l)}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

      </div>
    </>
  );
}
