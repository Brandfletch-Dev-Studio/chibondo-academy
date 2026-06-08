import React from 'react';
import DiscussionThread from '@/components/discussion/DiscussionThread';

export default function LessonDiscussion({ lessonId, user, subjectId }) {
  // user may be null for guest visitors — pass null-safe values
  return (
    <DiscussionThread
      lessonId={lessonId}
      subjectId={subjectId}
      currentUserId={user?.id || null}
      currentUserRole={user?.role || 'student'}
    />
  );
}