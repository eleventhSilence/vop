import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { HomePage } from '@/pages/public/HomePage';
import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import { DashboardPage } from '@/pages/account/DashboardPage';
import { MyCoursesPage } from '@/pages/account/MyCoursesPage';
import { ProfilePage } from '@/pages/account/ProfilePage';
import { ReviewEditPage } from '@/pages/account/ReviewEditPage';
import { AdminCourseDetailPage } from '@/pages/admin/AdminCourseDetailPage';
import { AdminCoursesPage } from '@/pages/admin/AdminCoursesPage';
import { AdminDashboardPage } from '@/pages/admin/AdminDashboardPage';
import { AdminQuestionDetailPage } from '@/pages/admin/AdminQuestionDetailPage';
import { AdminQuestionOptionsPage } from '@/pages/admin/AdminQuestionOptionsPage';
import { AdminReviewsPage } from '@/pages/admin/AdminReviewsPage';
import { AdminTestDetailPage } from '@/pages/admin/AdminTestDetailPage';
import { AdminTestQuestionsPage } from '@/pages/admin/AdminTestQuestionsPage';
import { AdminTestsPage } from '@/pages/admin/AdminTestsPage';
import { AdminUsersPage } from '@/pages/admin/AdminUsersPage';
import { CourseLearningPage } from '@/pages/learning/CourseLearningPage';
import { TestPage } from '@/pages/learning/TestPage';
import { NotFoundPage } from '@/pages/not-found/NotFoundPage';
import { CourseDetailPage } from '@/pages/public/CourseDetailPage';
import { CoursesListPage } from '@/pages/public/CoursesListPage';
import { MyReviewsPage } from '@/pages/reviews/MyReviewsPage';
import { AccountLayout } from '@/widgets/navigation/AccountLayout';
import { AdminLayout } from '@/widgets/navigation/AdminLayout';
import { AdminRoute, ProtectedRoute, PublicOnlyRoute } from '@/widgets/navigation/RouteGuards';
import { PublicLayout } from '@/widgets/navigation/PublicLayout';

export const AppRouter = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<HomePage />} />
          <Route path="courses" element={<CoursesListPage />} />
          <Route path="courses/:courseId" element={<CourseDetailPage />} />

          <Route element={<PublicOnlyRoute />}>
            <Route path="login" element={<LoginPage />} />
            <Route path="register" element={<RegisterPage />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route path="account" element={<AccountLayout />}>
            <Route index element={<Navigate to="profile" replace />} />
            <Route path="dashboard" element={<Navigate to="/account/profile" replace />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="courses" element={<MyCoursesPage />} />
            <Route path="courses/:courseId" element={<CourseLearningPage />} />
            <Route path="courses/:courseId/test" element={<TestPage />} />
            <Route path="reviews" element={<MyReviewsPage />} />
            <Route path="reviews/:reviewId/edit" element={<ReviewEditPage />} />
          </Route>
        </Route>

        <Route element={<AdminRoute />}>
          <Route path="admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboardPage />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="courses" element={<AdminCoursesPage />} />
            <Route path="courses/:courseId" element={<AdminCourseDetailPage />} />
            <Route path="tests" element={<AdminTestsPage />} />
            <Route path="tests/:testId" element={<AdminTestDetailPage />} />
            <Route path="tests/:testId/questions" element={<AdminTestQuestionsPage />} />
            <Route path="questions/:questionId" element={<AdminQuestionDetailPage />} />
            <Route path="questions/:questionId/options" element={<AdminQuestionOptionsPage />} />
            <Route path="reviews" element={<AdminReviewsPage />} />
            <Route path="reviews/pending" element={<AdminReviewsPage pendingOnly />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
};
