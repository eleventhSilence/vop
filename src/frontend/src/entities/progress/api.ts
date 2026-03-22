import { http } from '@/shared/api/http';
import type { CourseProgress, CourseProgressDetail } from '@/entities/progress/types';
import type { PaginatedResponse } from '@/shared/lib/pagination';

export const progressApi = {
  myProgress() {
    return http.get<PaginatedResponse<CourseProgress>>('/progress/my/').then((response) => response.data);
  },
  courseProgress(courseId: string) {
    return http.get<CourseProgressDetail>(`/progress/course/${courseId}/`).then((response) => response.data);
  },
  completeTheory(courseId: string) {
    return http.post(`/progress/course/${courseId}/complete-theory/`).then((response) => response.data);
  },
};
