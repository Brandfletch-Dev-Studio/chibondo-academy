/**
 * MyTutorProfile — redirects to Teacher Settings → Public Profile tab.
 *
 * The full public profile editor was merged into TeacherSettings
 * under the "Public Profile" tab for a unified settings experience.
 * This file is kept so any bookmarks or internal links don't 404.
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function MyTutorProfile() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate('/teacher/settings?tab=public-profile', { replace: true });
  }, []);
  return null;
}
