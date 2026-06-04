import React from 'react';
import DiscussionThread from '@/components/discussion/DiscussionThread';

export default function LessonDiscussion({ lessonId, user, subjectId }) {
  return (
    <DiscussionThread
      lessonId={lessonId}
      subjectId={subjectId}
      currentUserId={user.id}
      currentUserRole={user.role || 'student'}
    />
  );
}