import { http } from '@/shared/api/http';
import type {
  AdminDashboard,
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
};
