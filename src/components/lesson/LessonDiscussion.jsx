import React from 'react';
import LessonComments from '@/components/lesson/LessonComments';

export default function LessonDiscussion({ lessonId, lessonTitle, lessonUrl, user, subjectId }) {
  return (
    <LessonComments
      lessonId={lessonId}
      lessonTitle={lessonTitle}
      lessonUrl={lessonUrl}
      subjectId={subjectId}
      user={user}
    />
  );
}
