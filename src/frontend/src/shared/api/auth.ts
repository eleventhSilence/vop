import { http } from '@/shared/api/http';
import type {
  ChangePasswordPayload,
  LoginPayload,
  LoginResponse,
  RegisterPayload,
  RegisterResponse,
  SessionUser,
  UpdateMePayload,
} from '@/entities/auth/types';
import type { AccountDashboard } from '@/features/auth/model/types';

export const authApi = {
  login(payload: LoginPayload) {
    return http.post<LoginResponse>('/auth/login/', payload).then((response) => response.data);
  },
  register(payload: RegisterPayload) {
    return http.post<RegisterResponse>('/auth/register/', payload).then((response) => response.data);
  },
  logout(refresh: string) {
    return http.post('/auth/logout/', { refresh }).then((response) => response.data);
  },
  me() {
    return http.get<SessionUser>('/account/me/').then((response) => response.data);
  },
  updateMe(payload: UpdateMePayload) {
    return http.patch<SessionUser>('/account/me/', payload).then((response) => response.data);
  },
  changePassword(payload: ChangePasswordPayload) {
    return http.post('/account/change-password/', payload).then((response) => response.data);
  },
  dashboard() {
    return http.get<AccountDashboard>('/account/dashboard/').then((response) => response.data);
  },
};
