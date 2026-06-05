import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import WelcomeCard from '@/components/dashboard/WelcomeCard';
import StatsGrid from '@/components/dashboard/StatsGrid';
import RecentSubjects from '@/components/dashboard/RecentSubjects';
import UpcomingItems from '@/components/dashboard/UpcomingItems';

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
    enabled: true,
  });

  const completedCount = enrollments.reduce((acc, e) => acc + (e.completed_lessons?.length || 0), 0);

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
      <div className="grid lg:grid-cols-2 gap-6">
        <RecentSubjects enrollments={enrollments} />
        <UpcomingItems assignments={assignments} />
      </div>
    </div>
  );
}