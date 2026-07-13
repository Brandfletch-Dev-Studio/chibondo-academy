import { lazy, Suspense } from 'react';
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ProtectedRoute from '@/components/ProtectedRoute';
import AppLayout from '@/components/layout/AppLayout';
import RoleGuard from '@/components/RoleGuard';
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

// ── Lazy-loaded pages (code splitting) ─────────────────────────────────
const Login = lazy(() => import('@/pages/Login'));
const Register = lazy(() => import('@/pages/Register'));
const ForgotPassword = lazy(() => import('@/pages/ForgotPassword'));
const ResetPassword = lazy(() => import('@/pages/ResetPassword'));
const TeacherRegister = lazy(() => import('@/pages/TeacherRegister'));
const VerifyOtp = lazy(() => import('@/pages/VerifyOtp'));
const LandingPage = lazy(() => import('@/pages/LandingPage'));
const TutorProfilePage = lazy(() => import('@/pages/tutors/TutorProfile'));
const TutorsPage = lazy(() => import('@/pages/tutors/TutorsPage'));
const MyClassesPage = lazy(() => import('@/pages/MyClassesPage'));
const EnrollmentAnalytics = lazy(() => import('@/pages/admin/EnrollmentAnalytics'));
const ForumsHome = lazy(() => import('@/pages/forums/ForumsHome'));
const SubjectForum = lazy(() => import('@/pages/forums/SubjectForum'));
const ForumThread = lazy(() => import('@/pages/forums/ThreadPage'));
const StudentDashboard = lazy(() => import('@/pages/StudentDashboard'));
const SubjectsPage = lazy(() => import('@/pages/SubjectsPage'));
const SubjectDetail = lazy(() => import('@/pages/SubjectDetail'));
const LessonPage = lazy(() => import('@/pages/LessonPage'));
const RevisionHub = lazy(() => import('@/pages/RevisionHub'));
const MyQuizzes = lazy(() => import('@/pages/MyQuizzes'));
const QuizPage = lazy(() => import('@/pages/QuizPage'));
const MyAssignments = lazy(() => import('@/pages/MyAssignments'));
const DiscussionsPage = lazy(() => import('@/pages/DiscussionsPage'));
const ProgressPage = lazy(() => import('@/pages/ProgressPage'));
const ProgressAnalytics = lazy(() => import('@/pages/ProgressAnalytics'));
const SubscriptionPage = lazy(() => import('@/pages/SubscriptionPage'));
const NotificationsPage = lazy(() => import('@/pages/NotificationsPage'));
const LibraryPage = lazy(() => import('@/pages/LibraryPage'));
const DocumentViewer = lazy(() => import('@/pages/DocumentViewer'));
const EnrollSubjectsPage = lazy(() => import('@/pages/EnrollSubjectsPage'));
const AffiliateLayout = lazy(() => import('@/pages/affiliate/AffiliateLayout'));
const AffiliateDashboard = lazy(() => import('@/pages/affiliate/AffiliateDashboard'));
const AffiliateLinks = lazy(() => import('@/pages/affiliate/AffiliateLinks'));
const AffiliateReferrals = lazy(() => import('@/pages/affiliate/AffiliateReferrals'));
const AffiliateCommissions = lazy(() => import('@/pages/affiliate/AffiliateCommissions'));
const AffiliatePayouts = lazy(() => import('@/pages/affiliate/AffiliatePayouts'));
const AffiliateMaterials = lazy(() => import('@/pages/affiliate/AffiliateMaterials'));
const AffiliateProfile = lazy(() => import('@/pages/affiliate/AffiliateProfile'));
const BlogPage = lazy(() => import('@/pages/BlogPage'));
const BlogPostDetail = lazy(() => import('@/pages/BlogPostDetail'));
const LibraryManagement = lazy(() => import('@/pages/admin/LibraryManagement'));
const AdminBlog = lazy(() => import('@/pages/admin/AdminBlog'));
const TeacherDashboard = lazy(() => import('@/pages/teacher/TeacherDashboard'));
const TeacherCourses = lazy(() => import('@/pages/teacher/TeacherCourses'));
const CourseBuilder = lazy(() => import('@/pages/teacher/CourseBuilder'));
const QuizBuilder = lazy(() => import('@/pages/teacher/QuizBuilder'));
const AssignmentGrading = lazy(() => import('@/pages/teacher/AssignmentGrading'));
const TeacherLibrary = lazy(() => import('@/pages/teacher/TeacherLibrary'));
const TeacherAssignments = lazy(() => import('@/pages/teacher/TeacherAssignments'));
const AdminDashboard = lazy(() => import('@/pages/admin/AdminDashboard'));
const UserManagement = lazy(() => import('@/pages/admin/UserManagement'));
const AdminSubscriptions = lazy(() => import('@/pages/admin/AdminSubscriptions'));
const AdminSettings = lazy(() => import('@/pages/admin/AdminSettings'));
const TeacherApplications = lazy(() => import('@/pages/admin/TeacherApplications'));
const StudentProgressTracker = lazy(() => import('@/pages/teacher/StudentProgressTracker'));
const AdminNotifications = lazy(() => import('@/pages/admin/AdminNotifications'));
const TeacherNotifications = lazy(() => import('@/pages/teacher/TeacherNotifications'));
const TeacherBlog = lazy(() => import('@/pages/teacher/TeacherBlog'));
const CurriculumManagement = lazy(() => import('@/pages/admin/CurriculumManagement'));
const AdminCourses = lazy(() => import('@/pages/admin/AdminCourses'));
const AffiliateManagement = lazy(() => import('@/pages/admin/AffiliateManagement'));
const TutorManagement = lazy(() => import('@/pages/admin/TutorManagement'));
const StudentSettings = lazy(() => import('@/pages/settings/StudentSettings'));
const TeacherSettings = lazy(() => import('@/pages/settings/TeacherSettings'));

const AppRoutes = () => {
  const { authError } = useAuth();

  // Public settings load in the background — never block page rendering on them.
  if (authError?.type === 'user_not_registered') return <UserNotRegisteredError />;

  return (
    <Suspense fallback={
    <div style={{position:'fixed',inset:0,background:'linear-gradient(135deg,#1e2d5c 0%,#0d1b3e 100%)',zIndex:999}} />
  }>
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
            </Suspense>
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

