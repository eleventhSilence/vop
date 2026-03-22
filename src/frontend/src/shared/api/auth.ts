import { http } from '@/shared/api/http';
import type {
  LoginPayload,
  LoginResponse,
  RegisterPayload,
  RegisterResponse,
  SessionUser,
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
  dashboard() {
    return http.get<AccountDashboard>('/account/dashboard/').then((response) => response.data);
  },
};
