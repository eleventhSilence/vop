import { http } from '@/shared/api/http';
import type { AdminDashboard, AdminUser, AdminUserDetail, AdminUserUpdatePayload } from '@/entities/admin/types';
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
};
