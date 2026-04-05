import { http } from '@/shared/api/http';
import type {
  AdminDashboard,
  AdminTestQuestion,
  AdminTestQuestionCreatePayload,
  AdminTestQuestionUpdatePayload,
  AdminTestCreatePayload,
  AdminTest,
  AdminTestUpdatePayload,
  AdminUser,
  AdminUserDetail,
  AdminUserUpdatePayload,
} from '@/entities/admin/types';
import type { PaginatedResponse } from '@/shared/lib/pagination';

export const adminApi = {
  dashboard() {
    return http.get<AdminDashboard>('/admin/dashboard/').then((response) => response.data);
  },
  users(params?: Record<string, string | number>) {
    return http.get<PaginatedResponse<AdminUser>>('/admin/users/', { params }).then((response) => response.data);
  },
  userDetail(userId: string) {
    return http.get<AdminUserDetail>(`/admin/users/${userId}/`).then((response) => response.data);
  },
  updateUser(userId: string, payload: AdminUserUpdatePayload) {
    return http.patch<AdminUserDetail>(`/admin/users/${userId}/`, payload).then((response) => response.data);
  },
  testDetail(testId: string) {
    return http.get<AdminTest>(`/admin/tests/${testId}/`).then((response) => response.data);
  },
  updateTest(testId: string, payload: AdminTestUpdatePayload) {
    return http.patch<AdminTest>(`/admin/tests/${testId}/`, payload).then((response) => response.data);
  },
  deleteTest(testId: string) {
    return http.delete(`/admin/tests/${testId}/`);
  },
  createTest(payload: AdminTestCreatePayload) {
    return http.post<AdminTest>('/admin/tests/', payload).then((response) => response.data);
  },
  questions(params?: Record<string, string | number>) {
    return http.get<PaginatedResponse<AdminTestQuestion>>('/admin/questions/', { params }).then((response) => response.data);
  },
  createQuestion(payload: AdminTestQuestionCreatePayload) {
    return http.post<AdminTestQuestion>('/admin/questions/', payload).then((response) => response.data);
  },
  updateQuestion(questionId: string, payload: AdminTestQuestionUpdatePayload) {
    return http.patch<AdminTestQuestion>(`/admin/questions/${questionId}/`, payload).then((response) => response.data);
  },
  deleteQuestion(questionId: string) {
    return http.delete(`/admin/questions/${questionId}/`);
  },
};
