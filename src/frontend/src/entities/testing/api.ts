import { http } from '@/shared/api/http';
import type { ActiveAttemptResponse, CourseTestInfo, StartedAttempt, TestAttempt, TestAttemptDetail, TestSubmitResult } from '@/entities/testing/types';
import type { PaginatedResponse } from '@/shared/lib/pagination';
import type { AdminTest } from '@/entities/admin/types';

export const testingApi = {
  courseTest(courseId: string) {
    return http.get<CourseTestInfo>(`/testing/course/${courseId}/`).then((response) => response.data);
  },
  myCourseTest(courseId: string) {
    return http.get<CourseTestInfo>(`/testing/my/course/${courseId}/`).then((response) => response.data);
  },
  submit(testId: string, answers: unknown[], attemptId?: string) {
    return http.post<TestSubmitResult>(`/testing/${testId}/submit/`, { answers, attempt_id: attemptId }).then((response) => response.data);
  },
  startAttempt(testId: string) {
    return http.post<StartedAttempt>(`/testing/${testId}/attempts/start/`).then((response) => response.data);
  },
  activeAttempt(testId: string) {
    return http.get<ActiveAttemptResponse>(`/testing/${testId}/attempts/active/`).then((response) => response.data);
  },
  interruptAttempt(attemptId: string, answers: unknown[]) {
    return http.post<TestSubmitResult>(`/testing/attempts/${attemptId}/interrupt/`, { answers }).then((response) => response.data);
  },
  attempts(testId: string) {
    return http.get<PaginatedResponse<TestAttempt>>(`/testing/${testId}/attempts/`).then((response) => response.data);
  },
  attemptDetail(attemptId: string) {
    return http.get<TestAttemptDetail>(`/testing/attempts/${attemptId}/`).then((response) => response.data);
  },
  adminTests(params?: Record<string, string | number>) {
    return http.get<PaginatedResponse<AdminTest>>('/admin/tests/', { params }).then((response) => response.data);
  },
};
