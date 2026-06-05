import React from 'react';
import { useParams, useOutletContext, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { BookOpen, PlayCircle, CheckCircle2, Lock, ArrowLeft, Clock, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { toast } from 'sonner';
import FeesGateCard from '@/components/subscription/FeesGateCard';

export default function SubjectDetail() {
  const { subjectId } = useParams();
  const { user } = useOutletContext();
  const queryClient = useQueryClient();

  const { data: subject } = useQuery({
    queryKey: ['subject', subjectId],
    queryFn: async () => {
      const results = await base44.entities.Subject.filter({ id: subjectId });
      return results[0];
    },
  });

  const { data: topics = [] } = useQuery({
    queryKey: ['topics', subjectId],
    queryFn: () => base44.entities.Topic.filter({ subject_id: subjectId }, 'order', 100),
  });

  const { data: lessons = [] } = useQuery({
    queryKey: ['lessons', subjectId],
    queryFn: () => base44.entities.Lesson.filter({ subject_id: subjectId }, 'order', 200),
  });

  const { data: enrollment } = useQuery({
    queryKey: ['enrollment', user?.id, subjectId],
    queryFn: async () => {
      if (!user?.id) return null;
      const results = await base44.entities.Enrollment.filter({ student_id: user.id, subject_id: subjectId });
      return results[0] || null;
    },
    enabled: !!user?.id,
  });

  const { data: subscription } = useQuery({
    queryKey: ['subscription', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const results = await base44.entities.Subscription.filter({ student_id: user.id, status: 'active' });
      return results[0] || null;
    },
    enabled: !!user?.id,
  });

  const { data: platformSettings } = useQuery({
    queryKey: ['platformSettings', 'pricing'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getPricing', {});
      return res.data.pricing;
    },
  });

  const hasPaidFees = subscription?.status === 'active';
  const freeLessonsPerSubject = platformSettings?.free_lessons_per_subject ?? 2;

  const enrollMutation = useMutation({
    mutationFn: () => base44.entities.Enrollment.create({
      student_id: user.id,
      subject_id: subjectId,
      subject_name: subject?.name,
      form_id: subject?.form_id,
      form_name: subject?.form_name,
      completed_lessons: [],
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enrollment'] });
      toast.success('Enrolled successfully!');
    },
  });

  const lessonsByTopic = {};
  lessons.forEach(l => {
    if (!lessonsByTopic[l.topic_id]) lessonsByTopic[l.topic_id] = [];
    lessonsByTopic[l.topic_id].push(l);
  });

  const completedLessons = enrollment?.completed_lessons || [];
  const totalLessons = lessons.length;
  const progressPct = totalLessons > 0 ? Math.round((completedLessons.length / totalLessons) * 100) : 0;

  if (!subject) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link to="/subjects" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Subjects
      </Link>

      {/* Subject Header */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        {/* Banner */}
        {subject.cover_image ? (
          <div className="h-40 lg:h-56 w-full relative">
            <img src={subject.cover_image} alt={subject.name} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          </div>
        ) : (
          <div className="h-32 lg:h-44 w-full bg-gradient-to-br from-primary via-primary/80 to-primary/60 flex items-center justify-center">
            <BookOpen className="w-16 h-16 text-primary-foreground/30" />
          </div>
        )}
        <div className="p-6 lg:p-8">
          <div className="flex flex-col lg:flex-row lg:items-start gap-6">
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <Badge variant="secondary" className="text-[10px]">{subject.form_name || 'Form'}</Badge>
                {subject.is_premium && (
                  <Badge className="text-[10px] bg-accent/10 text-accent border-accent/20">Premium</Badge>
                )}
              </div>
              <h1 className="text-2xl lg:text-3xl font-display font-bold">{subject.name}</h1>
              {subject.description && (
                <p className="text-muted-foreground text-sm mt-2 leading-relaxed max-w-2xl">{subject.description}</p>
              )}
              <div className="flex flex-wrap items-center gap-4 mt-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5"><BookOpen className="w-4 h-4" />{topics.length} topics · {totalLessons} lessons</span>
                {subject.teacher_name && <span>Taught by <span className="font-medium text-foreground">{subject.teacher_name}</span></span>}
              </div>
            </div>
            <div className="flex flex-col items-start lg:items-end gap-3 flex-shrink-0">
              {enrollment ? (
                <div className="bg-muted/50 rounded-xl p-4 text-center min-w-[120px]">
                  <div className="text-3xl font-bold text-primary font-display">{progressPct}%</div>
                  <p className="text-xs text-muted-foreground mb-2">Complete</p>
                  <Progress value={progressPct} className="h-2" />
                </div>
              ) : (
                <Button onClick={() => enrollMutation.mutate()} className="bg-primary hover:bg-primary/90 px-8">
                  Enroll Now
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Fees Gate — shown when subject is premium and student hasn't paid */}
      {subject.is_premium && !hasPaidFees && (
        <FeesGateCard />
      )}

      {/* Topics & Lessons */}
      <div className="rounded-2xl border border-border overflow-hidden bg-card">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-display font-semibold text-lg">Course Content</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{topics.length} units · {totalLessons} lessons</p>
        </div>
        <Accordion type="multiple" defaultValue={topics.map(t => t.id)}>
          {topics.map((topic, idx) => {
            const topicLessons = lessonsByTopic[topic.id] || [];
            return (
              <AccordionItem key={topic.id} value={topic.id} className="border-0 border-b border-border last:border-b-0">
                {/* Topic header — blue tinted row like the screenshot */}
                <AccordionTrigger className="px-5 py-4 hover:no-underline bg-primary/5 hover:bg-primary/10 transition-colors [&>svg]:text-primary">
                  <span className="text-primary font-semibold text-sm text-left leading-snug">
                    Unit {idx + 1}: {topic.title}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="p-0">
                  {topicLessons.map((lesson, lessonIdx) => {
                    const isCompleted = completedLessons.includes(lesson.id);
                    const isSampleLesson = lesson.is_free || lessonIdx < freeLessonsPerSubject;
                    const isLocked = !hasPaidFees && !isSampleLesson;
                    const hasVideo = !!lesson.video_url;

                    // Format duration as MM:SS if stored as minutes, else show raw
                    const duration = lesson.estimated_minutes > 0
                      ? `${String(Math.floor(lesson.estimated_minutes)).padStart(2, '0')}:00`
                      : null;

                    return (
                      <Link
                        key={lesson.id}
                        to={isLocked ? '#' : `/lesson/${lesson.id}`}
                        className={`flex items-center gap-3 px-5 py-3.5 border-b border-border/50 last:border-b-0 text-sm transition-colors ${
                          isLocked
                            ? 'cursor-not-allowed opacity-60'
                            : 'hover:bg-muted/40'
                        } ${isCompleted ? 'bg-success/5' : ''}`}
                      >
                        {/* Format icon */}
                        <span className="flex-shrink-0 text-muted-foreground">
                          {isCompleted ? (
                            <CheckCircle2 className="w-4 h-4 text-success" />
                          ) : hasVideo ? (
                            <PlayCircle className="w-4 h-4" />
                          ) : (
                            <FileText className="w-4 h-4" />
                          )}
                        </span>

                        {/* Title */}
                        <span className="flex-1 leading-snug text-foreground">{lesson.title}</span>

                        {/* Duration */}
                        {duration && (
                          <span className="text-xs text-muted-foreground flex-shrink-0 tabular-nums">{duration}</span>
                        )}

                        {/* Lock / Free badge */}
                        <span className="flex-shrink-0">
                          {isLocked ? (
                            <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                          ) : isSampleLesson && !hasPaidFees ? (
                            <Badge className="text-[9px] bg-success/10 text-success border-success/20 px-1.5">Free</Badge>
                          ) : null}
                        </span>
                      </Link>
                    );
                  })}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </div>
    </div>
  );
}