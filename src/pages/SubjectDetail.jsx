import React, { useState } from 'react';
import { useParams, useOutletContext, Link, Navigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { BookOpen, PlayCircle, CheckCircle2, Lock, ArrowLeft, FileText, Eye, Share2, Copy, Check, GraduationCap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { toast } from 'sonner';
import FeesGateCard from '@/components/subscription/FeesGateCard';
import SEO from '@/components/SEO';

export default function SubjectDetail() {
  const { subjectId } = useParams();
  const { user } = useOutletContext();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);

  // Get user's referral code for sharing
  const referralCode = user?.referral_code || (user?.id ? `CHIB-${user.id.slice(-6).toUpperCase()}` : '');

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
      if (!results[0]) return null;
      const sub = results[0];
      if (sub.end_date && new Date(sub.end_date) < new Date()) return null;
      return sub;
    },
    enabled: !!user?.id,
  });

  const hasPaidFees = !!subscription;

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
    },
  });

  // Auto-enroll when student clicks a lesson (if not already enrolled)
  const handleLessonClick = async (lessonId) => {
    if (!user) {
      // Guest - redirect to login
      const nextUrl = encodeURIComponent(`/lesson/${lessonId}`);
      window.location.href = `/login?next=${nextUrl}`;
      return;
    }
    if (!hasPaidFees) {
      // Redirect to subscription page for unpaid users
      window.location.href = '/subscription';
      return;
    }
    if (!enrollment) {
      await enrollMutation.mutateAsync();
    }
  };

  // Share functions with affiliate tracking
  const shareLink = `${window.location.origin}/subjects/${subjectId}?ref=${referralCode}`;
  
  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Link copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: `Study ${subject.name} - Chibondo Academy`,
        text: `Join me at Chibondo Academy to master ${subject.name}! Use my referral code ${referralCode} when registering.`,
        url: shareLink,
      });
    } else {
      handleCopy(shareLink);
    }
  };

  const handleWhatsApp = () => {
    const message = `📚 Study ${subject.name} at Chibondo Academy!\n\nJoin me to access quality lessons and course materials.\n\nUse my referral code ${referralCode} when registering.\n\n${shareLink}`;
    const encoded = encodeURIComponent(message);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  };

  const lessonsByTopic = {};
  lessons.forEach(l => {
    if (!lessonsByTopic[l.topic_id]) lessonsByTopic[l.topic_id] = [];
    lessonsByTopic[l.topic_id].push(l);
  });

  const completedLessons = enrollment?.completed_lessons || [];
  const totalLessons = lessons.length;
  const progressPct = totalLessons > 0 ? Math.round((completedLessons.length / totalLessons) * 100) : 0;

  // Find first lesson for CTA
  const firstLesson = lessons.length > 0 ? lessons[0] : null;

  if (!subject) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  // Guest users can view but not enroll - show login prompt on enroll attempt
  const handleGuestEnroll = () => {
    if (!user) {
      // Store intended action and redirect to login
      const nextUrl = encodeURIComponent(`/subjects/${subjectId}`);
      window.location.href = `/login?next=${nextUrl}`;
      return;
    }
    if (!hasPaidFees) {
      window.location.href = '/subscription';
      return;
    }
    if (!enrollment) {
      enrollMutation.mutate();
    }
  };

  return (
    <div className="space-y-6">
      <SEO 
        title={`${subject.name} - ${subject.form_name || 'Form'} Course`}
        description={subject.description || `Study ${subject.name} with Chibondo Academy. Access quality lessons, videos, and course materials for MSCE students.`}
        image={subject.cover_image}
        type="course"
        article={{
          author: subject.teacher_name,
          section: subject.form_name,
        }}
      />
      
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
          <div className="flex flex-col gap-4">
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
                <AccordionTrigger className="px-5 py-4 hover:no-underline bg-primary/5 hover:bg-primary/10 transition-colors [&>svg]:text-primary">
                  <span className="text-primary font-semibold text-sm text-left leading-snug">
                    Unit {idx + 1}: {topic.title}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="p-0">
                  {topicLessons.map((lesson) => {
                    const isCompleted = completedLessons.includes(lesson.id);
                    const isLocked = !hasPaidFees;
                    const hasVideo = !!lesson.video_url;

                    const duration = lesson.estimated_minutes > 0
                      ? `${String(Math.floor(lesson.estimated_minutes)).padStart(2, '0')}:00`
                      : null;

                    return (
                      <Link
                        key={lesson.id}
                        to={isLocked ? (user ? '/subscription' : `/login?next=/lesson/${lesson.id}`) : `/lesson/${lesson.id}`}
                        onClick={() => !isLocked && handleLessonClick(lesson.id)}
                        className={`flex items-center gap-3 px-5 py-3.5 border-b border-border/50 last:border-b-0 text-sm transition-colors ${
                          isLocked ? 'opacity-60 hover:bg-muted/20' : 'hover:bg-muted/40'
                        } ${isCompleted ? 'bg-success/5' : ''}`}
                      >
                        <span className="flex-shrink-0 text-muted-foreground">
                          {isCompleted ? (
                            <CheckCircle2 className="w-4 h-4 text-success" />
                          ) : hasVideo ? (
                            <PlayCircle className="w-4 h-4" />
                          ) : (
                            <FileText className="w-4 h-4" />
                          )}
                        </span>

                        <span className="flex-1 leading-snug text-foreground">{lesson.title}</span>

                        {duration && (
                          <span className="text-xs text-muted-foreground flex-shrink-0 tabular-nums">{duration}</span>
                        )}

                        <span className="flex-shrink-0">
                          {isLocked ? (
                            <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                          ) : (
                            <Eye className="w-3.5 h-3.5 text-primary" />
                          )}
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

      {/* Progress Bar & Start Learning CTA - Bottom of page */}
      {enrollment && totalLessons > 0 && (
        <div className="space-y-4">
          {/* Progress Section */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display font-semibold text-lg">Your Progress</h3>
              <span className="text-3xl font-bold text-primary font-display">{progressPct}%</span>
            </div>
            <Progress value={progressPct} className="h-3 mb-2" />
            <p className="text-sm text-muted-foreground">
              {completedLessons.length} of {totalLessons} lessons completed
            </p>
          </div>

          {/* Start Learning CTA */}
          <div className="bg-gradient-to-br from-primary to-primary/80 rounded-2xl p-6 text-primary-foreground">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                <GraduationCap className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="font-display font-bold text-xl mb-2">Ready to Start Learning?</h3>
                <p className="text-sm text-primary-foreground/80 mb-4">
                  {hasPaidFees 
                    ? `Jump into your first lesson and begin your ${subject.name} journey!`
                    : 'Subscribe to unlock all lessons and start learning.'}
                </p>
                <div className="flex flex-wrap gap-3">
                  {hasPaidFees && firstLesson ? (
                    <Link to={`/lesson/${firstLesson.id}`}>
                      <Button className="bg-white text-primary hover:bg-white/90 px-8">
                        <PlayCircle className="w-4 h-4 mr-2" />
                        Start Learning
                      </Button>
                    </Link>
                  ) : (
                    <Link to="/subscription">
                      <Button className="bg-white text-primary hover:bg-white/90 px-8">
                        Subscribe Now
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Share Buttons */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <h3 className="font-display font-semibold mb-4">Share This Course</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Invite friends using your referral link. They'll get registered under your code automatically!
            </p>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                onClick={() => handleCopy(shareLink)}
                className="flex-1 min-w-[140px]"
              >
                {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                {copied ? 'Copied!' : 'Copy Link'}
              </Button>
              <Button
                variant="outline"
                onClick={handleWhatsApp}
                className="flex-1 min-w-[140px] bg-green-500/10 text-green-600 hover:bg-green-500/20 border-green-500/20"
              >
                <Share2 className="w-4 h-4 mr-2" />
                WhatsApp
              </Button>
              <Button
                variant="outline"
                onClick={handleShare}
                className="flex-1 min-w-[140px]"
              >
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </Button>
            </div>
            <div className="mt-4 p-3 bg-muted/50 rounded-xl">
              <p className="text-xs font-mono text-muted-foreground break-all">{shareLink}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}