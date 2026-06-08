import React, { useState } from 'react';
import { useParams, useOutletContext, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { BookOpen, PlayCircle, CheckCircle2, Lock, ArrowLeft, FileText, Copy, Check, Share2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { toast } from 'sonner';
import FeesGateCard from '@/components/subscription/FeesGateCard';
import SEO from '@/components/SEO';

export default function SubjectDetail() {
  const { subjectId } = useParams();
  const { user } = useOutletContext() ?? {};
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [justEnrolled, setJustEnrolled] = useState(false);

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

  const isEnrolled = !!enrollment || justEnrolled;

  const enrollMutation = useMutation({
    mutationFn: async () => {
      const rec = await base44.entities.Enrollment.create({
        student_id: user.id,
        subject_id: subjectId,
        subject_name: subject?.name,
        form_id: subject?.form_id,
        form_name: subject?.form_name,
        completed_lessons: [],
        status: 'active',
        progress_percentage: 0,
        last_accessed: new Date().toISOString(),
      });
      try {
        await base44.entities.Subject.update(subjectId, {
          enrollment_count: (subject?.enrollment_count || 0) + 1,
        });
      } catch(_) {}
      return rec;
    },
    onSuccess: () => {
      setJustEnrolled(true);
      toast.success('✓ You have successfully joined this class.');
      queryClient.invalidateQueries({ queryKey: ['enrollment'] });
      queryClient.invalidateQueries({ queryKey: ['subject', subjectId] });
    },
    onError: () => toast.error('Could not join class. Please try again.'),
  });

  // Lesson row click — auto-enroll then navigate
  const handleLessonClick = async () => {
    if (!hasPaidFees) { navigate('/subscription'); return; }
    if (!isEnrolled) { await enrollMutation.mutateAsync(); }
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

  // ── Rich SEO & Structured Data ──────────────────────────────────────────
  const teacherName = subject.teacher_name || 'Chibondo Academy';
  const lessonCount = lessons.length;
  const topicCount  = topics.length;
  const metaTitle   = `${subject.name} | ${subject.form_name || 'MSCE'} | Chibondo Academy`;
  const metaDesc    = subject.description
    ? subject.description.replace(/<[^>]+>/g, '').slice(0, 160)
    : `Study ${subject.name} (${subject.form_name || 'Secondary'}) online at Chibondo Academy. ${lessonCount} lessons, ${topicCount} topics taught by ${teacherName}. Join now from MWK 10,000/month.`;
  const canonicalUrl = `${window.location.origin}/subjects/${subjectId}`;
  const keywords = [
    subject.name, subject.form_name, 'MSCE', 'Malawi secondary school',
    'online lessons Malawi', 'Chibondo Academy', teacherName,
    `${subject.name} notes`, `${subject.name} revision`,
  ].filter(Boolean).join(', ');

  const courseSchema = {
    "@context": "https://schema.org",
    "@type": "Course",
    "name": subject.name,
    "description": metaDesc,
    "url": canonicalUrl,
    "image": subject.cover_image || undefined,
    "keywords": keywords,
    "provider": {
      "@type": "Organization",
      "name": "Chibondo Academy",
      "url": window.location.origin,
      "logo": `${window.location.origin}/logo.png`
    },
    "instructor": {
      "@type": "Person",
      "name": teacherName
    },
    "educationalLevel": subject.form_name || "Secondary",
    "teaches": subject.name,
    "courseMode": "Online",
    "numberOfCredits": lessonCount,
    "hasCourseInstance": {
      "@type": "CourseInstance",
      "courseMode": "Online",
      "courseWorkload": `${lessonCount} lessons`
    },
    "offers": {
      "@type": "Offer",
      "category": subject.is_premium ? "Paid" : "Free",
      "priceCurrency": "MWK",
      "price": subject.is_premium ? "10000" : "0",
      "availability": "https://schema.org/InStock",
      "url": canonicalUrl
    }
  };

  return (
    <>
      <SEO
        title={metaTitle}
        description={metaDesc}
        canonical={canonicalUrl}
        ogImage={subject.cover_image || undefined}
        schema={courseSchema}
        keywords={keywords}
      />
      <div className="space-y-6">
        {/* Minimal Header */}
        <div className="flex items-center justify-between">
          <Link to="/subjects" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to Subjects
          </Link>
          {subject.is_premium && (
            <Badge className="text-[10px] bg-accent/10 text-accent border-accent/20">Premium</Badge>
          )}
        </div>

        {/* Simple Title */}
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold">{subject.name}</h1>
          {subject.form_name && (
            <p className="text-sm text-muted-foreground mt-1">{subject.form_name}</p>
          )}
        </div>

      {/* Thumbnail or Intro Video */}
      {subject.video_url ? (
        <div className="rounded-2xl overflow-hidden aspect-video bg-black">
          <iframe
            src={subject.video_url}
            className="w-full h-full"
            allowFullScreen
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          />
        </div>
      ) : subject.cover_image ? (
        <div className="rounded-2xl overflow-hidden aspect-video bg-muted">
          <img src={subject.cover_image} alt={subject.name} className="w-full h-full object-cover" />
        </div>
      ) : null}

      {/* Description */}
      {subject.description && (
        <p className="text-sm text-muted-foreground leading-relaxed">{subject.description}</p>
      )}

      {/* Simple Course Content */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="font-semibold text-base">Course Content</h2>
        </div>
        <Accordion type="multiple" defaultValue={topics.map(t => t.id)}>
          {topics.map((topic, idx) => {
            const topicLessons = lessonsByTopic[topic.id] || [];
            return (
              <AccordionItem key={topic.id} value={topic.id} className="border-0 border-b border-border last:border-b-0">
                <AccordionTrigger className="px-4 py-3 hover:no-underline [&>svg]:text-primary">
                  <span className="font-medium text-sm text-left">
                    {topic.title}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="p-0">
                  {topicLessons.map((lesson) => {
                    const isCompleted = completedLessons.includes(lesson.id);
                    const isLocked = !hasPaidFees;
                    const hasVideo = !!lesson.video_url;

                    return (
                      <Link
                        key={lesson.id}
                        to={isLocked ? '/subscription' : `/lesson/${lesson.id}`}
                        onClick={() => !isLocked && handleLessonClick()}
                        className={`flex items-center gap-3 px-4 py-2.5 border-b border-border/50 last:border-b-0 text-sm transition-colors hover:bg-muted/30 ${
                          isCompleted ? 'bg-success/5' : ''
                        }`}
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
                        <span className="flex-1 text-foreground">{lesson.title}</span>
                        {isLocked && <Lock className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />}
                      </Link>
                    );
                  })}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </div>

      {/* ── Enrollment count ── */}
      {(subject?.enrollment_count > 0) && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="w-4 h-4" />
          <span><span className="font-semibold text-foreground">{subject.enrollment_count.toLocaleString()}</span> students enrolled</span>
        </div>
      )}

      {/* ── Course Progress bar (only when enrolled) ── */}
      {isEnrolled && totalLessons > 0 && (
        <div className="bg-card border border-border rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold">Your Progress</span>
            <span className="font-bold text-primary">{progressPct}%</span>
          </div>
          <Progress value={progressPct} className="h-2.5" />
          <p className="text-xs text-muted-foreground">{completedLessons.length} of {totalLessons} lessons completed</p>
          {progressPct === 100 && (
            <div className="mt-2 p-3 rounded-xl text-center" style={{ background: 'hsl(160 60% 45% / 0.1)', border: '1px solid hsl(160 60% 45% / 0.2)' }}>
              <p className="text-sm font-bold text-green-600">🎉 Congratulations! You completed this course.</p>
            </div>
          )}
        </div>
      )}

      {/* ── MAIN CTA button ── */}
      {firstLesson && (
        <div className="space-y-3">
          {/* Scenario D: no subscription → pay gate */}
          {!hasPaidFees && (
            <Link to="/subscription">
              <Button className="w-full h-12 text-base font-semibold" size="lg"
                style={{ background: 'hsl(222 47% 18%)', color: 'hsl(43 74% 66%)' }}>
                Pay Fees to Unlock Access
              </Button>
            </Link>
          )}

          {/* Scenario B: paid but not enrolled → Join Class */}
          {hasPaidFees && !isEnrolled && (
            <Button
              className="w-full h-12 text-base font-semibold"
              size="lg"
              disabled={enrollMutation.isPending}
              onClick={() => enrollMutation.mutate()}
              style={{ background: 'hsl(222 47% 18%)', color: 'hsl(43 74% 66%)' }}
            >
              {enrollMutation.isPending ? (
                <><span className="animate-spin mr-2">⏳</span>Joining…</>
              ) : (
                <><BookOpen className="w-5 h-5 mr-2" />Join Class</>
              )}
            </Button>
          )}

          {/* Scenario C: enrolled → Start/Continue Learning */}
          {hasPaidFees && isEnrolled && (
            <Link
              to={`/lesson/${enrollment?.last_lesson_id || firstLesson.id}`}
            >
              <Button className="w-full h-12 text-base font-semibold" size="lg"
                style={{ background: 'hsl(222 47% 18%)', color: 'hsl(43 74% 66%)' }}>
                <PlayCircle className="w-5 h-5 mr-2" />
                {completedLessons.length > 0 ? 'Continue Learning' : 'Start Learning'}
              </Button>
            </Link>
          )}

          {/* My Classes shortcut */}
          {isEnrolled && (
            <Link to="/my-classes" className="block text-center text-xs text-muted-foreground hover:text-primary transition-colors">
              View all my classes →
            </Link>
          )}
        </div>
      )}

      {/* Share Buttons */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <h3 className="font-display font-semibold mb-3">Share This Course</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Invite friends using your referral link. They'll get registered under your code automatically!
        </p>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => handleCopy(shareLink)} className="flex-1 min-w-[140px]">
            {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
            {copied ? 'Copied!' : 'Copy Link'}
          </Button>
          <Button variant="outline" onClick={handleWhatsApp} className="flex-1 min-w-[140px] bg-green-500/10 text-green-600 hover:bg-green-500/20 border-green-500/20">
            <Share2 className="w-4 h-4 mr-2" />
            WhatsApp
          </Button>
          <Button variant="outline" onClick={handleShare} className="flex-1 min-w-[140px]">
            <Share2 className="w-4 h-4 mr-2" />
            Share
          </Button>
        </div>
        <div className="mt-4 p-3 bg-muted/50 rounded-xl">
          <p className="text-xs font-mono text-muted-foreground break-all">{shareLink}</p>
        </div>
      </div>
    </div>
    </>
  );
}