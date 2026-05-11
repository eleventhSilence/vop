import { http } from '@/shared/api/http';
import type { PublicUserProfile } from '@/entities/user/types';

export const usersApi = {
  getPublicUserProfile(userId: string) {
    return http.get<PublicUserProfile>(`/public/users/${userId}/`).then((response) => response.data);
  },
};
