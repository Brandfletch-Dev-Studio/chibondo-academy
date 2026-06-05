import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useOutletContext } from 'react-router-dom';

function RoleHome() {
  const { user } = useOutletContext();
  if (!user) return null;
  if (user.role === 'admin') return <Navigate to="/admin" replace />;
  if (user.role === 'teacher') return <Navigate to="/teacher" replace />;
  return <Navigate to="/dashboard" replace />;
}

// Auth pages
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import TeacherRegister from '@/pages/TeacherRegister';

// Layout
import AppLayout from '@/components/layout/AppLayout';

// Student pages
import StudentDashboard from '@/pages/StudentDashboard';
import SubjectsPage from '@/pages/SubjectsPage';
import SubjectDetail from '@/pages/SubjectDetail';
import LessonPage from '@/pages/LessonPage';
import RevisionHub from '@/pages/RevisionHub';
import MyQuizzes from '@/pages/MyQuizzes';
import QuizPage from '@/pages/QuizPage';
import MyAssignments from '@/pages/MyAssignments';
import DiscussionsPage from '@/pages/DiscussionsPage';
import ProgressPage from '@/pages/ProgressPage';
import ProgressAnalytics from '@/pages/ProgressAnalytics';
import SubscriptionPage from '@/pages/SubscriptionPage';
import NotificationsPage from '@/pages/NotificationsPage';
import ReferralsPage from '@/pages/ReferralsPage';
import LibraryPage from '@/pages/LibraryPage';
import MyAffiliates from '@/pages/MyAffiliates';

// Teacher pages
import TeacherDashboard from '@/pages/teacher/TeacherDashboard';
import TeacherCourses from '@/pages/teacher/TeacherCourses';
import CourseBuilder from '@/pages/teacher/CourseBuilder';
import QuizBuilder from '@/pages/teacher/QuizBuilder';
import AssignmentGrading from '@/pages/teacher/AssignmentGrading';
import TeacherLibrary from '@/pages/teacher/TeacherLibrary';
import TeacherAssignments from '@/pages/teacher/TeacherAssignments';

// Admin pages
import AdminDashboard from '@/pages/admin/AdminDashboard';
import UserManagement from '@/pages/admin/UserManagement';
import AdminSubscriptions from '@/pages/admin/AdminSubscriptions';
import AdminSettings from '@/pages/admin/AdminSettings';
import TeacherApplications from '@/pages/admin/TeacherApplications';
import StudentProgressTracker from '@/pages/teacher/StudentProgressTracker';
import AdminNotifications from '@/pages/admin/AdminNotifications';
import TeacherNotifications from '@/pages/teacher/TeacherNotifications';
import CurriculumManagement from '@/pages/admin/CurriculumManagement';
import AffiliateManagement from '@/pages/admin/AffiliateManagement';

// Settings pages
import StudentSettings from '@/pages/settings/StudentSettings';
import TeacherSettings from '@/pages/settings/TeacherSettings';

// RBAC
import RoleGuard from '@/components/RoleGuard';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: 'hsl(222 47% 8%)' }}>
        <div className="text-center flex flex-col items-center gap-6">
          <img
            src="https://media.base44.com/images/public/6a212896f8e71114ad51c36f/3fd7d6af7_FB_IMG_1780187860438.jpg"
            alt="Chibondo Academy"
            className="w-32 h-32 rounded-2xl object-cover shadow-2xl"
            style={{ boxShadow: '0 0 60px rgba(184,144,55,0.3)' }}
          />
          <div>
            <p className="text-lg font-display tracking-widest uppercase" style={{ color: 'hsl(43 74% 52%)' }}>The Chibondo Academy</p>
            <div className="flex items-center justify-center gap-1.5 mt-3">
              {[0,1,2].map(i => (
                <div key={i} className="w-2 h-2 rounded-full" style={{ background: 'hsl(43 74% 52%)', animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
              ))}
            </div>
          </div>
        </div>
        <style>{`@keyframes bounce { 0%,80%,100%{transform:scale(0);opacity:0.3} 40%{transform:scale(1);opacity:1} }`}</style>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Routes>
      {/* Auth Routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/register/teacher" element={<TeacherRegister />} />

      {/* Protected Routes */}
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<AppLayout />}>
          {/* Role-based home redirect */}
          <Route path="/" element={<RoleHome />} />
          {/* Student */}
          <Route path="/dashboard" element={<StudentDashboard />} />
          <Route path="/subjects" element={<SubjectsPage />} />
          <Route path="/subjects/:subjectId" element={<SubjectDetail />} />
          <Route path="/lesson/:lessonId" element={<LessonPage />} />
          <Route path="/revision" element={<RevisionHub />} />
          <Route path="/my-quizzes" element={<MyQuizzes />} />
          <Route path="/quiz/:quizId" element={<QuizPage />} />
          <Route path="/my-assignments" element={<MyAssignments />} />
          <Route path="/discussions" element={<DiscussionsPage />} />
          <Route path="/progress" element={<ProgressPage />} />
          <Route path="/progress/analytics" element={<ProgressAnalytics />} />
          <Route path="/subscription" element={<SubscriptionPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/referrals" element={<ReferralsPage />} />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/my-affiliates" element={<MyAffiliates />} />

          {/* Student Settings */}
          <Route path="/settings" element={<StudentSettings />} />

          {/* Teacher */}
          <Route path="/teacher" element={<RoleGuard allowed={['teacher', 'admin']}><TeacherDashboard /></RoleGuard>} />
          <Route path="/teacher/courses" element={<RoleGuard allowed={['teacher', 'admin']}><TeacherCourses /></RoleGuard>} />
          <Route path="/teacher/courses/:subjectId" element={<RoleGuard allowed={['teacher', 'admin']}><CourseBuilder /></RoleGuard>} />
          <Route path="/teacher/quizzes" element={<RoleGuard allowed={['teacher', 'admin']}><QuizBuilder /></RoleGuard>} />
          <Route path="/teacher/assignments" element={<RoleGuard allowed={['teacher', 'admin']}><TeacherAssignments /></RoleGuard>} />
          <Route path="/teacher/library" element={<RoleGuard allowed={['teacher', 'admin']}><TeacherLibrary /></RoleGuard>} />
          <Route path="/teacher/grading" element={<RoleGuard allowed={['teacher', 'admin']}><AssignmentGrading /></RoleGuard>} />
          <Route path="/teacher/progress" element={<RoleGuard allowed={['teacher', 'admin']}><StudentProgressTracker /></RoleGuard>} />
          <Route path="/teacher/settings" element={<RoleGuard allowed={['teacher']}><TeacherSettings /></RoleGuard>} />
          <Route path="/teacher/notifications" element={<RoleGuard allowed={['teacher', 'admin']}><TeacherNotifications /></RoleGuard>} />

          {/* Admin */}
          <Route path="/admin" element={<RoleGuard allowed={['admin']}><AdminDashboard /></RoleGuard>} />

          <Route path="/admin/users" element={<RoleGuard allowed={['admin']}><UserManagement /></RoleGuard>} />
          <Route path="/admin/teachers" element={<RoleGuard allowed={['admin']}><TeacherApplications /></RoleGuard>} />
          <Route path="/admin/subscriptions" element={<RoleGuard allowed={['admin']}><AdminSubscriptions /></RoleGuard>} />
          <Route path="/admin/settings" element={<RoleGuard allowed={['admin']}><AdminSettings /></RoleGuard>} />
          <Route path="/admin/notifications" element={<RoleGuard allowed={['admin']}><AdminNotifications /></RoleGuard>} />
          <Route path="/admin/curriculum" element={<RoleGuard allowed={['admin']}><CurriculumManagement /></RoleGuard>} />
          <Route path="/admin/affiliates" element={<RoleGuard allowed={['admin']}><AffiliateManagement /></RoleGuard>} />
          <Route path="/admin/library" element={<RoleGuard allowed={['admin']}><TeacherLibrary /></RoleGuard>} />
        </Route>
      </Route>

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App