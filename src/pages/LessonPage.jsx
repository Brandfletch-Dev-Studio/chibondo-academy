import React, { useState, useRef, useEffect } from 'react';
import { useParams, useOutletContext, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  ArrowLeft, ArrowRight, CheckCircle2, Download, MessageSquare,
  BookOpen, PlayCircle, FileText, Clock, Lock, ChevronDown,
  ChevronRight, Menu, X, Layers, Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import LessonDiscussion from '@/components/lesson/LessonDiscussion';
import { cn } from '@/lib/utils';

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

function VideoPlayer({ lesson }) {
  const { video_url, video_provider } = lesson;
  if (!video_url) return null;

  // YouTube — extract ID properly
  const ytId = getYouTubeId(video_url);
  if (ytId) {
    return (
      <div className="relative aspect-video bg-black w-full">
        <iframe
          src={`https://www.youtube.com/embed/${ytId}?rel=0&modestbranding=1&color=white&enablejsapi=1`}
          className="absolute inset-0 w-full h-full"
          allow={EMBED_ALLOW}
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          title={lesson.title}
        />
      </div>
    );
  }

  // Bunny.net stream embed
  if (video_provider === 'bunny' || video_url?.includes('iframe.mediadelivery.net') || video_url?.includes('b-cdn.net')) {
    return (
      <div className="relative aspect-video bg-black w-full">
        <iframe
          src={video_url}
          className="absolute inset-0 w-full h-full"
          allow={EMBED_ALLOW}
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          title={lesson.title}
        />
      </div>
    );
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

// ─── SIDEBAR LESSON ITEM ──────────────────────────────────────────────────────
function SidebarLesson({ lesson, currentLessonId, completed, locked }) {
  const isActive = lesson.id === currentLessonId;
  const isDone = completed.includes(lesson.id);

  return (
    <Link
      to={locked ? '#' : `/lesson/${lesson.id}`}
      className={cn(
        'flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs transition-all group',
        isActive ? 'bg-primary text-primary-foreground' : locked
          ? 'opacity-40 cursor-not-allowed'
          : 'hover:bg-white/5 text-sidebar-foreground/80 hover:text-sidebar-foreground'
      )}
    >
      <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
        {isDone ? (
          <Check className={cn('w-3.5 h-3.5', isActive ? 'text-primary-foreground' : 'text-success')} />
        ) : locked ? (
          <Lock className="w-3 h-3" />
        ) : lesson.video_url ? (
          <PlayCircle className={cn('w-3.5 h-3.5', isActive ? 'text-primary-foreground' : 'text-primary')} />
        ) : (
          <FileText className={cn('w-3.5 h-3.5', isActive ? 'text-primary-foreground' : 'text-muted-foreground')} />
        )}
      </span>
      <span className="flex-1 leading-snug truncate">{lesson.title}</span>
      {lesson.estimated_minutes > 0 && (
        <span className={cn('flex-shrink-0 text-[10px]', isActive ? 'text-primary-foreground/60' : 'text-muted-foreground')}>
          {lesson.estimated_minutes}m
        </span>
      )}
    </Link>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function LessonPage() {
  const { lessonId } = useParams();
  const { user } = useOutletContext();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('notes');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [expandedTopics, setExpandedTopics] = useState({});

  const { data: lesson } = useQuery({
    queryKey: ['lesson', lessonId],
    queryFn: async () => {
      const results = await base44.entities.Lesson.filter({ id: lessonId });
      return results[0];
    },
  });

  const { data: allLessons = [] } = useQuery({
    queryKey: ['subjectLessons', lesson?.subject_id],
    queryFn: () => base44.entities.Lesson.filter({ subject_id: lesson.subject_id }, 'order', 200),
    enabled: !!lesson?.subject_id,
    onSuccess: (lessons) => {
      // Auto-expand the topic containing the current lesson
      const currentLesson = lessons.find(l => l.id === lessonId);
      if (currentLesson?.topic_id) {
        setExpandedTopics(prev => ({ ...prev, [currentLesson.topic_id]: true }));
      }
    },
  });

  const { data: topics = [] } = useQuery({
    queryKey: ['topics', lesson?.subject_id],
    queryFn: () => base44.entities.Topic.filter({ subject_id: lesson.subject_id }, 'order', 100),
    enabled: !!lesson?.subject_id,
  });

  const { data: enrollment } = useQuery({
    queryKey: ['enrollment', user?.id, lesson?.subject_id],
    queryFn: async () => {
      const results = await base44.entities.Enrollment.filter({ student_id: user.id, subject_id: lesson.subject_id });
      return results[0] || null;
    },
    enabled: !!user?.id && !!lesson?.subject_id,
  });

  const { data: subscription } = useQuery({
    queryKey: ['subscription', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const results = await base44.entities.Subscription.filter({ student_id: user.id, status: 'active' });
      if (!results[0]) return null;
      // Check if subscription is actually still valid (end_date not passed)
      const sub = results[0];
      if (sub.end_date && new Date(sub.end_date) < new Date()) return null;
      return sub;
    },
    enabled: !!user?.id,
  });

  const hasPaidFees = !!subscription;

  // Every lesson is locked unless student has active subscription
  const isLessonLocked = () => !hasPaidFees;

  const markCompleteMutation = useMutation({
    mutationFn: async () => {
      if (!enrollment) return;
      const completed = [...(enrollment.completed_lessons || [])];
      if (!completed.includes(lessonId)) completed.push(lessonId);
      const pct = allLessons.length > 0 ? Math.round((completed.length / allLessons.length) * 100) : 0;
      await base44.entities.Enrollment.update(enrollment.id, {
        completed_lessons: completed,
        progress_percentage: pct,
        last_lesson_id: lessonId,
        last_accessed: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enrollment'] });
      toast.success('Lesson marked as complete!');
    },
  });

  const completedLessons = enrollment?.completed_lessons || [];
  const currentIndex = allLessons.findIndex(l => l.id === lessonId);
  const prevLesson = currentIndex > 0 ? allLessons[currentIndex - 1] : null;
  const nextLesson = currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null;
  const isCompleted = completedLessons.includes(lessonId);
  const progressPct = allLessons.length > 0 ? Math.round((completedLessons.length / allLessons.length) * 100) : 0;

  // Group lessons by topic
  const lessonsByTopic = {};
  allLessons.forEach(l => {
    if (!lessonsByTopic[l.topic_id]) lessonsByTopic[l.topic_id] = [];
    lessonsByTopic[l.topic_id].push(l);
  });

  const toggleTopic = (topicId) => setExpandedTopics(prev => ({ ...prev, [topicId]: !prev[topicId] }));

  // Auto-expand the topic containing the current lesson
  React.useEffect(() => {
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

  // ── HARD GATE: block direct access if no active subscription ──────────────
  const dataLoaded = subscription !== undefined;
  if (dataLoaded && isLessonLocked()) {
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
  const isTextLesson = !hasVideo;

  return (
    <div className="flex flex-col lg:flex-row min-h-0 -mx-4 sm:-mx-6 lg:-mx-8 -mt-6">
      {/* ── SIDEBAR ──────────────────────────────────────────────────── */}
      <aside className={cn(
        'bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex-shrink-0 flex flex-col transition-all duration-300',
        'lg:sticky lg:top-0 lg:h-screen',
        sidebarOpen ? 'lg:w-72' : 'lg:w-0 lg:overflow-hidden',
        'hidden lg:flex'
      )}>
        {/* Sidebar header */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-sidebar-border flex-shrink-0">
          <Link to={`/subjects/${lesson.subject_id}`} className="flex items-center gap-2 text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors min-w-0">
            <ArrowLeft className="w-4 h-4 flex-shrink-0" />
            <span className="text-xs font-semibold truncate">{lesson.subject_name || 'Course'}</span>
          </Link>
        </div>

        {/* Progress */}
        <div className="px-4 py-3 border-b border-sidebar-border flex-shrink-0">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-sidebar-foreground/60">Course progress</span>
            <span className="font-bold text-sidebar-primary">{progressPct}%</span>
          </div>
          <Progress value={progressPct} className="h-1.5 bg-sidebar-border" />
          <p className="text-[10px] text-sidebar-foreground/40 mt-1.5">{completedLessons.length} of {allLessons.length} lessons done</p>
        </div>

        {/* Topic + lesson list */}
        <nav className="flex-1 overflow-y-auto py-2 px-2">
          {topics.length === 0 ? (
            allLessons.map(l => (
              <SidebarLesson key={l.id} lesson={l} currentLessonId={lessonId} completed={completedLessons} locked={isLessonLocked(l)} />
            ))
          ) : topics.map((topic, tIdx) => {
            const tLessons = lessonsByTopic[topic.id] || [];
            const isOpen = expandedTopics[topic.id];
            const doneCount = tLessons.filter(l => completedLessons.includes(l.id)).length;
            return (
              <div key={topic.id} className="mb-1">
                <button
                  onClick={() => toggleTopic(topic.id)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors text-left"
                >
                  <span className="w-5 h-5 rounded-full bg-sidebar-primary/20 text-sidebar-primary text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                    {tIdx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-sidebar-foreground truncate">{topic.title}</p>
                    <p className="text-[10px] text-sidebar-foreground/40">{doneCount}/{tLessons.length}</p>
                  </div>
                  <ChevronRight className={cn('w-3.5 h-3.5 text-sidebar-foreground/30 transition-transform flex-shrink-0', isOpen && 'rotate-90')} />
                </button>
                {isOpen && (
                  <div className="ml-2 pl-3 border-l border-sidebar-border/50 py-1 space-y-0.5">
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

      {/* ── MAIN CONTENT ──────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10">
          <button
            onClick={() => setSidebarOpen(v => !v)}
            className="hidden lg:flex items-center justify-center w-8 h-8 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
          >
            <Menu className="w-4 h-4" />
          </button>
          <Link to={`/subjects/${lesson.subject_id}`} className="lg:hidden flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-3.5 h-3.5" /> {lesson.subject_name}
          </Link>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground truncate">{lesson.topic_title || 'Lesson'}</p>
            <p className="text-sm font-semibold truncate leading-tight">{lesson.title}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {lesson.estimated_minutes > 0 && (
              <span className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />{lesson.estimated_minutes}m
              </span>
            )}
            {enrollment && (
              <Button
                onClick={() => markCompleteMutation.mutate()}
                variant={isCompleted ? 'secondary' : 'default'}
                size="sm"
                disabled={isCompleted || markCompleteMutation.isPending}
                className="text-xs h-8"
              >
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                {isCompleted ? 'Done' : 'Mark Complete'}
              </Button>
            )}
          </div>
        </div>

        {/* Video / Content */}
        <div className="flex-1">
          {/* Video */}
          {hasVideo && (
            <div className="w-full bg-black">
              <VideoPlayer lesson={lesson} />
            </div>
          )}

          {/* Lesson info beneath video */}
          <div className="p-4 sm:p-6 lg:p-8 space-y-6">
            {/* Title + meta */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  {hasVideo ? (
                    <Badge className="text-[10px] bg-primary/10 text-primary border-primary/20 gap-1">
                      <PlayCircle className="w-3 h-3" /> Video
                    </Badge>
                  ) : (
                    <Badge className="text-[10px] bg-muted text-muted-foreground border-border gap-1">
                      <FileText className="w-3 h-3" /> Reading
                    </Badge>
                  )}
                  {lesson.estimated_minutes > 0 && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {lesson.estimated_minutes} min
                    </span>
                  )}
                  {isCompleted && (
                    <Badge className="text-[10px] bg-success/10 text-success border-success/20 gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Completed
                    </Badge>
                  )}
                </div>
                <h1 className="text-xl lg:text-2xl font-display font-bold leading-snug">{lesson.title}</h1>
                {lesson.description && (
                  <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{lesson.description}</p>
                )}
              </div>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="bg-muted">
                <TabsTrigger value="notes" className="gap-1.5 text-xs">
                  <BookOpen className="w-3.5 h-3.5" /> Notes
                </TabsTrigger>
                {lesson.attachments?.length > 0 && (
                  <TabsTrigger value="downloads" className="gap-1.5 text-xs">
                    <Download className="w-3.5 h-3.5" /> Files ({lesson.attachments.length})
                  </TabsTrigger>
                )}
                <TabsTrigger value="discussion" className="gap-1.5 text-xs">
                  <MessageSquare className="w-3.5 h-3.5" /> Discussion
                </TabsTrigger>
              </TabsList>

              <TabsContent value="notes" className="mt-4">
                <div className="bg-card rounded-2xl border border-border p-6 lg:p-8">
                  {lesson.content ? (
                    <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: lesson.content }} />
                  ) : (
                    <div className="text-center py-12">
                      <BookOpen className="w-10 h-10 mx-auto text-muted-foreground/20 mb-3" />
                      <p className="text-sm text-muted-foreground">No notes for this lesson yet.</p>
                    </div>
                  )}
                </div>
              </TabsContent>

              {lesson.attachments?.length > 0 && (
                <TabsContent value="downloads" className="mt-4">
                  <div className="bg-card rounded-2xl border border-border p-5 space-y-2">
                    {lesson.attachments.map((file, idx) => (
                      <a
                        key={idx}
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors group"
                      >
                        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Download className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{file.name}</p>
                          {file.type && <p className="text-xs text-muted-foreground uppercase">{file.type}</p>}
                        </div>
                        <ArrowRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                      </a>
                    ))}
                  </div>
                </TabsContent>
              )}

              <TabsContent value="discussion" className="mt-4">
                <LessonDiscussion lessonId={lessonId} user={user} subjectId={lesson.subject_id} />
              </TabsContent>
            </Tabs>

            {/* Navigation */}
            <div className="grid grid-cols-2 gap-3 pt-4 border-t border-border">
              {prevLesson ? (
                <Link to={`/lesson/${prevLesson.id}`}>
                  <div className="flex items-center gap-3 p-4 rounded-2xl border border-border hover:bg-muted/50 transition-colors group h-full">
                    <ArrowLeft className="w-5 h-5 text-muted-foreground group-hover:text-foreground flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Previous</p>
                      <p className="text-sm font-semibold truncate leading-tight mt-0.5">{prevLesson.title}</p>
                    </div>
                  </div>
                </Link>
              ) : <div />}

              {nextLesson ? (
                <Link to={`/lesson/${nextLesson.id}`}>
                  <div className="flex items-center gap-3 p-4 rounded-2xl border border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors group justify-end text-right h-full">
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wide text-primary font-medium">Next Lesson</p>
                      <p className="text-sm font-semibold truncate leading-tight mt-0.5">{nextLesson.title}</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-primary flex-shrink-0" />
                  </div>
                </Link>
              ) : (
                <div className="flex items-center gap-3 p-4 rounded-2xl border border-success/30 bg-success/5">
                  <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-success">Course Complete!</p>
                    <p className="text-xs text-muted-foreground">You've reached the end</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}