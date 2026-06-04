import React from 'react';
import { useParams, useOutletContext, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { BookOpen, PlayCircle, CheckCircle2, Lock, ChevronRight, ArrowLeft, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { toast } from 'sonner';

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
      <div className="bg-card rounded-2xl border border-border p-6 lg:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center gap-6">
          <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <BookOpen className="w-8 h-8 text-primary" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="secondary" className="text-[10px]">{subject.form_name || 'Form'}</Badge>
              {subject.is_premium && (
                <Badge className="text-[10px] bg-accent/10 text-accent border-accent/20">Premium</Badge>
              )}
            </div>
            <h1 className="text-2xl font-display font-bold">{subject.name}</h1>
            {subject.description && (
              <p className="text-muted-foreground text-sm mt-1">{subject.description}</p>
            )}
            <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
              <span>{topics.length} topics</span>
              <span>{totalLessons} lessons</span>
              {subject.teacher_name && <span>By {subject.teacher_name}</span>}
            </div>
          </div>
          <div className="flex flex-col items-end gap-3">
            {enrollment ? (
              <div className="text-center">
                <div className="text-3xl font-bold text-primary font-display">{progressPct}%</div>
                <p className="text-xs text-muted-foreground">Complete</p>
                <Progress value={progressPct} className="w-32 h-2 mt-2" />
              </div>
            ) : (
              <Button onClick={() => enrollMutation.mutate()} className="bg-primary hover:bg-primary/90">
                Enroll Now
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Topics & Lessons */}
      <div className="bg-card rounded-xl border border-border">
        <div className="p-5 border-b border-border">
          <h2 className="font-display font-semibold text-lg">Course Content</h2>
          <p className="text-xs text-muted-foreground mt-1">
            {topics.length} topics · {totalLessons} lessons
          </p>
        </div>
        <Accordion type="multiple" className="px-2">
          {topics.map((topic, idx) => {
            const topicLessons = lessonsByTopic[topic.id] || [];
            const completedInTopic = topicLessons.filter(l => completedLessons.includes(l.id)).length;
            return (
              <AccordionItem key={topic.id} value={topic.id}>
                <AccordionTrigger className="px-4 py-3 hover:no-underline">
                  <div className="flex items-center gap-3 text-left">
                    <span className="w-7 h-7 rounded-full bg-muted text-xs font-bold flex items-center justify-center flex-shrink-0">
                      {idx + 1}
                    </span>
                    <div>
                      <p className="font-medium text-sm">{topic.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {topicLessons.length} lessons · {completedInTopic}/{topicLessons.length} done
                      </p>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-3">
                  <div className="space-y-1 ml-10">
                    {topicLessons.map(lesson => {
                      const isCompleted = completedLessons.includes(lesson.id);
                      const isLocked = !enrollment && !lesson.is_free;
                      return (
                        <Link
                          key={lesson.id}
                          to={isLocked ? '#' : `/lesson/${lesson.id}`}
                          className={`flex items-center gap-3 p-2.5 rounded-lg text-sm transition-colors ${
                            isLocked ? 'opacity-50 cursor-not-allowed' : 'hover:bg-muted/50'
                          }`}
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
                          ) : isLocked ? (
                            <Lock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          ) : (
                            <PlayCircle className="w-4 h-4 text-primary flex-shrink-0" />
                          )}
                          <span className="flex-1">{lesson.title}</span>
                          <div className="flex items-center gap-2">
                            {lesson.is_free && (
                              <Badge variant="secondary" className="text-[9px]">Free</Badge>
                            )}
                            {lesson.estimated_minutes > 0 && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="w-3 h-3" />{lesson.estimated_minutes}m
                              </span>
                            )}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </div>
    </div>
  );
}