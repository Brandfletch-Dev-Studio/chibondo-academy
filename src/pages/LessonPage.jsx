import React, { useState } from 'react';
import { useParams, useOutletContext, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ArrowLeft, ArrowRight, CheckCircle2, Download, MessageSquare, BookOpen, PlayCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import LessonDiscussion from '@/components/lesson/LessonDiscussion';

export default function LessonPage() {
  const { lessonId } = useParams();
  const { user } = useOutletContext();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('notes');

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
  });

  const { data: enrollment } = useQuery({
    queryKey: ['enrollment', user?.id, lesson?.subject_id],
    queryFn: async () => {
      const results = await base44.entities.Enrollment.filter({ student_id: user.id, subject_id: lesson.subject_id });
      return results[0] || null;
    },
    enabled: !!user?.id && !!lesson?.subject_id,
  });

  const markCompleteMutation = useMutation({
    mutationFn: async () => {
      if (!enrollment) return;
      const completed = [...(enrollment.completed_lessons || [])];
      if (!completed.includes(lessonId)) {
        completed.push(lessonId);
      }
      const total = allLessons.length;
      const pct = total > 0 ? Math.round((completed.length / total) * 100) : 0;
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

  const currentIndex = allLessons.findIndex(l => l.id === lessonId);
  const prevLesson = currentIndex > 0 ? allLessons[currentIndex - 1] : null;
  const nextLesson = currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null;
  const isCompleted = enrollment?.completed_lessons?.includes(lessonId);

  if (!lesson) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to={`/subjects/${lesson.subject_id}`} className="hover:text-foreground transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3 h-3" />
          {lesson.subject_name || 'Subject'}
        </Link>
        <span>/</span>
        <span>{lesson.topic_title || 'Topic'}</span>
      </div>

      {/* Lesson Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-display font-bold">{lesson.title}</h1>
          {lesson.description && (
            <p className="text-sm text-muted-foreground mt-1">{lesson.description}</p>
          )}
        </div>
        {enrollment && (
          <Button
            onClick={() => markCompleteMutation.mutate()}
            variant={isCompleted ? "secondary" : "default"}
            size="sm"
            disabled={isCompleted}
          >
            <CheckCircle2 className="w-4 h-4 mr-1.5" />
            {isCompleted ? 'Completed' : 'Mark Complete'}
          </Button>
        )}
      </div>

      {/* Video Player */}
      {lesson.video_url && (
        <div className="rounded-xl overflow-hidden bg-black aspect-video">
          {lesson.video_provider === 'youtube' ? (
            <iframe
              src={lesson.video_url.replace('watch?v=', 'embed/')}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <video src={lesson.video_url} controls className="w-full h-full" />
          )}
        </div>
      )}

      {/* Tabs: Notes, Downloads, Discussion */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-muted">
          <TabsTrigger value="notes" className="gap-1.5">
            <BookOpen className="w-3.5 h-3.5" /> Notes
          </TabsTrigger>
          {lesson.attachments?.length > 0 && (
            <TabsTrigger value="downloads" className="gap-1.5">
              <Download className="w-3.5 h-3.5" /> Downloads
            </TabsTrigger>
          )}
          <TabsTrigger value="discussion" className="gap-1.5">
            <MessageSquare className="w-3.5 h-3.5" /> Discussion
          </TabsTrigger>
        </TabsList>

        <TabsContent value="notes" className="mt-4">
          <div className="bg-card rounded-xl border border-border p-6 lg:p-8">
            {lesson.content ? (
              <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: lesson.content }} />
            ) : (
              <p className="text-muted-foreground text-sm text-center py-8">No notes available for this lesson yet.</p>
            )}
          </div>
        </TabsContent>

        {lesson.attachments?.length > 0 && (
          <TabsContent value="downloads" className="mt-4">
            <div className="bg-card rounded-xl border border-border p-6 space-y-3">
              {lesson.attachments.map((file, idx) => (
                <a
                  key={idx}
                  href={file.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <Download className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">{file.name}</span>
                  <Badge variant="secondary" className="text-[10px] ml-auto">{file.type || 'File'}</Badge>
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
          <Link to={`/lesson/${prevLesson.id}`} className="block">
            <div className="flex items-center gap-3 p-4 rounded-xl border border-border hover:bg-muted/50 transition-colors group">
              <ArrowLeft className="w-5 h-5 text-muted-foreground group-hover:text-foreground flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Previous</p>
                <p className="text-sm font-semibold truncate leading-tight mt-0.5">{prevLesson.title}</p>
              </div>
            </div>
          </Link>
        ) : <div />}
        {nextLesson ? (
          <Link to={`/lesson/${nextLesson.id}`} className="block">
            <div className="flex items-center gap-3 p-4 rounded-xl border border-primary/40 bg-primary/5 hover:bg-primary/10 transition-colors group justify-end text-right">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wide text-primary font-medium">Next</p>
                <p className="text-sm font-semibold truncate leading-tight mt-0.5">{nextLesson.title}</p>
              </div>
              <ArrowRight className="w-5 h-5 text-primary flex-shrink-0" />
            </div>
          </Link>
        ) : (
          <div className="flex items-center gap-3 p-4 rounded-xl border border-success/30 bg-success/5">
            <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-success">All done!</p>
              <p className="text-xs text-muted-foreground">You've reached the end</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}