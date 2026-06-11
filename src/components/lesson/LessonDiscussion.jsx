import React from 'react';
import DiscussionThread from '@/components/discussion/DiscussionThread';

export default function LessonDiscussion({ lessonId, lessonTitle, lessonUrl, user, subjectId }) {
  return (
    <DiscussionThread
      lessonId={lessonId}
      lessonTitle={lessonTitle}
      lessonUrl={lessonUrl}
      subjectId={subjectId}
      currentUserId={user?.id || null}
      currentUserName={user?.full_name || user?.email || null}
      currentUserAvatar={user?.avatar_url || null}
      currentUserRole={user?.role || 'student'}
    />
  );
}
