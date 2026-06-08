import React from 'react';
import { useOutletContext, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import WelcomeCard from '@/components/dashboard/WelcomeCard';
import StatsGrid from '@/components/dashboard/StatsGrid';
import RecentSubjects from '@/components/dashboard/RecentSubjects';
import UpcomingItems from '@/components/dashboard/UpcomingItems';
import { Progress } from '@/components/ui/progress';
import { PlayCircle, BookOpen, ArrowRight, Trophy, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

function MiniClassCard({ enrollment }) {
  const navigate = useNavigate();
  const pct     = enrollment.progress_percentage || 0;
  const resumeId = enrollment.last_lesson_id;
  const ago      = enrollment.last_accessed
    ? formatDistanceToNow(new Date(enrollment.last_accessed), { addSuffix: true })
    : null;

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors group">
      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
        {pct === 100
          ? <Trophy className="w-5 h-5 text-accent" />
          : <BookOpen className="w-4 h-4 text-primary" />
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
          {enrollment.subject_name}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <Progress value={pct} className="h-1.5 flex-1" />
          <span className="text-[10px] font-bold text-primary flex-shrink-0">{pct}%</span>
        </div>
        {ago && (
          <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
            <Clock className="w-2.5 h-2.5" />{ago}
          </p>
        )}
      </div>
      <button
        onClick={() => navigate(resumeId ? `/lesson/${resumeId}` : `/subjects/${enrollment.subject_id}`)}
        className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors"
        style={{ background:'hsl(222 47% 18%)' }}
      >
        <PlayCircle className="w-4 h-4" style={{ color:'hsl(43 74% 66%)' }} />
      </button>
    </div>
  );
}

export default function StudentDashboard() {
  const { user } = useOutletContext();
  const userId = user?.id;

  const { data: enrollments = [] } = useQuery({
    queryKey: ['enrollments', userId],
    queryFn: () => base44.entities.Enrollment.filter({ student_id: userId }, '-last_accessed', 20),
    enabled: !!userId,
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ['upcomingAssignments'],
    queryFn: () => base44.entities.Assignment.filter({ status: 'published' }, '-created_date', 5),
  });

  const completedCount = enrollments.filter(e =>
    (e.progress_percentage || 0) === 100 || e.status === 'completed'
  ).length;

  const inProgressEnrollments = enrollments
    .filter(e => (e.progress_percentage || 0) > 0 && (e.progress_percentage || 0) < 100)
    .slice(0, 3);

  const recentEnrollments = enrollments
    .filter(e => !((e.progress_percentage || 0) > 0 && (e.progress_percentage || 0) < 100))
    .slice(0, 3 - inProgressEnrollments.length);

  const displayEnrollments = [...inProgressEnrollments, ...recentEnrollments].slice(0, 3);

  const statsData = {
    enrolled: enrollments.length,
    hours: user?.total_learning_hours || 0,
    completed: completedCount,
    streak: user?.study_streak || 0,
  };

  return (
    <div className="space-y-6">
      <WelcomeCard user={user} />
      <StatsGrid data={statsData} />

      {/* My Classes section */}
      {enrollments.length > 0 && (
        <div className="bg-card rounded-2xl border border-border p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display font-semibold text-base flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-accent" /> My Classes
            </h3>
            <Link to="/my-classes" className="text-xs font-medium text-primary flex items-center gap-1 hover:underline">
              View All <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-1">
            {displayEnrollments.map(e => <MiniClassCard key={e.id} enrollment={e} />)}
          </div>
          {enrollments.length > 3 && (
            <Link to="/my-classes"
              className="block mt-3 text-center text-xs text-muted-foreground hover:text-primary transition-colors">
              +{enrollments.length - 3} more classes →
            </Link>
          )}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <RecentSubjects enrollments={enrollments} />
        <UpcomingItems assignments={assignments} />
      </div>
    </div>
  );
}
