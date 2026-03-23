import { http } from '@/shared/api/http';
import type { CourseTestInfo, TestAttempt, TestSubmitResult } from '@/entities/testing/types';
import type { PaginatedResponse } from '@/shared/lib/pagination';
import type { AdminTest } from '@/entities/admin/types';

export const testingApi = {
  courseTest(courseId: string) {
    return http.get<CourseTestInfo>(`/testing/course/${courseId}/`).then((response) => response.data);
  },
  myCourseTest(courseId: string) {
    return http.get<CourseTestInfo>(`/testing/my/course/${courseId}/`).then((response) => response.data);
  },
  submit(testId: string, answers: unknown[]) {
    return http.post<TestSubmitResult>(`/testing/${testId}/submit/`, { answers }).then((response) => response.data);
  },
  attempts(testId: string) {
    return http.get<PaginatedResponse<TestAttempt>>(`/testing/${testId}/attempts/`).then((response) => response.data);
  },
  adminTests(params?: Record<string, string | number>) {
    return http.get<PaginatedResponse<AdminTest>>('/admin/tests/', { params }).then((response) => response.data);
  },
};
