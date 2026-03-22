import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/widgets/navigation/AppShell';
import { AdminRoute, ProtectedRoute, PublicOnlyRoute } from '@/widgets/navigation/RouteGuards';
import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import { CoursesListPage } from '@/pages/public/CoursesListPage';
import { CourseDetailPage } from '@/pages/public/CourseDetailPage';
import { DashboardPage } from '@/pages/account/DashboardPage';
import { ProfilePage } from '@/pages/account/ProfilePage';
import { MyCoursesPage } from '@/pages/account/MyCoursesPage';
import { CourseLearningPage } from '@/pages/learning/CourseLearningPage';
import { TestPage } from '@/pages/learning/TestPage';
import { MyReviewsPage } from '@/pages/reviews/MyReviewsPage';
import { AdminDashboardPage } from '@/pages/admin/AdminDashboardPage';
import { AdminUsersPage } from '@/pages/admin/AdminUsersPage';
import { AdminCoursesPage } from '@/pages/admin/AdminCoursesPage';
import { AdminTestsPage } from '@/pages/admin/AdminTestsPage';
import { AdminReviewsPage } from '@/pages/admin/AdminReviewsPage';
import { NotFoundPage } from '@/pages/not-found/NotFoundPage';

export const AppRouter = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/courses" replace />} />
          <Route path="courses" element={<CoursesListPage />} />
          <Route path="courses/:courseId" element={<CourseDetailPage />} />

          <Route element={<PublicOnlyRoute />}>
            <Route path="login" element={<LoginPage />} />
            <Route path="register" element={<RegisterPage />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="account/dashboard" element={<DashboardPage />} />
            <Route path="account/profile" element={<ProfilePage />} />
            <Route path="my-courses" element={<MyCoursesPage />} />
            <Route path="learning/:courseId" element={<CourseLearningPage />} />
            <Route path="tests/:courseId" element={<TestPage />} />
            <Route path="reviews/my" element={<MyReviewsPage />} />
          </Route>

          <Route element={<AdminRoute />}>
            <Route path="admin/dashboard" element={<AdminDashboardPage />} />
            <Route path="admin/users" element={<AdminUsersPage />} />
            <Route path="admin/courses" element={<AdminCoursesPage />} />
            <Route path="admin/tests" element={<AdminTestsPage />} />
            <Route path="admin/reviews" element={<AdminReviewsPage />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};
