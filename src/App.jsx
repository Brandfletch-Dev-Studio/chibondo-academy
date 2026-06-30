import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useOutletContext } from 'react-router-dom';

// Default theme is LIGHT. Only switch to dark if the user has explicitly chosen it.
// System preference is intentionally ignored — the app ships light by default.
if (typeof window !== 'undefined') {
  const saved = localStorage.getItem('theme');
  if (saved === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

function RoleHome() {
  const { user } = useOutletContext() ?? {};

  // Supabase sends password-reset links to site_url (homepage).
  // Detect the #type=recovery hash and silently forward to /reset-password.
  if (typeof window !== 'undefined') {
    const hash = window.location.hash.slice(1);
    const params = new URLSearchParams(hash);
    if (params.get('type') === 'recovery' && params.get('access_token')) {
      return <Navigate to={`/reset-password${window.location.hash}`} replace />;
    }
  }

  // If user is still loading (undefined), show nothing (AppLayout handles it)
  if (user === undefined) return null;
  // Guests → show the Landing Page
  if (!user) return <LandingPage />;
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
import VerifyOtp from '@/pages/VerifyOtp';

// Layout
import AppLayout from '@/components/layout/AppLayout';
import LandingPage from '@/pages/LandingPage';

import TutorProfilePage from '@/pages/tutors/TutorProfile';
import TutorsPage from '@/pages/tutors/TutorsPage';
import MyClassesPage from '@/pages/MyClassesPage';
import EnrollmentAnalytics from '@/pages/admin/EnrollmentAnalytics';
import ForumsHome from '@/pages/forums/ForumsHome';
import SubjectForum from '@/pages/forums/SubjectForum';
import ForumThread from '@/pages/forums/ThreadPage';

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
import LibraryPage from '@/pages/LibraryPage';
import DocumentViewer from '@/pages/DocumentViewer';
import EnrollSubjectsPage from '@/pages/EnrollSubjectsPage';
import AffiliateLayout from '@/pages/affiliate/AffiliateLayout';
import AffiliateDashboard from '@/pages/affiliate/AffiliateDashboard';
import AffiliateLinks from '@/pages/affiliate/AffiliateLinks';
import AffiliateReferrals from '@/pages/affiliate/AffiliateReferrals';
import AffiliateCommissions from '@/pages/affiliate/AffiliateCommissions';
import AffiliatePayouts from '@/pages/affiliate/AffiliatePayouts';
import AffiliateMaterials from '@/pages/affiliate/AffiliateMaterials';
import AffiliateProfile from '@/pages/affiliate/AffiliateProfile';
import BlogPage from '@/pages/BlogPage';
import BlogPostDetail from '@/pages/BlogPostDetail';
import LibraryManagement from '@/pages/admin/LibraryManagement';
import AdminBlog from '@/pages/admin/AdminBlog';

// Teacher pages
import TeacherDashboard from '@/pages/teacher/TeacherDashboard';
import TeacherCourses from '@/pages/teacher/TeacherCourses';
import CourseBuilder from '@/pages/teacher/CourseBuilder';
import QuizBuilder from '@/pages/teacher/QuizBuilder';
import AssignmentGrading from '@/pages/teacher/AssignmentGrading';
import TeacherLibrary from '@/pages/teacher/TeacherLibrary';
import TeacherAssignments from '@/pages/teacher/TeacherAssignments';
import MyTutorProfile from '@/pages/teacher/MyTutorProfile';

// Admin pages
import AdminDashboard from '@/pages/admin/AdminDashboard';
import UserManagement from '@/pages/admin/UserManagement';
import AdminSubscriptions from '@/pages/admin/AdminSubscriptions';
import AdminSettings from '@/pages/admin/AdminSettings';
import TeacherApplications from '@/pages/admin/TeacherApplications';
import StudentProgressTracker from '@/pages/teacher/StudentProgressTracker';
import AdminNotifications from '@/pages/admin/AdminNotifications';
import TeacherNotifications from '@/pages/teacher/TeacherNotifications';
import TeacherBlog from '@/pages/teacher/TeacherBlog';
import CurriculumManagement from '@/pages/admin/CurriculumManagement';
import AdminCourses from '@/pages/admin/AdminCourses';
import AffiliateManagement from '@/pages/admin/AffiliateManagement';
import TutorManagement from '@/pages/admin/TutorManagement';

// Settings pages
import StudentSettings from '@/pages/settings/StudentSettings';
import TeacherSettings from '@/pages/settings/TeacherSettings';

// RBAC
import RoleGuard from '@/components/RoleGuard';

// ── Loading screen shared between public + auth init ──────────────────────────
const LoadingScreen = () => (
  <div className="fixed inset-0 flex items-center justify-center" style={{ background: 'hsl(var(--background))' }}>
    <div className="text-center flex flex-col items-center gap-6">
      <img
        src="https://nckjjfxlmmsnmnexcgzg.supabase.co/storage/v1/object/public/assets/logo_square.jpg"
        alt="Chibondo Academy"
        className="w-32 h-32 rounded-2xl object-cover shadow-2xl"
        style={{ boxShadow: '0 0 60px rgba(184,144,55,0.3)' }}
      />
      <div>
        <p className="text-lg font-display tracking-widest uppercase" style={{ color: 'hsl(var(--primary))' }}>The Chibondo Academy</p>
        <div className="flex items-center justify-center gap-1.5 mt-3">
          {[0,1,2].map(i => (
            <div key={i} className="w-2 h-2 rounded-full" style={{ background: 'hsl(var(--primary))', animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
          ))}
        </div>
      </div>
    </div>
    <style>{`@keyframes bounce { 0%,80%,100%{transform:scale(0);opacity:0.3} 40%{transform:scale(1);opacity:1} }`}</style>
  </div>
);

const AppRoutes = () => {
  const { isLoadingPublicSettings, authError } = useAuth();

  // Only block rendering while the initial platform check runs
  // After that, AppLayout itself handles auth state gracefully
  if (isLoadingPublicSettings) return <LoadingScreen />;

  if (authError?.type === 'user_not_registered') return <UserNotRegisteredError />;

  return (
    <Routes>
      {/* ── Auth pages (standalone, no layout) ── */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/register/teacher" element={<TeacherRegister />} />
      <Route path="/verify-otp" element={<VerifyOtp />} />
      <Route path="/welcome" element={<LandingPage />} />

      {/* ═══════════════════════════════════════════════════════════════
          PUBLIC SHELL — AppLayout handles both guest + authenticated.
          All routes here are accessible without login.
          Pages are responsible for gating their own interactive actions.
      ════════════════════════════════════════════════════════════════ */}
      <Route element={<AppLayout />}>
        {/* Root redirect — role-based for auth users, blog for guests */}
        <Route path="/" element={<RoleHome />} />

        {/* ── PUBLIC BROWSE ROUTES ── */}
        <Route path="/blog" element={<BlogPage />} />
        <Route path="/blog/:slugOrId" element={<BlogPostDetail />} />
        <Route path="/subjects" element={<SubjectsPage />} />
        <Route path="/subjects/:subjectId" element={<SubjectDetail />} />
        <Route path="/tutors" element={<TutorsPage />} />
        <Route path="/tutors/:slug" element={<TutorProfilePage />} />
        <Route path="/forums" element={<ForumsHome />} />
        <Route path="/forums/:subjectSlug" element={<SubjectForum />} />
        <Route path="/forums/:subjectSlug/:threadSlug" element={<ForumThread />} />
        <Route path="/library" element={<LibraryPage />} />
        <Route path="/library/read/:resourceId" element={<DocumentViewer />} />
        <Route path="/subscription" element={<SubscriptionPage />} />
        <Route path="/lesson/:lessonId" element={<LessonPage />} />

        {/* ── AUTHENTICATED-ONLY ROUTES (redirect to login if guest) ── */}
        <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
          <Route path="/dashboard" element={<StudentDashboard />} />
          <Route path="/revision" element={<RevisionHub />} />
          <Route path="/my-quizzes" element={<MyQuizzes />} />
          <Route path="/quiz/:quizId" element={<QuizPage />} />
          <Route path="/my-assignments" element={<MyAssignments />} />
          <Route path="/discussions" element={<DiscussionsPage />} />
          <Route path="/progress" element={<ProgressPage />} />
          <Route path="/progress/analytics" element={<ProgressAnalytics />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/my-classes" element={<MyClassesPage />} />
          <Route path="/enroll-subjects" element={<EnrollSubjectsPage />} />

          {/* ── Affiliate Program ── */}
          <Route path="/affiliate" element={<AffiliateLayout />}>
            <Route index element={<AffiliateDashboard />} />
            <Route path="links" element={<AffiliateLinks />} />
            <Route path="referrals" element={<AffiliateReferrals />} />
            <Route path="commissions" element={<AffiliateCommissions />} />
            <Route path="payouts" element={<AffiliatePayouts />} />
            <Route path="materials" element={<AffiliateMaterials />} />
            <Route path="profile" element={<AffiliateProfile />} />
          </Route>


          <Route path="/settings" element={<StudentSettings />} />

          {/* Teacher */}
          <Route path="/teacher" element={<RoleGuard allowed={['teacher','admin']}><TeacherDashboard /></RoleGuard>} />
          <Route path="/teacher/courses" element={<RoleGuard allowed={['teacher','admin']}><TeacherCourses /></RoleGuard>} />
          <Route path="/teacher/courses/:subjectId" element={<RoleGuard allowed={['teacher','admin']}><CourseBuilder /></RoleGuard>} />
          <Route path="/teacher/quizzes" element={<RoleGuard allowed={['teacher','admin']}><QuizBuilder /></RoleGuard>} />
          <Route path="/teacher/assignments" element={<RoleGuard allowed={['teacher','admin']}><TeacherAssignments /></RoleGuard>} />
          <Route path="/teacher/library" element={<RoleGuard allowed={['teacher','admin']}><TeacherLibrary /></RoleGuard>} />
          <Route path="/teacher/grading" element={<RoleGuard allowed={['teacher','admin']}><AssignmentGrading /></RoleGuard>} />
          <Route path="/teacher/progress" element={<RoleGuard allowed={['teacher','admin']}><StudentProgressTracker /></RoleGuard>} />
          <Route path="/teacher/my-profile" element={<RoleGuard allowed={['teacher','admin']}><MyTutorProfile /></RoleGuard>} />
          <Route path="/teacher/settings" element={<RoleGuard allowed={['teacher']}><TeacherSettings /></RoleGuard>} />
          <Route path="/teacher/blog" element={<RoleGuard allowed={['teacher','admin']}><TeacherBlog /></RoleGuard>} />
          <Route path="/teacher/notifications" element={<RoleGuard allowed={['teacher','admin']}><TeacherNotifications /></RoleGuard>} />

          {/* Admin */}
          <Route path="/admin" element={<RoleGuard allowed={['admin']}><AdminDashboard /></RoleGuard>} />
          <Route path="/admin/users" element={<RoleGuard allowed={['admin']}><UserManagement /></RoleGuard>} />
          <Route path="/admin/teachers" element={<Navigate to="/admin/tutors" replace />} />
          <Route path="/admin/subscriptions" element={<RoleGuard allowed={['admin']}><AdminSubscriptions /></RoleGuard>} />
          <Route path="/admin/settings" element={<RoleGuard allowed={['admin']}><AdminSettings /></RoleGuard>} />
          <Route path="/admin/notifications" element={<RoleGuard allowed={['admin']}><AdminNotifications /></RoleGuard>} />
          <Route path="/admin/blog" element={<RoleGuard allowed={['admin']}><AdminBlog /></RoleGuard>} />
          <Route path="/admin/curriculum" element={<RoleGuard allowed={['admin']}><CurriculumManagement /></RoleGuard>} />
          <Route path="/admin/courses" element={<RoleGuard allowed={['admin']}><AdminCourses /></RoleGuard>} />
          <Route path="/admin/affiliates" element={<RoleGuard allowed={['admin']}><AffiliateManagement /></RoleGuard>} />
          <Route path="/admin/tutors" element={<RoleGuard allowed={['admin']}><TutorManagement /></RoleGuard>} />
          <Route path="/admin/library" element={<RoleGuard allowed={['admin']}><LibraryManagement /></RoleGuard>} />
          <Route path="/admin/enrollment-analytics" element={<RoleGuard allowed={['admin']}><EnrollmentAnalytics /></RoleGuard>} />
        </Route>
      </Route>

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

export default function App() {
  return (
    <QueryClientProvider client={queryClientInstance}>
      <AuthProvider>
        <Router>
          <AppRoutes />
          <Toaster />
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
}

